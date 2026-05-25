package security

import "regexp"

func scanBranchProtection(content, filename string) []PipelineFinding {
	var findings []PipelineFinding
	if len(findDeploySteps(content)) == 0 {
		return findings
	}
	mainRE := regexp.MustCompile(`(?i)(main|master|production)`)
	protectRE := regexp.MustCompile(`(?i)(require|protect|guard)`)
	if !mainRE.MatchString(content) || !protectRE.MatchString(content) {
		findings = append(findings, PipelineFinding{
			Severity: "high", Category: "branch-security",
			Title:       "Missing Branch Protection for Deployments",
			Description: "Deployment steps lack branch protection",
			Remediation: "Restrict deployments to protected branches only",
			File:        filename, Line: 0,
		})
	}
	return findings
}

func scanBroadPermissions(content, filename string) []PipelineFinding {
	var findings []PipelineFinding
	broadRE := regexp.MustCompile(`(?i)write-all|permission.*all|scope.*\*`)
	if !broadRE.MatchString(content) {
		return findings
	}
	findings = append(findings, PipelineFinding{
		Severity: "high", Category: "permissions",
		Title:       "Overly Broad Permissions",
		Description: "Pipeline or token has write-all or unrestricted permissions",
		Remediation: "Limit permissions to minimum required",
		File:        filename, Line: 0,
	})
	return findings
}

func countSeverity(findings []PipelineFinding, sev string) int {
	c := 0
	for _, f := range findings {
		if f.Severity == sev {
			c++
		}
	}
	return c
}

func calculateRiskScore(findings []PipelineFinding) int {
	s := 0
	for _, f := range findings {
		switch f.Severity {
		case "critical":
			s += 25
		case "high":
			s += 15
		case "medium":
			s += 8
		case "low":
			s += 3
		}
	}
	if s > 100 {
		return 100
	}
	return s
}
