package api

import "net/http"

func setupComplianceRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	setupCaseRoutes(mux, deps, authChain)
	setupMonitorRoutes(mux, deps, authChain)
	setupRiskRoutes(mux, deps, authChain)
	setupUBORoutes(mux, deps, authChain)
	setupEDDRoutes(mux, deps, authChain)
	setupPEPRoutes(mux, deps, authChain)
	setupMediaRoutes(mux, deps, authChain)
	setupReportRoutes(mux, deps, authChain)
	setupSARRoutes(mux, deps, authChain)
	setupEnforcementRoutes(mux, deps, authChain)
	setupVesselRoutes(mux, deps, authChain)
	setupCountryRiskRoutes(mux, deps, authChain)
}

func setupEnforcementRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	if deps.Enforcements == nil {
		return
	}
	eh := NewEnforcementHandler(deps.Enforcements)
	usageCheck := UsageEnforcementMiddleware(deps.Enforcer)
	mux.Handle("GET /api/v1/enforcement/{id}",
		authChain(http.HandlerFunc(eh.GetByEntity)))
	mux.Handle("GET /api/v1/enforcement/search",
		authChain(usageCheck(http.HandlerFunc(eh.Search))))
}

func setupReportRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	rh := NewReportHandler(deps.Screenings, deps.Alerts, deps.CaseQueries)
	mux.Handle("POST /api/v1/reports/generate",
		authChain(http.HandlerFunc(rh.Generate)))
	mux.Handle("GET /api/v1/reports",
		authChain(http.HandlerFunc(rh.ListReports)))
}

func setupPEPRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	ph := NewPEPHandler(deps.PEPs)
	usageCheck := UsageEnforcementMiddleware(deps.Enforcer)
	mux.Handle("POST /api/v1/pep/screen",
		authChain(usageCheck(http.HandlerFunc(ph.Screen))))
	mux.Handle("GET /api/v1/pep",
		authChain(http.HandlerFunc(ph.ListByCountry)))
	// Public endpoint: 2 req/hr per IP, bot-blocked
	mux.HandleFunc("POST /api/v1/pep/public-search",
		PublicPEPScreen(deps.PEPs))
}

func setupMediaRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	mh := NewMediaHandler(deps.Media)
	writeOnly := WriteAccess()
	mux.Handle("GET /api/v1/media/entity/{id}",
		authChain(http.HandlerFunc(mh.GetByEntity)))
	mux.Handle("PUT /api/v1/media/results/{id}/review",
		authChain(writeOnly(http.HandlerFunc(ReviewMediaHit))))
}

func setupCaseRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	ch := NewCaseHandler(deps.Cases, deps.CaseQueries, deps.CaseComments)
	ah := NewCaseActionHandler(deps.Cases)
	writeOnly := WriteAccess()
	mux.Handle("GET /api/v1/cases",
		authChain(http.HandlerFunc(ch.ListCases)))
	mux.Handle("GET /api/v1/cases/{id}",
		authChain(http.HandlerFunc(ch.GetCase)))
	mux.Handle("PUT /api/v1/cases/{id}/assign",
		authChain(writeOnly(http.HandlerFunc(ah.Assign))))
	mux.Handle("PUT /api/v1/cases/{id}/escalate",
		authChain(writeOnly(http.HandlerFunc(ah.Escalate))))
	mux.Handle("PUT /api/v1/cases/{id}/resolve",
		authChain(writeOnly(http.HandlerFunc(ah.Resolve))))
	mux.Handle("PUT /api/v1/cases/{id}/review",
		authChain(writeOnly(http.HandlerFunc(handleFourEyesSubmit(deps.Cases)))))
	mux.Handle("POST /api/v1/cases/bulk-resolve",
		authChain(writeOnly(http.HandlerFunc(handleBulkResolve(deps.Cases)))))
	setupCaseWorkflowRoutes(mux, deps, authChain)
}
