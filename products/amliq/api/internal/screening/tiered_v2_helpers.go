package screening

import (
	"context"
	"log"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func (ti *TieredIndexV2) searchPGFallback(
	name string, opts SearchOpts,
) []Candidate {
	entities, err := ti.pgSearcher.Search(name, opts)
	if err != nil {
		log.Printf("pg fallback error: %v", err)
		return nil
	}
	candidates := entitiesToCandidates(entities)
	if len(candidates) > 0 {
		ti.queryCache.Set(name, candidates)
	}
	return candidates
}

func (ti *TieredIndexV2) fetchAndConvert(ids []string) []Candidate {
	if len(ids) == 0 || ti.fetcher == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	entities, err := ti.fetcher.FetchByIDs(ctx, ids)
	if err != nil {
		log.Printf("entity fetch error: %v", err)
		return nil
	}
	return entitiesToCandidates(entities)
}

func mergeUniqueIDs(a, b []string) []string {
	seen := make(map[string]bool, len(a))
	for _, id := range a {
		seen[id] = true
	}
	merged := make([]string, len(a))
	copy(merged, a)
	for _, id := range b {
		if !seen[id] {
			seen[id] = true
			merged = append(merged, id)
		}
	}
	return merged
}

// HotEntityCount returns the number of entities in the slim index.
func (ti *TieredIndexV2) HotEntityCount() int {
	if ti.slimIndex == nil {
		return 0
	}
	return ti.slimIndex.EntityCount()
}

// entitiesToCandidatesV2 converts entities to candidates (reuses existing).
func entitiesToCandidatesV2(entities []domain.Entity) []Candidate {
	return entitiesToCandidates(entities)
}
