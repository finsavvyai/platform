package analysis

import (
	"strings"
)

// managedRunners is the set of GitHub-hosted runner labels that are ephemeral by design.
var managedRunners = map[string]bool{
	"ubuntu-latest":  true,
	"ubuntu-22.04":   true,
	"ubuntu-20.04":   true,
	"ubuntu-18.04":   true,
	"windows-latest": true,
	"windows-2022":   true,
	"windows-2019":   true,
	"macos-latest":   true,
	"macos-13":       true,
	"macos-12":       true,
	"macos-11":       true,
}

// RunnerIsolationChecker analyzes pipeline YAML content to detect runner reuse risk.
type RunnerIsolationChecker struct{}

// NewRunnerIsolationChecker creates a new RunnerIsolationChecker.
func NewRunnerIsolationChecker() *RunnerIsolationChecker {
	return &RunnerIsolationChecker{}
}

// CheckRunnerReuse inspects pipeline YAML for self-hosted or variable runners.
// It returns Findings for each detected risk pattern.
func (c *RunnerIsolationChecker) CheckRunnerReuse(content string) []Finding {
	var findings []Finding

	lines := strings.Split(content, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		// Only examine "runs-on:" directives
		if !strings.HasPrefix(trimmed, "runs-on:") {
			continue
		}

		value := strings.TrimSpace(strings.TrimPrefix(trimmed, "runs-on:"))

		// Variable reference (e.g. ${{ vars.RUNNER_GROUP }})
		if strings.Contains(value, "${{") {
			findings = append(findings, Finding{
				Severity: SeverityLow,
				Category: "runner-isolation",
				Title:    "Runner label uses a variable — verify ephemeral configuration",
				Description: "The runs-on value (" + value + ") is resolved at runtime from a " +
					"variable expression. If this resolves to a self-hosted runner, cross-job " +
					"contamination risk applies. Ensure the runner is ephemeral.",
				Remediation: "Pin runs-on to a known ephemeral label or document that the " +
					"variable always resolves to a managed runner.",
				Confidence: 0.6,
				Status:     "open",
			})
			continue
		}

		// Inline array syntax: [self-hosted, linux, X64]
		if strings.HasPrefix(value, "[") {
			if isSelfHostedArray(value) {
				findings = append(findings, selfHostedFinding(value))
			}
			continue
		}

		// Scalar value — check against known managed runners
		label := strings.Trim(value, `"'`)
		if label == "self-hosted" || (!managedRunners[label] && label != "") {
			findings = append(findings, selfHostedFinding(value))
		}
	}

	return findings
}

// isSelfHostedArray returns true when an inline array contains "self-hosted"
// or contains no managed-runner labels at all.
func isSelfHostedArray(value string) bool {
	inner := strings.Trim(value, "[]")
	parts := strings.Split(inner, ",")
	for _, p := range parts {
		label := strings.TrimSpace(strings.Trim(p, `"' `))
		if label == "self-hosted" {
			return true
		}
		if managedRunners[label] {
			return false // at least one managed label → treat as managed
		}
	}
	// No managed labels found — likely a custom/self-hosted pool
	return true
}

// selfHostedFinding builds the standard medium-severity finding for a self-hosted runner.
func selfHostedFinding(value string) Finding {
	return Finding{
		Severity: SeverityMedium,
		Category: "runner-isolation",
		Title:    "Self-hosted runner detected — verify ephemeral configuration",
		Description: "The pipeline uses a self-hosted runner (" + value + "). " +
			"Non-ephemeral self-hosted runners persist between jobs, creating cross-job " +
			"contamination risk: secrets, build artifacts, and environment mutations from " +
			"one job may be visible to subsequent jobs on the same runner.",
		Remediation: "Use ephemeral runners (--ephemeral flag with GitHub Actions Runner) " +
			"or migrate to managed GitHub-hosted runners (ubuntu-latest, etc.) for " +
			"better isolation. If self-hosted runners are required, enforce workspace " +
			"cleanup steps at the start of every job.",
		Confidence: 0.85,
		Status:     "open",
	}
}
