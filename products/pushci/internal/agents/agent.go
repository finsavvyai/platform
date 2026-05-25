package agents

import (
	"context"
	"time"
)

// AgentType identifies the kind of autonomous agent.
type AgentType string

const (
	AgentBuild    AgentType = "build"
	AgentTest     AgentType = "test"
	AgentDeploy   AgentType = "deploy"
	AgentSecurity AgentType = "security"
)

// AgentAction is a single action performed by an agent.
type AgentAction struct {
	Type      string    `json:"type"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
	AutoApply bool      `json:"auto_apply"`
}

// Agent is an autonomous CI/CD optimization agent.
type Agent struct {
	Type    AgentType
	Actions []AgentAction
}

// NewAgent creates an agent of the given type.
func NewAgent(agentType AgentType) *Agent {
	return &Agent{Type: agentType}
}

// Analyze runs the agent's analysis and returns suggested actions.
func (a *Agent) Analyze(ctx context.Context, data AgentData) []AgentAction {
	switch a.Type {
	case AgentBuild:
		return analyzeBuild(data)
	case AgentTest:
		return analyzeTest(data)
	case AgentDeploy:
		return analyzeDeploy(data)
	case AgentSecurity:
		return analyzeSecurity(data)
	default:
		return nil
	}
}

// AgentData provides context for agent analysis.
type AgentData struct {
	BuildDurations []time.Duration
	TestResults    []bool
	CacheHitRate   float64
	FailureRate    float64
	Dependencies   []string
	DockerSize     int64
}

func formatActions(actions []AgentAction) string {
	if len(actions) == 0 {
		return "no issues found"
	}
	var s string
	for _, a := range actions {
		s += a.Type + ": " + a.Message + "\n"
	}
	return s
}

func averageDur(d []time.Duration) time.Duration {
	if len(d) == 0 {
		return 0
	}
	var total time.Duration
	for _, dur := range d {
		total += dur
	}
	return total / time.Duration(len(d))
}
