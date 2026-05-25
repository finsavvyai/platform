package api

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestParseMatchWeights(t *testing.T) {
	tests := []struct {
		name    string
		raw     map[string]interface{}
		wantSum float64
	}{
		{
			"update exact only",
			map[string]interface{}{"exact": 30.0},
			105.0,
		},
		{
			"update all",
			map[string]interface{}{
				"exact": 20.0, "fuzzy": 20.0, "phonetic": 15.0,
				"token": 15.0, "embedding": 20.0, "graph": 10.0,
			},
			100.0,
		},
		{
			"empty raw",
			map[string]interface{}{},
			100.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			defaults := domain.DefaultMatchWeights()
			result := parseMatchWeights(tt.raw, defaults)
			got := result.Sum()
			diff := got - tt.wantSum
			if diff < -0.1 || diff > 0.1 {
				t.Errorf("sum = %.1f, want %.1f", got, tt.wantSum)
			}
		})
	}
}

func TestMatchWeightsValidation(t *testing.T) {
	tests := []struct {
		name    string
		weights domain.MatchWeights
		wantErr bool
	}{
		{
			"valid sum-to-100",
			domain.DefaultMatchWeights(),
			false,
		},
		{
			"invalid sum-to-90",
			domain.MatchWeights{
				Exact: 15, Fuzzy: 15, Phonetic: 15,
				Token: 15, Embedding: 15, Graph: 15,
			},
			true,
		},
		{
			"negative weight",
			domain.MatchWeights{
				Exact: -5, Fuzzy: 30, Phonetic: 25,
				Token: 25, Embedding: 15, Graph: 10,
			},
			true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.weights.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() err=%v, wantErr=%v", err, tt.wantErr)
			}
		})
	}
}
