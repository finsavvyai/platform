package api

import "net/http"

func setupAPIKeyRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	adminOnly := AdminOnly()
	kh := NewSelfKeyHandler(deps.DB)
	mux.Handle("POST /api/v1/keys",
		authChain(adminOnly(http.HandlerFunc(kh.GenerateKey))))
	mux.Handle("GET /api/v1/keys",
		authChain(http.HandlerFunc(kh.ListKeys)))
	mux.Handle("DELETE /api/v1/keys/{id}",
		authChain(adminOnly(http.HandlerFunc(kh.RevokeKey))))
}
