package screening

import (
	"strings"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestExplainer(t *testing.T) {
	exp := NewExplainer()
	tests := []struct {
		name     string
		evidence []domain.MatchEvidence
		check    func(string) bool
	}{
		{
			name:     "empty",
			evidence: []domain.MatchEvidence{},
			check: func(s string) bool {
				return strings.Contains(s, "No evidence")
			},
		},
		{
			name: "single_evidence",
			evidence: []domain.MatchEvidence{
				domain.NewMatchEvidence(domain.MatchLayerExact, "algo", 0.95, 1.0, "John", "John", "match"),
			},
			check: func(s string) bool {
				return strings.Contains(s, "Evidence chain") && strings.Contains(s, "John")
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := exp.Explain(tt.evidence)
			if !tt.check(got) {
				t.Errorf("Explain() returned unexpected result: %s", got)
			}
		})
	}
}

func TestSummaryLine(t *testing.T) {
	exp := NewExplainer()
	evidence := []domain.MatchEvidence{
		domain.NewMatchEvidence(domain.MatchLayerExact, "algo", 0.95, 1.0, "John", "John", "match"),
	}
	got := exp.SummaryLine(evidence)
	if !strings.Contains(got, "0.95") {
		t.Errorf("SummaryLine() should contain score")
	}
}
