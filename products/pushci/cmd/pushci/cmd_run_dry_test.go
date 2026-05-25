package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Regression tests for the teddk dogfood bug: `pushci run --dry-run`
// silently executed real commands because --dry-run was undeclared
// and unknown flags fell through to a live pipeline execution. All
// three failure modes below were observable in teddk's Maven/pytest/
// terraform runs.

// goodPipeline writes a valid pushci.yml in a temp dir and returns
// the path so the test can chdir into it.
func goodPipeline(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	yml := "stages:\n  - name: install\n    checks:\n      - run: npm ci\n  - name: test\n    checks:\n      - run: npm test\n"
	if err := os.WriteFile(filepath.Join(dir, "pushci.yml"), []byte(yml), 0o644); err != nil {
		t.Fatal(err)
	}
	return dir
}

// chdir helper — restores the original cwd via t.Cleanup.
func chdir(t *testing.T, dir string) {
	t.Helper()
	cwd, _ := os.Getwd()
	t.Cleanup(func() { _ = os.Chdir(cwd) })
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
}

func TestCmdRun_DryRunDoesNotExecute(t *testing.T) {
	chdir(t, goodPipeline(t))
	// Canary: if the runner actually executes commands, this file
	// gets created. Dry-run must leave it untouched.
	canary := filepath.Join(".", "canary")
	yml := "stages:\n  - name: bad\n    checks:\n      - run: touch " + canary + "\n"
	if err := os.WriteFile("pushci.yml", []byte(yml), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := cmdRun(context.Background(), []string{"--dry-run"}); err != nil {
		t.Fatalf("dry-run should succeed, got: %v", err)
	}
	if _, err := os.Stat(canary); err == nil {
		t.Fatal("canary file exists — dry-run executed commands (teddk bug not fixed)")
	}
}

func TestCmdRun_UnknownFlagRejectedWithSuggestion(t *testing.T) {
	chdir(t, goodPipeline(t))
	err := cmdRun(context.Background(), []string{"--drr-run"})
	if err == nil {
		t.Fatal("expected error for --drr-run typo")
	}
	msg := err.Error()
	if !strings.Contains(msg, "unknown flag") || !strings.Contains(msg, "--drr-run") {
		t.Errorf("error should mention unknown flag and the token, got: %q", msg)
	}
	if !strings.Contains(msg, "--dry-run") {
		t.Errorf("error should suggest --dry-run, got: %q", msg)
	}
}

func TestCmdRun_UnknownFlagAlongsideKnownStillRejects(t *testing.T) {
	chdir(t, goodPipeline(t))
	err := cmdRun(context.Background(), []string{"--dry-run", "--bogus"})
	if err == nil {
		t.Fatal("expected mixed known+unknown flag to be rejected")
	}
	if !strings.Contains(err.Error(), "--bogus") {
		t.Errorf("error should mention --bogus, got: %q", err.Error())
	}
}

func TestCmdRun_DryRunPrintsPlan(t *testing.T) {
	chdir(t, goodPipeline(t))
	// Just verify no error + no panic; stdout capture is out of
	// scope for a unit test. The canary test above is the real
	// functional assertion that nothing ran.
	if err := cmdRun(context.Background(), []string{"--dry-run"}); err != nil {
		t.Fatalf("dry-run returned error: %v", err)
	}
}
