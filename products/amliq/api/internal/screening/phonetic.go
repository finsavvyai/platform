package screening

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

type PhoneticMatcher struct {
	normalizer *Normalizer
}

func NewPhoneticMatcher() *PhoneticMatcher {
	return &PhoneticMatcher{
		normalizer: NewNormalizer(),
	}
}

func (pm *PhoneticMatcher) Match(
	query domain.Name,
	candidates []domain.Name,
) []domain.MatchEvidence {
	queryCodes := phoneticCodes(query.Full)
	evidence := make([]domain.MatchEvidence, 0, len(candidates))

	if len(queryCodes) == 0 {
		return evidence
	}

	querySet := make(map[string]struct{}, len(queryCodes))
	for _, c := range queryCodes {
		querySet[c] = struct{}{}
	}

	for _, candidate := range candidates {
		candCodes := phoneticCodes(candidate.Full)
		overlap := 0
		for _, cc := range candCodes {
			if _, ok := querySet[cc]; ok {
				overlap++
			}
		}
		if overlap == 0 {
			continue
		}
		// Score based on overlap ratio
		total := len(queryCodes)
		if len(candCodes) > total {
			total = len(candCodes)
		}
		score := float64(overlap) / float64(total)
		if score < 0.3 {
			continue
		}
		algo := "soundex+metaphone+dmetaphone"
		ev := domain.NewMatchEvidence(
			domain.MatchLayerPhonetic,
			algo,
			score,
			0.6,
			query.Full,
			candidate.Full,
			"Multi-phonetic match (Soundex + Metaphone + Double Metaphone)",
		)
		evidence = append(evidence, ev)
	}
	return evidence
}
