package aianalysis

import (
	"fmt"
	"time"

	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/security"
)

// detectInjection scans CI-controlled fields for prompt-injection signatures.
// Returns (hit, fieldName, sample) where sample is the offending value
// truncated for safe logging.
func detectInjection(conn *integrations.Connection, run *integrations.PipelineRun) (bool, string, string) {
	candidates := []struct {
		name  string
		value string
	}{
		{"connection.name", conn.Name},
		{"run.branch", run.Branch},
		{"run.commit_sha", run.CommitSHA},
		{"run.url", run.URL},
		{"run.id", run.ID},
	}
	for _, c := range candidates {
		if security.HasInjectionSignature(c.value) {
			return true, c.name, truncateSample(c.value)
		}
	}
	for i, step := range run.Steps {
		if security.HasInjectionSignature(step.Name) {
			return true, fmt.Sprintf("run.steps[%d].name", i), truncateSample(step.Name)
		}
		if security.HasInjectionSignature(step.LogURL) {
			return true, fmt.Sprintf("run.steps[%d].log_url", i), truncateSample(step.LogURL)
		}
	}
	return false, "", ""
}

func truncateSample(s string) string {
	const max = 120
	if len(s) <= max {
		return s
	}
	return s[:max] + "…"
}

// mythosBlockedResult builds the synthetic analysis.AnalysisResult returned when the
// downgrade gate fires. The shape matches a normal scan so callers (handlers,
// storage, frontend) need no special-case branch.
func mythosBlockedResult(
	conn *integrations.Connection,
	run *integrations.PipelineRun,
	field string,
	sample string,
	start time.Time,
) *analysis.AnalysisResult {
	return &analysis.AnalysisResult{
		ConnectionName: conn.Name,
		RunID:          run.ID,
		Findings: []analysis.Finding{
			{
				ConnectionName: conn.Name,
				RunID:          run.ID,
				Severity:       analysis.SeverityHigh,
				Category:       analysis.CategoryConfig,
				Title:          "Prompt-injection signature in CI input — LLM analysis skipped",
				Description: fmt.Sprintf(
					"PipeWarden's mythos gate detected an instruction-injection pattern in %s "+
						"(sample: %q). The outbound Claude API call was suppressed to prevent "+
						"the lethal-trifecta exit (private data + untrusted content + outbound). "+
						"Heuristic and DLP scans still ran upstream.",
					field, sample,
				),
				Remediation: "Inspect the offending field and the system that produced it. " +
					"If legitimate, sanitize at the source. If hostile, treat the connected " +
					"repository or webhook source as compromised.",
				Confidence: 0.99,
				Status:     "open",
			},
		},
		Summary:    "Mythos gate fired: untrusted CI input contained an injection signature; LLM call skipped.",
		RiskScore:  60,
		TokensUsed: 0,
		Model:      "mythos-gate",
		AnalyzedAt: time.Now().UTC(),
		DurationMS: time.Since(start).Milliseconds(),
	}
}
