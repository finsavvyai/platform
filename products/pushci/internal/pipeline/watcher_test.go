package pipeline

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestWatcherCheckOnce(t *testing.T) {
	tests := []struct {
		name    string
		setup   func(dir string)
		changed bool
	}{
		{"no config file", func(_ string) {}, false},
		{"config matches repo", func(d string) {
			os.WriteFile(filepath.Join(d, "pushci.yml"), []byte("on: [push]\nchecks:\n  - name: go\n    run: build\n"), 0o644)
			os.WriteFile(filepath.Join(d, "main.go"), []byte("package main"), 0o644)
		}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			tt.setup(dir)
			w := NewWatcher(dir, time.Second)
			result, err := w.CheckOnce()
			if err != nil && tt.name != "no config file" {
				t.Fatalf("unexpected error: %v", err)
			}
			if result != nil && result.Changed != tt.changed {
				t.Errorf("changed = %v, want %v", result.Changed, tt.changed)
			}
		})
	}
}

func TestWatcherAutoApply(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "pushci.yml"), []byte("on: [push]\nchecks: []\n"), 0o644)
	w := NewWatcher(dir, time.Second)
	result, err := w.AutoApply()
	if err != nil {
		t.Fatalf("auto-apply error: %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
}

func TestWatcherStopDoesNotPanic(t *testing.T) {
	w := NewWatcher(t.TempDir(), time.Millisecond*50)
	w.Watch(nil)
	time.Sleep(time.Millisecond * 100)
	w.Stop()
}
