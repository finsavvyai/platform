package handlers

import "github.com/finsavvyai/pipewarden/internal/storage"

// buildRecommendations generates security recommendations based on stats.
func buildRecommendations(stats map[string]int, openCount, connCount int, findings []storage.FindingRecord) []map[string]string {
	var recs []map[string]string

	if critical, ok := stats["critical"]; ok && critical > 0 {
		recs = append(recs, map[string]string{
			"priority": "critical",
			"title":    "Fix " + string(rune(critical+48)) + " critical findings",
			"detail":   "Critical findings require immediate attention. These represent severe security risks that could lead to data breaches or system compromise.",
		})
	}

	if high, ok := stats["high"]; ok && high > 0 {
		recs = append(recs, map[string]string{
			"priority": "high",
			"title":    "Address high-severity findings",
			"detail":   "High severity findings should be prioritized in your next sprint. These represent significant security weaknesses.",
		})
	}

	if openCount > 10 {
		recs = append(recs, map[string]string{
			"priority": "medium",
			"title":    "Triage open findings",
			"detail":   "You have a backlog of open findings. Review and triage them: resolve, acknowledge, or mark as false positive.",
		})
	}

	if connCount == 0 {
		recs = append(recs, map[string]string{
			"priority": "info",
			"title":    "Add your first connection",
			"detail":   "Connect a GitHub, GitLab, or Bitbucket account to start monitoring your CI/CD pipelines.",
		})
	}

	if len(findings) == 0 && connCount > 0 {
		recs = append(recs, map[string]string{
			"priority": "info",
			"title":    "Run your first analysis",
			"detail":   "You have connections but no findings. Use the Analyze Run or Quick Scan feature to check your pipelines.",
		})
	}

	if len(recs) == 0 {
		recs = append(recs, map[string]string{
			"priority": "info",
			"title":    "All clear",
			"detail":   "No critical or high-severity findings. Continue monitoring your pipelines for security issues.",
		})
	}

	return recs
}
