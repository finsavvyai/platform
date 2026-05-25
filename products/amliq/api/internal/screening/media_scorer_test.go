package screening

import (
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestMediaScorer(t *testing.T) {
	tenantID, _ := domain.NewTenantID("tnt_000000000001")
	scorer := NewMediaScorer()

	hit1, _ := domain.NewAdverseMediaHit("ent_1", tenantID, domain.MediaMoneyLaundering, "reuters.com", "ML scheme", "https://reuters.com/1", 9)
	hit2, _ := domain.NewAdverseMediaHit("ent_1", tenantID, domain.MediaFraud, "bbc.com", "Fraud case", "https://bbc.com/1", 7)

	tests := []struct {
		name     string
		hits     []domain.AdverseMediaHit
		minScore float64
		maxScore float64
	}{
		{"empty", nil, 0, 0.01},
		{"single_tier1", []domain.AdverseMediaHit{hit1}, 0.3, 1.0},
		{"multiple_sources", []domain.AdverseMediaHit{hit1, hit2}, 0.3, 1.0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := scorer.Score(tt.hits)
			if score < tt.minScore || score > tt.maxScore {
				t.Errorf("score = %v, want [%v, %v]", score, tt.minScore, tt.maxScore)
			}
		})
	}
}

func TestSourceClassification(t *testing.T) {
	tests := []struct {
		source string
		tier   SourceTier
	}{
		{"reuters.com", SourceTier1},
		{"bloomberg.com", SourceTier1},
		{"bbc.co.uk", SourceTier2},
		{"cnn.com", SourceTier2},
		{"randomblog.xyz", SourceTier3},
	}
	for _, tt := range tests {
		t.Run(tt.source, func(t *testing.T) {
			if got := classifySource(tt.source); got != tt.tier {
				t.Errorf("classifySource(%s) = %v, want %v", tt.source, got, tt.tier)
			}
		})
	}
}

func TestRecencyDecay(t *testing.T) {
	scorer := NewMediaScorer()
	recent := scorer.recencyDecay(time.Now())
	old := scorer.recencyDecay(time.Now().AddDate(-1, 0, 0))
	if recent <= old {
		t.Error("recent articles should score higher than old ones")
	}
	if recent < 0.95 {
		t.Errorf("very recent decay should be ~1.0, got %v", recent)
	}
}
