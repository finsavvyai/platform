package screening

import (
	"math"

	"github.com/aegis-aml/aegis/internal/domain"
)

// tokenEntry stores an entity ID and its TF-IDF weight for a token.
type tokenEntry struct {
	EntityID domain.EntityID
	Weight   float64
}

// tokenIndex is an inverted index mapping words to entity entries.
type tokenIndex struct {
	index map[string][]tokenEntry
	total int
}

// buildTokens constructs the token inverted index with TF-IDF weights.
func buildTokens(entities []domain.Entity) tokenIndex {
	idx := tokenIndex{
		index: make(map[string][]tokenEntry),
		total: len(entities),
	}

	// First pass: compute document frequency
	df := make(map[string]int)
	entityTokens := make(map[string]map[string]int, len(entities))
	for _, e := range entities {
		id := e.ID.String()
		entityTokens[id] = make(map[string]int)
		seen := make(map[string]bool)
		for _, n := range e.Names {
			for _, tok := range tokenizeForIndex(n.Full) {
				entityTokens[id][tok]++
				if !seen[tok] {
					df[tok]++
					seen[tok] = true
				}
			}
		}
	}

	// Second pass: compute TF-IDF and build index
	n := float64(len(entities))
	if n == 0 {
		return idx
	}
	for _, e := range entities {
		id := e.ID.String()
		toks := entityTokens[id]
		for tok, freq := range toks {
			tf := float64(freq)
			idf := math.Log(n / float64(df[tok]))
			weight := tf * idf
			idx.index[tok] = append(idx.index[tok], tokenEntry{
				EntityID: e.ID,
				Weight:   weight,
			})
		}
	}
	return idx
}

