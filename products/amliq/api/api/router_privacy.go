package api

import "net/http"

// setupPrivacyRoutes registers GDPR-related endpoints. Public:
// the sub-processor directory (auditor + customer visibility).
// Authenticated + admin-only: the data-subject erasure call.
func setupPrivacyRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	mux.HandleFunc("GET /api/v1/privacy/subprocessors",
		HandleSubProcessors)
	mux.HandleFunc("GET /api/v1/privacy/subprocessors/changelog",
		HandleSubProcessorChangelog)

	if deps.DB == nil {
		return
	}
	ph := NewPrivacyHandler(deps.DB)
	mux.Handle("POST /api/v1/privacy/erase",
		authChain(http.HandlerFunc(ph.Erase)))
}
