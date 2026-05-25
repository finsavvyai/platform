package domain

import (
	"testing"
)

func TestDefaultMatchWeights(t *testing.T) {
	mw := DefaultMatchWeights()
	if err := mw.Validate(); err != nil {
		t.Errorf("validation failed: %v", err)
	}
	sum := mw.Sum()
	if sum != 100.0 {
		t.Errorf("sum = %f, want 100.0", sum)
	}
}

func TestDefaultMatchWeightsFields(t *testing.T) {
	mw := DefaultMatchWeights()
	tests := []struct {
		name  string
		want  float64
		field float64
	}{
		{"Exact", 25.0, mw.Exact},
		{"Fuzzy", 20.0, mw.Fuzzy},
		{"Phonetic", 15.0, mw.Phonetic},
		{"Token", 15.0, mw.Token},
		{"Embedding", 17.5, mw.Embedding},
		{"Graph", 7.5, mw.Graph},
	}

	for _, tt := range tests {
		if tt.field != tt.want {
			t.Errorf("%s = %f, want %f", tt.name, tt.field, tt.want)
		}
	}
}

func TestMatchWeightsSumPartial(t *testing.T) {
	mw := MatchWeights{Exact: 50.0, Fuzzy: 50.0}
	if got := mw.Sum(); got != 100.0 {
		t.Errorf("Sum() = %f, want 100.0", got)
	}
}
