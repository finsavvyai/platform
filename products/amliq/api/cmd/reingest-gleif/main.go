// Command reingest-gleif paginates the GLEIF LEI public API
// (api.gleif.org) and upserts Company entities under the __global__
// tenant. GLEIF has ~3.28M LEIs as of 2026-Q2 so a full cold ingest
// runs for hours; --max-pages caps the run for starter-plan capacity
// and --start-page supports resume after a crash.
//
// Usage (on Render shell or locally):
//
//	go run ./cmd/reingest-gleif --page-size 200 --max-pages 100
//	go run ./cmd/reingest-gleif --start-page 101 --max-pages 100
package main

import (
	"context"
	"flag"
	"log"
	"os"
	"time"

	"github.com/aegis-aml/aegis/internal/config"
	"github.com/aegis-aml/aegis/internal/storage/pgx"
)

func main() {
	var (
		pageSize  = flag.Int("page-size", 200, "Records per GLEIF API page (max 200)")
		startPage = flag.Int("start-page", 1, "First page to fetch (1-indexed)")
		maxPages  = flag.Int("max-pages", 100, "How many pages to fetch before stopping")
		pageSleep = flag.Duration("page-sleep", 250*time.Millisecond,
			"Pause between GLEIF API calls to respect rate limits")
		jurisdiction = flag.String("jurisdiction", "",
			"Optional ISO-3166-1 alpha-2 country code (e.g. IL, US, DE) "+
				"— GLEIF's global pagination caps at ~20K records, so "+
				"per-jurisdiction scans are the only path to full "+
				"coverage via the JSON API")
	)
	flag.Parse()

	cfg := config.Load()
	pool, err := pgx.NewPool(cfg.Database.URL)
	if err != nil {
		log.Fatalf("reingest-gleif: db pool: %v", err)
	}
	defer pool.Close()

	d := newDeps(pool)
	ctx := context.Background()
	stats, err := runGLEIF(ctx, d, *startPage, *pageSize, *maxPages, *pageSleep, *jurisdiction)
	log.Printf("reingest-gleif: pages=%d entities=%d errors=%d",
		stats.pages, stats.entities, stats.errors)
	if err != nil {
		log.Printf("reingest-gleif: aborted: %v", err)
		os.Exit(1)
	}
}
