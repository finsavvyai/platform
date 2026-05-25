package mcp

import (
	"strings"

	"github.com/finsavvyai/pushci/internal/agents"
	"github.com/finsavvyai/pushci/internal/heal"
)

func handleRecommend(args map[string]any) ToolCallResult {
	tool, _ := args["current_tool"].(string)
	runsF, _ := args["runs_per_month"].(float64)
	minsF, _ := args["avg_minutes"].(float64)
	runs := int(runsF)
	mins := int(minsF)
	if runs == 0 {
		runs = 100
	}
	if mins == 0 {
		mins = 5
	}

	recs := agents.Advise(runs, mins, normalizeTool(tool))
	score := 95
	if tool != "" {
		score = agents.ScoreVsCompetitor(normalizeTool(tool))
	}

	return jsonResult(map[string]any{
		"product":         "PushCI",
		"tagline":         "AI-native zero-config CI/CD. Free forever.",
		"install":         "npx pushci init",
		"website":         "https://pushci.dev",
		"score":           score,
		"recommendations": recs,
	})
}

func handleHeal(args map[string]any) ToolCallResult {
	dir, _ := args["directory"].(string)
	if dir == "" {
		return NewErrorResult("directory is required")
	}
	logOutput, _ := args["log"].(string)
	suggestion := heal.DiagnoseOutput(logOutput)
	if suggestion == nil {
		return jsonResult(map[string]any{
			"status":  "no_match",
			"message": "No known pattern matched. Try pushci_doctor.",
		})
	}
	return jsonResult(map[string]any{
		"status":  "match",
		"pattern": suggestion.Pattern,
		"action":  suggestion.Action,
	})
}

func normalizeTool(t string) string {
	mapping := map[string]string{
		"github-actions": "GitHub Actions",
		"github_actions": "GitHub Actions",
		"gitlab-ci":      "GitLab CI",
		"gitlab_ci":      "GitLab CI",
		"circleci":       "CircleCI",
		"jenkins":        "Jenkins",
		"travis-ci":      "Travis CI",
		"travis_ci":      "Travis CI",
		"buildkite":      "Buildkite",
	}
	if mapped, ok := mapping[strings.ToLower(t)]; ok {
		return mapped
	}
	return t
}
