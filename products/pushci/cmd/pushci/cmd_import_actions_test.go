package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestImportActions_SimpleWorkflow(t *testing.T) {
	dir := t.TempDir()
	wfDir := filepath.Join(dir, ".github", "workflows")
	if err := os.MkdirAll(wfDir, 0o755); err != nil {
		t.Fatal(err)
	}
	wf := `name: ci
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
`
	if err := os.WriteFile(filepath.Join(wfDir, "ci.yml"), []byte(wf), 0o644); err != nil {
		t.Fatal(err)
	}

	chdir(t, dir)
	out := filepath.Join(dir, "pushci.yml")

	if err := cmdImportActions(context.Background(), []string{"--output", out}); err != nil {
		t.Fatalf("cmdImportActions: %v", err)
	}

	got, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(got), "stages:") {
		t.Errorf("output missing 'stages:' section\n%s", got)
	}
	if !strings.Contains(string(got), "npm test") {
		t.Errorf("output missing converted step 'npm test'\n%s", got)
	}
	if !strings.Contains(string(got), "WORKFLOW: ci.yml") {
		t.Errorf("output missing workflow header\n%s", got)
	}
}

func TestImportActions_RefuseOverwriteWithoutForce(t *testing.T) {
	dir := t.TempDir()
	chdir(t, dir)
	wfDir := filepath.Join(dir, ".github", "workflows")
	_ = os.MkdirAll(wfDir, 0o755)
	_ = os.WriteFile(filepath.Join(wfDir, "ci.yml"), []byte("name: x\non: [push]\njobs:\n  t:\n    steps:\n      - run: echo\n"), 0o644)

	out := filepath.Join(dir, "pushci.yml")
	_ = os.WriteFile(out, []byte("existing"), 0o644)

	err := cmdImportActions(context.Background(), []string{"--output", out})
	if err == nil || !strings.Contains(err.Error(), "--force") {
		t.Errorf("expected refusal without --force, got: %v", err)
	}

	if err := cmdImportActions(context.Background(), []string{"--output", out, "--force"}); err != nil {
		t.Errorf("expected overwrite with --force, got: %v", err)
	}
}

func TestImportActions_DiscoverEmpty(t *testing.T) {
	dir := t.TempDir()
	chdir(t, dir)
	err := cmdImportActions(context.Background(), []string{"--output", filepath.Join(dir, "out.yml")})
	if err == nil {
		t.Errorf("expected error when no workflows are present, got nil")
	}
	msg := ""
	if err != nil {
		msg = err.Error()
	}
	if !strings.Contains(msg, "no workflows found") && !strings.Contains(msg, "path not found") {
		t.Errorf("expected workflow-discovery error, got: %v", err)
	}
}

// chdir helper lives in cmd_run_dry_test.go and is reused here.
