package actions

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestDetectWorkflows_RejectsEmptyRoot(t *testing.T) {
	if _, err := DetectWorkflows(""); err == nil {
		t.Fatal("expected error for empty repo root")
	}
}

func TestDetectWorkflows_NoWorkflowsDir(t *testing.T) {
	dir := t.TempDir()
	_, err := DetectWorkflows(dir)
	if !errors.Is(err, ErrNoWorkflows) {
		t.Fatalf("expected ErrNoWorkflows, got %v", err)
	}
	if HasWorkflows(dir) {
		t.Error("HasWorkflows should be false when no dir exists")
	}
}

func TestDetectWorkflows_DiscoversYamlAndYml(t *testing.T) {
	dir := t.TempDir()
	wfDir := filepath.Join(dir, ".github", "workflows")
	if err := os.MkdirAll(wfDir, 0o755); err != nil {
		t.Fatal(err)
	}
	files := map[string]string{
		"ci.yml":        "name: CI\non: [push]\njobs: {}\n",
		"deploy.yaml":   "name: Deploy\non: [push]\njobs: {}\n",
		"README.md":     "ignored",
		"nested.txt":    "ignored",
		"UPPERCASE.YML": "name: Upper\non: [push]\njobs: {}\n",
	}
	for name, body := range files {
		if err := os.WriteFile(filepath.Join(wfDir, name), []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	got, err := DetectWorkflows(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 3 {
		t.Fatalf("expected 3 workflows, got %d: %+v", len(got), got)
	}
	// Sorted by RelPath, so deterministic order.
	if got[0].Name != "UPPERCASE" || got[1].Name != "ci" || got[2].Name != "deploy" {
		t.Errorf("unexpected order/names: %+v", got)
	}
	if !HasWorkflows(dir) {
		t.Error("HasWorkflows should be true once a workflow exists")
	}
	for _, w := range got {
		if !filepath.IsAbs(w.Path) {
			t.Errorf("Path should be absolute, got %q", w.Path)
		}
		if w.RelPath == "" {
			t.Errorf("RelPath should not be empty")
		}
	}
}

func TestDetectWorkflows_IgnoresSubdirectories(t *testing.T) {
	dir := t.TempDir()
	wfDir := filepath.Join(dir, ".github", "workflows", "nested")
	if err := os.MkdirAll(wfDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(wfDir, "deep.yml"), []byte("nested"), 0o644); err != nil {
		t.Fatal(err)
	}
	// Top level dir exists but is empty (only contains the nested dir).
	_, err := DetectWorkflows(dir)
	if !errors.Is(err, ErrNoWorkflows) {
		t.Fatalf("expected ErrNoWorkflows since detection is non-recursive, got %v", err)
	}
}

func TestStripWorkflowExt(t *testing.T) {
	cases := map[string]string{
		"ci.yml":        "ci",
		"deploy.yaml":   "deploy",
		"UPPERCASE.YML": "UPPERCASE",
		"Mixed.Yaml":    "Mixed",
		"no-extension":  "no-extension",
		"weird.txt":     "weird.txt",
		"":              "",
	}
	for in, want := range cases {
		if got := stripWorkflowExt(in); got != want {
			t.Errorf("stripWorkflowExt(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestDetectWorkflows_PathPointsToFileNotDir(t *testing.T) {
	dir := t.TempDir()
	wfDir := filepath.Join(dir, ".github", "workflows")
	if err := os.MkdirAll(filepath.Dir(wfDir), 0o755); err != nil {
		t.Fatal(err)
	}
	// Create a regular file where the workflows directory should be.
	if err := os.WriteFile(wfDir, []byte("not a dir"), 0o644); err != nil {
		t.Fatal(err)
	}
	_, err := DetectWorkflows(dir)
	if !errors.Is(err, ErrNoWorkflows) {
		t.Errorf("expected ErrNoWorkflows when workflows path is a file, got %v", err)
	}
}

func TestIsWorkflowFile(t *testing.T) {
	cases := map[string]bool{
		"ci.yml":     true,
		"ci.yaml":    true,
		"CI.YML":     true,
		"README.md":  false,
		"workflow":   false,
		"x.yamlbak":  false,
		".gitignore": false,
	}
	for name, want := range cases {
		if got := isWorkflowFile(name); got != want {
			t.Errorf("isWorkflowFile(%q) = %v, want %v", name, got, want)
		}
	}
}
