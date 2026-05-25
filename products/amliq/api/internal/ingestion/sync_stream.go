package ingestion

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// streamBatchSize is the upsert flush cadence for streaming sync.
// Tuned so batch_size × per-entity RAM stays well under 50MB for
// OpenSanctions-scale rows and so each DB round-trip fits inside
// Postgres' parameter budget with margin.
const streamBatchSize = 2_000

// SyncListStreaming fetches, parses, and reconciles a list entirely
// row-by-row. Peak RAM is bounded by streamBatchSize, not by the list
// size. Used when the registered parser implements StreamParser and
// the store implements StreamingEntityStore.
func (ss *SyncService) SyncListStreaming(
	ctx context.Context,
	tenantID domain.TenantID,
	listCfg domain.ListConfig,
	sp StreamParser,
	stream StreamingEntityStore,
) error {
	url := listCfg.EffectiveURL()
	log.Printf("sync(stream) %s for %s from %s", listCfg.ListID, tenantID, url)

	body, etag, err := ss.fetcher.FetchStreamWithETag(url, listCfg.ETag)
	if err != nil {
		return fmt.Errorf("fetch %s: %w", listCfg.ListID, err)
	}
	if body == nil {
		log.Printf("sync(stream) %s: not modified", listCfg.ListID)
		return ss.meta.UpdateLastSynced(
			ctx, tenantID, listCfg.ListID, time.Now().UTC(),
		)
	}
	defer body.Close()

	priorIDs, err := stream.IDsByListID(ctx, tenantID, listCfg.ListID)
	if err != nil {
		return fmt.Errorf("load prior ids %s: %w", listCfg.ListID, err)
	}
	unseen := make(map[string]struct{}, len(priorIDs))
	for _, id := range priorIDs {
		unseen[id] = struct{}{}
	}

	rc := &streamReconciler{
		ctx: ctx, tenantID: tenantID, listCfg: listCfg,
		store: stream, hook: ss.fpHook, unseen: unseen,
	}
	if err := sp.ParseStream(body, rc.consume); err != nil {
		return fmt.Errorf("parse(stream) %s: %w", listCfg.ListID, err)
	}
	if err := rc.flush(); err != nil {
		return err
	}
	if err := rc.retireUnseen(); err != nil {
		return err
	}

	log.Printf("sync(stream) %s: upserted=%d retired=%d",
		listCfg.ListID, rc.upserted, rc.retired)
	return ss.meta.RecordSync(ctx, domain.ListSyncMeta{
		TenantID: tenantID, ListID: listCfg.ListID, ETag: etag,
		EntityCount: rc.upserted, SyncedAt: time.Now().UTC(),
	})
}
