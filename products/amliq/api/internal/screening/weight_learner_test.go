package screening

import (
	"testing"
)

func TestApplyWeight(t *testing.T) {
	tests := []struct {
		name      string
		algo      string
		precision float64
		check     func(LearnedWeights) float64
	}{
		{"exact", "exact", 0.95, func(w LearnedWeights) float64 { return w.Exact }},
		{"fuzzy", "fuzzy", 0.80, func(w LearnedWeights) float64 { return w.Fuzzy }},
		{"phonetic", "phonetic", 0.60, func(w LearnedWeights) float64 { return w.Phonetic }},
		{"token", "token", 0.70, func(w LearnedWeights) float64 { return w.Token }},
		{"embedding", "embedding", 0.85, func(w LearnedWeights) float64 { return w.Embedding }},
		{"graph", "graph", 0.45, func(w LearnedWeights) float64 { return w.Graph }},
		{"unknown algo keeps default", "unknown", 0.99, func(w LearnedWeights) float64 { return w.Exact }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := defaultWeights
			applyWeight(&w, tt.algo, tt.precision)
			got := tt.check(w)
			if tt.algo == "unknown" {
				if got != defaultWeights.Exact {
					t.Errorf("unknown algo should not change weight, got %f", got)
				}
				return
			}
			if got != tt.precision {
				t.Errorf("expected %f, got %f", tt.precision, got)
			}
		})
	}
}

func TestDefaultWeights(t *testing.T) {
	tests := []struct {
		name  string
		field float64
		want  float64
	}{
		{"exact", defaultWeights.Exact, 1.0},
		{"fuzzy", defaultWeights.Fuzzy, 0.7},
		{"phonetic", defaultWeights.Phonetic, 0.5},
		{"token", defaultWeights.Token, 0.6},
		{"embedding", defaultWeights.Embedding, 0.8},
		{"graph", defaultWeights.Graph, 0.4},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.field != tt.want {
				t.Errorf("default %s = %f, want %f", tt.name, tt.field, tt.want)
			}
		})
	}
}

func TestMatchOutcomeFields(t *testing.T) {
	o := MatchOutcome{
		Algorithm:    "exact",
		ListSource:   "ofac_sdn",
		TruePositive: true,
	}
	if o.Algorithm != "exact" {
		t.Error("algorithm field mismatch")
	}
	if o.ListSource != "ofac_sdn" {
		t.Error("list source field mismatch")
	}
	if !o.TruePositive {
		t.Error("true positive field mismatch")
	}
}
