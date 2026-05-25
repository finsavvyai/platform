package domain

import (
	"testing"
)

func TestNewMatchWeights(t *testing.T) {
	tests := []struct {
		name      string
		exact     float64
		fuzzy     float64
		phonetic  float64
		token     float64
		embedding float64
		graph     float64
		wantErr   bool
	}{
		{
			name:      "valid sum 100",
			exact:     25.0,
			fuzzy:     20.0,
			phonetic:  15.0,
			token:     15.0,
			embedding: 17.5,
			graph:     7.5,
		},
		{
			name:      "sum too low",
			exact:     20.0,
			fuzzy:     20.0,
			phonetic:  15.0,
			token:     15.0,
			embedding: 15.0,
			graph:     5.0,
			wantErr:   true,
		},
		{
			name:      "sum too high",
			exact:     30.0,
			fuzzy:     25.0,
			phonetic:  20.0,
			token:     15.0,
			embedding: 15.0,
			graph:     10.0,
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewMatchWeights(tt.exact, tt.fuzzy, tt.phonetic, tt.token, tt.embedding, tt.graph)
			if (err != nil) != tt.wantErr {
				t.Errorf("error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestMatchWeightsValidate(t *testing.T) {
	tests := []struct {
		name    string
		weights MatchWeights
		wantErr bool
	}{
		{
			name: "valid equals 100",
			weights: MatchWeights{
				Exact:     25.0,
				Fuzzy:     20.0,
				Phonetic:  15.0,
				Token:     15.0,
				Embedding: 17.5,
				Graph:     7.5,
			},
		},
		{
			name: "sum below 100",
			weights: MatchWeights{
				Exact:     20.0,
				Fuzzy:     20.0,
				Phonetic:  15.0,
				Token:     15.0,
				Embedding: 15.0,
				Graph:     5.0,
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
