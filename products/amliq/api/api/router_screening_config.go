package api

import "net/http"

func setupScreeningConfigRoutes(
	mux *http.ServeMux,
	authChain func(http.Handler) http.Handler,
	adminOnly func(http.Handler) http.Handler,
) {
	mux.Handle("GET /api/v1/config/screening",
		authChain(http.HandlerFunc(handleGetScreeningConfig)))
	mux.Handle("PUT /api/v1/config/screening",
		authChain(adminOnly(http.HandlerFunc(handleUpdateScreeningConfig))))
	mux.Handle("POST /api/v1/config/screening/reset",
		authChain(adminOnly(http.HandlerFunc(handleResetScreeningConfig))))
}
