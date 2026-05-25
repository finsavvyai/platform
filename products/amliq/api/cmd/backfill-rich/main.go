package main

import (
	"context"
	"flag"
	"log"
	"os"
	"time"

	"github.com/aegis-aml/aegis/internal/config"
	"github.com/aegis-aml/aegis/internal/ingestion"
	"github.com/aegis-aml/aegis/internal/storage/pgx"
)

// backfill-rich: fast, targeted backfill of the `addresses`,
// `identifiers`, `aliases` JSONB columns on the entities table.
//
// Unlike cmd/reingest-global, this tool does NOT rewrite all 17
// columns with ON CONFLICT DO UPDATE — it only writes the three rich
// columns via a TEMP TABLE + single UPDATE...FROM, skipping every
// other index and column-level work. For 703k PEPs the full run is
// typically 2–5 minutes instead of ~2 hours.
//
// Usage (Render shell):
//
//	go run ./cmd/backfill-rich --all
//	go run ./cmd/backfill-rich --list opensanctions_peps
//	go run ./cmd/backfill-rich --all --batch 8000
func main() {
	var (
		all     = flag.Bool("all", false, "Backfill every list in AllListConfigs()")
		listID  = flag.String("list", "", "Backfill a single list by ListID")
		batch   = flag.Int("batch", 8000, "Rows per INSERT batch into temp")
		timeout = flag.Duration("timeout", 300*time.Second, "HTTP fetch timeout")
	)
	flag.Parse()
	if !*all && *listID == "" {
		log.Printf("backfill-rich: must pass --all or --list <id>")
		os.Exit(2)
	}

	cfg := config.Load()
	pool, err := pgx.NewPool(cfg.Database.URL)
	if err != nil {
		log.Fatalf("backfill-rich: db pool: %v", err)
	}
	defer pool.Close()

	tr := ingestion.NewTypeRegistry()
	ingestion.RegisterBulkParsers(tr)
	ingestion.RegisterExtendedParsers(tr)

	ctx := context.Background()
	targets := selectTargets(*all, *listID)
	if len(targets) == 0 {
		log.Fatalf("backfill-rich: no matching list configs (list=%q)", *listID)
	}
	ok, skipped, failed := runAll(ctx, pool.DB(), tr,
		ingestion.NewListFetcher(*timeout), targets, *batch)
	log.Printf("backfill-rich: done — ok=%d skipped=%d failed=%d",
		ok, skipped, failed)
	if failed > 0 {
		os.Exit(1)
	}
}
