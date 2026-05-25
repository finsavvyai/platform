package domain

import "testing"

func TestCalculateRiskScore(t *testing.T) {
	tid, _ := NewTenantID("tnt_aabbccddee11")
	weights := DefaultRiskWeights()

	tests := []struct {
		name      string
		sanctions float64
		pep       float64
		media     float64
		country   float64
		industry  float64
		wantLevel RiskLevel
	}{
		{"all high", 1.0, 1.0, 1.0, 1.0, 1.0, RiskCritical},
		{"all zero", 0, 0, 0, 0, 0, RiskLow},
		{"sanctions only", 1.0, 0, 0, 0, 0, RiskMedium},
		{"high combo", 0.9, 0.8, 0.7, 0.5, 0.5, RiskHigh},
		{"medium range", 0.5, 0.4, 0.3, 0.2, 0.1, RiskMedium},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := CalculateRiskScore(
				"ent_1", tid,
				tt.sanctions, tt.pep, tt.media, tt.country, tt.industry,
				weights,
			)
			if score.Level != tt.wantLevel {
				t.Errorf("level=%s (score=%.3f), want=%s",
					score.Level, score.CompositeScore, tt.wantLevel)
			}
		})
	}
}

func TestCountryRiskScore(t *testing.T) {
	tests := []struct {
		country string
		want    float64
	}{
		{"IR", 1.0},
		{"KP", 1.0},
		{"US", 0.1},
		{"", 0.1},
	}
	for _, tt := range tests {
		t.Run(tt.country, func(t *testing.T) {
			got := CountryRiskScore(tt.country)
			if got != tt.want {
				t.Errorf("CountryRiskScore(%s)=%f, want=%f", tt.country, got, tt.want)
			}
		})
	}
}
