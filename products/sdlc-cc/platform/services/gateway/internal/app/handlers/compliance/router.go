// Mounts the five compliance endpoints under /compliance with:
//   - stricter rate limits than the rest of the admin API
//   - a `compliance:read` permission gate
//   - a uniform JSON writer + Deprecation-header helper
//
// The permission gate + rate-limit middleware are passed in as opaque
// chi.Middleware values so this package has no upward dependency on
// internal/infrastructure/middleware. Real callers wire those in
// when constructing the router; tests can pass no-op middleware.
//
// Day 32 of the production-ready roadmap.
package compliance

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// Deps is the full set of stores the compliance package needs to mount.
type Deps struct {
	Audit     AuditEventReader
	RBAC      RBACReader
	Retention RetentionReader
	DLP       DLPEventReader

	// Optional middlewares. If nil, the route is mounted without it
	// (useful for tests). Production wiring MUST set both.
	PermissionGate func(perm string) func(http.Handler) http.Handler
	RateLimit      func(http.Handler) http.Handler
}

// Mount returns a chi.Router with all five compliance routes.
func Mount(deps Deps) chi.Router {
	r := chi.NewRouter()

	if deps.RateLimit != nil {
		r.Use(deps.RateLimit)
	}
	gate := func(_ string) func(http.Handler) http.Handler {
		return func(next http.Handler) http.Handler { return next }
	}
	if deps.PermissionGate != nil {
		gate = deps.PermissionGate
	}

	r.With(gate("compliance:read")).Get("/audit-events",
		AuditEventsHandler(AuditEventDeps{Reader: deps.Audit}))
	r.With(gate("compliance:read")).Get("/access-controls",
		AccessControlsHandler(AccessControlsDeps{Reader: deps.RBAC}))
	r.With(gate("compliance:read")).Get("/data-flow", DataFlowHandler())
	r.With(gate("compliance:read")).Get("/retention-status",
		RetentionStatusHandler(RetentionDeps{Reader: deps.Retention}))
	r.With(gate("compliance:read")).Get("/dlp-events",
		DLPEventsHandler(DLPEventDeps{Reader: deps.DLP}))
	return r
}

// writeComplianceJSON is the shared JSON writer for this package.
// Sets the X-Schema-Version header on every response.
func writeComplianceJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Schema-Version", SchemaVersion)
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// SetDeprecation marks a response field/endpoint as deprecated. Per
// RFC 8594 the value is an HTTP-date or "true". We use the IMF-fixdate
// form because most clients can parse it directly.
//
// Usage from within a handler, before WriteHeader:
//
//	SetDeprecation(w, deprecatedAt, "https://docs.sdlc.cc/api/audit-events#v1")
func SetDeprecation(w http.ResponseWriter, deprecatedAt string, sunsetLink string) {
	if deprecatedAt != "" {
		w.Header().Set("Deprecation", deprecatedAt)
	}
	if sunsetLink != "" {
		w.Header().Set("Link", "<"+sunsetLink+`>; rel="deprecation"`)
	}
}

// errBadQuery is the local query-parse error type.
type errBadQuery struct{ msg string }

func (e *errBadQuery) Error() string { return e.msg }
