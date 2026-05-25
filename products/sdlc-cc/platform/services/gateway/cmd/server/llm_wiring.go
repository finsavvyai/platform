// LLM + spend wiring kept in its own file so wiring.go stays focused
// on the security suite. BEAT-PLAN S1.2 / INTEGRATION-DEBT Days 28-29
// + 49: real Anthropic adapter + spend Tracker + 402 hard-cap gate.

package main

import (
	"context"
	"net/http"
	"os"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/stdlib"

	llmhandler "github.com/sdlc-ai/platform/services/gateway/internal/app/handlers/llm"
	"github.com/sdlc-ai/platform/services/gateway/internal/domain/routing"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/database"
	infllm "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/llm"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/record"
	infspend "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/spend"
	httpmw "github.com/sdlc-ai/platform/services/gateway/internal/interfaces/http/middleware"
)

// LLMSuite groups the spend trio + the active provider. Owned by
// Application; Close stops the spend Tracker drain goroutine.
type LLMSuite struct {
	Provider infllm.Provider
	Tracker  *infspend.Tracker
	Usage    *infspend.UsageReader
	Limits   *infspend.LimitRepo
	// Recorder writes to session_recordings when wired (DB available).
	Recorder record.Recorder
}

// Close drains the spend tracker buffer.
func (l *LLMSuite) Close() {
	if l == nil {
		return
	}
	if l.Tracker != nil {
		l.Tracker.Close()
	}
}

// initLLMSuite builds the LLM provider + spend trio. Provider is nil
// when no vendor key is set (dev) so the chat handler returns a
// helpful 502 rather than blowing up at boot.
//
// Day-49 fallback chain: when more than one vendor is configured, we
// wrap the adapters in a FallbackChain so transient (5xx, network,
// timeout) failures advance to the next provider in priority order.
// Primary is whichever adapter shows up first in the env-var sweep
// below; secondaries are the remaining adapters in declaration order.
func initLLMSuite(_ context.Context, db *database.Database) *LLMSuite {
	suite := &LLMSuite{}

	var providers []infllm.Provider
	var names []string

	// ClawPipe lands first when configured: it routes to 21 upstream
	// providers with semantic cache + cost optimization. Direct adapters
	// (Anthropic, OpenAI, etc.) become fallbacks for ClawPipe outages so
	// the compliance boundary (SDLC) never depends solely on one path.
	// Bucket E of NEXT-SESSION-PLAN.md.
	if key := os.Getenv("CLAWPIPE_API_KEY"); key != "" {
		providers = append(providers, infllm.NewClawPipe(
			key,
			os.Getenv("CLAWPIPE_PROJECT_ID"),
			firstNonEmpty(os.Getenv("CLAWPIPE_BASE_URL"), "https://api.clawpipe.ai"),
		))
		names = append(names, "clawpipe")
	}

	if key := os.Getenv("ANTHROPIC_API_KEY"); key != "" {
		providers = append(providers, infllm.NewAnthropic(key, os.Getenv("ANTHROPIC_BASE_URL")))
		names = append(names, "anthropic")
	}
	if key := os.Getenv("OPENAI_API_KEY"); key != "" {
		providers = append(providers, infllm.NewOpenAI(key, os.Getenv("OPENAI_BASE_URL")))
		names = append(names, "openai")
	}
	// Bedrock + Google + Azure ship as real adapters but their
	// constructors take richer config than a single env var. They are
	// included in the fallback chain only when the relevant deployment
	// envs are set; nil constructors are skipped silently so dev
	// without those secrets still boots clean.
	if p := bedrockFromEnv(); p != nil {
		providers = append(providers, p)
		names = append(names, "bedrock")
	}
	if p := googleFromEnv(); p != nil {
		providers = append(providers, p)
		names = append(names, "google")
	}
	if p := azureFromEnv(); p != nil {
		providers = append(providers, p)
		names = append(names, "azure_openai")
	}

	switch len(providers) {
	case 0:
		// no provider — chat handler 501s, suite stays usable for
		// embedding-free flows.
	case 1:
		suite.Provider = providers[0]
	default:
		cfg := infllm.FallbackConfig{Primary: names[0], Secondaries: names[1:]}
		suite.Provider = infllm.NewFallbackChain(cfg, providers...)
	}

	if db != nil && db.GetPool() != nil {
		suite.Usage = infspend.NewUsageReader(db.GetPool())
		suite.Limits = infspend.NewLimitRepo(db.GetPool())
		sink := infspend.NewPgxSink(db.GetPool())
		pricing := infspend.NewPgxPricing(db.GetPool(), 0)
		suite.Tracker = infspend.NewTracker(sink, pricing, 0)
		// Day-54: session recording. A separate sql.DB adapter is opened
		// on the same pool so the recorder's *sql.DB interface is
		// satisfied without a second physical connection pool.
		recDB := stdlib.OpenDBFromPool(db.GetPool())
		suite.Recorder = record.NewAppendOnlyPostgresRecorder(recDB, tenantCtxFromChain)
	}
	return suite
}

// bedrockFromEnv returns a Bedrock adapter when AWS_BEDROCK_REGION is
// set, else nil.
func bedrockFromEnv() infllm.Provider {
	if os.Getenv("AWS_BEDROCK_REGION") == "" {
		return nil
	}
	return infllm.NewBedrock(
		os.Getenv("AWS_BEDROCK_REGION"),
		os.Getenv("AWS_ACCESS_KEY_ID"),
		os.Getenv("AWS_SECRET_ACCESS_KEY"),
		os.Getenv("AWS_SESSION_TOKEN"),
	)
}

// googleFromEnv returns a Vertex AI adapter when both project + an
// access token (typically via Workload Identity) are configured.
// We only wire when a static GOOGLE_API_KEY is set; OAuth-token
// loading is deferred to a separate config knob.
func googleFromEnv() infllm.Provider {
	project := os.Getenv("GOOGLE_VERTEX_PROJECT")
	apiKey := os.Getenv("GOOGLE_API_KEY")
	if project == "" || apiKey == "" {
		return nil
	}
	return infllm.NewVertex(
		project,
		firstNonEmpty(os.Getenv("GOOGLE_VERTEX_LOCATION"), "us-central1"),
		infllm.StaticTokenSource(apiKey),
	)
}

func azureFromEnv() infllm.Provider {
	if os.Getenv("AZURE_OPENAI_ENDPOINT") == "" {
		return nil
	}
	return infllm.NewAzureOpenAI(
		os.Getenv("AZURE_OPENAI_API_KEY"),
		os.Getenv("AZURE_OPENAI_ENDPOINT"),
		os.Getenv("AZURE_OPENAI_DEPLOYMENT"),
		firstNonEmpty(os.Getenv("AZURE_OPENAI_API_VERSION"), "2024-02-15-preview"),
	)
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

// chatHandlerOrNotImplemented returns the /v1/chat handler when the
// LLM provider is wired, otherwise a 501 stub so the route surface is
// stable across dev/prod. Tenant id pulled from ctx via the typed
// chain key; falls back to legacy string key for LOCAL_AUTH_BYPASS.
func chatHandlerOrNotImplemented(suite *LLMSuite) http.Handler {
	if suite == nil || suite.Provider == nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "/v1/chat: ANTHROPIC_API_KEY not configured", http.StatusNotImplemented)
		})
	}
	deps := llmhandler.Deps{
		Provider:      suite.Provider,
		Tracker:       suite.Tracker,
		TenantCtx:     tenantCtxFromChain,
		UserCtx:       userCtxFromChain,
		RoutingPolicy: routing.NewDefaultPolicy(),
		Recorder:      suite.Recorder,
		RecordingEnabled: func(_ context.Context, _ uuid.UUID) bool {
			return suite.Recorder != nil
		},
	}
	if suite.Usage != nil {
		deps.Usage = suite.Usage
	}
	if suite.Limits != nil {
		deps.Limits = suite.Limits
	}
	return llmhandler.Chat(deps)
}

// tenantCtxFromChain bridges the chain's typed CtxKeyTenantID (string
// in chain.go) to the uuid.UUID that the spend gate expects. Returns
// false on parse error so a malformed claim never charges someone.
func tenantCtxFromChain(ctx context.Context) (uuid.UUID, bool) {
	v, _ := ctx.Value(httpmw.CtxKeyTenantID).(string)
	if v == "" {
		return uuid.Nil, false
	}
	id, err := uuid.Parse(v)
	if err != nil {
		return uuid.Nil, false
	}
	return id, true
}

// userCtxFromChain extracts the user UUID from the chain's CtxKeyUserID
// context value. Returns false when missing or zero so callers can treat
// unauthenticated requests consistently.
func userCtxFromChain(ctx context.Context) (uuid.UUID, bool) {
	uid, ok := ctx.Value(httpmw.CtxKeyUserID).(uuid.UUID)
	return uid, ok && uid != uuid.Nil
}
