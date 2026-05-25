package screening

import "github.com/aegis-aml/aegis/internal/domain"

// FastEngine runs only Exact + Fuzzy layers for sub-10ms payment screening.
type FastEngine struct {
	exact  *ExactMatcher
	fuzzy  *FuzzyMatcher
	scorer *WeightedScorer
}

func NewFastEngine() *FastEngine {
	return &FastEngine{
		exact:  NewExactMatcher(),
		fuzzy:  NewFuzzyMatcher(0.80),
		scorer: NewWeightedScorer(map[string]float64{"Exact": 1.0, "Fuzzy": 0.8}),
	}
}

// FastResult is a lightweight screening result for payment flows.
type FastResult struct {
	Match      bool    `json:"match"`
	Confidence float64 `json:"confidence"`
	MatchedName string `json:"matched_name,omitempty"`
	ListID     string  `json:"list_id,omitempty"`
}

// Screen performs fast 2-layer screening for payment transactions.
func (fe *FastEngine) Screen(
	queryName string, candidates []domain.Entity,
) FastResult {
	if queryName == "" || len(candidates) == 0 {
		return FastResult{Match: false}
	}

	qName, _ := domain.NewName(queryName, "", "", "")
	candNames := extractNames(candidates)

	var allEvidence []domain.MatchEvidence
	allEvidence = append(allEvidence, fe.exact.Match(qName, candNames)...)
	allEvidence = append(allEvidence, fe.fuzzy.Match(qName, candNames)...)

	if len(allEvidence) == 0 {
		return FastResult{Match: false}
	}

	best := bestEvidence(allEvidence)
	score, _ := fe.scorer.Score([]domain.MatchEvidence{best})
	listID := findListForName(candidates, best.MatchedValue)

	return FastResult{
		Match:       true,
		Confidence:  score,
		MatchedName: best.MatchedValue,
		ListID:      listID,
	}
}

func extractNames(entities []domain.Entity) []domain.Name {
	var names []domain.Name
	for _, e := range entities {
		names = append(names, e.Names...)
	}
	return names
}

func bestEvidence(evidence []domain.MatchEvidence) domain.MatchEvidence {
	best := evidence[0]
	for _, ev := range evidence[1:] {
		if ev.Score > best.Score {
			best = ev
		}
	}
	return best
}

func findListForName(entities []domain.Entity, name string) string {
	for _, e := range entities {
		for _, n := range e.Names {
			if n.Full == name {
				return e.ListID
			}
		}
	}
	return ""
}
