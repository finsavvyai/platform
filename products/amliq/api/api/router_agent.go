package api

import "net/http"

// setupAgentRoutes registers on-premise agent management routes.
func setupAgentRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	handler := NewAgentHandler()

	mux.Handle("POST /api/v1/agent/register",
		authChain(http.HandlerFunc(handler.Register)))

	mux.Handle("GET /api/v1/agent/lists/latest",
		authChain(http.HandlerFunc(handler.LatestLists)))

	mux.Handle("GET /api/v1/agent/lists/delta",
		authChain(http.HandlerFunc(handler.DeltaLists)))

	mux.Handle("POST /api/v1/agent/results",
		authChain(http.HandlerFunc(handler.ReportResults)))
}
