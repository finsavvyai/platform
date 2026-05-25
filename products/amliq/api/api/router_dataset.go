package api

import "net/http"

func setupDatasetRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	dh := NewDatasetHandler(deps.Entities)
	dd := NewDatasetDeltaHandler(deps.Entities)

	mux.Handle("GET /api/v1/dataset/latest",
		authChain(http.HandlerFunc(dh.Latest)))
	mux.Handle("GET /api/v1/dataset/delta",
		authChain(http.HandlerFunc(dd.Delta)))
}
