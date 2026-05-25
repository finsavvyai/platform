package agents

import (
	"strings"
	"testing"
)

func TestEvolvePipelineNoCaching(t *testing.T) {
	config := "on: [push]\nchecks:\n  - npm install\n  - npm test\n"
	ev := EvolvePipeline(config)
	if len(ev.Suggestions) < 2 {
		t.Errorf("suggestions = %d, want >= 2", len(ev.Suggestions))
	}
}

func TestEvolvePipelineAlreadyOptimized(t *testing.T) {
	config := "on: [push]\nchecks:\n  - test\ncache:\n  - node_modules\nparallel: true\n"
	ev := EvolvePipeline(config)
	if len(ev.Suggestions) != 0 {
		t.Errorf("suggestions = %d, want 0", len(ev.Suggestions))
	}
}

func TestApplyEvolution(t *testing.T) {
	config := "on: [push]\nchecks:\n  - test\n"
	suggestions := []EvolveSuggestion{
		{Action: "add_cache"},
		{Action: "parallelize"},
	}
	result := ApplyEvolution(config, suggestions)
	if !strings.Contains(result, "cache:") {
		t.Error("expected cache directive")
	}
	if !strings.Contains(result, "parallel:") {
		t.Error("expected parallel directive")
	}
}
