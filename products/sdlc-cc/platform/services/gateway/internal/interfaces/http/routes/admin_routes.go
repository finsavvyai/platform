// Admin routes — Day 7 (rate-limit CRUD) + Day 13 (audit log query).
//
// The route registrations themselves are REAL: every entry below is
// mounted on the chi router so an unauthenticated probe returns
// 401/403 (gated by RBAC), not 404. That distinction is what the
// router_admin_test asserts.
//
// The downstream repository wiring (ratelimit.AdminRepo + audit.Writer)
// requires a *sql.DB that the current Application wires through pgxpool
// only. When AdminDependencies is constructed without those repos,
// MountAdminRoutes substitutes safe stubs that return 503 — so the
// surface is discoverable + RBAC-gated even before the DB plumbing
// lands.
//
// TODO(REAL-1): replace stub repos with real ones once the gateway
// exposes a *sql.DB sibling to its pgxpool.Pool (Day 14 task).
package routes

import (
	"context"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	apphandlers "github.com/sdlc-ai/platform/services/gateway/internal/app/handlers"
	"github.com/sdlc-ai/platform/services/gateway/internal/app/middleware"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/ratelimit"
	"github.com/sdlc-ai/platform/services/gateway/internal/interfaces/http/handlers"
)

// AdminDependencies holds the optional repositories the admin routes
// need. When a field is nil the corresponding routes are still mounted
// but return 503 with a clear "wiring pending" body.
type AdminDependencies struct {
	RateLimits   handlers.AdminRateLimitWriter
	Audit        handlers.AuditAppender
	AuditRead    handlers.AuditLogReader
	APIKeyRotate     handlers.APIKeyRotator              // Day-9
	CMEKPool         *pgxpool.Pool                       // S3.1 follow-up — tenants.kms_key_arn admin
	AnalyticsStore   apphandlers.AnalyticsOverviewStore  // Day-30 — overview
	TimeseriesStore  apphandlers.TimeseriesStore         // Day-30 — timeseries
	RBAC             *middleware.RBAC                    // optional; nil disables permission gates (test mode)
}

// MountAdminRoutes registers the Day 7 + Day 13 admin endpoints on r.
// Permissions: admin:rate_limit:read|write and admin:audit:read.
func MountAdminRoutes(r chi.Router, deps AdminDependencies) {
	rl := deps.RateLimits
	if rl == nil {
		rl = stubRateLimits{}
	}
	au := deps.Audit
	auRead := deps.AuditRead
	if auRead == nil {
		auRead = stubAuditReader{}
	}

	rlDeps := handlers.AdminRateLimitsDeps{Admin: rl, Audit: au}
	auDeps := handlers.AuditQueryDeps{Reader: auRead}
	rotDeps := handlers.APIKeyRotateDeps{Rotator: deps.APIKeyRotate, Audit: au}

	r.Route("/admin", func(r chi.Router) {
		r.Route("/tenants/{id}/rate-limits", func(r chi.Router) {
			r.With(perm(deps.RBAC, "admin:rate_limit:read")).
				Get("/", handlers.ListRateLimits(rlDeps))
			r.With(perm(deps.RBAC, "admin:rate_limit:write")).
				Put("/", handlers.PutRateLimits(rlDeps))
		})
		r.With(perm(deps.RBAC, "admin:audit:read")).
			Get("/audit-logs", handlers.QueryAuditLogs(auDeps))

		// S3.1 follow-up — per-tenant CMEK admin.
		cmekDeps := handlers.TenantCMEKDeps{Pool: deps.CMEKPool, Audit: au}
		r.Route("/tenants/{id}/cmek", func(r chi.Router) {
			r.With(perm(deps.RBAC, "tenants:read")).
				Get("/", handlers.GetTenantCMEK(cmekDeps))
			r.With(perm(deps.RBAC, "tenants:write")).
				Patch("/", handlers.PatchTenantCMEK(cmekDeps))
		})

		// Day-30 analytics. RBAC: admin:analytics:read.
		if deps.AnalyticsStore != nil {
			r.With(perm(deps.RBAC, "admin:analytics:read")).
				Get("/analytics/overview",
					apphandlers.AnalyticsOverviewHandler(apphandlers.AnalyticsOverviewDeps{Store: deps.AnalyticsStore}))
		}
		if deps.TimeseriesStore != nil {
			r.With(perm(deps.RBAC, "admin:analytics:read")).
				Get("/analytics/timeseries",
					apphandlers.AnalyticsTimeseriesHandler(apphandlers.TimeseriesDeps{Store: deps.TimeseriesStore}))
		}
	})

	// Day-9 API key rotation endpoints. Mounted under /v1 (not /admin)
	// because they're scoped to the key owner, not a global admin
	// surface — RBAC differentiates by api_keys:{write,delete} which
	// every key-owner role grants.
	r.Route("/v1/api-keys/{id}", func(r chi.Router) {
		r.With(perm(deps.RBAC, "api_keys:write")).
			Post("/rotate", handlers.RotateAPIKey(rotDeps))
		r.With(perm(deps.RBAC, "api_keys:delete")).
			Post("/revoke", handlers.RevokeAPIKeyHandler(rotDeps))
	})
}

// perm returns RBAC middleware when RBAC is wired, or a passthrough
// otherwise. The passthrough exists so unit tests can mount routes
// without standing up an Evaluator.
func perm(r *middleware.RBAC, p string) func(http.Handler) http.Handler {
	if r == nil {
		return func(next http.Handler) http.Handler { return next }
	}
	return r.RequirePermission(p)
}

// stubRateLimits + stubAuditReader return 503-style errors so the
// HTTP surface stays honest about wiring readiness. They never silently
// succeed — see TODO(REAL-1) above.
type stubRateLimits struct{}

func (stubRateLimits) List(_ context.Context, _ uuid.UUID) ([]ratelimit.Rule, error) {
	return nil, errWiringPending
}

func (stubRateLimits) Replace(_ context.Context, _ uuid.UUID, _ []ratelimit.Rule) error {
	return errWiringPending
}

type stubAuditReader struct{}

func (stubAuditReader) Query(_ context.Context, _ handlers.AuditQuery) (handlers.AuditPage, error) {
	return handlers.AuditPage{}, errWiringPending
}

var errWiringPending = errors.New(
	"admin route handler wiring pending — see TODO(REAL-1) in routes/admin_routes.go")
