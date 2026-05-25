package security

import (
	"regexp"
	"strings"
)

func scanSecrets(content, filename string) []PipelineFinding {
	var findings []PipelineFinding
	for i, line := range strings.Split(content, "\n") {
		for _, pattern := range SecretPatterns {
			if pattern.MatchString(line) {
				findings = append(findings, PipelineFinding{
					Severity:    "critical",
					Category:    "secrets",
					Title:       "Hardcoded Secret Detected",
					Description: "Pipeline config contains what appears to be a hardcoded secret",
					Remediation: "Remove the secret and use environment variables or secrets management",
					File:        filename,
					Line:        i + 1,
				})
				break
			}
		}
	}
	return findings
}

func scanMissingSecuritySteps(content, filename string) []PipelineFinding {
	var findings []PipelineFinding
	hasLint := regexp.MustCompile(`(?i)(lint|eslint|pylint|golangci)`).MatchString(content)
	hasTest := regexp.MustCompile(`(?i)(test|pytest|go test|npm test)`).MatchString(content)
	hasSAST := regexp.MustCompile(`(?i)(sast|semgrep|snyk|sonarqube)`).MatchString(content)

	if !hasLint {
		findings = append(findings, PipelineFinding{
			Severity:    "medium",
			Category:    "configuration",
			Title:       "Missing Lint Step",
			Description: "Pipeline does not include linting to catch code quality issues",
			Remediation: "Add a lint step using eslint, pylint, golangci-lint, or similar",
			File:        filename,
			Line:        0,
		})
	}

	if !hasTest {
		findings = append(findings, PipelineFinding{
			Severity:    "high",
			Category:    "configuration",
			Title:       "Missing Test Step",
			Description: "Pipeline does not include unit tests",
			Remediation: "Add test steps using pytest, go test, npm test, or similar",
			File:        filename,
			Line:        0,
		})
	}

	if !hasSAST {
		findings = append(findings, PipelineFinding{
			Severity:    "medium",
			Category:    "configuration",
			Title:       "No SAST Scanning",
			Description: "Pipeline lacks static application security testing",
			Remediation: "Integrate SAST tools like Semgrep, Snyk, or SonarQube",
			File:        filename,
			Line:        0,
		})
	}

	return findings
}
