// Command sdlc-api is the sdlc.cc compliance LLM gateway binary.
// Wraps github.com/finsavvyai/sdlc-core in HTTP layer for B2B
// customers — banks, healthcare, gov contractors who need DLP +
// audit + multi-provider routing in front of Claude.
//
// Endpoints:
//   POST /v1/messages   Anthropic-compat drop-in (DLP-scrubbed)
//   GET  /health         liveness (always 200 if process is up)
//   GET  /ready          readiness (200 when at least one provider configured)
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/finsavvyai/sdlc-core/ai"
	"github.com/finsavvyai/sdlc-core/audit"
	"github.com/finsavvyai/sdlc-core/quota"

	"github.com/finsavvyai/sdlc-cc/internal/auth"
	sdlchttp "github.com/finsavvyai/sdlc-cc/internal/http"
	"github.com/finsavvyai/sdlc-cc/internal/metrics"
	"github.com/finsavvyai/sdlc-cc/internal/tenant"
)

func main() {
	port := envOrDefault("PORT", "8080")
	chain := buildProviderChain()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"status":"healthy"}`))
	})
	mux.HandleFunc("GET /ready", func(w http.ResponseWriter, _ *http.Request) {
		if chain.IsConfigured() {
			_, _ = w.Write([]byte(`{"ready":true}`))
			return
		}
		http.Error(w, `{"ready":false,"reason":"no provider configured"}`,
			http.StatusServiceUnavailable)
	})
	// Single shared audit repo: HandleMessages writes, AuditUsageHandler
	// reads. DATABASE_URL → Postgres (durable); unset → in-memory
	// (dev / smoke tests; rows lost on restart).
	pool := connectPostgres()
	var auditRepo audit.Repository = audit.NewInMemoryRepository()
	if pool != nil {
		auditRepo = audit.NewPgRepository(pool)
		log.Printf("sdlc-api: audit repo = postgres")
	} else {
		log.Printf("sdlc-api: audit repo = in-memory (DATABASE_URL unset)")
	}

	// Quota enforcer: nil when AEGIS_AI_DAILY_CAP/_PER_SEAT both unset.
	// Pre-call gate + post-success counter. Multi-replica deploys will
	// undercount until we swap to a Redis-backed enforcer.
	enforcer := quota.NewAIQuotaEnforcer()
	if enforcer != nil {
		log.Printf("sdlc-api: quota enforcer = enabled")
	}

	// Prometheus text-format metrics. Always on — the registry is
	// in-memory + atomic so there's no reason to gate it.
	metricsReg := metrics.NewRegistry()
	mux.Handle("GET /metrics", metrics.Handler(metricsReg))

	mux.Handle("POST /v1/messages", sdlchttp.HandleMessages(chain, auditRepo, enforcer, metricsReg))
	mux.Handle("POST /v1/dlp/scrub", sdlchttp.HandleDLPScrub(auditRepo, metricsReg))

	// Admin / governance endpoint for the TenantIQ console (and any
	// internal dashboard) to read aggregated AI usage. Requires
	// SDLC_ADMIN_BEARER; unset = endpoint refuses every request.
	mux.Handle("GET /v1/audit/usage", sdlchttp.AuditUsageHandler(auditRepo))

	// Transparent-proxy mode: when TRANSPARENT_PROXY_HOSTS is set
	// (e.g. "api.anthropic.com"), the gateway accepts requests on
	// those hostnames too — corp DNS routes them here, corp CA
	// signs the cert. /v1/messages applies DLP; other Anthropic
	// paths transparent-forward to the real upstream.
	upstream := &http.Client{Timeout: 60 * time.Second}
	anthropicHandler := sdlchttp.HandleAnthropicHostMux(chain, upstream)

	// CIDR-based tenant resolution: pgx loader when Postgres is
	// configured; else nil resolver (passthrough — no tenant_id
	// attribution, audit rows go in unattributed).
	var resolver tenant.Resolver
	if pool != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		loader, err := tenant.NewPgLoader(ctx, pool)
		cancel()
		if err != nil {
			log.Printf("sdlc-api: tenant_network_map load failed; resolver disabled: %v", err)
		} else {
			loader.Start(context.Background(), 60*time.Second)
			resolver = loader
			log.Printf("sdlc-api: tenant resolver = pg_loader (60s refresh)")
		}
	}
	// API-key gate: sk_sdlc_* tokens win over CIDR resolution. nil
	// verifier (no Postgres) skips the gate entirely so dev still
	// boots. Wrapped on the outside so both direct + transparent
	// paths share one gate.
	var verifier sdlchttp.Verifier
	if pool != nil {
		verifier = auth.NewStore(pool)
		log.Printf("sdlc-api: api-key gate = enabled (Bearer sk_sdlc_*)")
	}

	withTenant := sdlchttp.WithTenantResolver(resolver, anthropicHandler)
	hostMux := sdlchttp.NewHostAwareMux(mux, withTenant)
	handler := sdlchttp.WithAPIKeys(verifier, hostMux)

	addr := fmt.Sprintf(":%s", port)
	log.Printf("sdlc-api: listening on %s (provider chain configured=%v)",
		addr, chain.IsConfigured())
	srv := &http.Server{Addr: addr, Handler: handler,
		ReadHeaderTimeout: 10 * time.Second}
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("sdlc-api: %v", err)
	}
}

// buildProviderChain assembles the production fallback chain.
// Anthropic primary; Bedrock optional fallback when AWS_BEDROCK_REGION
// is set. Each link wraps in retry. FallbackChain auto-filters
// unconfigured links so a deploy with only ANTHROPIC_API_KEY still
// produces a single-provider chain.
func buildProviderChain() ai.Provider {
	withRetry := func(p ai.Provider) ai.Provider {
		if p == nil {
			return nil
		}
		return ai.NewRetryProvider(p, 3, 250*time.Millisecond)
	}
	return ai.NewFallbackChain(
		withRetry(ai.NewAnthropicClient()),
		withRetry(ai.NewBedrockClient()),
	)
}

// connectPostgres dials DATABASE_URL when set. Returns nil when the
// env is unset so the binary still boots in dev/smoke without a DB.
// A connect failure is fatal in prod (better to crashloop than serve
// silently without audit) but caller decides — we just log + return
// nil so the operator gets an obvious "audit disabled" line.
func connectPostgres() *pgxpool.Pool {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		log.Printf("sdlc-api: pgxpool.New failed (audit disabled): %v", err)
		return nil
	}
	if err := pool.Ping(ctx); err != nil {
		log.Printf("sdlc-api: postgres ping failed (audit disabled): %v", err)
		pool.Close()
		return nil
	}
	return pool
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
