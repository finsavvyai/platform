package analysis

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/integrations"
)

// HeuristicAnalyzer performs quick, rule-based security checks without requiring
// an external AI service. It catches common pipeline security anti-patterns.
type HeuristicAnalyzer struct{}

// NewHeuristicAnalyzer creates a new heuristic analyzer.
func NewHeuristicAnalyzer() *HeuristicAnalyzer {
	return &HeuristicAnalyzer{}
}

// AnalyzeRun performs heuristic security analysis on a pipeline run.
func (h *HeuristicAnalyzer) AnalyzeRun(conn *integrations.Connection, run *integrations.PipelineRun) *AnalysisResult {
	start := time.Now()

	var findings []Finding
	riskScore := 0

	// Run all heuristic checks
	findings = append(findings, h.checkBranchSecurity(conn, run)...)
	findings = append(findings, h.checkRunStatus(conn, run)...)
	findings = append(findings, h.checkStepSecurity(conn, run)...)
	findings = append(findings, h.checkTimingAnomalies(conn, run)...)
	findings = append(findings, h.checkMissingChecks(conn, run)...)

	// Run license compliance checks against synthesised step content
	content := h.buildStepContent(run)
	lc := NewLicenseChecker()
	for _, f := range lc.CheckLicenses(content) {
		f.ConnectionName = conn.Name
		f.RunID = run.ID
		findings = append(findings, f)
	}

	// Run pipeline content checks against synthesised step content
	for _, f := range CheckCurlPipeSh(content) {
		f.ConnectionName = conn.Name
		f.RunID = run.ID
		findings = append(findings, f)
	}
	for _, f := range CheckHardcodedIPs(content) {
		f.ConnectionName = conn.Name
		f.RunID = run.ID
		findings = append(findings, f)
	}
	for _, f := range CheckPrivilegedContainer(content) {
		f.ConnectionName = conn.Name
		f.RunID = run.ID
		findings = append(findings, f)
	}
	for _, f := range CheckOutdatedBaseImages(content) {
		f.ConnectionName = conn.Name
		f.RunID = run.ID
		findings = append(findings, f)
	}
	for _, f := range CheckEnvVarSecrets(content) {
		f.ConnectionName = conn.Name
		f.RunID = run.ID
		findings = append(findings, f)
	}

	// Egress monitoring (opt-in via PIPEWARDEN_EGRESS_BASELINE).
	// Off by default to avoid flooding existing users' findings with noise
	// before they've configured an allowlist. Set the env var to a comma-
	// separated list of hosts (wildcards supported) to enable.
	findings = append(findings, runEgressCheck(conn.Name, run.ID, content)...)

	// OSV dependency scan (opt-out via PIPEWARDEN_OSV_SCAN=0). Uses the
	// shared internal/osv client so SCA results share the same code path as
	// POST /api/v1/sca/scan.
	if os.Getenv("PIPEWARDEN_OSV_SCAN") != "0" {
		osvScanner := NewOSVDependencyScanner()
		findings = append(findings, osvScanner.ScanContent(
			context.Background(),
			content,
			conn.Name,
			run.ID,
		)...)
	}

	// Calculate risk score from findings
	for _, f := range findings {
		switch f.Severity {
		case SeverityCritical:
			riskScore += 25
		case SeverityHigh:
			riskScore += 15
		case SeverityMedium:
			riskScore += 8
		case SeverityLow:
			riskScore += 3
		case SeverityInfo:
			riskScore += 1
		}
	}
	if riskScore > 100 {
		riskScore = 100
	}

	summary := h.buildSummary(findings, riskScore)

	return &AnalysisResult{
		ConnectionName: conn.Name,
		RunID:          run.ID,
		Findings:       findings,
		Summary:        summary,
		RiskScore:      riskScore,
		TokensUsed:     0,
		Model:          "heuristic-v1",
		AnalyzedAt:     time.Now().UTC(),
		DurationMS:     time.Since(start).Milliseconds(),
	}
}

func (h *HeuristicAnalyzer) buildSummary(findings []Finding, riskScore int) string {
	if len(findings) == 0 {
		return "No security issues detected by heuristic analysis. Consider running a full AI-powered analysis for deeper inspection."
	}

	critical := 0
	high := 0
	for _, f := range findings {
		switch f.Severity {
		case SeverityCritical:
			critical++
		case SeverityHigh:
			high++
		}
	}

	parts := []string{fmt.Sprintf("Heuristic analysis found %d issue(s)", len(findings))}
	if critical > 0 {
		parts = append(parts, fmt.Sprintf("%d critical", critical))
	}
	if high > 0 {
		parts = append(parts, fmt.Sprintf("%d high severity", high))
	}
	parts = append(parts, fmt.Sprintf("Risk score: %d/100", riskScore))

	return strings.Join(parts, ". ") + "."
}

// Analyze runs all pipeline content checks against raw YAML/config text.
// Use this when you have the raw pipeline file content available.
func (h *HeuristicAnalyzer) Analyze(content string) []Finding {
	var findings []Finding
	findings = append(findings, CheckCurlPipeSh(content)...)
	findings = append(findings, CheckHardcodedIPs(content)...)
	findings = append(findings, CheckPrivilegedContainer(content)...)
	findings = append(findings, CheckOutdatedBaseImages(content)...)
	findings = append(findings, CheckEnvVarSecrets(content)...)
	return findings
}

// buildStepContent synthesises a scannable text representation from run step data.
func (h *HeuristicAnalyzer) buildStepContent(run *integrations.PipelineRun) string {
	var sb strings.Builder
	for _, step := range run.Steps {
		sb.WriteString(step.Name)
		sb.WriteString("\n")
	}
	return sb.String()
}

// formatDuration formats a duration for human-readable display.
func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%.0fs", d.Seconds())
	}
	if d < time.Hour {
		return fmt.Sprintf("%.0fm", d.Minutes())
	}
	return fmt.Sprintf("%.1fh", d.Hours())
}
