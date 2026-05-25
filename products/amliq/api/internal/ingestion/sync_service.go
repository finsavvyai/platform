package ingestion

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// SyncService orchestrates fetch → parse → delta → upsert per tenant.
type SyncService struct {
	fetcher  *ListFetcher
	registry *Registry
	delta    *DeltaEngine
	store    EntityStore
	meta     ListMetaStore
	fpHook   *FingerprintHook
	lmHook   *ListMonitorHook
}

// NewSyncService creates a new sync service with all dependencies.
func NewSyncService(
	fetcher *ListFetcher,
	registry *Registry,
	delta *DeltaEngine,
	store EntityStore,
	meta ListMetaStore,
) *SyncService {
	return &SyncService{
		fetcher:  fetcher,
		registry: registry,
		delta:    delta,
		store:    store,
		meta:     meta,
	}
}

// WithFingerprintHook attaches fingerprint generation to entity sync.
func (ss *SyncService) WithFingerprintHook(hook *FingerprintHook) {
	ss.fpHook = hook
}

// WithListMonitorHook attaches list_monitors upsert after syncs.
func (ss *SyncService) WithListMonitorHook(hook *ListMonitorHook) {
	ss.lmHook = hook
}

// SyncList fetches, parses, diffs, and applies one list for one tenant.
// When both the parser and the store support streaming the memory-
// bounded path runs automatically — buffered path is the fallback.
// Thin wrapper around SyncListWithStats that drops the stats; kept
// for backwards compatibility with existing callers.
func (ss *SyncService) SyncList(
	ctx context.Context,
	tenantID domain.TenantID,
	listCfg domain.ListConfig,
) error {
	_, err := ss.SyncListWithStats(ctx, tenantID, listCfg)
	return err
}

// SyncListWithStats is the same as SyncList but returns parse/coverage
// stats so audit-aware callers (hybrid refresh, manual refresh) can
// persist per-sync enrichment metrics into list_sync_audit.
func (ss *SyncService) SyncListWithStats(
	ctx context.Context,
	tenantID domain.TenantID,
	listCfg domain.ListConfig,
) (*SyncResult, error) {
	parser, err := ss.registry.GetByType(listCfg.ParserType)
	if err != nil {
		return nil, fmt.Errorf("parser %s: %w", listCfg.ParserType, err)
	}

	if sp, ok := parser.(StreamParser); ok {
		if stream, ok := ss.store.(StreamingEntityStore); ok {
			err := ss.SyncListStreaming(ctx, tenantID, listCfg, sp, stream)
			return nil, err
		}
	}

	url := listCfg.EffectiveURL()
	log.Printf("sync %s for tenant %s from %s", listCfg.ListID, tenantID, url)

	data, etag, err := ss.fetcher.FetchWithETag(url, listCfg.ETag)
	if err != nil {
		return nil, fmt.Errorf("fetch %s: %w", listCfg.ListID, err)
	}
	if data == nil {
		log.Printf("sync %s: not modified (etag match)", listCfg.ListID)
		if err := ss.meta.UpdateLastSynced(ctx, tenantID, listCfg.ListID, time.Now().UTC()); err != nil {
			return nil, err
		}
		return &SyncResult{NotModified: true}, nil
	}

	parsed, err := parser.Parse(data)
	if err != nil {
		return nil, fmt.Errorf("parse %s: %w", listCfg.ListID, err)
	}

	if err := ss.applyAndRecord(ctx, tenantID, listCfg, parsed, etag); err != nil {
		return nil, err
	}
	return &SyncResult{
		SourceBytes:    len(data),
		ParsedEntities: len(parsed),
		Coverage:       countCoverage(parsed),
	}, nil
}
