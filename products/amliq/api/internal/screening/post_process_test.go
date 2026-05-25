package screening

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestPostProcess(t *testing.T) {
	cfg := func(esc, dis float64) domain.TenantConfig {
		return domain.TenantConfig{AutoEscalateAbove: esc, AutoDismissBelow: dis}
	}
	tests := []struct {
		name    string
		config  domain.TenantConfig
		input   []domain.MatchResult
		wantEsc int
		wantRev int
		wantDis int
	}{
		{
			name: "all_escalated", config: cfg(0.8, 0.3),
			input:   []domain.MatchResult{mkMatch(0.95), mkMatch(0.90)},
			wantEsc: 2, wantRev: 0, wantDis: 0,
		},
		{
			name: "all_dismissed", config: cfg(0.8, 0.3),
			input:   []domain.MatchResult{mkMatch(0.25), mkMatch(0.20)},
			wantEsc: 0, wantRev: 0, wantDis: 2,
		},
		{
			name: "all_review", config: cfg(0.8, 0.3),
			input:   []domain.MatchResult{mkMatch(0.70), mkMatch(0.50)},
			wantEsc: 0, wantRev: 2, wantDis: 0,
		},
		{
			name: "mixed", config: cfg(0.8, 0.3),
			input:   []domain.MatchResult{mkMatch(0.95), mkMatch(0.60), mkMatch(0.25)},
			wantEsc: 1, wantRev: 1, wantDis: 1,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := PostProcess(tt.input, tt.config)
			if len(r.Escalated) != tt.wantEsc {
				t.Errorf("escalated: got %d, want %d", len(r.Escalated), tt.wantEsc)
			}
			if len(r.Review) != tt.wantRev {
				t.Errorf("review: got %d, want %d", len(r.Review), tt.wantRev)
			}
			if len(r.Dismissed) != tt.wantDis {
				t.Errorf("dismissed: got %d, want %d", len(r.Dismissed), tt.wantDis)
			}
		})
	}
}

func mkMatch(score float64) domain.MatchResult {
	conf, _ := domain.NewConfidence(score)
	eid, _ := domain.NewEntityID("ent_000000000001")
	return domain.NewMatchResult(eid, conf, domain.DispositionReview,
		[]domain.MatchEvidence{}, "test", "list_test")
}
