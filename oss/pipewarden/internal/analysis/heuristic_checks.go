package analysis

import (
	"fmt"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/integrations"
)

func (h *HeuristicAnalyzer) checkBranchSecurity(conn *integrations.Connection, run *integrations.PipelineRun) []Finding {
	var findings []Finding
	branch := strings.ToLower(run.Branch)

	// Check if deploying from main/master directly
	if branch == "main" || branch == "master" {
		if run.Status == integrations.StatusSuccess {
			findings = append(findings, Finding{
				ConnectionName: conn.Name,
				RunID:          run.ID,
				Severity:       SeverityMedium,
				Category:       CategoryAccessControl,
				Title:          "Direct push to protected branch",
				Description:    fmt.Sprintf("Pipeline run executed directly on %s branch. Direct pushes to main branches may bypass code review requirements.", run.Branch),
				Remediation:    "Enforce branch protection rules requiring pull request reviews before merging to " + run.Branch,
				Confidence:     0.6,
				Status:         "open",
			})
		}
	}

	// Check for suspicious branch names
	suspiciousPrefixes := []string{"temp/", "test/", "debug/", "hack/", "quick-"}
	for _, prefix := range suspiciousPrefixes {
		if strings.HasPrefix(branch, prefix) {
			findings = append(findings, Finding{
				ConnectionName: conn.Name,
				RunID:          run.ID,
				Severity:       SeverityLow,
				Category:       CategoryConfig,
				Title:          "Pipeline run from temporary branch",
				Description:    fmt.Sprintf("Pipeline triggered from branch '%s' which appears to be a temporary/debug branch. These branches may contain experimental or insecure code.", run.Branch),
				Remediation:    "Review code on temporary branches before allowing pipeline execution. Consider restricting pipeline triggers to approved branches.",
				Confidence:     0.5,
				Status:         "open",
			})
			break
		}
	}

	return findings
}

func (h *HeuristicAnalyzer) checkRunStatus(conn *integrations.Connection, run *integrations.PipelineRun) []Finding {
	var findings []Finding

	// Failed pipeline that was later retried and succeeded — potential bypass
	if run.Status == integrations.StatusFailed {
		findings = append(findings, Finding{
			ConnectionName: conn.Name,
			RunID:          run.ID,
			Severity:       SeverityInfo,
			Category:       CategoryConfig,
			Title:          "Failed pipeline run detected",
			Description:    "This pipeline run failed. Investigate whether the failure is related to security checks (SAST, dependency scanning, etc.) that were bypassed on a subsequent run.",
			Remediation:    "Review failure logs to determine if security steps caused the failure. Ensure security step failures block deployment.",
			Confidence:     0.7,
			Status:         "open",
		})
	}

	// Cancelled pipeline — could indicate someone aborting a security scan
	if run.Status == integrations.StatusCancelled {
		findings = append(findings, Finding{
			ConnectionName: conn.Name,
			RunID:          run.ID,
			Severity:       SeverityLow,
			Category:       CategoryConfig,
			Title:          "Pipeline run was cancelled",
			Description:    "This pipeline run was manually cancelled. Cancelled runs may indicate an attempt to skip security checks or hide failing security scans.",
			Remediation:    "Audit cancelled runs to ensure security checks were not intentionally bypassed. Consider alerting on cancelled security-critical pipelines.",
			Confidence:     0.4,
			Status:         "open",
		})
	}

	return findings
}

func (h *HeuristicAnalyzer) checkStepSecurity(conn *integrations.Connection, run *integrations.PipelineRun) []Finding {
	var findings []Finding

	if len(run.Steps) == 0 {
		findings = append(findings, Finding{
			ConnectionName: conn.Name,
			RunID:          run.ID,
			Severity:       SeverityMedium,
			Category:       CategoryConfig,
			Title:          "No pipeline steps available for inspection",
			Description:    "Pipeline run has no visible steps. This could indicate insufficient API permissions, a misconfigured pipeline, or a pipeline that runs a single monolithic step without granularity.",
			Remediation:    "Ensure the API token has permissions to view pipeline jobs/steps. Break monolithic pipelines into discrete steps for better visibility and security.",
			Confidence:     0.5,
			Status:         "open",
		})
		return findings
	}

	securityStepNames := []string{"scan", "sast", "dast", "security", "snyk", "trivy", "semgrep", "codeql", "sonar", "lint", "audit", "vulnerability", "dependabot", "checkmarx", "veracode", "fortify"}

	hasSecurityStep := false
	for _, step := range run.Steps {
		stepLower := strings.ToLower(step.Name)
		for _, keyword := range securityStepNames {
			if strings.Contains(stepLower, keyword) {
				hasSecurityStep = true
				// Check if security step failed
				if step.Status == integrations.StatusFailed {
					findings = append(findings, Finding{
						ConnectionName: conn.Name,
						RunID:          run.ID,
						Severity:       SeverityHigh,
						Category:       CategoryConfig,
						Title:          fmt.Sprintf("Security step '%s' failed", step.Name),
						Description:    fmt.Sprintf("The security-related step '%s' failed during this pipeline run. If the overall pipeline still succeeded, security checks may be non-blocking.", step.Name),
						Remediation:    "Investigate the failure of this security step. Ensure security steps are required (blocking) and cannot be skipped.",
						Confidence:     0.85,
						Status:         "open",
					})
				}
				break
			}
		}

		// Check for extremely fast steps (possibly skipped)
		if step.Duration > 0 && step.Duration < 2*time.Second && step.Status == integrations.StatusSuccess {
			findings = append(findings, Finding{
				ConnectionName: conn.Name,
				RunID:          run.ID,
				Severity:       SeverityLow,
				Category:       CategoryConfig,
				Title:          fmt.Sprintf("Step '%s' completed suspiciously fast (%s)", step.Name, step.Duration),
				Description:    fmt.Sprintf("Step '%s' completed in %s, which may indicate it was skipped, cached without validation, or not performing meaningful work.", step.Name, step.Duration),
				Remediation:    "Verify that this step is actually executing its intended checks and not being short-circuited by caching or conditionals.",
				Confidence:     0.3,
				Status:         "open",
			})
		}
	}

	if !hasSecurityStep && len(run.Steps) > 0 {
		findings = append(findings, Finding{
			ConnectionName: conn.Name,
			RunID:          run.ID,
			Severity:       SeverityHigh,
			Category:       CategoryConfig,
			Title:          "No security scanning steps detected",
			Description:    "This pipeline has no steps that appear to perform security scanning (SAST, DAST, dependency scanning, etc.). Modern CI/CD pipelines should include automated security checks.",
			Remediation:    "Add security scanning steps to your pipeline: SAST (Semgrep, CodeQL), dependency scanning (Trivy, Snyk), and secret scanning. These should run on every pull request.",
			Confidence:     0.7,
			Status:         "open",
		})
	}

	return findings
}
