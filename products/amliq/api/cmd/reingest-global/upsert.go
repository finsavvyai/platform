package main

import (
	"context"
	"log"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage/pgx"
)

// upsertBatched writes `entities` to the shared __global__ tenant.
// BulkUpsert now runs its internal batches in parallel so we no
// longer chunk here — we only emit a single log line per call.
// The `batch` arg is preserved for CLI compatibility but unused.
func upsertBatched(
	ctx context.Context, repo *pgx.EntityRepository,
	entities []domain.Entity, _ int,
) error {
	if len(entities) == 0 {
		return nil
	}
	tid := domain.SystemTenantID()
	log.Printf("  upserting %d entities (parallel batches)", len(entities))
	if err := repo.BulkUpsert(ctx, tid, entities); err != nil {
		return err
	}
	log.Printf("  upserted %d (100%%)", len(entities))
	return nil
}
