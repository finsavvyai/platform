package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Regression tests for v1.4.3 dispatch bug: `pushci run` silently
// ignored pushci.yml and fell through to auto-detect whenever the
// file failed to parse OR used the flat top-level `checks:` form.
// See cmd_run.go:45.

func TestCmdRun_ParseErrorSurfaces(t *testing.T) {
	dir := t.TempDir()
	badYaml := "stages: [this is: not: valid yaml\n  - broken"
	if err := os.WriteFile(filepath.Join(dir, "pushci.yml"), []byte(badYaml), 0o644); err != nil {
		t.Fatal(err)
	}

	cwd, _ := os.Getwd()
	t.Cleanup(func() { _ = os.Chdir(cwd) })
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}

	err := cmdRun(context.Background(), nil)
	if err == nil {
		t.Fatal("expected parse error to surface, got nil — the v1.4.3 bug was silently falling through to auto-detect")
	}
	if !strings.Contains(err.Error(), "pushci.yml") {
		t.Errorf("error should mention pushci.yml, got: %v", err)
	}
}

func TestCmdRun_EmptyPipelineRefusesToFallThrough(t *testing.T) {
	dir := t.TempDir()
	empty := "on: [push]\n"
	if err := os.WriteFile(filepath.Join(dir, "pushci.yml"), []byte(empty), 0o644); err != nil {
		t.Fatal(err)
	}

	cwd, _ := os.Getwd()
	t.Cleanup(func() { _ = os.Chdir(cwd) })
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}

	err := cmdRun(context.Background(), nil)
	if err == nil {
		t.Fatal("expected empty pipe to error, got nil — silent fall-through was the v1.4.3 regression")
	}
	if !strings.Contains(err.Error(), "nothing to run") {
		t.Errorf("error should explain emptiness, got: %v", err)
	}
}
