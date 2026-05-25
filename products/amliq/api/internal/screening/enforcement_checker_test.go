package screening

import (
	"context"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

type mockEnforcementStore struct {
	actions []domain.EnforcementAction
}

func (m *mockEnforcementStore) SearchByName(_ context.Context, _ string, _ int) ([]domain.EnforcementAction, error) {
	return m.actions, nil
}

func TestEnforcementCheckerMatch(t *testing.T) {
	action, _ := domain.NewEnforcementAction(
		"Bad Corp", "SEC", domain.ActionFine,
		time.Now(), "Market manipulation", "https://sec.gov/1", "US",
	)
	store := &mockEnforcementStore{actions: []domain.EnforcementAction{action}}
	checker := NewEnforcementChecker(store)

	evidence := checker.Check(context.Background(), "Bad Corp")
	if len(evidence) == 0 {
		t.Fatal("expected enforcement evidence")
	}
	if evidence[0].Score < 0.5 {
		t.Errorf("fine score too low: %v", evidence[0].Score)
	}
}

func TestEnforcementCheckerNoMatch(t *testing.T) {
	store := &mockEnforcementStore{}
	checker := NewEnforcementChecker(store)

	evidence := checker.Check(context.Background(), "Clean Corp")
	if len(evidence) != 0 {
		t.Error("expected no evidence for clean entity")
	}
}

func TestEnforcementScore(t *testing.T) {
	tests := []struct {
		actionType domain.EnforcementActionType
		minScore   float64
	}{
		{domain.ActionBan, 0.8},
		{domain.ActionFine, 0.6},
		{domain.ActionWarning, 0.3},
	}
	for _, tt := range tests {
		a, _ := domain.NewEnforcementAction("X", "SEC", tt.actionType, time.Now(), "", "", "US")
		score := enforcementScore(a)
		if score < tt.minScore {
			t.Errorf("%s score=%v, want >=%v", tt.actionType, score, tt.minScore)
		}
	}
}
