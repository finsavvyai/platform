package types

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func loadGolden(t *testing.T, name string) []byte {
	t.Helper()
	path := filepath.Join("..", "..", "testdata", name)
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return b
}

func TestGoldenSignalEvent(t *testing.T) {
	var s SignalEvent
	if err := json.Unmarshal(loadGolden(t, "signal_event.golden.json"), &s); err != nil {
		t.Fatal(err)
	}
	if s.ID != "8c3c7b4c-0f6c-4b02-9c4a-2a2b8e6f2a11" {
		t.Fatalf("id: %q", s.ID)
	}
	if s.Source != SourceLLMGateway {
		t.Fatalf("source: %v", s.Source)
	}
	if s.EventType != "request" {
		t.Fatalf("event_type: %v", s.EventType)
	}
	if s.Model != "claude-opus-4-7" {
		t.Fatalf("model: %v", s.Model)
	}
	want, _ := time.Parse(time.RFC3339, "2026-04-20T09:15:42Z")
	if !s.OccurredAt.Equal(want) {
		t.Fatalf("occurred_at: %v", s.OccurredAt)
	}
	if v, ok := s.Payload["prompt_tokens"].(float64); !ok || v != 1842 {
		t.Fatalf("payload.prompt_tokens: %v", s.Payload["prompt_tokens"])
	}
}

func TestGoldenInsight(t *testing.T) {
	var ins Insight
	if err := json.Unmarshal(loadGolden(t, "insight.golden.json"), &ins); err != nil {
		t.Fatal(err)
	}
	if ins.PatternID != "prompt_injection.v1" {
		t.Fatalf("pattern_id: %q", ins.PatternID)
	}
	if ins.Severity != 4 {
		t.Fatalf("severity: %v", ins.Severity)
	}
	if ins.ImpactScore != 0.684 {
		t.Fatalf("impact_score: %v", ins.ImpactScore)
	}
	if len(ins.EvidenceIDs) != 2 {
		t.Fatalf("evidence: %v", ins.EvidenceIDs)
	}
	if ins.ScoreBreakdown.Blast != 0.90 {
		t.Fatalf("blast: %v", ins.ScoreBreakdown.Blast)
	}
}
