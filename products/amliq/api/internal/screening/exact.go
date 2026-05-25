package screening

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

type ExactMatcher struct {
	normalizer *Normalizer
}

func NewExactMatcher() *ExactMatcher {
	return &ExactMatcher{
		normalizer: NewNormalizer(),
	}
}

func (em *ExactMatcher) Match(
	query domain.Name,
	candidates []domain.Name,
) []domain.MatchEvidence {
	queryNorm := em.normalizer.Normalize(query.Full)
	evidence := make([]domain.MatchEvidence, 0, 4)

	for _, candidate := range candidates {
		candNorm := em.normalizer.Normalize(candidate.Full)
		if queryNorm == candNorm {
			score := 1.0
			ev := domain.NewMatchEvidence(
				domain.MatchLayerExact,
				"exact_match",
				score,
				1.0,
				query.Full,
				candidate.Full,
				"Exact normalized match",
			)
			evidence = append(evidence, ev)
		}
	}
	return evidence
}
