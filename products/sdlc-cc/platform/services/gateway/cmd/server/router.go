package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"

	apphandlers "github.com/sdlc-ai/platform/services/gateway/internal/app/handlers"
	"github.com/sdlc-ai/platform/services/gateway/internal/app/handlers/anthropic_compat"
	"github.com/sdlc-ai/platform/services/gateway/internal/app/handlers/byok_admin"
	"github.com/sdlc-ai/platform/services/gateway/internal/app/handlers/compliance_export"
	"github.com/sdlc-ai/platform/services/gateway/internal/app/handlers/dlp_template_admin"
	"github.com/sdlc-ai/platform/services/gateway/internal/app/handlers/me_redactions"
	domprojects "github.com/sdlc-ai/platform/services/gateway/internal/domain/projects"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/billing/lemonsqueezy"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/byok"
	infcomplianceexport "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/compliance_export"
	infdlptemplate "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/dlp_template"
	infmeredactions "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/me_redactions"
	infprojects "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/projects"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/record"
	"github.com/sdlc-ai/platform/services/gateway/internal/app/handlers/compliance"
	appmw "github.com/sdlc-ai/platform/services/gateway/internal/app/middleware"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/analytics"
	infaudit "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/audit"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/scim"
	infspend "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/spend"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/webhooks"
	"github.com/sdlc-ai/platform/services/gateway/internal/connectors"
	dv "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/domain_verification"
	connectorgithub "github.com/sdlc-ai/platform/services/gateway/internal/connectors/github"
	connectorgoogle "github.com/sdlc-ai/platform/services/gateway/internal/connectors/google"
	"github.com/sdlc-ai/platform/services/gateway/internal/connectors/hubspot"
	"github.com/sdlc-ai/platform/services/gateway/internal/connectors/servicenow"
	connectorslack "github.com/sdlc-ai/platform/services/gateway/internal/connectors/slack"
	"github.com/sdlc-ai/platform/services/gateway/internal/connectors/zendesk"
	"github.com/sdlc-ai/platform/services/gateway/internal/domain/repositories"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/health"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/langfuse"
	infmw "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/middleware"
	"github.com/sdlc-ai/platform/services/gateway/internal/interfaces/http/handlers"
	httpmw "github.com/sdlc-ai/platform/services/gateway/internal/interfaces/http/middleware"
	"github.com/sdlc-ai/platform/services/gateway/internal/interfaces/http/routes"
)

// setupRouter assembles the gateway's HTTP surface: golden-order middleware
// chain, then the public/internal/authenticated route groups.
func (app *Application) setupRouter(proxyMiddleware func(http.Handler) http.Handler) chi.Router {
	r := chi.NewRouter()

	// Proxy sits outside the chain so upstream rewrites happen before auth.
	r.Use(proxyMiddleware)
	r.Use(chimw.Timeout(60 * time.Second))

	httpmw.Apply(r, httpmw.ChainDeps{
		Logger:            logrus.StandardLogger(),
		Version:           app.Config.Version,
		JWTSecret:         app.Config.JWT.Secret,
		JWTIssuer:         app.Config.JWT.Issuer,
		RateLimiter:       app.RateLimiter,
		PolicyEngine:      app.PolicyEngine,
		PolicyQuery:       app.Config.OPA.AuthPolicyPath,
		PolicyEnforce:     app.Config.OPA.Enabled,
		DenyOnPolicyError: app.Config.OPA.DenyByDefault,
		CORSOrigins:       app.Config.CORS.AllowedOrigins,
		SkipAuthFor:       publicPaths(),
		AuditWriter:       auditWriterFromSuite(app.Security),
		DLP:               dlpFromSuite(app.Security),
		IPAllowList:       ipAllowListFromSuite(app.Security),
	})

	mountUnauthenticatedSurfaces(r, app)
	mountAuthenticatedAPI(r, app)
	mountLangfuseIfEnabled(r)

	r.Get("/version", app.handleVersion)
	r.Get("/info", app.handleInfo)

	return r
}

// publicPaths bypass auth: orchestrator probes, Prometheus scrape,
// and inbound webhooks that carry their own signature-based auth.
func publicPaths() []string {
	return []string{
		"/health", "/health/ready", "/health/live", "/health/dependencies",
		"/api/health", "/metrics", "/version", "/info",
		"/api/v1/auth/login",
		"/webhooks/lemonsqueezy",
	}
}

func mountUnauthenticatedSurfaces(r chi.Router, app *Application) {
	r.Handle("/metrics", promhttp.Handler())

	healthHandler := health.NewHTTPHandler(app.HealthRegistry)
	r.Get("/health", healthHandler.ServeHTTP)
	r.Get("/api/health", healthHandler.ServeHTTP)
	r.Get("/health/ready", healthHandler.ServeHTTP)
	r.Get("/health/live", healthHandler.ServeHTTP)
	r.Get("/health/dependencies", healthHandler.ServeHTTP)

	// Bucket D: LemonSqueezy webhook receiver. Signature-gated (no JWT).
	// LEMONSQUEEZY_WEBHOOK_SECRET and SDLC_LS_PRODUCT_ID come from env.
	// When either var is absent the handler is still mounted but all
	// requests will fail signature verification (empty secret → always
	// false), so the surface is safe without config.
	lsSecret := os.Getenv("LEMONSQUEEZY_WEBHOOK_SECRET")
	lsProductID := os.Getenv("SDLC_LS_PRODUCT_ID")
	r.Post("/webhooks/lemonsqueezy", lemonsqueezy.New(lsSecret, lsProductID).ServeHTTP)
}

func mountAuthenticatedAPI(r chi.Router, app *Application) {
	r.Route("/services", func(r chi.Router) {
		r.Get("/", app.handleListServices)
		r.Get("/{service}", app.handleGetService)
		r.Post("/{service}", app.handleRegisterService)
		r.Delete("/{service}/{instance}", app.handleUnregisterService)
	})

	r.Route("/api/v1/openclaw", func(r chi.Router) {
		r.Get("/health", app.handleOpenClawHealth)
		r.Get("/capabilities", app.handleOpenClawCapabilities)
	})
	r.Route("/api/v1/claw", func(r chi.Router) {
		r.Get("/health", app.handleClawHealth)
		r.Get("/capabilities", app.handleClawCapabilities)
		r.Post("/session/register", app.handleClawSessionRegister)
		r.Get("/tools/list", app.handleClawToolsList)
		r.Post("/tools/list", app.handleClawToolsList)
		r.Post("/tools/call", app.handleClawToolCall)
		r.Post("/memory/write", app.handleClawMemoryWrite)
		r.Post("/memory/search", app.handleClawMemorySearch)
		r.Get("/memory/{id}", app.handleClawMemoryGet)
		r.Delete("/memory/{id}", app.handleClawMemoryDelete)
	})

	deps := &handlers.Dependencies{
		Config:       app.Config,
		DB:           app.DB,
		PolicyEngine: app.PolicyEngine,
		Repos:        &repositories.RepositoryRegistry{},
		RBAC:         buildRBAC(app),
		DomainStore:  domainStoreFromApp(app),
		Audit:        auditAppenderFromSuite(app.Security),
	}
	if mux, ok := r.(*chi.Mux); ok {
		routes.SetupRoutes(mux, deps)
	}

	// BEAT-PLAN S1.2: /v1/chat with 402 hard cap. RBAC-gated.
	r.With(rbacGateChat(app)).Method(http.MethodPost, "/v1/chat", chatHandlerOrNotImplemented(app.LLM))

	// Claude Team P0 — Anthropic-compatible /v1/messages drop-in.
	// Customer points ANTHROPIC_BASE_URL at the gateway; their
	// existing SDK keeps working with PII redacted via the chain DLP.
	mountAnthropicCompat(r, app)

	// Claude Team A3 — BYOK admin endpoints for per-tenant Anthropic
	// credential enrollment + rotation. RBAC gating is the caller's
	// responsibility (admin:billing:write); the handler itself does
	// not enforce permissions so it stays composable.
	byok_admin.Mount(r, byokWriteRepoFromApp(app))

	// Claude Team D1 — GDPR Article 15 per-user redaction view. The
	// data subject can read their own DLP detection trail.
	mountMeRedactions(r, app)

	// Privacy-gateway 2026-05-20 — standalone POST /v1/redact for
	// the browser extension, IDE addins, and Office addins. Uses
	// the same per-tenant policy + custom patterns + legal preset
	// as the inbound middleware via DLP.Scan.
	mountRedact(r, app)

	// Claude Team D2 — DLP policy templates. Operators can list +
	// apply HIPAA / PCI / GDPR / SOC 2 baselines via /admin endpoint.
	dlp_template_admin.Mount(r, dlpTemplateRepoFromApp(app))

	// Claude Team D3 — compliance evidence export. Auditors get one
	// JSON download per (tenant, date window) covering DLP / policy
	// / api_key / auth audit trails with a SHA-256 hash chain.
	compliance_export.Mount(r, complianceExportReaderFromApp(app))

	mountConnectorOAuth(r)
	mountSCIM(r, app)
	mountProjects(r, app)
	mountRecordings(r, app)
	// Day 7 + Day 13 admin routes. The repos come from SecuritySuite
	// when wired; nil-tolerant fallbacks return 503 with a clear body
	// so the surface stays discoverable in dev.
	analyticsStore := analyticsStoreFromApp(app)
	routes.MountAdminRoutes(r, routes.AdminDependencies{
		RateLimits:      rateLimitAdminFromSuite(app.Security),
		Audit:           auditAppenderFromSuite(app.Security),
		AuditRead:       auditLogReaderFromSuite(app.Security),
		APIKeyRotate:    apiKeyRotatorFromSuite(app.Security),
		CMEKPool:        poolFromApp(app),
		AnalyticsStore:  analyticsStore,
		TimeseriesStore: analyticsStore,
		RBAC:            buildRBAC(app),
	})

	// Day 32 compliance routes (/compliance/audit-events,
	// /access-controls, /data-flow, /retention-status, /dlp-events).
	// Mounted with stub readers for now so the surface is discoverable;
	// real Postgres-backed readers slot in via complianceDeps in main.
	r.Mount("/compliance", compliance.Mount(compliance.Deps{
		Audit:     auditReaderFromSuite(app.Security),
		RBAC:      complianceRBACFromSuite(app.Security),
		Retention: complianceRetentionFromSuite(app.Security),
		DLP:       complianceDLPFromSuite(app.Security),
	}))
}

// --- Stub compliance readers ---
//
// These return empty pages / counts so the route surface is testable
// without the full Postgres-backed query plumbing. Replaced wholesale
// once `services/gateway/internal/infrastructure/repositories/audit_query.go`
// gets a `compliance.AuditEventReader`-shaped wrapper.
type stubAuditReader struct{}

func (stubAuditReader) Query(_ context.Context, _ compliance.AuditEventQuery) (compliance.AuditEventPage, error) {
	return compliance.AuditEventPage{Rows: []compliance.AuditEventRow{}}, nil
}

// auditReaderFromSuite returns the Postgres-backed reader when the
// security suite is configured, otherwise the stub. Mirrors the
// pattern used by auditWriterFromSuite in wiring.go so router.go has
// no awareness of *audit.PgxReader's concrete type.
func auditReaderFromSuite(s *SecuritySuite) compliance.AuditEventReader {
	if s == nil || s.AuditReader == nil {
		return stubAuditReader{}
	}
	return s.AuditReader
}

// buildRBAC composes the app-middleware RBAC factory from the security
// suite. Returns nil when the evaluator is missing so route gating
// degrades to a passthrough (see routes/rbac_gate.go).
func buildRBAC(app *Application) *appmw.RBAC {
	if app == nil || app.Security == nil || app.Security.Evaluator == nil {
		return nil
	}
	return appmw.NewRBAC(app.Security.Evaluator, app.Security.AuditWriter)
}

// rbacGateChat returns RequirePermission("llm:invoke") when the suite
// is wired, else a passthrough so dev keeps serving /v1/chat.
func rbacGateChat(app *Application) func(http.Handler) http.Handler {
	r := buildRBAC(app)
	if r == nil {
		return func(next http.Handler) http.Handler { return next }
	}
	return r.RequirePermission("llm:invoke")
}

// dlpFromSuite returns the DLP middleware from the suite, or nil so
// the chain step degrades to passthrough in dev/no-DB environments.
func dlpFromSuite(s *SecuritySuite) *infmw.DLP {
	if s == nil {
		return nil
	}
	return s.DLP
}

// ipAllowListFromSuite returns the Day-26 PgxLoader when the suite
// is wired, else nil so the chain ipAllowListMiddleware degrades to
// passthrough.
func ipAllowListFromSuite(s *SecuritySuite) httpmw.IPAllowListLookup {
	if s == nil || s.IPAllowListLoad == nil {
		return nil
	}
	return s.IPAllowListLoad
}

// complianceRBACFromSuite + complianceRetentionFromSuite +
// complianceDLPFromSuite return the Day-32 Postgres-backed readers
// when wired, else the prior stubs so /compliance/* routes stay
// discoverable in dev/no-DB environments.
func complianceRBACFromSuite(s *SecuritySuite) compliance.RBACReader {
	if s == nil || s.ComplianceReaders == nil {
		return stubRBACReader{}
	}
	return s.ComplianceReaders
}

func complianceRetentionFromSuite(s *SecuritySuite) compliance.RetentionReader {
	if s == nil || s.ComplianceReaders == nil {
		return stubRetentionReader{}
	}
	return s.ComplianceReaders
}

func complianceDLPFromSuite(s *SecuritySuite) compliance.DLPEventReader {
	if s == nil || s.ComplianceReaders == nil {
		return stubDLPReader{}
	}
	return s.ComplianceReaders
}

type stubRBACReader struct{}

func (stubRBACReader) Snapshot(_ context.Context, _ uuid.UUID) (compliance.RBACSnapshot, error) {
	return compliance.RBACSnapshot{}, nil
}

type stubRetentionReader struct{}

func (stubRetentionReader) Status(_ context.Context, _ uuid.UUID) (compliance.RetentionReport, error) {
	return compliance.RetentionReport{}, nil
}

type stubDLPReader struct{}

func (stubDLPReader) List(_ context.Context, _ compliance.DLPEventQuery) (compliance.DLPEventPage, error) {
	return compliance.DLPEventPage{}, nil
}

// rateLimitAdminFromSuite returns the Day-7 admin repo when the suite
// has an sql.DB sibling, else nil so MountAdminRoutes substitutes its
// 503 stub.
func rateLimitAdminFromSuite(s *SecuritySuite) handlers.AdminRateLimitWriter {
	if s == nil || s.RateLimitAdmin == nil {
		return nil
	}
	return s.RateLimitAdmin
}

// apiKeyRotatorFromSuite returns the Day-9 *auth.Rotator when wired,
// else nil so the rotate/revoke endpoints return 503 NOT_CONFIGURED.
func apiKeyRotatorFromSuite(s *SecuritySuite) handlers.APIKeyRotator {
	if s == nil || s.APIKeyRotator == nil {
		return nil
	}
	return s.APIKeyRotator
}

// poolFromApp surfaces the gateway's pgxpool for admin handlers that
// need direct DB access (CMEK admin). Nil when the DB isn't wired so
// MountAdminRoutes leaves the surface mounted with 503 stubs.
func poolFromApp(app *Application) *pgxpool.Pool {
	if app == nil || app.DB == nil {
		return nil
	}
	return app.DB.GetPool()
}

// analyticsStoreFromApp returns the Day-30 PgxStore that satisfies
// both AnalyticsOverviewStore and TimeseriesStore. Nil when DB
// isn't wired so MountAdminRoutes skips the routes entirely.
func analyticsStoreFromApp(app *Application) *analytics.PgxStore {
	pool := poolFromApp(app)
	if pool == nil {
		return nil
	}
	return analytics.NewPgxStore(pool, tenantCtxFromChain)
}

// domainStoreFromApp returns the Day-25 PgxStore for tenant_domains
// when the pgxpool is wired, else nil so handlers fall back to the
// in-process MemStore.
func domainStoreFromApp(app *Application) dv.Store {
	pool := poolFromApp(app)
	if pool == nil {
		return nil
	}
	return dv.NewPgxStore(pool)
}

// complianceExportReaderFromApp builds the D3 evidence-export
// reader. Returns nil when no DB pool is wired so the endpoint
// 503s with a clear message in dev.
func complianceExportReaderFromApp(app *Application) compliance_export.Reader {
	pool := poolFromApp(app)
	if pool == nil {
		return nil
	}
	return infcomplianceexport.NewPgxReader(pool)
}

// dlpTemplateRepoFromApp builds the upsert repo for D2 templates.
// Returns nil when no DB pool is wired so the admin endpoint 503s
// with a clear message and the listing endpoint stays available.
func dlpTemplateRepoFromApp(app *Application) dlp_template_admin.Repo {
	pool := poolFromApp(app)
	if pool == nil {
		return nil
	}
	return infdlptemplate.NewPgxRepo(pool)
}

// mountMeRedactions mounts the GDPR Article 15 per-user redaction
// view at GET /v1/me/redactions. Returns 503 when no DB pool is
// available so the surface stays discoverable in dev. Claude Team D1.
func mountMeRedactions(r chi.Router, app *Application) {
	pool := poolFromApp(app)
	var reader me_redactions.Reader
	if pool != nil {
		reader = infmeredactions.NewPgxReader(pool)
	}
	r.Method(http.MethodGet, "/v1/me/redactions", me_redactions.Handler(
		reader,
		func(req *http.Request) (uuid.UUID, error) {
			id, ok := tenantCtxFromChain(req.Context())
			if !ok {
				return uuid.Nil, fmt.Errorf("missing tenant context")
			}
			return id, nil
		},
		func(req *http.Request) (uuid.UUID, error) {
			if uid, ok := req.Context().Value(httpmw.CtxKeyUserID).(uuid.UUID); ok && uid != uuid.Nil {
				return uid, nil
			}
			return uuid.Nil, fmt.Errorf("missing user context")
		},
	))
}

// mountAnthropicCompat mounts the Claude Team drop-in surface at
// `POST /anthropic/v1/messages`. The handler proxies the request
// body verbatim to the upstream Anthropic API; DLP runs through
// the chain (steps 8a + 12a) so prompts and responses are scanned
// without the handler touching them. Spend tracking pulls the
// platform tracker when configured.
//
// Per-tenant BYOK (Claude Team A3): when BYOK_ENCRYPTION_KEY is set
// the handler resolves the upstream Anthropic key from
// `tenant_provider_credentials` first, falling back to the platform
// `ANTHROPIC_API_KEY`. Without either credential the handler returns
// an Anthropic-shape 503 so SDKs surface the configuration error
// cleanly. Claude Team A1 + A2 (streaming pass-through) + A3 + C4.
func mountAnthropicCompat(r chi.Router, app *Application) {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	deps := anthropic_compat.Deps{
		APIKey:    apiKey,
		BaseURL:   os.Getenv("ANTHROPIC_BASE_URL"),
		Tracker:   trackerFromApp(app),
		TenantCtx: tenantCtxFromChain,
		BYOK:      byokRepoFromApp(app),
		StreamDLP: streamDLPFactoryFromApp(app),
	}
	r.Method(http.MethodPost, "/anthropic/v1/messages", anthropic_compat.Messages(deps))
}

// streamDLPFactoryFromApp returns the per-request StreamRedactor
// factory used by the Anthropic-compat streaming branch. The
// factory looks up the tenant's DLP action + custom patterns and
// returns a redactor only when the action would actually rewrite
// content (mask / redact / tokenize). Tenants on `allow` get nil
// so the bytes flow verbatim. Claude Team A2.
func streamDLPFactoryFromApp(app *Application) func(context.Context, http.ResponseWriter) *infmw.StreamRedactor {
	dlp := dlpFromSuite(app.Security)
	if dlp == nil {
		return nil
	}
	return func(ctx context.Context, w http.ResponseWriter) *infmw.StreamRedactor {
		tenant := dlp.TenantFromCtxOrEmpty(ctx)
		if tenant == "" {
			return nil
		}
		action, _ := dlp.Policy.DLPAction(ctx, tenant)
		if action == "" || action == infmw.ActionAllow {
			return nil
		}
		var extra []infmw.CustomPatternSpec
		if cp, ok := dlp.Policy.(infmw.CustomPatternsLookup); ok {
			extra, _ = cp.CustomPatterns(ctx, tenant)
		}
		return infmw.NewStreamRedactor(w, dlp.Detector, action,
			infmw.CompileCustomPatterns(extra))
	}
}

// byokRepoFromApp builds the BYOK PgxRepo when both the database
// pool and BYOK_ENCRYPTION_KEY are configured. Returns nil
// otherwise so the handler falls through to the platform key.
func byokRepoFromApp(app *Application) anthropic_compat.BYOKLookup {
	if r := buildBYOKRepo(app); r != nil {
		return r
	}
	return nil
}

// byokWriteRepoFromApp returns the same repo via the byok_admin.Repo
// interface (Set + Delete only). Nil when the repo can't be built so
// the admin endpoint 503s with a clear message.
func byokWriteRepoFromApp(app *Application) byok_admin.Repo {
	if r := buildBYOKRepo(app); r != nil {
		return r
	}
	return nil
}

// buildBYOKRepo is the shared constructor used by both the read
// (handler) and write (admin) wiring helpers. Single env-var check
// + single sealer construction so misconfig surfaces consistently.
func buildBYOKRepo(app *Application) *byok.PgxRepo {
	pool := poolFromApp(app)
	if pool == nil {
		return nil
	}
	hexKey := os.Getenv("BYOK_ENCRYPTION_KEY")
	if hexKey == "" {
		return nil
	}
	sealer, err := byok.NewSealer(hexKey)
	if err != nil {
		// Misconfigured key: fail closed by returning nil (platform
		// key path); a logger entry would land here in production.
		return nil
	}
	return byok.NewPgxRepo(pool, sealer)
}

// trackerFromApp surfaces the spend tracker from the LLMSuite. nil
// when the suite or tracker isn't wired, in which case spend
// recording is a no-op (tests, dev without a DB).
func trackerFromApp(app *Application) *infspend.Tracker {
	if app == nil || app.LLM == nil {
		return nil
	}
	return app.LLM.Tracker
}

// mountProjects wires the Day-53 /v1/projects CRUD surface. The repo
// is the Postgres-backed *infprojects.PgxRepo when a pool is
// available; without a pool the surface is skipped (handler would
// always 500 against the missing repo).
func mountProjects(r chi.Router, app *Application) {
	pool := poolFromApp(app)
	if pool == nil {
		return
	}
	repo := infprojects.NewPgxRepo(pool)
	svc := domprojects.NewService(repo, nil)
	apphandlers.MountProjects(r, apphandlers.ProjectsDeps{
		Service: svc,
		RBAC:    buildRBAC(app),
		TenantFrom: func(req *http.Request) (uuid.UUID, error) {
			id, ok := tenantCtxFromChain(req.Context())
			if !ok {
				return uuid.Nil, fmt.Errorf("missing tenant context")
			}
			return id, nil
		},
		UserFrom: func(req *http.Request) (uuid.UUID, error) {
			if uid, ok := req.Context().Value(httpmw.CtxKeyUserID).(uuid.UUID); ok && uid != uuid.Nil {
				return uid, nil
			}
			return uuid.Nil, fmt.Errorf("missing user context")
		},
	})
}

// mountRecordings wires GET /admin/recordings/{session_id} for admin playback
// of session_recordings rows. Skipped when no DB pool is available.
func mountRecordings(r chi.Router, app *Application) {
	pool := poolFromApp(app)
	if pool == nil {
		return
	}
	sqlDB := stdlib.OpenDBFromPool(pool)
	apphandlers.MountRecordings(r, apphandlers.RecordingsDeps{
		Reader: record.NewSqlReader(sqlDB),
		RBAC:   buildRBAC(app),
		TenantFrom: func(req *http.Request) (uuid.UUID, error) {
			id, ok := tenantCtxFromChain(req.Context())
			if !ok {
				return uuid.Nil, fmt.Errorf("missing tenant context")
			}
			return id, nil
		},
	})
}

// auditAppenderFromSuite is the Day-7 audit-on-mutate hook the rate-
// limit handler uses to log every PUT. Adapts the handler's
// AuditEvent shape onto audit.Writer.AppendCritical so failures at
// PUT time fail the request (admin mutating actions must not silently
// drop their audit row).
func auditAppenderFromSuite(s *SecuritySuite) handlers.AuditAppender {
	if s == nil || s.AuditWriter == nil {
		return nil
	}
	return &auditAppenderAdapter{w: s.AuditWriter, dispatcher: s.WebhookDispatcher}
}

type auditAppenderAdapter struct {
	w          *infaudit.Writer
	dispatcher *webhooks.Dispatcher
}

func (a *auditAppenderAdapter) Append(ctx context.Context, e handlers.AuditEvent) error {
	var actorPtr *uuid.UUID
	if e.ActorID != uuid.Nil {
		uid := e.ActorID
		actorPtr = &uid
	}
	row := infaudit.Row{
		TenantID:   e.TenantID,
		ActorID:    actorPtr,
		ActorType:  "user",
		Action:     e.Action,
		TargetType: "rate_limit",
		TargetID:   e.Target,
		Before:     e.Before,
		After:      e.After,
		CreatedAt:  e.Timestamp,
	}
	if err := a.w.AppendCritical(ctx, row); err != nil {
		return err
	}
	// Day-38: fire-and-forget outbound webhook on every critical
	// admin mutation. Subscribers register against event types like
	// "rate_limit.update". Dispatcher swallows per-endpoint errors
	// (DLQ handles terminal failures) so we never fail the admin
	// request because of a webhook delivery hiccup.
	if a.dispatcher != nil {
		go func() {
			payload, _ := json.Marshal(map[string]any{
				"tenant_id": row.TenantID.String(),
				"actor_id":  row.ActorID,
				"action":    row.Action,
				"target":    row.TargetType + ":" + row.TargetID,
				"before":    row.Before,
				"after":     row.After,
				"at":        row.CreatedAt,
			})
			_, _ = a.dispatcher.Dispatch(context.Background(), row.TenantID, row.TargetType+"."+row.Action, payload)
		}()
	}
	return nil
}

// auditLogReaderFromSuite adapts compliance.AuditEventReader to the
// handlers.AuditLogReader shape the Day-13 query API expects. The two
// interfaces have the same query fields but differ on the row shape:
// compliance returns Target as "type:id" joined; handlers wants them
// split. The adapter performs that split.
func auditLogReaderFromSuite(s *SecuritySuite) handlers.AuditLogReader {
	if s == nil || s.AuditReader == nil {
		return nil
	}
	return &auditLogReaderAdapter{inner: s.AuditReader}
}

// auditLogReaderAdapter wraps *audit.PgxReader so it satisfies the
// handlers.AuditLogReader interface with the row-shape translation.
type auditLogReaderAdapter struct {
	inner compliance.AuditEventReader
}

func (a *auditLogReaderAdapter) Query(ctx context.Context, q handlers.AuditQuery) (handlers.AuditPage, error) {
	page, err := a.inner.Query(ctx, compliance.AuditEventQuery{
		TenantID: q.TenantID,
		ActorID:  q.ActorID,
		Action:   q.Action,
		From:     q.From,
		To:       q.To,
		Cursor:   q.Cursor,
		Limit:    q.Limit,
	})
	if err != nil {
		return handlers.AuditPage{}, err
	}
	out := handlers.AuditPage{NextCursor: page.NextCursor}
	out.Rows = make([]handlers.AuditRow, 0, len(page.Rows))
	for _, r := range page.Rows {
		row := handlers.AuditRow{
			ID:        r.ID,
			TenantID:  r.TenantID,
			ActorID:   r.ActorID,
			ActorType: r.ActorType,
			Action:    r.Action,
			IP:        r.IP,
			CreatedAt: r.CreatedAt,
		}
		// PgxReader joins target_type + target_id with `:`. Split back
		// so the handler's response shape matches its OpenAPI schema.
		if i := indexByte(r.Target, ':'); i >= 0 {
			row.TargetType = r.Target[:i]
			row.TargetID = r.Target[i+1:]
		} else {
			row.TargetID = r.Target
		}
		out.Rows = append(out.Rows, row)
	}
	return out, nil
}

// indexByte is a small inline helper so we don't import strings just
// for IndexByte in this file.
func indexByte(s string, c byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == c {
			return i
		}
	}
	return -1
}

// mountLangfuseIfEnabled gates the Langfuse compat surface behind an env flag.
//
// Why: the previous handler accepted any non-empty credential pair as a valid
// tenant identity (security S1). Until the BasicAuth resolver is wired to the
// api_keys table with hashed lookups, the only safe default is off. Setting
// SDLC_LANGFUSE_ENABLED=true mounts the surface but with reject-all resolvers
// — the operator must replace those before exposing it.
func mountLangfuseIfEnabled(r chi.Router) {
	if os.Getenv("SDLC_LANGFUSE_ENABLED") != "true" {
		return
	}
	lf := &langfuse.Handler{
		Prompts:    langfuse.NewMemoryPromptStore(),
		BasicAuth:  rejectAll,
		BearerAuth: rejectAllBearer,
	}
	lf.Mount(r)
}

func rejectAll(_, _ string) (string, error) {
	return "", langfuse.ErrUnauthorized
}

func rejectAllBearer(_ string) (string, error) {
	return "", langfuse.ErrUnauthorized
}

// mountSCIM attaches the SCIM 2.0 surface (Users + Groups + Bulk) to
// the gateway router under /scim/v2. BEAT-PLAN Day 23.
//
// Stores are Postgres-backed when a pgxpool is available (production)
// and fall back to in-memory in dev/no-DB so the surface stays
// discoverable. Tenant resolution comes from the chain's
// CtxKeyTenantID (already populated by tenantMiddleware).
func mountSCIM(r chi.Router, app *Application) {
	var (
		store  scim.Store
		groups scim.GroupStore
	)
	if pool := poolFromApp(app); pool != nil {
		store = scim.NewPgxStore(pool)
		groups = scim.NewPgxGroupStore(pool)
	} else {
		store = scim.NewMemoryStore()
		groups = scim.NewMemoryGroupStore()
	}
	auditAppender := auditAppenderFromSuite(app.Security)
	h := &scim.Handler{
		Store:      store,
		GroupStore: groups,
		BasePath:   "/scim/v2",
		Tenant: func(req *http.Request) (string, error) {
			if v, ok := req.Context().Value(httpmw.CtxKeyTenantID).(string); ok && v != "" {
				return v, nil
			}
			return "", scim.ErrNotFound
		},
		Audit: func(ctx context.Context, action, target, tenantID string) error {
			if auditAppender == nil {
				return nil
			}
			return auditAppender.Append(ctx, handlers.AuditEvent{
				Action:    action,
				Target:    target,
				Timestamp: time.Now(),
			})
		},
	}
	mux := http.NewServeMux()
	h.Register(mux)
	r.Mount("/scim/v2", http.StripPrefix("/scim/v2", mux))
}

// listConnectorsHandler returns the marketplace catalog: every
// registered connector's metadata (name, vendor, scopes, status). The
// admin UI Connectors page consumes this directly. BEAT-PLAN Day 48.
func listConnectorsHandler(reg *connectors.Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": reg.ListMeta(),
		})
	}
}

// mountConnectorOAuth registers the shared OAuth start/callback routes
// for every connector built into this binary. The token store + secret
// come from env so production can swap them for a DB-backed Store.
func mountConnectorOAuth(r chi.Router) {
	reg := connectors.NewRegistry()
	store := connectors.NewMemoryStore()
	_ = zendesk.Register(reg, nil, store, os.Getenv("ZENDESK_CLIENT_ID"), os.Getenv("ZENDESK_CLIENT_SECRET"), os.Getenv("ZENDESK_SUBDOMAIN"))
	_ = servicenow.Register(reg, nil, store, os.Getenv("SERVICENOW_CLIENT_ID"), os.Getenv("SERVICENOW_CLIENT_SECRET"), os.Getenv("SERVICENOW_INSTANCE"))
	_ = hubspot.Register(reg, nil, store, os.Getenv("HUBSPOT_CLIENT_ID"), os.Getenv("HUBSPOT_CLIENT_SECRET"), os.Getenv("HUBSPOT_APP_ID"))
	_ = connectorgoogle.Register(reg, nil, store, connectorgoogle.Config{
		ClientID: os.Getenv("GOOGLE_CLIENT_ID"), ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		RedirectURI: os.Getenv("GOOGLE_REDIRECT_URI"),
	})
	_ = connectorslack.Register(reg, nil, store, connectorslack.Config{
		ClientID: os.Getenv("SLACK_CLIENT_ID"), ClientSecret: os.Getenv("SLACK_CLIENT_SECRET"),
		RedirectURI: os.Getenv("SLACK_REDIRECT_URI"),
	})
	_ = connectorgithub.Register(reg, nil, store, connectorgithub.Config{
		ClientID: os.Getenv("GITHUB_CLIENT_ID"), ClientSecret: os.Getenv("GITHUB_CLIENT_SECRET"),
		RedirectURI: os.Getenv("GITHUB_REDIRECT_URI"),
	})

	secret := []byte(os.Getenv("CONNECTOR_OAUTH_SECRET"))
	if len(secret) == 0 {
		secret = []byte("dev-only-replace-in-prod")
	}
	// Day-48 marketplace UI feed. The admin-ui Connectors page calls
	// GET /admin/connectors for the registered connector catalog.
	r.Get("/admin/connectors", listConnectorsHandler(reg))

	apphandlers.MountConnectorOAuth(r, apphandlers.ConnectorOAuthDeps{
		Registry:   reg,
		Secret:     secret,
		AdminUIURL: os.Getenv("ADMIN_UI_URL"),
		AuthorizeURL: func(name string) (string, error) {
			switch name {
			case "zendesk":
				return fmt.Sprintf("https://%s.zendesk.com/oauth/authorizations/new?response_type=code&client_id=%s",
					os.Getenv("ZENDESK_SUBDOMAIN"), os.Getenv("ZENDESK_CLIENT_ID")), nil
			case "servicenow":
				return fmt.Sprintf("https://%s.service-now.com/oauth_auth.do?response_type=code&client_id=%s",
					os.Getenv("SERVICENOW_INSTANCE"), os.Getenv("SERVICENOW_CLIENT_ID")), nil
			case "hubspot":
				return fmt.Sprintf("https://app.hubspot.com/oauth/authorize?client_id=%s&scope=crm.objects.contacts.read",
					os.Getenv("HUBSPOT_CLIENT_ID")), nil
			case "google_workspace":
				return fmt.Sprintf("https://accounts.google.com/o/oauth2/v2/auth?response_type=code&access_type=offline&prompt=consent&client_id=%s&redirect_uri=%s&scope=%s",
					os.Getenv("GOOGLE_CLIENT_ID"),
					os.Getenv("GOOGLE_REDIRECT_URI"),
					"https://www.googleapis.com/auth/drive.readonly+https://www.googleapis.com/auth/documents.readonly+https://www.googleapis.com/auth/spreadsheets.readonly"), nil
			case "slack":
				return fmt.Sprintf("https://slack.com/oauth/v2/authorize?client_id=%s&scope=channels:read,channels:history,users:read",
					os.Getenv("SLACK_CLIENT_ID")), nil
			case "github":
				return fmt.Sprintf("https://github.com/login/oauth/authorize?client_id=%s&scope=repo,read:org",
					os.Getenv("GITHUB_CLIENT_ID")), nil
			default:
				return "", fmt.Errorf("no authorize url for %s", name)
			}
		},
	})
}
