package main

import (
	"context"
	"flag"
	"log"
	"os"
	"time"

	"github.com/aegis-aml/aegis/internal/alerting"
	"github.com/aegis-aml/aegis/internal/config"
	"github.com/aegis-aml/aegis/internal/ingestion"
	"github.com/aegis-aml/aegis/internal/storage/pgx"
)

// reingest-global: fetch every (or one) sanctions / PEP / registry
// feed, re-parse with the richer parsers, and upsert under
// tenant_id='__global__'. Complements cmd/reingest-peps, which was
// limited to the OpenSanctions PEP feed.
//
// Usage (on Render shell):
//
//	go run ./cmd/reingest-global --all
//	go run ./cmd/reingest-global --list eu_consolidated
//	go run ./cmd/reingest-global --all --dry-run
//	go run ./cmd/reingest-global --all --batch 1000
func main() {
	var (
		all         = flag.Bool("all", false, "Reingest every list in AllListConfigs()")
		listID      = flag.String("list", "", "Reingest a single list by ListID")
		dryRun      = flag.Bool("dry-run", false, "Parse only, skip the database upsert")
		batch       = flag.Int("batch", 2000, "Upsert batch size")
		concurrency = flag.Int("concurrency", 4, "Parallel list workers (tune for RAM; 4 ≈ 2GB)")
		timeout     = flag.Duration("timeout", 30*time.Minute, "Per-fetch HTTP timeout (covers total request including streamed body)")
	)
	flag.Parse()

	if !*all && *listID == "" {
		log.Printf("reingest-global: must pass --all or --list <id>")
		os.Exit(2)
	}

	cfg := config.Load()
	pool, err := pgx.NewPool(cfg.Database.URL)
	if err != nil {
		log.Fatalf("reingest-global: db pool: %v", err)
	}
	defer pool.Close()

	deps := buildDeps(pool, *timeout)
	targets := selectTargets(*all, *listID)
	if len(targets) == 0 {
		log.Fatalf("reingest-global: no matching list configs (list=%q)", *listID)
	}
	log.Printf("reingest-global: will process %d list(s)", len(targets))

	ctx := context.Background()
	ok, skipped, failed := runAll(ctx, deps, targets, *batch, *concurrency, *dryRun)
	log.Printf("reingest-global: done — ok=%d skipped=%d failed=%d",
		ok, skipped, failed)
	if failed > 0 {
		os.Exit(1)
	}
}

func buildDeps(pool *pgx.Pool, timeout time.Duration) deps {
	tr := ingestion.NewTypeRegistry()
	ingestion.RegisterBulkParsers(tr)
	ingestion.RegisterExtendedParsers(tr)
	auditStore := pgx.NewAuditEventsSQL(pool.DB())
	auditRepo := pgx.NewListSyncAuditRepo(pool.DB())
	recorder := alerting.NewRecordingAlerter(
		auditRepo, alerting.BuildDefaultChannels(auditStore),
	)
	return deps{
		tr:       tr,
		fetcher:  ingestion.NewListFetcher(timeout),
		repo:     pgx.NewEntityRepository(pool.DB()),
		recorder: recorder,
	}
}
