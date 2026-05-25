package api

import "net/http"

func setupEntityRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	detail := NewEntityDetailHandler(deps.Entities)
	mux.Handle("GET /api/v1/entities/{id}",
		authChain(http.HandlerFunc(detail.GetByID)))
}
