package api

import "net/http"

func setupMarketplaceRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	marketplace := NewMarketplaceListsHandler(deps.Tenants, deps.DB)
	mux.Handle("GET /api/v1/lists/marketplace",
		authChain(http.HandlerFunc(marketplace.ListAll)))

	toggle := NewListToggleHandler(deps.Tenants)
	mux.Handle("POST /api/v1/lists/marketplace/{listId}/enable",
		authChain(http.HandlerFunc(toggle.Enable)))
	mux.Handle("POST /api/v1/lists/marketplace/{listId}/disable",
		authChain(http.HandlerFunc(toggle.Disable)))

	sched := NewListScheduleHandler(deps.Tenants)
	mux.Handle("PUT /api/v1/lists/marketplace/{listId}/schedule",
		authChain(http.HandlerFunc(sched.Update)))
}
