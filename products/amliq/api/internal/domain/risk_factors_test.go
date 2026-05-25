package domain

import "testing"

func TestIdentifyFactors(t *testing.T) {
	tests := []struct {
		name      string
		s, p, m   float64
		c, i      float64
		wantCount int
	}{
		{"no factors", 0.1, 0.1, 0.1, 0.1, 0.1, 0},
		{"all factors", 0.9, 0.9, 0.9, 0.9, 0.9, 5},
		{"sanctions only", 0.8, 0.2, 0.1, 0.1, 0.1, 1},
		{"pep and media", 0.1, 0.7, 0.8, 0.1, 0.1, 2},
		{"country and industry", 0.1, 0.1, 0.1, 0.6, 0.7, 2},
		{"borderline 0.5", 0.5, 0.5, 0.5, 0.5, 0.5, 0},
		{"just above", 0.51, 0.51, 0.51, 0.51, 0.51, 5},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			factors := identifyFactors(tt.s, tt.p, tt.m, tt.c, tt.i)
			if len(factors) != tt.wantCount {
				t.Errorf("got %d factors, want %d: %v", len(factors), tt.wantCount, factors)
			}
		})
	}
}

func TestCountryRiskScoreExtended(t *testing.T) {
	tests := []struct {
		name    string
		country string
		want    float64
	}{
		{"Iran max risk", "IR", 1.0},
		{"North Korea max", "KP", 1.0},
		{"Syria", "SY", 0.95},
		{"Cuba", "CU", 0.9},
		{"Nigeria threshold", "NG", 0.5},
		{"safe country", "CH", 0.1},
		{"unknown country", "XX", 0.1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CountryRiskScore(tt.country)
			if got != tt.want {
				t.Errorf("CountryRiskScore(%s) = %f, want %f", tt.country, got, tt.want)
			}
		})
	}
}
