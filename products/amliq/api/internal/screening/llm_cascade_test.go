package screening

import (
	"context"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

type mockLLMClient struct {
	response string
	err      error
}

func (m *mockLLMClient) Complete(_ context.Context, _ string) (string, error) {
	return m.response, m.err
}

func testCandidate() domain.Entity {
	dob := time.Date(1980, 1, 1, 0, 0, 0, 0, time.UTC)
	name, _ := domain.NewName("Ali Hassan", "Ali", "Hassan", "")
	eid, _ := domain.NewEntityID("cand-001")
	e, _ := domain.NewEntity(eid, domain.EntityTypeIndividual, []domain.Name{name})
	e.DOB = &dob
	e.Nationalities = []string{"SY"}
	e.ListID = "OFAC-SDN"
	return e
}

func TestCascadeOnlyTriggeredForUncertainScores(t *testing.T) {
	cascade := NewLLMCascade(&mockLLMClient{response: "YES"}, 0.4, 0.8)
	tests := []struct {
		name   string
		score  float64
		should bool
	}{
		{"below_low", 0.3, false},
		{"at_low", 0.4, true},
		{"middle", 0.6, true},
		{"at_high", 0.8, true},
		{"above_high", 0.9, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := cascade.ShouldEvaluate(tt.score); got != tt.should {
				t.Errorf("ShouldEvaluate(%.1f) = %v, want %v",
					tt.score, got, tt.should)
			}
		})
	}
}

func TestHighScoreBypassesCascade(t *testing.T) {
	cascade := NewLLMCascade(&mockLLMClient{response: "YES"}, 0.4, 0.8)
	_, err := cascade.Evaluate(context.Background(), "Ali", testCandidate(), 0.95)
	if err == nil {
		t.Error("expected error for high score bypass")
	}
}

func TestLowScoreBypassesCascade(t *testing.T) {
	cascade := NewLLMCascade(&mockLLMClient{response: "NO"}, 0.4, 0.8)
	_, err := cascade.Evaluate(context.Background(), "Ali", testCandidate(), 0.1)
	if err == nil {
		t.Error("expected error for low score bypass")
	}
}

func TestCascadeEvaluateYes(t *testing.T) {
	cascade := NewLLMCascade(&mockLLMClient{response: "YES same entity"}, 0.4, 0.8)
	result, err := cascade.Evaluate(
		context.Background(), "Ali Hassan", testCandidate(), 0.6,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.IsSameEntity {
		t.Error("expected IsSameEntity=true")
	}
	if result.Confidence < 0.8 {
		t.Errorf("expected high confidence, got %v", result.Confidence)
	}
}

func TestCascadeEvaluateNo(t *testing.T) {
	cascade := NewLLMCascade(&mockLLMClient{response: "NO different person"}, 0.4, 0.8)
	result, err := cascade.Evaluate(
		context.Background(), "John Smith", testCandidate(), 0.5,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.IsSameEntity {
		t.Error("expected IsSameEntity=false")
	}
}
