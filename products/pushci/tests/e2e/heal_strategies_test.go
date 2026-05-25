package e2e

// heal_strategies_test.go — tests for pattern-based diagnosis and heal strategy selection.
//
// Architecture note: Healer.Heal() finds a Fix via pattern matching, then calls
// ApplyFix() which actually execs the fix command. In E2E tests we can't exec
// arbitrary commands (no package.json in temp dir, etc.), so we test pattern
// recognition through two public surfaces:
//
//  1. ai.DiagnoseRun() — uses the same localDiagnose patterns; no exec.
//  2. Healer.Heal() for strategies that produce write: fixes (file changes)
//     which don't require external tools.

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/finsavvyai/pushci/internal/ai"
	"github.com/finsavvyai/pushci/internal/heal"
	"github.com/finsavvyai/pushci/internal/runner"
)

// failingRun builds a runner.Run with one failing check.
func failingRun(check, output string) *runner.Run {
	return &runner.Run{
		Results: []runner.Result{
			{Check: check, Passed: false, Output: output, Duration: time.Second},
		},
	}
}

// --- Pattern recognition via ai.DiagnoseRun (no exec, no API key) ---

func TestHealPattern_MissingNodeModule_Recognised(t *testing.T) {
	client := unconfiguredClient(t)
	run := failingRun("npm test", "Error: Cannot find module 'express'\n    at Module._resolveFilename")

	ctx := context.Background()
	diagnoses := ai.DiagnoseRun(ctx, client, run)

	if len(diagnoses) == 0 {
		t.Fatal("expected diagnosis for missing Node module")
	}
	d := diagnoses[0]
	if !strings.Contains(strings.ToLower(d.Suggestion), "install") {
		t.Errorf("expected suggestion to mention install, got %q", d.Suggestion)
	}
	if d.Confidence != "pattern" {
		t.Errorf("expected confidence=pattern (no API key), got %q", d.Confidence)
	}
}

func TestHealPattern_GoMissingModule_Recognised(t *testing.T) {
	client := unconfiguredClient(t)
	run := failingRun("go test", "go: module not found: no required module provides github.com/pkg/errors")

	ctx := context.Background()
	diagnoses := ai.DiagnoseRun(ctx, client, run)

	if len(diagnoses) == 0 {
		t.Fatal("expected diagnosis for missing Go module")
	}
	d := diagnoses[0]
	if !strings.Contains(strings.ToLower(d.Suggestion), "tidy") {
		t.Errorf("expected 'tidy' in suggestion, got %q", d.Suggestion)
	}
}

func TestHealPattern_PythonMissingModule_Recognised(t *testing.T) {
	client := unconfiguredClient(t)
	run := failingRun("pytest", "ModuleNotFoundError: No module named 'requests'")

	ctx := context.Background()
	diagnoses := ai.DiagnoseRun(ctx, client, run)

	if len(diagnoses) == 0 {
		t.Fatal("expected diagnosis for missing Python module")
	}
	d := diagnoses[0]
	if !strings.Contains(strings.ToLower(d.Suggestion), "pip") {
		t.Errorf("expected 'pip' in suggestion, got %q", d.Suggestion)
	}
}

func TestHealPattern_PermissionDenied_Recognised(t *testing.T) {
	client := unconfiguredClient(t)
	run := failingRun("deploy", "bash: ./deploy.sh: permission denied")

	ctx := context.Background()
	diagnoses := ai.DiagnoseRun(ctx, client, run)

	if len(diagnoses) == 0 {
		t.Fatal("expected diagnosis for permission denied")
	}
	d := diagnoses[0]
	if !strings.Contains(strings.ToLower(d.Suggestion), "chmod") &&
		!strings.Contains(strings.ToLower(d.Suggestion), "permission") {
		t.Errorf("expected chmod/permission in suggestion, got %q", d.Suggestion)
	}
}

func TestHealPattern_CompilationFailed_Recognised(t *testing.T) {
	client := unconfiguredClient(t)
	run := failingRun("build", "compilation failed: undefined: http.ListenAndServe2")

	ctx := context.Background()
	diagnoses := ai.DiagnoseRun(ctx, client, run)

	if len(diagnoses) == 0 {
		t.Fatal("expected diagnosis for compilation failure")
	}
	d := diagnoses[0]
	if !strings.Contains(strings.ToLower(d.Explanation), "syntax") &&
		!strings.Contains(strings.ToLower(d.Explanation), "compile") &&
		!strings.Contains(strings.ToLower(d.Explanation), "error") {
		t.Errorf("expected compilation-related explanation, got %q", d.Explanation)
	}
}

func TestHealPattern_UnknownError_NoPatternMatch(t *testing.T) {
	client := unconfiguredClient(t)
	run := failingRun("custom", "error: zyxwvuts99999 completely unknown signal")

	ctx := context.Background()
	diagnoses := ai.DiagnoseRun(ctx, client, run)

	// No pattern match + no API key = no diagnosis returned.
	if len(diagnoses) != 0 {
		t.Errorf("expected 0 diagnoses for unknown pattern, got %d: %+v", len(diagnoses), diagnoses)
	}
}

func TestHealPattern_ConfidenceLevel(t *testing.T) {
	// Pattern-matched diagnoses should report confidence="pattern", not "ai".
	client := unconfiguredClient(t)
	run := failingRun("test", "Cannot find module 'lodash'")

	ctx := context.Background()
	diagnoses := ai.DiagnoseRun(ctx, client, run)
	if len(diagnoses) == 0 {
		t.Skip("no diagnosis returned")
	}
	if diagnoses[0].Confidence != "pattern" {
		t.Errorf("expected confidence=pattern for local match, got %q", diagnoses[0].Confidence)
	}
}

// --- Healer.Heal with file-write fix (no external exec needed) ---

func TestHealer_FileSizeViolation_FixSelected(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()

	h := heal.NewHealer(nil)
	run := failingRun("ci-filesize", "cmd/pushci/big_file.go: 247 lines (max 100)")

	result, err := h.Heal(ctx, run, dir)
	if err != nil {
		t.Fatalf("Heal returned error: %v", err)
	}
	// The file-size strategy generates an echo command, which succeeds.
	if !result.Fixed {
		t.Fatal("expected Fixed=true for file-size violation (echo command should succeed)")
	}
	if result.Fixes[0].Pattern != "file-size-violation" {
		t.Errorf("expected pattern=file-size-violation, got %q", result.Fixes[0].Pattern)
	}
	if len(result.Fixes[0].FilesChanged) == 0 {
		t.Error("expected FilesChanged to be populated with the violating file path")
	}
}

// --- Healer with no AI client on passing run ---

func TestHealer_PassingRun_NothingToHeal(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()

	h := heal.NewHealer(nil)
	run := &runner.Run{
		Results: []runner.Result{
			{Check: "build", Passed: true, Output: "ok", Duration: time.Second},
			{Check: "test", Passed: true, Output: "PASS", Duration: time.Second},
		},
	}

	result, err := h.Heal(ctx, run, dir)
	if err != nil {
		t.Fatalf("Heal error: %v", err)
	}
	if result.Fixed {
		t.Error("expected Fixed=false for all-passing run")
	}
	if len(result.Fixes) != 0 {
		t.Errorf("expected no fixes for passing run, got %d", len(result.Fixes))
	}
}

// --- With real AI client ---

func TestHealer_WithAIClient_DoesNotPanic(t *testing.T) {
	if !anyAPIKeySet() {
		t.Skip("no API key available; skipping real AI heal test")
	}
	ctx := context.Background()
	dir := t.TempDir()

	client := ai.NewClient()
	h := heal.NewHealer(client)

	run := failingRun("npm test", "SyntaxError: Unexpected token }")
	result, err := h.Heal(ctx, run, dir)
	if err != nil {
		t.Fatalf("Heal returned unexpected error: %v", err)
	}
	// We just verify it doesn't panic and returns a valid struct.
	_ = result.Fixed
	_ = result.Fixes
}
