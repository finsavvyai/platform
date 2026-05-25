package api

import "net/http"

func setupMonitorProfileRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	if deps.MonitorProfiles == nil || deps.MonitorAlerts == nil {
		return
	}
	ph := NewMonitorProfileHandler(deps.MonitorProfiles)
	ah := NewMonitorAlertHandler(deps.MonitorAlerts, deps.MonitorProfiles)
	writeOnly := WriteAccess()

	// Profile CRUD
	mux.Handle("POST /api/v1/monitor",
		authChain(writeOnly(http.HandlerFunc(ph.Create))))
	mux.Handle("GET /api/v1/monitor",
		authChain(http.HandlerFunc(ph.List)))
	mux.Handle("PUT /api/v1/monitor/{id}",
		authChain(writeOnly(http.HandlerFunc(ph.Update))))
	mux.Handle("DELETE /api/v1/monitor/{id}",
		authChain(writeOnly(http.HandlerFunc(ph.Delete))))

	// Alert endpoints
	mux.Handle("GET /api/v1/monitor/alerts",
		authChain(http.HandlerFunc(ah.ListAlerts)))
	mux.Handle("PUT /api/v1/monitor/alerts/{id}/review",
		authChain(writeOnly(http.HandlerFunc(ah.ReviewAlert))))
	mux.Handle("GET /api/v1/monitor/dashboard",
		authChain(http.HandlerFunc(ah.Dashboard)))
}
