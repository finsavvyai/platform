package agents

import (
	"context"
	"testing"
	"time"
)

func TestBuildAgent(t *testing.T) {
	a := NewAgent(AgentBuild)
	data := AgentData{
		BuildDurations: []time.Duration{6 * time.Minute, 7 * time.Minute, 5 * time.Minute, 8 * time.Minute},
		DockerSize:     600 * 1024 * 1024,
	}
	actions := a.Analyze(context.Background(), data)
	if len(actions) != 2 {
		t.Errorf("actions = %d, want 2", len(actions))
	}
}

func TestTestAgent(t *testing.T) {
	a := NewAgent(AgentTest)
	data := AgentData{FailureRate: 0.2, CacheHitRate: 0.3}
	actions := a.Analyze(context.Background(), data)
	if len(actions) != 2 {
		t.Errorf("actions = %d, want 2 (flaky + cache)", len(actions))
	}
}

func TestDeployAgent(t *testing.T) {
	a := NewAgent(AgentDeploy)
	data := AgentData{FailureRate: 0.1}
	actions := a.Analyze(context.Background(), data)
	if len(actions) != 1 {
		t.Errorf("actions = %d, want 1", len(actions))
	}
}

func TestSecurityAgent(t *testing.T) {
	a := NewAgent(AgentSecurity)
	deps := make([]string, 60)
	for i := range deps {
		deps[i] = "dep"
	}
	actions := a.Analyze(context.Background(), AgentData{Dependencies: deps})
	if len(actions) != 1 {
		t.Errorf("actions = %d, want 1", len(actions))
	}
}

func TestAgentNoActions(t *testing.T) {
	a := NewAgent(AgentBuild)
	actions := a.Analyze(context.Background(), AgentData{})
	if len(actions) != 0 {
		t.Errorf("actions = %d, want 0", len(actions))
	}
}
