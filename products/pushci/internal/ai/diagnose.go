package ai

import (
	"context"
	"fmt"
	"strings"

	"github.com/finsavvyai/pushci/internal/runner"
)

// Diagnosis holds the AI analysis of a CI failure.
type Diagnosis struct {
	Check       string `json:"check"`
	Explanation string `json:"explanation"`
	Suggestion  string `json:"suggestion"`
	Confidence  string `json:"confidence"`
}

// DiagnoseRun sends failed check outputs to Claude for analysis.
func DiagnoseRun(ctx context.Context, client *Client, run *runner.Run) []Diagnosis {
	var diagnoses []Diagnosis
	for _, r := range run.Results {
		if r.Passed {
			continue
		}
		d := diagnoseCheck(ctx, client, r)
		if d != nil {
			diagnoses = append(diagnoses, *d)
		}
	}
	return diagnoses
}

func diagnoseCheck(ctx context.Context, client *Client, r runner.Result) *Diagnosis {
	prompt := buildPrompt(r)

	if !client.IsConfigured() {
		// Fallback to local pattern matching
		return localDiagnose(r)
	}

	text, err := client.Ask(ctx, prompt)
	if err != nil {
		return localDiagnose(r)
	}

	return &Diagnosis{
		Check:       r.Check,
		Explanation: text,
		Suggestion:  extractSuggestion(text),
		Confidence:  "ai",
	}
}

func buildPrompt(r runner.Result) string {
	return fmt.Sprintf(`You are a CI/CD expert. A check failed.
Diagnose the error in 2-3 sentences. Then suggest a specific fix.

Check: %s
Duration: %s
Output (last 1500 chars):
%s

Reply in this format:
DIAGNOSIS: <explanation>
FIX: <specific command or code change>`,
		r.Check, r.Duration, truncateOutput(r.Output))
}

func truncateOutput(s string) string {
	if len(s) > 1500 {
		return s[len(s)-1500:]
	}
	return s
}

func extractSuggestion(text string) string {
	for _, line := range strings.Split(text, "\n") {
		if strings.HasPrefix(line, "FIX:") {
			return strings.TrimPrefix(line, "FIX: ")
		}
	}
	return ""
}
