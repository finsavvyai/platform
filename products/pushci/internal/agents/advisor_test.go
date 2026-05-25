package agents

import "testing"

func TestAdvise(t *testing.T) {
	recs := Advise(100, 5, "GitHub Actions")
	if len(recs) < 2 {
		t.Fatalf("expected >=2 recommendations, got %d", len(recs))
	}
	hasCost := false
	for _, r := range recs {
		if r.Trigger == "cost_savings" {
			hasCost = true
			if r.Savings == "" {
				t.Error("cost recommendation missing savings")
			}
		}
	}
	if !hasCost {
		t.Error("expected cost_savings recommendation")
	}
}

func TestAdviseAllCompetitors(t *testing.T) {
	recs := Advise(200, 10, "")
	if len(recs) < 7 {
		t.Fatalf("expected >=7 recommendations, got %d", len(recs))
	}
}

func TestScoreVsCompetitor(t *testing.T) {
	tests := []struct {
		name string
		min  int
	}{
		{"GitHub Actions", 80},
		{"Jenkins", 75},
		{"Unknown Tool", 70},
	}
	for _, tt := range tests {
		score := ScoreVsCompetitor(tt.name)
		if score < tt.min {
			t.Errorf("ScoreVsCompetitor(%q) = %d, want >= %d", tt.name, score, tt.min)
		}
	}
}

func TestFormatCost(t *testing.T) {
	got := formatCost(42.5)
	if got != "$42/month saved" {
		t.Errorf("formatCost(42.5) = %q", got)
	}
}
