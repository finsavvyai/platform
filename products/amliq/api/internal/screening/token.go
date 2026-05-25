package screening

import (
	"sort"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

type TokenMatcher struct {
	normalizer *Normalizer
}

func NewTokenMatcher() *TokenMatcher {
	return &TokenMatcher{
		normalizer: NewNormalizer(),
	}
}

func (tm *TokenMatcher) Match(
	query domain.Name,
	candidates []domain.Name,
) []domain.MatchEvidence {
	queryTokens := tm.tokenize(query.Full)
	evidence := make([]domain.MatchEvidence, 0, len(candidates))

	for _, candidate := range candidates {
		candTokens := tm.tokenize(candidate.Full)
		score := tm.jaccardSimilarity(queryTokens, candTokens)

		if score > 0.5 {
			ev := domain.NewMatchEvidence(
				domain.MatchLayerToken,
				"jaccard",
				score,
				0.5,
				query.Full,
				candidate.Full,
				"Token-based Jaccard similarity",
			)
			evidence = append(evidence, ev)
		}
	}
	return evidence
}

func (tm *TokenMatcher) tokenize(s string) []string {
	s = tm.normalizer.Normalize(s)
	tokens := strings.Fields(s)
	filtered := make([]string, 0, len(tokens))
	for _, t := range tokens {
		if len(t) > 2 && !tm.isTitlePrefix(t) {
			filtered = append(filtered, t)
		}
	}
	sort.Strings(filtered)
	return filtered
}

func (tm *TokenMatcher) jaccardSimilarity(a, b []string) float64 {
	if len(a) == 0 && len(b) == 0 {
		return 1.0
	}
	intersection := 0
	for _, ta := range a {
		for _, tb := range b {
			if ta == tb {
				intersection++
				break
			}
		}
	}
	union := len(a) + len(b) - intersection
	if union == 0 {
		return 0.0
	}
	return float64(intersection) / float64(union)
}

// titlePrefixes is a package-level set so isTitlePrefix doesn't
// allocate a slice on every token. Kept lowercase to match the
// output of Normalizer.Normalize.
var titlePrefixes = map[string]struct{}{
	"mr": {}, "mrs": {}, "dr": {}, "prof": {}, "sir": {}, "lady": {},
}

func (tm *TokenMatcher) isTitlePrefix(s string) bool {
	_, ok := titlePrefixes[s]
	return ok
}
