package api

import "net/http"

func setupPlatformRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	superAdmin := AdminOnly()

	ph := NewPlatformHandler(deps.Tenants, deps.Screenings, deps.Seats, deps.Usage)
	mux.Handle("GET /api/v1/platform/overview",
		authChain(superAdmin(http.HandlerFunc(ph.Overview))))

	uh := NewPlatformUserHandler(deps.Users, deps.Tenants)
	mux.Handle("GET /api/v1/platform/users",
		authChain(superAdmin(http.HandlerFunc(uh.ListAllUsers))))

	kh := NewPlatformKeyHandler(deps.DB)
	mux.Handle("GET /api/v1/platform/keys",
		authChain(superAdmin(http.HandlerFunc(kh.ListAllKeys))))
	mux.Handle("PUT /api/v1/platform/keys/{id}/revoke",
		authChain(superAdmin(http.HandlerFunc(kh.RevokeKey))))

	th := NewPlatformTenantHandler(deps.Tenants, deps.Audit)
	mux.Handle("PUT /api/v1/platform/tenants/{id}/suspend",
		authChain(superAdmin(http.HandlerFunc(th.SuspendTenant))))
	mux.Handle("PUT /api/v1/platform/tenants/{id}/activate",
		authChain(superAdmin(http.HandlerFunc(th.ActivateTenant))))
}
