package screening

import (
	"context"
	"log"
	"time"
)

// TieredIndexV2 implements high-performance multi-tier search:
// LRU cache → SlimIndex (all entities in-memory) → Fingerprint DB → Trigram DB.
type TieredIndexV2 struct {
	queryCache *LRUCache
	slimIndex  *SlimIndex
	fpSearcher *FingerprintSearcher
	pgSearcher *PGSearcher
	fetcher    *EntityFetcher
}

// NewTieredIndexV2 builds the V2 tiered search.
func NewTieredIndexV2(
	slim *SlimIndex,
	fp *FingerprintSearcher,
	pg *PGSearcher,
	fetcher *EntityFetcher,
) *TieredIndexV2 {
	return &TieredIndexV2{
		queryCache: NewLRUCache(10000, 5*time.Minute),
		slimIndex:  slim,
		fpSearcher: fp,
		pgSearcher: pg,
		fetcher:    fetcher,
	}
}

// Search performs tiered lookup returning scored candidates.
func (ti *TieredIndexV2) Search(
	name string, opts SearchOpts,
) []Candidate {
	// Tier 0: LRU query cache
	if results, ok := ti.queryCache.Get(name); ok {
		return results
	}

	limit := opts.Limit
	if limit <= 0 {
		limit = 50
	}

	// Tier 1: SlimIndex — in-memory phonetic + name hash
	ids := ti.searchSlim(name, limit)

	// Tier 2: Fingerprint DB (if slim returned < 3)
	if len(ids) < 3 && ti.fpSearcher != nil {
		fpIDs := ti.searchFingerprints(name, limit)
		ids = mergeUniqueIDs(ids, fpIDs)
	}

	// Tier 3: PostgreSQL trigram fallback
	if len(ids) == 0 && ti.pgSearcher != nil {
		return ti.searchPGFallback(name, opts)
	}

	// Fetch full entities by ID
	candidates := ti.fetchAndConvert(ids)
	if len(candidates) > 0 {
		ti.queryCache.Set(name, candidates)
	}
	return candidates
}

func (ti *TieredIndexV2) searchSlim(name string, limit int) []string {
	if ti.slimIndex == nil {
		return nil
	}
	results := ti.slimIndex.Search(name, limit)
	ids := make([]string, len(results))
	for i, r := range results {
		ids[i] = r.EntityID
	}
	return ids
}

func (ti *TieredIndexV2) searchFingerprints(name string, limit int) []string {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	ids, err := ti.fpSearcher.Search(ctx, name, limit)
	if err != nil {
		log.Printf("fingerprint search error: %v", err)
		return nil
	}
	return ids
}
