package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/ingestion"
	pgxs "github.com/aegis-aml/aegis/internal/storage/pgx"
)

// runBackfill fetches + parses the feed for `lc`, then writes only
// the 3 rich JSONB cols via a temp table + UPDATE...FROM.
func runBackfill(
	ctx context.Context, db *sql.DB, tr *ingestion.TypeRegistry,
	fetcher *ingestion.ListFetcher, lc domain.ListConfig, batch int,
) error {
	parser, err := tr.Get(lc.ParserType)
	if err != nil {
		return fmt.Errorf("parser %q: %w", lc.ParserType, err)
	}
	data, _, err := fetcher.Fetch(lc.EffectiveURL())
	if err != nil {
		return fmt.Errorf("fetch: %w", err)
	}
	log.Printf("  fetched %d bytes", len(data))

	entities, err := parser.Parse(data)
	if err != nil {
		return fmt.Errorf("parse: %w", err)
	}
	log.Printf("  parsed %d entities", len(entities))

	rows := buildRichRows(entities)
	log.Printf("  %d rows have rich data (of %d)", len(rows), len(entities))
	if len(rows) == 0 {
		return nil
	}
	return applyBackfill(ctx, db, rows, batch)
}

// richRow is one row of the TEMP TABLE staged before UPDATE...FROM.
type richRow struct {
	id               string
	addrs, ids, alts []byte // JSONB; nil → NULL
}

func buildRichRows(entities []domain.Entity) []richRow {
	out := make([]richRow, 0, len(entities))
	for _, e := range entities {
		a, i, al := pgxs.MarshalRichCols(e)
		if a == nil && i == nil && al == nil {
			continue
		}
		out = append(out, richRow{
			id: e.ID.String(), addrs: a, ids: i, alts: al,
		})
	}
	return out
}

