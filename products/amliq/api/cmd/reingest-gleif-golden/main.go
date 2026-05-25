// Command reingest-gleif-golden downloads the daily GLEIF Golden
// Copy LEI-CDF ZIP (~880MB), streams the embedded XML through the
// gleif_xml StreamParser, and batch-upserts every LEIRecord
// under the __global__ tenant. Unlocks the full 3.28M LEI dataset
// that the paginated API (cmd/reingest-gleif) can't reach past its
// ~20K offset cap.
//
// Usage:
//
//	go run ./cmd/reingest-gleif-golden
//	go run ./cmd/reingest-gleif-golden --url https://...xml.zip
//	go run ./cmd/reingest-gleif-golden --batch 500 --dry-run
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

// defaultURL is the GLEIF Golden Copy "latest" endpoint. It 302s to
// the dated ZIP file on the GLEIF storage bucket.
const defaultURL = "https://leidata-preview.gleif.org/api/v2/golden-copies/publishes/lei2/latest.xml"

func main() {
	var (
		url        = flag.String("url", defaultURL, "Golden Copy ZIP URL")
		batch      = flag.Int("batch", 500, "Upsert batch size")
		dryRun     = flag.Bool("dry-run", false, "Parse only, skip DB upsert")
		maxRecords = flag.Int("max-records", 0,
			"Stop after this many records (0 = all). Use for smoke tests.")
	)
	flag.Parse()

	cfg := config.Load()
	pool, err := pgx.NewPool(cfg.Database.URL)
	if err != nil {
		log.Fatalf("reingest-gleif-golden: db pool: %v", err)
	}
	defer pool.Close()

	d := newDeps(pool, 30*time.Minute)
	ctx := context.Background()
	stats, err := runGolden(ctx, d, *url, *batch, *dryRun, *maxRecords)
	log.Printf("reingest-gleif-golden: entities=%d batches=%d errors=%d",
		stats.entities, stats.batches, stats.errors)
	if err != nil {
		log.Printf("reingest-gleif-golden: aborted: %v", err)
		os.Exit(1)
	}
}
