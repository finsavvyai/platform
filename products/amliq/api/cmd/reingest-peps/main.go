package main

import (
	"context"
	"flag"
	"log"
	"os"
	"time"

	"github.com/aegis-aml/aegis/internal/config"
	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/ingestion"
	"github.com/aegis-aml/aegis/internal/storage/pgx"
)

// reingest-peps: fetch OpenSanctions PEP feed, re-parse with the
// enriched parser (DOB, nationalities, positions, metadata) and
// upsert under tenant_id='__global__' — the system tenant where
// bulk sanctions/PEP data lives and which the regular reingest
// CLI cannot target because its TenantID regex rejects the value.
//
// Usage (on Render shell):
//
//	go run ./cmd/reingest-peps                 # full re-upsert
//	go run ./cmd/reingest-peps --dry-run       # parse only, no writes
//	go run ./cmd/reingest-peps --batch 1000    # smaller batches
func main() {
	dryRun := flag.Bool("dry-run", false,
		"Parse only, skip the database upsert phase")
	batch := flag.Int("batch", 500,
		"Upsert batch size (smaller = more progress logs)")
	flag.Parse()

	cfg := config.Load()
	pool, err := pgx.NewPool(cfg.Database.URL)
	if err != nil {
		log.Fatalf("reingest-peps: db pool: %v", err)
	}
	defer pool.Close()

	ctx := context.Background()
	fetcher := ingestion.NewListFetcher(180 * time.Second)

	log.Printf("reingest-peps: fetching %s ...", ingestion.PEPDataURL)
	data, _, err := fetcher.Fetch(ingestion.PEPDataURL)
	if err != nil {
		log.Fatalf("reingest-peps: fetch: %v", err)
	}
	log.Printf("reingest-peps: downloaded %d bytes", len(data))

	parser := ingestion.NewOpenSanctionsPEPParser()
	entities, err := parser.Parse(data)
	if err != nil {
		log.Fatalf("reingest-peps: parse: %v", err)
	}
	log.Printf("reingest-peps: parsed %d PEP entities", len(entities))

	if *dryRun {
		log.Printf("reingest-peps: dry-run — first entity: %+v",
			sampleEntity(entities))
		os.Exit(0)
	}

	if err := upsertInBatches(ctx, pool, entities, *batch); err != nil {
		log.Fatalf("reingest-peps: upsert: %v", err)
	}
	log.Printf("reingest-peps: done, %d entities enriched", len(entities))
}

func sampleEntity(ents []domain.Entity) domain.Entity {
	if len(ents) == 0 {
		return domain.Entity{}
	}
	return ents[0]
}

func upsertInBatches(
	ctx context.Context, pool *pgx.Pool,
	ents []domain.Entity, batch int,
) error {
	repo := pgx.NewEntityRepository(pool.DB())
	tid := domain.SystemTenantID()
	total := len(ents)
	for i := 0; i < total; i += batch {
		end := i + batch
		if end > total {
			end = total
		}
		if err := repo.BulkUpsert(ctx, tid, ents[i:end]); err != nil {
			return err
		}
		pct := (end * 100) / total
		log.Printf("reingest-peps: upserted %d/%d (%d%%)", end, total, pct)
	}
	return nil
}
