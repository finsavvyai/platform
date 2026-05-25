package screening

import (
	"sort"
	"sync"

	"github.com/aegis-aml/aegis/internal/domain"
)

// Candidate represents a search index hit.
type Candidate struct {
	Entity domain.Entity
	Score  float64
	Source string
}

// SearchOpts configures index search behavior.
type SearchOpts struct {
	Lists []string
	Limit int
}

// SearchIndex is an in-memory index for O(1) entity lookups.
type SearchIndex struct {
	mu         sync.RWMutex
	entities   map[string]domain.Entity
	exact      exactIndex
	phonetic   phoneticIndex
	tokens     tokenIndex
	trigrams   trigramIndex
	entCount   int
}

// NewSearchIndex creates an empty search index.
func NewSearchIndex() *SearchIndex {
	return &SearchIndex{
		entities: make(map[string]domain.Entity),
	}
}

// Load builds all sub-indexes from an entity list.
func (si *SearchIndex) Load(entities []domain.Entity) {
	si.mu.Lock()
	defer si.mu.Unlock()

	si.entities = make(map[string]domain.Entity, len(entities))
	for _, e := range entities {
		si.entities[e.ID.String()] = e
	}
	si.entCount = len(entities)

	si.exact = buildExact(entities)
	si.phonetic = buildPhonetic(entities)
	si.tokens = buildTokens(entities)
	si.trigrams = buildTrigrams(entities)
}

// Search queries all sub-indexes and merges results.
func (si *SearchIndex) Search(query string, opts SearchOpts) []Candidate {
	si.mu.RLock()
	defer si.mu.RUnlock()

	limit := opts.Limit
	if limit <= 0 {
		limit = 20
	}

	scored := make(map[string]*Candidate)
	si.mergeHits(scored, si.exact.lookup(query), 1.0, "exact")
	si.mergeHits(scored, si.phonetic.lookup(query), 0.7, "phonetic")
	si.mergeHits(scored, si.tokens.lookup(query), 0.6, "token")
	si.mergeHits(scored, si.trigrams.lookup(query, 0.3), 0.5, "trigram")

	results := make([]Candidate, 0, len(scored))
	for _, c := range scored {
		if matchesList(c.Entity.ListID, opts.Lists) {
			results = append(results, *c)
		}
	}
	sort.Slice(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})
	if len(results) > limit {
		results = results[:limit]
	}
	return results
}

