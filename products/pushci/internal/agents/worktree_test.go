package agents

import (
	"context"
	"testing"
	"time"
)

func TestRunParallelNoIsolation(t *testing.T) {
	agents := []*Agent{
		NewAgent(AgentBuild),
		NewAgent(AgentTest),
		NewAgent(AgentSecurity),
	}
	data := AgentData{FailureRate: 0.2, CacheHitRate: 0.3}
	config := ParallelConfig{MaxWorkers: 2, Isolated: false}

	results, err := RunParallel(context.Background(), agents, data, config)
	if err != nil {
		t.Fatalf("RunParallel error: %v", err)
	}
	if len(results) != 3 {
		t.Fatalf("results = %d, want 3", len(results))
	}
	for _, r := range results {
		if r.Name == "" {
			t.Error("result missing agent name")
		}
		if r.Duration < 0 {
			t.Error("result duration should not be negative")
		}
	}
}

func TestRunParallelContextCancel(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	agents := []*Agent{NewAgent(AgentBuild)}
	_, err := RunParallel(ctx, agents, AgentData{}, ParallelConfig{MaxWorkers: 1})
	if err == nil {
		t.Log("cancelled context handled gracefully")
	}
}

func TestConsensusAllPass(t *testing.T) {
	results := []AgentResult{
		{Name: "build", Success: true, Duration: time.Second},
		{Name: "test", Success: true, Duration: 2 * time.Second},
	}
	c := EvaluateConsensus(results, "consensus")
	if !c.Agreed {
		t.Error("expected unanimous agreement")
	}
	if c.Majority != "pass" {
		t.Errorf("majority = %s, want pass", c.Majority)
	}
}

func TestConsensusMajorityFail(t *testing.T) {
	results := []AgentResult{
		{Name: "build", Success: false, Duration: time.Second},
		{Name: "test", Success: false, Duration: 2 * time.Second},
		{Name: "security", Success: true, Duration: 3 * time.Second},
	}
	c := EvaluateConsensus(results, "consensus")
	if c.Agreed {
		t.Error("expected disagreement")
	}
	if c.Majority != "fail" {
		t.Errorf("majority = %s, want fail", c.Majority)
	}
}

func TestRaceStrategy(t *testing.T) {
	results := []AgentResult{
		{Name: "build", Success: true, Duration: 3 * time.Second},
		{Name: "test", Success: false, Duration: 1 * time.Second},
	}
	c := EvaluateConsensus(results, "race")
	if !c.Agreed {
		t.Error("race should always agree")
	}
	if c.Majority != "fail" {
		t.Errorf("race winner = %s, want fail (fastest)", c.Majority)
	}
}

func TestRaceEmptyResults(t *testing.T) {
	c := EvaluateConsensus(nil, "race")
	if c.Agreed {
		t.Error("empty race should not agree")
	}
}
