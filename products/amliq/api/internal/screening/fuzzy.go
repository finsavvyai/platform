package screening

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

type FuzzyMatcher struct {
	normalizer *Normalizer
	threshold  float64
}

func NewFuzzyMatcher(threshold float64) *FuzzyMatcher {
	return &FuzzyMatcher{
		normalizer: NewNormalizer(),
		threshold:  threshold,
	}
}

func (fm *FuzzyMatcher) Match(
	query domain.Name,
	candidates []domain.Name,
) []domain.MatchEvidence {
	queryNorm := fm.normalizer.Normalize(query.Full)
	// Hoist the query tokenisation out of the candidate loop —
	// queryNorm is constant, so strings.Fields on it is wasted
	// work per candidate.
	qWords := strings.Fields(queryNorm)
	evidence := make([]domain.MatchEvidence, 0, len(candidates))

	for _, candidate := range candidates {
		candNorm := fm.normalizer.Normalize(candidate.Full)
		score := jaroWinklerSimilarity(queryNorm, candNorm)

		// "Putin" vs "VLADIMIR VLADIMIROVICH PUTIN" →
		// check "Putin" vs "PUTIN" token-by-token.
		bestWord := bestWordMatchTokens(qWords, candNorm)
		if bestWord > score {
			if len(qWords) <= 1 {
				score = bestWord
			} else {
				score = bestWord*0.7 + score*0.3
			}
		}

		if score >= fm.threshold {
			ev := domain.NewMatchEvidence(
				domain.MatchLayerFuzzy,
				"jaro_winkler",
				score,
				0.8,
				query.Full,
				candidate.Full,
				"Fuzzy match via Jaro-Winkler",
			)
			evidence = append(evidence, ev)
		}
	}
	return evidence
}

// bestWordMatch kept for backward compat with callers outside the
// Match hot path. Prefer bestWordMatchTokens when the query token
// list is already available.
func bestWordMatch(query, candidate string) float64 {
	return bestWordMatchTokens(strings.Fields(query), candidate)
}

// bestWordMatchTokens is the inner loop — accepts pre-tokenised
// query so callers can tokenise once per screen, not once per
// candidate.
func bestWordMatchTokens(qWords []string, candidate string) float64 {
	words := strings.Fields(candidate)
	best := 0.0
	for _, qw := range qWords {
		for _, cw := range words {
			s := jaroWinklerSimilarity(qw, cw)
			if s > best {
				best = s
			}
		}
	}
	return best
}
