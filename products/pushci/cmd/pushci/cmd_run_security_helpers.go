package main

import "github.com/finsavvyai/pushci/internal/security"

// groupFindingsBySeverity groups security findings by their severity level.
func groupFindingsBySeverity(findings []security.PipelineFinding) map[string][]security.PipelineFinding {
	groups := make(map[string][]security.PipelineFinding)
	for _, f := range findings {
		groups[f.Severity] = append(groups[f.Severity], f)
	}
	return groups
}

// hasCriticalFindings checks if the result contains any critical-severity findings.
func hasCriticalFindings(findings []security.PipelineFinding) bool {
	for _, f := range findings {
		if f.Severity == "critical" {
			return true
		}
	}
	return false
}
