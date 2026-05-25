package screening

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

// trigramIndex maps 3-character grams to entity IDs for fuzzy matching.
type trigramIndex struct {
	gramMap map[string][]domain.EntityID
}

// buildTrigrams constructs the trigram index from entities.
func buildTrigrams(entities []domain.Entity) trigramIndex {
	idx := trigramIndex{gramMap: make(map[string][]domain.EntityID)}
	for _, e := range entities {
		seen := make(map[string]bool)
		for _, n := range e.Names {
			grams := extractTrigrams(normalizeExact(n.Full))
			for _, g := range grams {
				if !seen[g] {
					idx.gramMap[g] = append(idx.gramMap[g], e.ID)
					seen[g] = true
				}
			}
		}
	}
	return idx
}

// lookup finds entities whose trigram overlap with query exceeds threshold.
func (ti trigramIndex) lookup(query string, threshold float64) []domain.EntityID {
	queryGrams := extractTrigrams(normalizeExact(query))
	if len(queryGrams) == 0 {
		return nil
	}

	// Count how many query trigrams each entity shares
	hitCount := make(map[string]int)
	idMap := make(map[string]domain.EntityID)
	for _, g := range queryGrams {
		seen := make(map[string]bool)
		for _, id := range ti.gramMap[g] {
			key := id.String()
			if !seen[key] {
				hitCount[key]++
				idMap[key] = id
				seen[key] = true
			}
		}
	}

	queryLen := len(queryGrams)
	var results []domain.EntityID
	for key, count := range hitCount {
		// Approximate Jaccard: intersection / query gram count
		sim := float64(count) / float64(queryLen)
		if sim >= threshold {
			results = append(results, idMap[key])
		}
	}
	return results
}

// extractTrigrams generates 3-character grams from a string.
func extractTrigrams(s string) []string {
	if len(s) < 3 {
		return nil
	}
	runes := []rune(s)
	seen := make(map[string]bool)
	var grams []string
	for i := 0; i <= len(runes)-3; i++ {
		g := string(runes[i : i+3])
		if !seen[g] {
			grams = append(grams, g)
			seen[g] = true
		}
	}
	return grams
}
