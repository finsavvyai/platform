package main

import (
	"context"
	"database/sql"
	"log"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/ingestion"
)

// selectTargets returns either every configured list (--all) or just
// the single list whose ListID matches `listID`.
func selectTargets(all bool, listID string) []domain.ListConfig {
	configs := ingestion.AllListConfigs()
	if all {
		return configs
	}
	out := make([]domain.ListConfig, 0, 1)
	for _, lc := range configs {
		if lc.ListID == listID {
			out = append(out, lc)
		}
	}
	return out
}

// runAll iterates every target, delegating to runBackfill and
// tallying (ok, skipped, failed). A missing parser counts as skipped,
// not failed — the run keeps going.
func runAll(
	ctx context.Context, db *sql.DB, tr *ingestion.TypeRegistry,
	fetcher *ingestion.ListFetcher, targets []domain.ListConfig, batch int,
) (ok, skipped, failed int) {
	for i, lc := range targets {
		log.Printf("[%d/%d] %s (%s)",
			i+1, len(targets), lc.ListID, lc.ParserType)
		if _, err := tr.Get(lc.ParserType); err != nil {
			log.Printf("  skip: %v", err)
			skipped++
			continue
		}
		if err := runBackfill(ctx, db, tr, fetcher, lc, batch); err != nil {
			log.Printf("  error: %v", err)
			failed++
			continue
		}
		ok++
	}
	return ok, skipped, failed
}
