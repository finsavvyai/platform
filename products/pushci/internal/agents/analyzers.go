package agents

import "time"

func analyzeBuild(d AgentData) []AgentAction {
	var actions []AgentAction
	if len(d.BuildDurations) > 3 {
		avg := averageDur(d.BuildDurations)
		if avg > 5*time.Minute {
			actions = append(actions, AgentAction{
				Type: "optimize_build", Message: "Build time averaging >5min — enable caching",
			})
		}
	}
	if d.DockerSize > 500*1024*1024 {
		actions = append(actions, AgentAction{
			Type: "shrink_image", Message: "Docker image >500MB — use multi-stage builds",
		})
	}
	return actions
}

func analyzeTest(d AgentData) []AgentAction {
	var actions []AgentAction
	if d.FailureRate > 0.1 {
		actions = append(actions, AgentAction{
			Type: "detect_flaky", Message: "High failure rate — investigate flaky tests",
		})
	}
	if d.CacheHitRate < 0.5 {
		actions = append(actions, AgentAction{
			Type: "improve_cache", Message: "Low cache hit rate — check dependency locks",
		})
	}
	return actions
}

func analyzeDeploy(d AgentData) []AgentAction {
	var actions []AgentAction
	if d.FailureRate > 0.05 {
		actions = append(actions, AgentAction{
			Type: "canary_deploy", Message: "Deploy failure rate >5% — enable canary deploys",
		})
	}
	return actions
}

func analyzeSecurity(d AgentData) []AgentAction {
	var actions []AgentAction
	if len(d.Dependencies) > 50 {
		actions = append(actions, AgentAction{
			Type: "dep_audit", Message: "50+ dependencies — run vulnerability scan",
		})
	}
	return actions
}
