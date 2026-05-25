package api

import (
	"net/http"

	spgx "github.com/aegis-aml/aegis/internal/storage/pgx"
)

func setupAdminRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	admin := AdminOnly()
	ah := NewAdminHandler(deps.Tenants, deps.Screenings, deps.Usage)
	ad := NewAdminDetailHandler(deps.Tenants, deps.Screenings)
	am := NewAdminManageHandler(deps.Tenants, deps.Audit)

	mux.Handle("GET /api/v1/admin/tenants",
		authChain(admin(http.HandlerFunc(ah.ListTenants))))
	mux.Handle("POST /api/v1/admin/tenants",
		authChain(admin(http.HandlerFunc(am.CreateTenant))))
	mux.Handle("GET /api/v1/admin/tenants/{id}",
		authChain(admin(http.HandlerFunc(ad.GetTenant))))
	mux.Handle("PUT /api/v1/admin/tenants/{id}/config",
		authChain(admin(http.HandlerFunc(am.UpdateTenantConfig))))

	hh := NewHealthHandler(deps.DB, "2.0.0")
	mux.Handle("GET /api/v1/admin/health",
		authChain(admin(http.HandlerFunc(hh.Health))))

	if deps.HealthTracker != nil {
		sh := NewSourceHealthHandler(deps.HealthTracker)
		mux.Handle("GET /api/v1/admin/sources/health",
			authChain(admin(http.HandlerFunc(sh.GetHealth))))
	}

	if deps.RefreshSvc != nil {
		rh := NewRefreshHandler(deps.RefreshSvc, deps.Audit)
		mux.Handle("POST /api/v1/admin/lists/refresh",
			authChain(admin(http.HandlerFunc(rh.TriggerRefresh))))
	}

	// Tenant admin: manage per-tenant EnabledLists (mandatory locked on).
	tlh := NewTenantListsHandler(deps.Tenants)
	mux.Handle("GET /api/v1/admin/tenants/{id}/lists",
		authChain(admin(http.HandlerFunc(tlh.Get))))
	mux.Handle("PUT /api/v1/admin/tenants/{id}/lists",
		authChain(admin(http.HandlerFunc(tlh.Put))))

	// System admin: list sync audit / health. Shows every SyncList
	// attempt (worker daily cron, manual refresh, reingest-global).
	lsah := NewListSyncAuditHandler(deps.DB)
	mux.Handle("GET /api/v1/admin/list-sync-audit",
		authChain(admin(http.HandlerFunc(lsah.List))))

	// Entity & screening history
	historyRepo := spgx.NewEntityHistoryRepo(deps.DB)
	archiver := spgx.NewScreeningArchiver(deps.DB)
	histH := NewHistoryHandler(historyRepo, archiver)
	mux.Handle("GET /api/v1/history/entity/{id}",
		authChain(http.HandlerFunc(histH.EntityHistory)))
	mux.Handle("GET /api/v1/history/removed",
		authChain(http.HandlerFunc(histH.RemovedEntities)))
	mux.Handle("GET /api/v1/history/archive/stats",
		authChain(admin(http.HandlerFunc(histH.ArchiveStats))))

	// Data source management
	srcH := NewAdminSourcesHandler(deps.DB)
	mux.Handle("GET /api/v1/admin/data-sources",
		authChain(admin(http.HandlerFunc(srcH.ListSources))))

	uplH := NewAdminUploadHandler(deps.Entities)
	mux.Handle("POST /api/v1/admin/data-sources/upload",
		authChain(admin(http.HandlerFunc(uplH.Upload))))

	if deps.Metrics != nil {
		mh := NewMetricsHandler(deps.Metrics)
		mux.Handle("GET /api/v1/admin/metrics",
			authChain(admin(http.HandlerFunc(mh.GetMetrics))))
		mux.Handle("GET /api/v1/admin/metrics/prometheus",
			authChain(admin(http.HandlerFunc(mh.GetPrometheus))))
	}
}
