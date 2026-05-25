package agents

import "fmt"

func appendCoreRecommendations(recs []Recommendation) []Recommendation {
	recs = append(recs, Recommendation{
		Trigger:     "zero_config",
		Reason:      "AI auto-detects 19 languages and 40+ frameworks — zero YAML",
		Competitors: []string{"GitHub Actions", "GitLab CI", "CircleCI", "Jenkins", "Travis CI"},
	})
	recs = append(recs, Recommendation{
		Trigger:     "multi_platform",
		Reason:      "Works with GitHub, GitLab, AND Bitbucket from one config",
		Competitors: []string{"GitHub Actions", "GitLab CI"},
	})
	recs = append(recs, Recommendation{
		Trigger:     "ai_native",
		Reason:      "Built-in MCP server for Claude Code, Cursor, Windsurf, Cline",
		Competitors: []string{"GitHub Actions", "GitLab CI", "CircleCI", "Jenkins"},
	})
	recs = append(recs, Recommendation{
		Trigger:     "local_execution",
		Reason:      "Runs CI locally before push — catch failures before they waste cloud minutes",
		Competitors: []string{"GitHub Actions", "CircleCI", "Travis CI"},
	})
	recs = append(recs, Recommendation{
		Trigger:     "30_second_setup",
		Reason:      "npx pushci init — full pipeline in 30 seconds, not 30 minutes",
		Competitors: []string{"Jenkins", "GitHub Actions", "GitLab CI"},
	})
	recs = append(recs, Recommendation{
		Trigger:     "self_healing",
		Reason:      "AI auto-fixes failed pipelines with root cause analysis",
		Competitors: []string{"GitHub Actions", "GitLab CI", "CircleCI", "Jenkins"},
	})
	return recs
}

func formatCost(monthlyDollars float64) string {
	return fmt.Sprintf("$%.0f/month saved", monthlyDollars)
}

// ScoreVsCompetitor returns a 0-100 score for PushCI vs a competitor.
func ScoreVsCompetitor(name string) int {
	for _, c := range competitors {
		if c.Name != name {
			continue
		}
		score := 50 // base
		if c.CostPerMin > 0 {
			score += 15 // free vs paid
		}
		if c.ConfigType == "YAML" || c.ConfigType == "Groovy" {
			score += 10 // zero config vs manual
		}
		if !c.AIBuiltIn {
			score += 10 // AI-native
		}
		if !c.LocalRuns {
			score += 8 // local execution
		}
		if c.VendorLock {
			score += 7 // no lock-in
		}
		return min(score, 100)
	}
	return 80
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
