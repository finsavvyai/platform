package ingestion

import (
	"context"
	"fmt"
	"log"

	"github.com/aegis-aml/aegis/internal/domain"
)

// ReingestList forces a full re-fetch and re-upsert of a list,
// bypassing ETag conditional requests. Used to refresh existing
// entities with newly extracted fields after a parser upgrade.
// If dryRun is true, parses only and skips the upsert/delete phase.
func (ss *SyncService) ReingestList(
	ctx context.Context,
	tenantID domain.TenantID,
	listCfg domain.ListConfig,
	dryRun bool,
) (int, error) {
	url := listCfg.EffectiveURL()
	log.Printf("reingest %s for tenant %s from %s (dryRun=%v)",
		listCfg.ListID, tenantID, url, dryRun)

	data, etag, err := ss.fetcher.Fetch(url)
	if err != nil {
		return 0, fmt.Errorf("fetch %s: %w", listCfg.ListID, err)
	}
	if len(data) == 0 {
		return 0, fmt.Errorf("reingest %s: empty payload", listCfg.ListID)
	}

	parser, err := ss.registry.GetByType(listCfg.ParserType)
	if err != nil {
		return 0, fmt.Errorf("parser %s: %w", listCfg.ParserType, err)
	}

	parsed, err := parser.Parse(data)
	if err != nil {
		return 0, fmt.Errorf("parse %s: %w", listCfg.ListID, err)
	}

	if dryRun {
		log.Printf("reingest %s dry-run: parsed %d entities", listCfg.ListID, len(parsed))
		return len(parsed), nil
	}

	if err := ss.applyAndRecord(ctx, tenantID, listCfg, parsed, etag); err != nil {
		return len(parsed), err
	}
	return len(parsed), nil
}
