package api

import "net/http"

func setupMonitorRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	mh := NewMonitorHandler(deps.Monitors)
	writeOnly := WriteAccess()
	mux.Handle("POST /api/v1/monitors",
		authChain(writeOnly(http.HandlerFunc(mh.Create))))
	mux.Handle("GET /api/v1/monitors",
		authChain(http.HandlerFunc(mh.List)))
	mux.Handle("DELETE /api/v1/monitors/{id}",
		authChain(writeOnly(http.HandlerFunc(mh.Delete))))
}

func setupRiskRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	usageCheck := UsageEnforcementMiddleware(deps.Enforcer)
	mux.Handle("POST /api/v1/risk/score",
		authChain(usageCheck(http.HandlerFunc(handleRiskScore))))
	adminOnly := AdminOnly()
	mux.Handle("GET /api/v1/match-config",
		authChain(http.HandlerFunc(handleGetMatchConfig)))
	mux.Handle("PUT /api/v1/match-config",
		authChain(adminOnly(http.HandlerFunc(handleUpdateMatchConfig))))
}

func setupVesselRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	vh := NewVesselHandler(deps.Entities)
	usageCheck := UsageEnforcementMiddleware(deps.Enforcer)
	mux.Handle("POST /api/v1/vessel/screen",
		authChain(usageCheck(http.HandlerFunc(vh.HandleScreen))))
}

func setupCountryRiskRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	if deps.CountryRiskIdx == nil {
		return
	}
	crh := NewCountryRiskHandler(deps.CountryRiskIdx)
	mux.Handle("GET /api/v1/country-risk/{code}",
		authChain(http.HandlerFunc(crh.GetByCode)))
	mux.Handle("GET /api/v1/country-risk",
		authChain(http.HandlerFunc(crh.ListAll)))
	adminOnly := AdminOnly()
	mux.Handle("PUT /api/v1/country-risk/{code}/override",
		authChain(adminOnly(http.HandlerFunc(crh.SetOverride))))
}

func setupUBORoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	uh := NewUBOHandler(deps.UBOs)
	sh := NewUBOScreenHandler(deps.UBOs, deps.Screenings)
	writeOnly := WriteAccess()
	mux.Handle("POST /api/v1/ubo",
		authChain(writeOnly(http.HandlerFunc(uh.AddOwner))))
	mux.Handle("GET /api/v1/ubo/{id}",
		authChain(http.HandlerFunc(uh.ListByOrg)))
	mux.Handle("DELETE /api/v1/ubo/{owner_id}",
		authChain(writeOnly(http.HandlerFunc(uh.DeleteOwner))))
	uboUsageCheck := UsageEnforcementMiddleware(deps.Enforcer)
	mux.Handle("POST /api/v1/ubo/{id}/screen",
		authChain(uboUsageCheck(http.HandlerFunc(sh.ScreenChain))))
}

func setupEDDRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	eh := NewEDDHandler(deps.EDDs)
	writeOnly := WriteAccess()
	mux.Handle("POST /api/v1/edd",
		authChain(writeOnly(http.HandlerFunc(eh.Create))))
	mux.Handle("GET /api/v1/edd/{id}",
		authChain(http.HandlerFunc(eh.Get)))
}
