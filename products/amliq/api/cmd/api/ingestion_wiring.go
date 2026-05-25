package main

import (
	"context"
	"time"

	"github.com/aegis-aml/aegis/api"
	"github.com/aegis-aml/aegis/internal/alerting"
	"github.com/aegis-aml/aegis/internal/ingestion"
	"github.com/aegis-aml/aegis/internal/screening"
	"github.com/aegis-aml/aegis/internal/storage/pgx"
)

// buildIngestionSvc constructs SyncSvc/RefreshSvc synchronously so admin
// routes that guard on these dependencies (POST /lists/{id}/sync,
// /admin/lists/refresh) register during SetupRoutes. No network calls.
func buildIngestionSvc(
	pool *pgx.Pool,
	entityRepo *pgx.EntityRepository,
	deps *api.Dependencies,
) {
	listMeta := pgx.NewListMetaRepository(pool.DB())
	fetcher := ingestion.NewListFetcher(60 * time.Second)
	delta := ingestion.NewDeltaEngine()
	syncSvc := ingestion.NewSyncService(
		fetcher, buildRegistry(), delta, entityRepo, listMeta,
	)
	syncSvc.WithFingerprintHook(ingestion.NewFingerprintHook(pool.DB()))
	limiterDL := ingestion.NewDownloadLimiter(5 * time.Second)
	deps.SyncSvc = syncSvc

	auditStore := pgx.NewAuditEventsSQL(pool.DB())
	auditRepo := pgx.NewListSyncAuditRepo(pool.DB())
	recorder := alerting.NewRecordingAlerter(
		auditRepo, alerting.BuildDefaultChannels(auditStore))
	deps.RefreshSvc = ingestion.NewRefreshService(
		syncSvc, deps.Tenants, limiterDL).WithRecorder(recorder)
}

// setupIngestion launches the 6-hourly daily-sync ticker. Must run
// after heavy indexes hydrate so engine.GetSearchIndex() is non-nil.
func setupIngestion(
	ctx context.Context,
	entityRepo *pgx.EntityRepository,
	engine *screening.Engine,
	deps *api.Dependencies,
) {
	go runDailySync(ctx, deps.RefreshSvc, engine.GetSearchIndex(), entityRepo)
}
