package domain

import (
	"testing"
)

func TestMatchWeightsValidateEdgeCases(t *testing.T) {
	tests := []struct {
		name    string
		weights MatchWeights
		wantErr bool
	}{
		{
			name: "sum just above 100",
			weights: MatchWeights{
				Exact:     20.0,
				Fuzzy:     20.0,
				Phonetic:  15.0,
				Token:     15.0,
				Embedding: 15.05,
				Graph:     14.95,
			},
			wantErr: false,
		},
		{
			name: "sum just below 100",
			weights: MatchWeights{
				Exact:     20.0,
				Fuzzy:     20.0,
				Phonetic:  15.0,
				Token:     15.0,
				Embedding: 15.0,
				Graph:     14.95,
			},
			wantErr: false,
		},
		{
			name: "all negative",
			weights: MatchWeights{
				Exact:     -10.0,
				Fuzzy:     -20.0,
				Phonetic:  -15.0,
				Token:     -15.0,
				Embedding: -20.0,
				Graph:     -10.0,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.weights.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
