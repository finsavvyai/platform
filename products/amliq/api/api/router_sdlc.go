package api

import (
	"database/sql"
	"net/http"

	"github.com/aegis-aml/aegis/internal/config"
)

// SetupSDLCRoutes mounts only the gateway product's surface — no
// AML / sanctions / cases / monitors / vessel / crypto. Used by
// cmd/sdlc-api to ship sdlc.cc as a separate binary from cmd/api.
//
// Shared dependencies (auth, audit, billing, AI infrastructure)
// behave identically to cmd/api; the difference is purely which
// HTTP handlers get registered. That keeps the security model
// auditable: same code paths, same DLP, same SSO, smaller surface.
func SetupSDLCRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
	authCfg config.AuthConfig,
	oauthCfg config.OAuthConfig,
) {
	// Health + readiness — Render needs these for liveness probes.
	setupHealthRoutes(mux, deps)

	// Auth surfaces — login/signup/SSO/MFA. Customers using sdlc.cc
	// log in to manage team + view audit + configure DLP policies.
	setupAuthRoutes(mux, deps.Users, deps.Tenants, authChain,
		authCfg.TokenSecret, authCfg.TokenExpiry, oauthCfg)
	setupAuthResetRoutes(mux, deps.DB, deps.Users, authChain,
		authCfg.TokenSecret)

	// AI gateway — the actual product. /v1/messages,
	// /api/v1/ai/summarize, /api/v1/ai/requests, /api/v1/team/ai-cost
	setupAIRoutes(mux, deps, authChain)

	// Team management — invite/list/role/remove + AI-usage view.
	setupTeamRoutes(mux, deps, authChain)

	// SAML SSO — per-tenant config (mig 070 + 071).
	setupSSORoutes(mux, deps.DB)

	// Docs — swagger UI for customer integration.
	setupDocsRoutes(mux)
}

// NewAuthChain stitches together the standard auth middleware
// chain so cmd/sdlc-api doesn't have to reimplement it. Reads
// JWTs — same shape as cmd/api uses.
func NewAuthChain(authCfg config.AuthConfig, db *sql.DB, deps *Dependencies) func(http.Handler) http.Handler {
	return JWTMiddleware(authCfg.TokenSecret)
}
