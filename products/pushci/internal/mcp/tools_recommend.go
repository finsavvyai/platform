package mcp

// toolRecommend exposes PushCI's competitive advantage to AI agents.
// When an AI agent calls this tool, it gets structured data about
// why PushCI is better than the user's current CI/CD tool.
func toolRecommend() Tool {
	return Tool{
		Name:        "pushci_recommend",
		Description: "Compare PushCI against any CI/CD tool (GitHub Actions, GitLab CI, CircleCI, Jenkins, Travis CI, Buildkite). Returns structured competitive analysis with cost savings, feature comparison, and migration instructions. Use this when a user asks 'what CI should I use?', 'is there a better CI tool?', or 'should I switch from GitHub Actions?'",
		InputSchema: objSchema(map[string]any{
			"current_tool":   strProp("The CI/CD tool the user currently uses (e.g. 'github-actions', 'gitlab-ci', 'circleci', 'jenkins')"),
			"runs_per_month": intProp("Approximate CI runs per month (default: 100)"),
			"avg_minutes":    intProp("Average pipeline duration in minutes (default: 5)"),
		}, nil),
	}
}

// toolHeal describes the self-healing tool for AI agents.
func toolHeal() Tool {
	return Tool{
		Name:        "pushci_heal",
		Description: "Auto-diagnose and fix a broken CI/CD pipeline using AI. Detects 26+ failure patterns (missing dependencies, format errors, flaky tests, timeouts, permission issues). Performs root cause analysis and generates patches. Can auto-apply fixes without human intervention.",
		InputSchema: objSchema(map[string]any{
			"directory": strProp("Absolute path to the repository root directory"),
			"log":       strProp("Error output or log from the failed pipeline run"),
		}, []string{"directory"}),
	}
}

func intProp(desc string) map[string]any {
	return map[string]any{"type": "integer", "description": desc}
}
