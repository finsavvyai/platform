package scorer

import (
	"testing"

	"github.com/sdlc-ai/platform/packages/insights-core/types"
)

func TestScoreZero(t *testing.T) {
	s := New(types.DefaultWeights())
	got := s.Score(types.ScoreBreakdown{})
	if got != 0 {
		t.Fatalf("want 0, got %v", got)
	}
}

func TestScoreMax(t *testing.T) {
	s := New(types.DefaultWeights())
	got := s.Score(types.ScoreBreakdown{SOC2: 1, HIPAA: 1, GDPR: 1, Cost: 1, Blast: 1})
	if got != 1 {
		t.Fatalf("want 1, got %v", got)
	}
}

func TestScoreClamped(t *testing.T) {
	s := New(types.Weights{SOC2: 2})
	got := s.Score(types.ScoreBreakdown{SOC2: 2})
	if got != 1 {
		t.Fatalf("want clamp to 1, got %v", got)
	}
}
