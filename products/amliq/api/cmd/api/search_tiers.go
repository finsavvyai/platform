package main

import (
	"database/sql"
	"log"
	"time"

	"github.com/aegis-aml/aegis/internal/screening"
	"github.com/aegis-aml/aegis/internal/storage"
)

// buildSearchTiers initializes the fingerprint-first search architecture.
// SlimIndex covers ALL entities in ~170MB RAM (vs 3.5GB for full objects).
// Falls back to V1 tiered or flat index if SlimIndex setup fails.
func buildSearchTiers(
	db *sql.DB,
	entityRepo storage.EntityRepository,
) []screening.EngineOption {
	start := time.Now()

	// Step 1: SlimIndex — compact in-memory phonetic index for ALL entities
	slim, err := screening.LoadSlimIndex(db)
	if err != nil {
		log.Printf("SlimIndex failed: %v (falling back to V1 tiered)", err)
		return v1TieredFallback(db, entityRepo)
	}

	// Step 2: Fingerprint searcher — B-tree indexed hash lookups in PG
	fpSearcher := screening.NewFingerprintSearcher(db)

	// Step 3: PG trigram searcher — fallback for zero-hit queries
	pgSearcher := screening.NewPGSearcher(db)

	// Step 4: Entity fetcher — batch PK lookups for scoring
	fetcher := screening.NewEntityFetcher(db)

	// Step 5: Assemble TieredIndexV2
	tieredV2 := screening.NewTieredIndexV2(slim, fpSearcher, pgSearcher, fetcher)

	elapsed := time.Since(start).Seconds()
	log.Printf(
		"Search V2 ready: slim=%dK entities, startup=%.1fs",
		tieredV2.HotEntityCount()/1000, elapsed,
	)

	return []screening.EngineOption{
		screening.WithTieredIndexV2(tieredV2),
	}
}

func v1TieredFallback(
	db *sql.DB, entityRepo storage.EntityRepository,
) []screening.EngineOption {
	bloom, err := screening.BuildBloomFromDB(db)
	if err != nil {
		log.Printf("bloom failed: %v", err)
		return flatIndexFallback(entityRepo)
	}
	hot, err := screening.LoadHotEntities(db)
	if err != nil {
		log.Printf("hot load failed: %v", err)
		return flatIndexFallback(entityRepo)
	}
	tiered := screening.NewTieredIndex(bloom, hot, db)
	log.Printf("V1 tiered fallback: %dK hot entities", tiered.HotEntityCount()/1000)
	return []screening.EngineOption{screening.WithTieredIndex(tiered)}
}

func flatIndexFallback(
	repo storage.EntityRepository,
) []screening.EngineOption {
	idx, err := screening.LoadFromRepo(repo)
	if err != nil {
		log.Printf("flat index also failed: %v", err)
		return nil
	}
	return []screening.EngineOption{screening.WithSearchIndex(idx)}
}
