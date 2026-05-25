package screening

import "testing"

func TestJaroWinklerSimilarity(t *testing.T) {
	tests := []struct {
		name     string
		s1       string
		s2       string
		minScore float64
		maxScore float64
	}{
		{"identical", "john", "john", 0.99, 1.01},
		{"one_char_diff", "john", "joan", 0.85, 0.90},
		{"empty", "", "", 0.99, 1.01},
		{"empty_vs_text", "", "john", -0.01, 0.01},
		{"martha_marhta", "MARTHA", "MARHTA", 0.94, 1.0},
		{"dixon_dickson", "DIXON", "DICKSON", 0.76, 0.85},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := jaroWinklerSimilarity(tt.s1, tt.s2)
			if got < tt.minScore || got > tt.maxScore {
				t.Errorf("similarity(%q, %q) = %f, want %f-%f", tt.s1, tt.s2, got, tt.minScore, tt.maxScore)
			}
		})
	}
}
