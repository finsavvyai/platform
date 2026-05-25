package pipeline

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestApplyWritesValidYAML(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "pushci.yml")
	os.WriteFile(cfgPath, []byte("on: [push]\nchecks:\n  - build\n"), 0644)

	u := NewUpdater()
	changes := []Change{
		{Type: ChangeAdd, Suggestion: "Add go/test checks"},
	}
	if err := u.Apply(dir, changes); err != nil {
		t.Fatalf("Apply: %v", err)
	}
	data, err := os.ReadFile(cfgPath)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	content := string(data)
	// yaml.Marshal quotes "on" as it's a YAML keyword
	if !strings.Contains(content, "\"on\":") && !strings.Contains(content, "on:") {
		t.Error("output missing on key")
	}
	if !strings.Contains(content, "checks:") {
		t.Error("output missing 'checks:' key")
	}
	if !strings.Contains(content, "Add go/test checks") {
		t.Error("output missing new check suggestion")
	}
}

func TestApplyEmptyChangesPreservesConfig(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "pushci.yml")
	original := "on: [push]\nchecks:\n  - build\n"
	os.WriteFile(cfgPath, []byte(original), 0644)

	u := NewUpdater()
	if err := u.Apply(dir, nil); err != nil {
		t.Fatalf("Apply: %v", err)
	}
	data, _ := os.ReadFile(cfgPath)
	if !strings.Contains(string(data), "build") {
		t.Error("empty apply should preserve existing checks")
	}
}

func TestCheckMissingConfigReturnsError(t *testing.T) {
	dir := t.TempDir()
	// No pushci.yml created
	u := NewUpdater()
	_, err := u.Check(dir)
	if err == nil {
		t.Fatal("expected error for missing pushci.yml")
	}
	if !strings.Contains(err.Error(), "load config") {
		t.Errorf("error = %q, want 'load config' prefix", err.Error())
	}
}

func TestApplyCreatesConfigWhenMissing(t *testing.T) {
	dir := t.TempDir()
	// No pushci.yml — Apply should create from default
	u := NewUpdater()
	changes := []Change{
		{Type: ChangeAdd, Suggestion: "Add python checks"},
	}
	if err := u.Apply(dir, changes); err != nil {
		t.Fatalf("Apply: %v", err)
	}
	data, err := os.ReadFile(filepath.Join(dir, "pushci.yml"))
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if !strings.Contains(string(data), "Add python checks") {
		t.Error("new config missing applied change")
	}
}
