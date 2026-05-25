package api

import "net/http"

func setupHealthRoutes(mux *http.ServeMux, deps *Dependencies) {
	hh := NewHealthHandler(deps.DB, "2.0.0")
	mux.HandleFunc("GET /health", hh.Health)
	mux.HandleFunc("GET /health/full", hh.HealthFull)
	mux.HandleFunc("GET /ready", hh.Ready)
	if deps.Metrics != nil {
		lh := NewLatencyHandler(deps.Metrics)
		mux.HandleFunc("GET /health/latency", lh.Get)
		// Public HTML dashboard backing the "sub-50ms, measured"
		// marketing claim — linkable before the main web app is rebuilt.
		mux.HandleFunc("GET /status", latencyPage)
		mux.HandleFunc("GET /status/", latencyPage)
	}
}
