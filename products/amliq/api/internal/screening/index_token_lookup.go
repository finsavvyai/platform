package screening

import (
	"sort"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// lookup tokenizes the query and ranks entities by summed TF-IDF.
func (ti tokenIndex) lookup(query string) []domain.EntityID {
	tokens := tokenizeForIndex(query)
	if len(tokens) == 0 {
		return nil
	}

	scores := make(map[string]float64)
	idMap := make(map[string]domain.EntityID)
	for _, tok := range tokens {
		for _, entry := range ti.index[tok] {
			key := entry.EntityID.String()
			scores[key] += entry.Weight
			idMap[key] = entry.EntityID
		}
	}

	type ranked struct {
		id    domain.EntityID
		score float64
	}
	items := make([]ranked, 0, len(scores))
	for key, score := range scores {
		items = append(items, ranked{id: idMap[key], score: score})
	}
	// O(n log n) sort replaces O(n²) bubble sort
	sort.Slice(items, func(i, j int) bool {
		return items[i].score > items[j].score
	})
	limit := 50
	if len(items) < limit {
		limit = len(items)
	}
	result := make([]domain.EntityID, limit)
	for i := 0; i < limit; i++ {
		result[i] = items[i].id
	}
	return result
}

// tokenizeForIndex normalizes and splits a name into tokens.
func tokenizeForIndex(s string) []string {
	s = normalizeExact(s)
	parts := strings.Fields(s)
	var tokens []string
	for _, p := range parts {
		if len(p) > 1 {
			tokens = append(tokens, p)
		}
	}
	return tokens
}
