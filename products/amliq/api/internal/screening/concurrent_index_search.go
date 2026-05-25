package screening

import (
	"sort"

	"github.com/aegis-aml/aegis/internal/domain"
)

// Search queries all sub-indexes and merges results. Lock-free path.
// Scores from different sub-indexes accumulate on the same entity,
// so a name matching both exact and phonetic beats a phonetic-only
// match — cheap proxy for the ensemble scorer at index time.
func (ci *ConcurrentSearchIndex) Search(query string, opts SearchOpts) []Candidate {
	limit := opts.Limit
	if limit <= 0 {
		limit = 20
	}

	scored := make(map[string]*Candidate)
	ci.lookupExact(query, scored)
	ci.lookupPhonetic(query, scored)
	ci.lookupTokens(query, scored)
	ci.lookupTrigrams(query, scored)

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

func (ci *ConcurrentSearchIndex) lookupExact(q string, scored map[string]*Candidate) {
	if ids, ok := ci.exact.Load(normalizeExact(q)); ok {
		ci.mergeIDs(scored, ids, 1.0, "exact")
	}
}

func (ci *ConcurrentSearchIndex) lookupPhonetic(q string, scored map[string]*Candidate) {
	for _, code := range phoneticCodes(q) {
		if ids, ok := ci.phonetic.Load(code); ok {
			ci.mergeIDs(scored, ids, 0.7, "phonetic")
		}
	}
}

func (ci *ConcurrentSearchIndex) lookupTokens(q string, scored map[string]*Candidate) {
	for _, tok := range tokenize(q) {
		if ids, ok := ci.tokens.Load(tok); ok {
			ci.mergeIDs(scored, ids, 0.6, "token")
		}
	}
}

func (ci *ConcurrentSearchIndex) lookupTrigrams(q string, scored map[string]*Candidate) {
	for _, tri := range computeTrigrams(normalizeExact(q)) {
		if ids, ok := ci.trigrams.Load(tri); ok {
			ci.mergeIDs(scored, ids, 0.5, "trigram")
		}
	}
}

func (ci *ConcurrentSearchIndex) mergeIDs(
	scored map[string]*Candidate, ids []domain.EntityID,
	score float64, source string,
) {
	for _, id := range ids {
		ent, ok := ci.entities.Load(id.String())
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
