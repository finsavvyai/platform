package debug

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/finsavvyai/pushci/internal/runner"
)

func TestCaptureSnapshot(t *testing.T) {
	r := &runner.Run{
		Started: time.Now(),
		Results: []runner.Result{
			{Check: "lint", Passed: true, Output: "ok"},
			{Check: "test", Passed: false, Output: "fail"},
		},
	}
	s := CaptureSnapshot(r, "run-001")

	if s.RunID != "run-001" {
		t.Errorf("RunID = %q, want run-001", s.RunID)
	}
	if len(s.Checks) != 2 {
		t.Fatalf("len(Checks) = %d, want 2", len(s.Checks))
	}
	if s.Checks[0].ExitCode != 0 {
		t.Errorf("Checks[0].ExitCode = %d, want 0", s.Checks[0].ExitCode)
	}
	if s.Checks[1].ExitCode != 1 {
		t.Errorf("Checks[1].ExitCode = %d, want 1", s.Checks[1].ExitCode)
	}
}

func TestSnapshotPersistence(t *testing.T) {
	tmp := t.TempDir()
	s := &Snapshot{
		RunID: "test-persist",
		Checks: []CheckSnapshot{
			{Name: "build", Command: "go", Args: []string{"build"}, ExitCode: 0},
		},
		Env:  map[string]string{"GO111MODULE": "on"},
		Time: time.Now(),
	}

	if err := SaveSnapshot(tmp, s); err != nil {
		t.Fatalf("SaveSnapshot: %v", err)
	}

	path := filepath.Join(tmp, ".pushci", "snapshots", "test-persist.json")
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("snapshot file not found: %v", err)
	}

	loaded, err := LoadSnapshot(tmp, "test-persist")
	if err != nil {
		t.Fatalf("LoadSnapshot: %v", err)
	}
	if loaded.RunID != "test-persist" {
		t.Errorf("loaded RunID = %q, want test-persist", loaded.RunID)
	}
	if len(loaded.Checks) != 1 {
		t.Fatalf("loaded Checks len = %d, want 1", len(loaded.Checks))
	}
	if loaded.Checks[0].Command != "go" {
		t.Errorf("loaded Command = %q, want go", loaded.Checks[0].Command)
	}
}

func TestReplayLocallySkipsEmpty(t *testing.T) {
	s := &Snapshot{
		RunID: "empty-run",
		Checks: []CheckSnapshot{
			{Name: "no-cmd", Command: "", ExitCode: 0},
		},
	}
	// Should not error — skips checks without commands.
	if err := ReplayLocally(s); err != nil {
		t.Errorf("ReplayLocally: %v", err)
	}
}

func TestReplayLocallyExecutes(t *testing.T) {
	s := &Snapshot{
		RunID: "echo-run",
		Checks: []CheckSnapshot{
			{Name: "echo", Command: "echo", Args: []string{"hello"}, Dir: "/tmp"},
		},
	}
	if err := ReplayLocally(s); err != nil {
		t.Errorf("ReplayLocally: %v", err)
	}
}
