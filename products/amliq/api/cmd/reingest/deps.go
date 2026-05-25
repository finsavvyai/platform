package main

import (
	"fmt"
	"time"

	"github.com/aegis-aml/aegis/internal/config"
	"github.com/aegis-aml/aegis/internal/ingestion"
	"github.com/aegis-aml/aegis/internal/storage/pgx"
)

// reingestDeps bundles everything needed to run a reingest pass.
type reingestDeps struct {
	pool       *pgx.Pool
	refreshSvc *ingestion.RefreshService
}

func (d *reingestDeps) close() {
	if d.pool != nil {
		d.pool.Close()
	}
}

// buildReingestDeps wires DB pool, parser registry, stores and services.
// Uses the same rate limiter as daily refresh to stay polite to sources.
func buildReingestDeps() (*reingestDeps, error) {
	cfg := config.Load()
	pool, err := pgx.NewPool(cfg.Database.URL)
	if err != nil {
		return nil, fmt.Errorf("db pool: %w", err)
	}

	db := pool.DB()
	registry := buildReingestRegistry()
	fetcher := ingestion.NewListFetcher(60 * time.Second)
	delta := ingestion.NewDeltaEngine()
	entities := pgx.NewEntityRepository(db)
	listMeta := pgx.NewListMetaRepository(db)
	tenants := pgx.NewTenantRepository(db)

	syncSvc := ingestion.NewSyncService(
		fetcher, registry, delta, entities, listMeta,
	)
	syncSvc.WithFingerprintHook(ingestion.NewFingerprintHook(db))

	limiter := ingestion.NewDownloadLimiter(5 * time.Second)
	refreshSvc := ingestion.NewRefreshService(syncSvc, tenants, limiter)

	return &reingestDeps{pool: pool, refreshSvc: refreshSvc}, nil
}
