package screening

import "github.com/aegis-aml/aegis/internal/domain"

// mergeHits adds entity IDs from a sub-index into the scored map.
func (si *SearchIndex) mergeHits(
	scored map[string]*Candidate, ids []domain.EntityID,
	score float64, source string,
) {
	for _, id := range ids {
		ent, ok := si.entities[id.String()]
		if !ok {
			continue
		}
		key := id.String()
		if existing, found := scored[key]; found {
			existing.Score += score
		} else {
			scored[key] = &Candidate{Entity: ent, Score: score, Source: source}
		}
	}
}

// matchesList returns true if listID is in lists, or lists is empty.
func matchesList(listID string, lists []string) bool {
	if len(lists) == 0 {
		return true
	}
	for _, l := range lists {
		if l == listID {
			return true
		}
	}
	return false
}
