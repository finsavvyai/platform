package screening

import "testing"

func TestLevenshteinDistance(t *testing.T) {
	tests := []struct {
		name     string
		s1       string
		s2       string
		expected int
	}{
		{"identical", "john", "john", 0},
		{"one_char", "a", "b", 1},
		{"empty_to_abc", "", "abc", 3},
		{"abc_to_empty", "abc", "", 3},
		{"transposition", "abc", "bac", 2},
		{"substitution", "cat", "hat", 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := levenshteinDistance(tt.s1, tt.s2)
			if got != tt.expected {
				t.Errorf("distance(%q, %q) = %d, want %d", tt.s1, tt.s2, got, tt.expected)
			}
		})
	}
}

func TestLevenshteinSimilarity(t *testing.T) {
	tests := []struct {
		name      string
		s1        string
		s2        string
		minExpect float64
	}{
		{"identical", "john", "john", 0.99},
		{"empty", "", "", 0.99},
		{"very_different", "abc", "xyz", 0.0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := levenshteinSimilarity(tt.s1, tt.s2)
			if got < tt.minExpect && got < 0.99 {
				t.Errorf("similarity(%q, %q) = %f, want >= %f", tt.s1, tt.s2, got, tt.minExpect)
			}
		})
	}
}
