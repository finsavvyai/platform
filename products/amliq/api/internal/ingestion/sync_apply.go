package ingestion

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// applyAndRecord computes delta, applies changes, and records metadata.
func (ss *SyncService) applyAndRecord(
	ctx context.Context,
	tenantID domain.TenantID,
	listCfg domain.ListConfig,
	parsed []domain.Entity,
	etag string,
) error {
	previous, err := ss.store.ListByListID(ctx, tenantID, listCfg.ListID)
	if err != nil {
		return fmt.Errorf("load previous %s: %w", listCfg.ListID, err)
	}

	diff := ss.delta.Diff(previous, parsed)

	if err := ss.store.BulkUpsert(ctx, tenantID, diff.Added); err != nil {
		return fmt.Errorf("upsert added: %w", err)
	}
	if err := ss.store.BulkUpsert(ctx, tenantID, diff.Modified); err != nil {
		return fmt.Errorf("upsert modified: %w", err)
	}
	if err := ss.store.SoftDelete(ctx, tenantID, diff.Removed); err != nil {
		return fmt.Errorf("soft-delete: %w", err)
	}

	// Sync fingerprints for changed entities
	if ss.fpHook != nil {
		ss.fpHook.AfterUpsert(diff.Added)
		ss.fpHook.AfterUpsert(diff.Modified)
		ss.fpHook.AfterDelete(diff.Removed)
	}

	log.Printf("sync %s: +%d ~%d -%d",
		listCfg.ListID, len(diff.Added), len(diff.Modified), len(diff.Removed))

	meta := domain.ListSyncMeta{
		TenantID:    tenantID,
		ListID:      listCfg.ListID,
		ETag:        etag,
		EntityCount: len(parsed),
		SyncedAt:    time.Now().UTC(),
	}
	return ss.meta.RecordSync(ctx, meta)
}
