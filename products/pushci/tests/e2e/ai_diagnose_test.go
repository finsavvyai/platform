package e2e

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/finsavvyai/pushci/internal/ai"
	"github.com/finsavvyai/pushci/internal/runner"
)

// makeRun constructs a runner.Run with a single failing result.
func makeRun(checkName, output string) *runner.Run {
	return &runner.Run{
		Results: []runner.Result{
			{
				Check:    checkName,
				Passed:   false,
				Output:   output,
				Duration: time.Second,
			},
		},
	}
}

func unconfiguredClient(t *testing.T) *ai.Client {
	t.Helper()
	t.Setenv("GROQ_API_KEY", "")
	t.Setenv("ANTHROPIC_API_KEY", "")
	t.Setenv("DEEPSEEK_API_KEY", "")
	t.Setenv("OPEN_AI_KEY", "")
	t.Setenv("OPENAI_API_KEY", "")
	t.Setenv("GEMINI_API_KEY", "")
	t.Setenv("PUSHCI_AI_PROVIDER", "")
	return ai.NewClient()
}

func anyAPIKeySet() bool {
	keys := []string{
		"ANTHROPIC_API_KEY", "GROQ_API_KEY",
		"DEEPSEEK_API_KEY", "OPEN_AI_KEY",
		"OPENAI_API_KEY", "GEMINI_API_KEY",
	}
	for _, k := range keys {
		if os.Getenv(k) != "" {
			return true
		}
	}
	return false
}

func TestDiagnose_MissingNodeModule(t *testing.T) {
	client := unconfiguredClient(t)
	run := makeRun("npm test", "Error: Cannot find module 'express'\n    at require")

	ctx := context.Background()
	diagnoses := ai.DiagnoseRun(ctx, client, run)

	if len(diagnoses) == 0 {
		t.Fatal("expected at least one diagnosis for missing Node module")
	}
	d := diagnoses[0]
	if d.Check != "npm test" {
		t.Errorf("expected check name 'npm test', got %q", d.Check)
	}
	suggestion := strings.ToLower(d.Suggestion)
	if !strings.Contains(suggestion, "install") && !strings.Contains(suggestion, "npm") {
		t.Errorf("expected suggestion to mention install/npm, got %q", d.Suggestion)
	}
}

func TestDiagnose_GoMissingModule(t *testing.T) {
	client := unconfiguredClient(t)
	run := makeRun("go test", "go: module not found: no required module provides\n")

	ctx := context.Background()
	diagnoses := ai.DiagnoseRun(ctx, client, run)

	if len(diagnoses) == 0 {
		t.Fatal("expected diagnosis for missing Go module")
	}
	d := diagnoses[0]
	suggestion := strings.ToLower(d.Suggestion)
	if !strings.Contains(suggestion, "mod") && !strings.Contains(suggestion, "tidy") {
		t.Errorf("expected suggestion to mention go mod tidy, got %q", d.Suggestion)
	}
}

func TestDiagnose_PythonMissingModule(t *testing.T) {
	client := unconfiguredClient(t)
	run := makeRun("pytest", "ModuleNotFoundError: No module named 'flask'\n")

	ctx := context.Background()
	diagnoses := ai.DiagnoseRun(ctx, client, run)

	if len(diagnoses) == 0 {
		t.Fatal("expected diagnosis for missing Python module")
	}
	d := diagnoses[0]
	suggestion := strings.ToLower(d.Suggestion)
	if !strings.Contains(suggestion, "pip") && !strings.Contains(suggestion, "install") {
		t.Errorf("expected suggestion to mention pip install, got %q", d.Suggestion)
	}
}

func TestDiagnose_PassingChecksSkipped(t *testing.T) {
	client := unconfiguredClient(t)
	run := &runner.Run{
		Results: []runner.Result{
			{Check: "build", Passed: true, Output: "ok", Duration: time.Second},
			{Check: "test", Passed: true, Output: "PASS", Duration: time.Second},
		},
	}

	ctx := context.Background()
	diagnoses := ai.DiagnoseRun(ctx, client, run)

	if len(diagnoses) != 0 {
		t.Errorf("expected no diagnoses for all-passing run, got %d", len(diagnoses))
	}
}

func TestDiagnose_UnknownPatternReturnsEmpty(t *testing.T) {
	client := unconfiguredClient(t)
	// Output that matches no local pattern
	run := makeRun("custom-check", "some completely unique error zyxwvuts12345")

	ctx := context.Background()
	diagnoses := ai.DiagnoseRun(ctx, client, run)

	// Without a configured client and without a matching pattern, localDiagnose returns nil.
	// DiagnoseRun collects only non-nil results, so length is 0.
	if len(diagnoses) != 0 {
		t.Errorf("expected 0 diagnoses for unknown pattern without API key, got %d", len(diagnoses))
	}
}

func TestDiagnose_MultipleFailures(t *testing.T) {
	client := unconfiguredClient(t)
	run := &runner.Run{
		Results: []runner.Result{
			{Check: "lint", Passed: false, Output: "Cannot find module 'eslint'", Duration: time.Second},
			{Check: "build", Passed: true, Output: "ok", Duration: time.Second},
			{Check: "test", Passed: false, Output: "Cannot find module 'jest'", Duration: time.Second},
		},
	}

	ctx := context.Background()
	diagnoses := ai.DiagnoseRun(ctx, client, run)

	if len(diagnoses) != 2 {
		t.Errorf("expected 2 diagnoses (one per failed check), got %d", len(diagnoses))
	}
}

func TestDiagnose_WithRealAPIKey(t *testing.T) {
	if !anyAPIKeySet() {
		t.Skip("requires a real API key (ANTHROPIC_API_KEY, GROQ_API_KEY, etc.)")
	}

	client := ai.NewClient()
	if !client.IsConfigured() {
		t.Skip("no configured AI provider")
	}

	run := makeRun("go test", "FAIL: TestSomething (1.23s)\npanic: test timed out after 30s")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	diagnoses := ai.DiagnoseRun(ctx, client, run)
	if len(diagnoses) == 0 {
		t.Error("expected at least one diagnosis from AI")
	}
}
