package screening

import (
	"database/sql"
	"log"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// TieredIndex implements a multi-tier search: cache → bloom → hot → DB.
type TieredIndex struct {
	bloom      *BloomFilter
	hotCache   *SearchIndex
	pgSearcher *PGSearcher
	queryCache *LRUCache
}

// NewTieredIndex builds the tiered search from components.
func NewTieredIndex(
	bloom *BloomFilter,
	hotEntities []domain.Entity,
	db *sql.DB,
) *TieredIndex {
	hot := NewSearchIndex()
	hot.Load(hotEntities)

	return &TieredIndex{
		bloom:      bloom,
		hotCache:   hot,
		pgSearcher: NewPGSearcher(db),
		queryCache: NewLRUCache(10000, 5*time.Minute),
	}
}

// Search performs tiered lookup: LRU → Bloom → Hot → PostgreSQL.
func (ti *TieredIndex) Search(
	name string, opts SearchOpts,
) []Candidate {
	// Tier 0: LRU query cache
	if results, ok := ti.queryCache.Get(name); ok {
		return results
	}

	// Tier 1: Hot in-memory cache first (always check — bloom
	// can give false negatives on name variants like "Putin"
	// vs "PUTIN, Vladimir Vladimirovich")
	results := ti.hotCache.Search(name, opts)
	if len(results) > 0 {
		ti.queryCache.Set(name, results)
		return results
	}

	// Tier 2: Bloom filter — skip DB if definitely absent
	if ti.bloom != nil && !ti.bloom.MayContain(name) {
		return nil
	}

	// Tier 3: PostgreSQL trigram/soundex search
	if ti.pgSearcher != nil && ti.pgSearcher.db != nil {
		entities, err := ti.pgSearcher.Search(name, opts)
		if err != nil {
			log.Printf("pg search error: %v", err)
		} else {
			results = entitiesToCandidates(entities)
			if len(results) > 0 {
				ti.queryCache.Set(name, results)
				return results
			}
		}
	}

	return nil
}

// HotEntityCount returns number of in-memory hot entities.
func (ti *TieredIndex) HotEntityCount() int {
	return ti.hotCache.EntityCount()
}

// BloomMemoryMB returns bloom filter memory in megabytes.
func (ti *TieredIndex) BloomMemoryMB() int {
	if ti.bloom == nil {
		return 0
	}
	return ti.bloom.MemoryBytes() / (1024 * 1024)
}

func entitiesToCandidates(entities []domain.Entity) []Candidate {
	candidates := make([]Candidate, len(entities))
	for i, e := range entities {
		candidates[i] = Candidate{Entity: e, Score: 0.5, Source: "pg"}
	}
	return candidates
}
