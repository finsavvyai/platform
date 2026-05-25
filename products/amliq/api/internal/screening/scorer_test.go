package screening

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestWeightedScorer(t *testing.T) {
	weights := map[string]float64{
		"Exact":    1.0,
		"Fuzzy":    0.8,
		"Phonetic": 0.6,
	}
	scorer := NewWeightedScorer(weights)

	tests := []struct {
		name        string
		evidence    []domain.MatchEvidence
		minExpected float64
		maxExpected float64
	}{
		{
			name:        "empty",
			evidence:    []domain.MatchEvidence{},
			minExpected: -0.01,
			maxExpected: 0.01,
		},
		{
			name: "single_exact",
			evidence: []domain.MatchEvidence{
				domain.NewMatchEvidence(domain.MatchLayerExact, "algo", 1.0, 1.0, "q", "m", "exact"),
			},
			minExpected: 0.99,
			maxExpected: 1.01,
		},
		{
			name: "mixed_scores",
			evidence: []domain.MatchEvidence{
				domain.NewMatchEvidence(domain.MatchLayerExact, "algo", 1.0, 1.0, "q", "m", "exact"),
				domain.NewMatchEvidence(domain.MatchLayerFuzzy, "algo", 0.8, 1.0, "q", "m", "fuzzy"),
			},
			minExpected: 0.8,
			maxExpected: 1.0,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := scorer.Score(tt.evidence)
			if err != nil {
				t.Fatalf("Score() error = %v", err)
			}
			if got < tt.minExpected || got > tt.maxExpected {
				t.Errorf("Score() = %f, want %f-%f", got, tt.minExpected, tt.maxExpected)
			}
		})
	}
}
