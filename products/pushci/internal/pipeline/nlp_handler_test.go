package pipeline

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/finsavvyai/pushci/internal/ai"
)

func TestNLPGenerateNoKey(t *testing.T) {
	client := ai.NewClient() // no API key
	_, err := NLPGenerate(context.Background(), client, "deploy on push", t.TempDir())
	if err == nil {
		t.Error("expected error without API key")
	}
}

func TestApplyNLPConfig(t *testing.T) {
	dir := t.TempDir()
	yaml := "on: [push]\nchecks:\n  - build\n"
	if err := ApplyNLPConfig(dir, yaml); err != nil {
		t.Fatalf("apply error: %v", err)
	}
	data, err := os.ReadFile(filepath.Join(dir, "pushci.yml"))
	if err != nil {
		t.Fatalf("read error: %v", err)
	}
	if string(data) != yaml {
		t.Errorf("got %q, want %q", data, yaml)
	}
}
