package screening

import (
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

// WithSearchIndex configures the engine to use an in-memory search index.
func WithSearchIndex(idx *SearchIndex) EngineOption {
	return func(e *Engine) { e.searchIndex = idx }
}

// WithTieredIndex configures the engine to use tiered search.
func WithTieredIndex(idx *TieredIndex) EngineOption {
	return func(e *Engine) { e.tieredIndex = idx }
}

// WithTieredIndexV2 configures the engine to use V2 tiered search
// with SlimIndex (all entities in-memory) + fingerprint DB lookups.
func WithTieredIndexV2(idx *TieredIndexV2) EngineOption {
	return func(e *Engine) { e.tieredIndexV2 = idx }
}

// ScreenByName uses the tiered or flat index to find and score candidates.
func (e *Engine) ScreenByName(
	name string, opts SearchOpts,
) ([]domain.MatchResult, error) {
	if e.searchIndex == nil && e.tieredIndex == nil && e.tieredIndexV2 == nil {
		return nil, fmt.Errorf("search index not configured")
	}
	if name == "" {
		return nil, fmt.Errorf("name required")
	}

	qName, err := domain.NewName(name, "", "", "")
	if err != nil {
		return nil, fmt.Errorf("invalid name: %w", err)
	}

	eid, _ := domain.NewEntityID("ent_000000000000")
	query, _ := domain.NewEntity(eid, domain.EntityTypeIndividual,
		[]domain.Name{qName})

	candidates := e.resolveCandidates(name)
	if len(candidates) == 0 {
		return nil, nil
	}

	if opts.Limit > 0 && len(candidates) > opts.Limit {
		candidates = candidates[:opts.Limit]
	}

	return e.Screen(query, candidates)
}

// resolveCandidates tries V2 tiered → V1 tiered → flat index.
func (e *Engine) resolveCandidates(name string) []domain.Entity {
	if e.tieredIndexV2 != nil {
		hits := e.tieredIndexV2.Search(name, SearchOpts{Limit: 50})
		entities := make([]domain.Entity, len(hits))
		for i, h := range hits {
			entities[i] = h.Entity
		}
		return entities
	}
	if e.tieredIndex != nil {
		hits := e.tieredIndex.Search(name, SearchOpts{Limit: 50})
		entities := make([]domain.Entity, len(hits))
		for i, h := range hits {
			entities[i] = h.Entity
		}
		return entities
	}
	if e.searchIndex != nil {
		return e.candidatesFromIndex(name)
	}
	return nil
}

// candidatesFromIndex resolves flat index hits to entity objects.
func (e *Engine) candidatesFromIndex(name string) []domain.Entity {
	hits := e.searchIndex.Search(name, SearchOpts{Limit: 50})
	candidates := make([]domain.Entity, len(hits))
	for i, h := range hits {
		candidates[i] = h.Entity
	}
	return candidates
}

// GetSearchIndex returns the in-memory search index (may be nil).
func (e *Engine) GetSearchIndex() *SearchIndex {
	return e.searchIndex
}
