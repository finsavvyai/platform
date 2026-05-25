package screening

import "strings"

// SearchByName finds candidates using pre-computed features.
// Phases: exact (1.0) → soundex (+0.3) → DM primary (+0.4) →
// DM alternate (+0.2) → trigram overlap (scaled by overlap ratio).
func (pi *PrecomputedIndex) SearchByName(query string, limit int) []Candidate {
	pi.mu.RLock()
	defer pi.mu.RUnlock()

	if limit <= 0 {
		limit = 20
	}
	norm := normalizeExact(query)
	scored := make(map[string]float64)

	// Phase 1: exact match.
	for _, id := range pi.exactMap[norm] {
		scored[id] = 1.0
	}

	// Phase 2: phonetic via soundex + double metaphone.
	pi.scorePhonetic(strings.Fields(norm), scored)

	// Phase 3: trigram overlap — bounded to avoid scanning every
	// entity when we already have plenty of high-confidence hits.
	pi.scoreTrigrams(norm, limit, scored)

	return pi.topCandidates(scored, limit)
}

func (pi *PrecomputedIndex) scorePhonetic(words []string, scored map[string]float64) {
	for _, w := range words {
		if len(w) < 2 {
			continue
		}
		sc := soundexCode(strings.ToUpper(w))
		for _, id := range pi.soundexMap[sc] {
			scored[id] += 0.3
		}
		pri, alt := DoubleMetaphone(w)
		for _, id := range pi.dmMap[pri] {
			scored[id] += 0.4
		}
		if alt != "" && alt != pri {
			for _, id := range pi.dmMap[alt] {
				scored[id] += 0.2
			}
		}
	}
}

func (pi *PrecomputedIndex) scoreTrigrams(norm string, limit int, scored map[string]float64) {
	queryTris := computeTrigrams(norm)
	if len(queryTris) == 0 || len(scored) >= limit*3 {
		return
	}
	for id, triSet := range pi.trigramSets {
		overlap := 0
		for _, t := range queryTris {
			if triSet[t] {
				overlap++
			}
		}
		if overlap == 0 {
			continue
		}
		ratio := float64(overlap) / float64(len(queryTris))
		if ratio > 0.3 {
			scored[id] += ratio * 0.5
		}
	}
}

func (pi *PrecomputedIndex) topCandidates(scored map[string]float64, limit int) []Candidate {
	results := make([]Candidate, 0, len(scored))
	for id, score := range scored {
		if ent, ok := pi.entities[id]; ok {
			results = append(results, Candidate{
				Entity: ent, Score: score, Source: "precomputed",
			})
		}
	}
	sortCandidates(results)
	if len(results) > limit {
		results = results[:limit]
	}
	return results
}
