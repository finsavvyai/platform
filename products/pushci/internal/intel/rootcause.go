package intel

import (
	"context"
	"fmt"
	"strings"

	"github.com/finsavvyai/pushci/internal/ai"
)

// RootCause holds deep analysis of a failure beyond surface-level logs.
type RootCause struct {
	Summary       string   `json:"summary"`
	Category      string   `json:"category"`
	AffectedFiles []string `json:"affected_files"`
	FixSteps      []string `json:"fix_steps"`
	Confidence    float64  `json:"confidence"`
	AIGenerated   bool     `json:"ai_generated"`
}

const rootCauseSystem = `You are a CI/CD root cause analysis expert.
Analyze the failure deeply—not just what the log says, but WHY.
Respond in this exact format:
CATEGORY: <dependency|config|test|build|runtime|infra>
SUMMARY: <1-2 sentence root cause>
FILES: <comma-separated affected file paths, or "unknown">
FIX: <step 1>
FIX: <step 2>
FIX: <step 3>`

// AnalyzeRootCause performs deep root cause analysis on a failure.
func AnalyzeRootCause(ctx context.Context, client *ai.Client, check, output string) *RootCause {
	// Try local pattern matching first
	if rc := localRootCause(check, output); rc != nil {
		return rc
	}
	if client == nil || !client.IsConfigured() {
		return fallbackRootCause(check, output)
	}
	prompt := fmt.Sprintf("Check: %s\nOutput (last 2000 chars):\n%s",
		check, truncateStr(output, 2000))
	text, err := client.AskWithSystem(ctx, rootCauseSystem, prompt)
	if err != nil {
		return fallbackRootCause(check, output)
	}
	return parseRootCause(text)
}

func localRootCause(check, output string) *RootCause {
	d := DiagnoseError(output)
	if d == nil {
		return nil
	}
	return &RootCause{
		Summary:    d.Explanation,
		Category:   categorize(d.Pattern),
		FixSteps:   []string{d.Suggestion},
		Confidence: d.Confidence,
	}
}

func categorize(pattern string) string {
	switch {
	case strings.Contains(pattern, "module"), strings.Contains(pattern, "import"):
		return "dependency"
	case strings.Contains(pattern, "test"), strings.Contains(pattern, "FAIL"):
		return "test"
	case strings.Contains(pattern, "compile"), strings.Contains(pattern, "compilation"):
		return "build"
	case strings.Contains(pattern, "permission"), strings.Contains(pattern, "port"):
		return "runtime"
	case strings.Contains(pattern, "memory"):
		return "infra"
	default:
		return "config"
	}
}

func fallbackRootCause(check, output string) *RootCause {
	return &RootCause{
		Summary:  fmt.Sprintf("Check '%s' failed — review logs for details", check),
		Category: "unknown",
		FixSteps: []string{"Review the full output logs"},
	}
}

func truncateStr(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[len(s)-max:]
}
