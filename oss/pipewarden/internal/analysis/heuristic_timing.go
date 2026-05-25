package analysis

import (
	"fmt"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/integrations"
)

func (h *HeuristicAnalyzer) checkTimingAnomalies(conn *integrations.Connection, run *integrations.PipelineRun) []Finding {
	var findings []Finding

	// Check for extremely long run duration (possible resource abuse / crypto mining)
	if !run.FinishedAt.IsZero() && !run.StartedAt.IsZero() {
		duration := run.FinishedAt.Sub(run.StartedAt)

		if duration > 2*time.Hour {
			findings = append(findings, Finding{
				ConnectionName: conn.Name,
				RunID:          run.ID,
				Severity:       SeverityMedium,
				Category:       CategoryConfig,
				Title:          fmt.Sprintf("Unusually long pipeline run (%s)", formatDuration(duration)),
				Description:    fmt.Sprintf("This pipeline run took %s to complete. Extremely long runs can indicate resource abuse (cryptocurrency mining), infinite loops, or exfiltration of large datasets.", formatDuration(duration)),
				Remediation:    "Set maximum pipeline execution time limits. Investigate why this pipeline took so long. Review runner resource usage.",
				Confidence:     0.5,
				Status:         "open",
			})
		}

		// Very short pipeline (might be skipping steps)
		if duration < 10*time.Second && len(run.Steps) > 3 {
			findings = append(findings, Finding{
				ConnectionName: conn.Name,
				RunID:          run.ID,
				Severity:       SeverityLow,
				Category:       CategoryConfig,
				Title:          "Pipeline completed extremely fast for its complexity",
				Description:    fmt.Sprintf("Pipeline with %d steps completed in only %s. This may indicate steps are being skipped or cached without proper validation.", len(run.Steps), formatDuration(duration)),
				Remediation:    "Review pipeline step execution to ensure all steps are actually running their intended operations.",
				Confidence:     0.4,
				Status:         "open",
			})
		}
	}

	return findings
}

func (h *HeuristicAnalyzer) checkMissingChecks(conn *integrations.Connection, run *integrations.PipelineRun) []Finding {
	var findings []Finding

	if len(run.Steps) == 0 {
		return findings
	}

	stepNames := make([]string, len(run.Steps))
	for i, s := range run.Steps {
		stepNames[i] = strings.ToLower(s.Name)
	}
	allSteps := strings.Join(stepNames, " ")

	// Check for deployment without tests
	hasDeployStep := strings.Contains(allSteps, "deploy") || strings.Contains(allSteps, "release") || strings.Contains(allSteps, "publish")
	hasTestStep := strings.Contains(allSteps, "test") || strings.Contains(allSteps, "spec") || strings.Contains(allSteps, "check")

	if hasDeployStep && !hasTestStep {
		findings = append(findings, Finding{
			ConnectionName: conn.Name,
			RunID:          run.ID,
			Severity:       SeverityHigh,
			Category:       CategoryConfig,
			Title:          "Deployment without test steps",
			Description:    "This pipeline deploys code but has no visible test steps. Deploying untested code increases the risk of deploying vulnerabilities or broken functionality.",
			Remediation:    "Add unit tests, integration tests, and security tests before the deployment step. Ensure tests must pass before deployment proceeds.",
			Confidence:     0.65,
			Status:         "open",
		})
	}

	return findings
}
