package domain

import "testing"

func TestNormalizeName(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"John Doe", "john doe"},
		{"  John   Doe  ", "john doe"},
		{"O'Brien", "obrien"},
		{"Al-Qaida", "al qaida"},
		{"ACME, Inc.", "acme inc"},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := NormalizeName(tt.input)
			if got != tt.want {
				t.Errorf("NormalizeName(%q)=%q, want=%q", tt.input, got, tt.want)
			}
		})
	}
}

func TestSimpleDedupeScore(t *testing.T) {
	tests := []struct {
		name string
		a    string
		b    string
		min  float64
		max  float64
	}{
		{"exact", "John Doe", "John Doe", 1.0, 1.0},
		{"case diff", "john doe", "JOHN DOE", 1.0, 1.0},
		{"partial", "John Doe", "John Smith", 0.4, 0.6},
		{"no match", "Alice", "Bob", 0, 0.01},
		{"reordered", "Doe John", "John Doe", 1.0, 1.0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := SimpleDedupeScore(tt.a, tt.b)
			if score < tt.min || score > tt.max {
				t.Errorf("score=%f, want [%f,%f]", score, tt.min, tt.max)
			}
		})
	}
}
