package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/tasklog"
)

func setupAdminOpsRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	if deps.TaskRegistry == nil {
		return
	}

	admin := AdminOnly()
	ops := NewAdminOpsHandler(deps.DB, deps.TaskRegistry)

	// Admin-only operations
	mux.Handle("POST /api/v1/admin/ops/migrate",
		authChain(admin(http.HandlerFunc(ops.RunMigrations))))
	mux.Handle("POST /api/v1/admin/ops/seed",
		authChain(admin(http.HandlerFunc(ops.SeedExtra))))
	mux.Handle("POST /api/v1/admin/ops/sync-fingerprints",
		authChain(admin(http.HandlerFunc(ops.SyncFingerprints))))
	mux.Handle("POST /api/v1/admin/lists/{id}/sync-fingerprints",
		authChain(admin(http.HandlerFunc(ops.SyncListFingerprints))))

	// Crypto wallet sync
	if deps.CryptoSyncSvc != nil {
		cryptoH := NewCryptoSyncHandler(deps.CryptoSyncSvc, deps.TaskRegistry)
		mux.Handle("POST /api/v1/admin/ops/sync-crypto",
			authChain(admin(http.HandlerFunc(cryptoH.SyncAll))))
	}

	// Diagnostic: test Israeli gov source connectivity
	testH := NewTestFetchHandler()
	mux.Handle("GET /api/v1/admin/ops/test-fetch",
		authChain(admin(http.HandlerFunc(testH.TestIsraeliSources))))

	// Task log — admin sees all
	tasks := NewTasksHandler(deps.TaskRegistry)
	mux.Handle("GET /api/v1/admin/tasks",
		authChain(admin(http.HandlerFunc(tasks.ListAll))))

	// Task log — tenant managers see their own
	mux.Handle("GET /api/v1/tasks",
		authChain(http.HandlerFunc(tasks.ListForTenant)))

	// Alert config for task failures
	alertStore := deps.AlertConfigStore
	if alertStore == nil {
		alertStore = NewAlertConfigStore()
	}
	alertH := NewTaskAlertHandler(alertStore)
	mux.Handle("GET /api/v1/tasks/alerts",
		authChain(http.HandlerFunc(alertH.GetConfig)))
	mux.Handle("PUT /api/v1/tasks/alerts",
		authChain(http.HandlerFunc(alertH.UpdateConfig)))
}

func registerCronTask(reg *tasklog.Registry, name string) string {
	return reg.Start(name, "cron", "system", "")
}
