package ingestion

import (
	"context"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

// streamReconciler owns the per-batch state for a streaming sync:
// which IDs we've seen (so we can retire the complement at the end),
// the pending buffer that flushes at streamBatchSize, and counters
// for the final log line. Kept tiny on purpose — one reconciler
// lives for the duration of one list sync and is then discarded.
type streamReconciler struct {
	ctx      context.Context
	tenantID domain.TenantID
	listCfg  domain.ListConfig
	store    StreamingEntityStore
	hook     *FingerprintHook

	unseen   map[string]struct{} // prior IDs not yet re-emitted
	batch    []domain.Entity
	upserted int
	retired  int
}

// consume is the EntityEmitter the parser calls per row. Marks the
// ID as seen, appends to the batch, flushes when full.
func (rc *streamReconciler) consume(ent domain.Entity) error {
	id := ent.ID.String()
	delete(rc.unseen, id)
	rc.batch = append(rc.batch, ent)
	if len(rc.batch) >= streamBatchSize {
		return rc.flush()
	}
	return nil
}

func (rc *streamReconciler) flush() error {
	if len(rc.batch) == 0 {
		return nil
	}
	if err := rc.store.BulkUpsert(rc.ctx, rc.tenantID, rc.batch); err != nil {
		return fmt.Errorf("stream upsert: %w", err)
	}
	if rc.hook != nil {
		rc.hook.AfterUpsert(rc.batch)
	}
	rc.upserted += len(rc.batch)
	rc.batch = rc.batch[:0]
	return nil
}

// retireUnseen soft-deletes every prior ID that the stream did not
// re-emit. Runs once, at end of stream.
func (rc *streamReconciler) retireUnseen() error {
	if len(rc.unseen) == 0 {
		return nil
	}
	ids := make([]string, 0, len(rc.unseen))
	for id := range rc.unseen {
		ids = append(ids, id)
	}
	if err := rc.store.SoftDeleteByIDs(rc.ctx, rc.tenantID, ids); err != nil {
		return fmt.Errorf("stream retire: %w", err)
	}
	if rc.hook != nil {
		rc.hook.AfterDelete(toIDEntities(ids))
	}
	rc.retired = len(ids)
	return nil
}

// toIDEntities wraps bare ID strings in domain.Entity shells so the
// existing AfterDelete hook signature (which expects entities, not
// IDs) can be reused without a fork.
func toIDEntities(ids []string) []domain.Entity {
	out := make([]domain.Entity, 0, len(ids))
	for _, s := range ids {
		id, err := domain.NewEntityID(s)
		if err != nil {
			continue
		}
		out = append(out, domain.Entity{ID: id})
	}
	return out
}
