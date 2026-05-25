package debug

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/finsavvyai/pushci/internal/runner"
)

// Snapshot stores a complete run state for replay.
type Snapshot struct {
	RunID  string            `json:"run_id"`
	Checks []CheckSnapshot   `json:"checks"`
	Env    map[string]string `json:"env"`
	Time   time.Time         `json:"timestamp"`
}

// CheckSnapshot records a single check result.
type CheckSnapshot struct {
	Name     string   `json:"name"`
	Command  string   `json:"command"`
	Args     []string `json:"args"`
	Dir      string   `json:"dir"`
	Output   string   `json:"output"`
	ExitCode int      `json:"exit_code"`
}

// CaptureSnapshot saves the current run state.
func CaptureSnapshot(r *runner.Run, id string) *Snapshot {
	s := &Snapshot{RunID: id, Env: captureEnv(), Time: r.Started}
	for _, res := range r.Results {
		code := 0
		if !res.Passed {
			code = 1
		}
		s.Checks = append(s.Checks, CheckSnapshot{
			Name: res.Check, Output: res.Output, ExitCode: code,
		})
	}
	return s
}

func captureEnv() map[string]string {
	env := make(map[string]string)
	for _, e := range os.Environ() {
		if k, v, ok := strings.Cut(e, "="); ok {
			env[k] = v
		}
	}
	return env
}

// SaveSnapshot persists a snapshot to disk.
func SaveSnapshot(root string, s *Snapshot) error {
	dir := filepath.Join(root, ".pushci", "snapshots")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	p := filepath.Join(dir, s.RunID+".json")
	return os.WriteFile(p, data, 0o644)
}

// LoadSnapshot reads a snapshot from disk.
func LoadSnapshot(root, runID string) (*Snapshot, error) {
	p := filepath.Join(root, ".pushci", "snapshots", runID+".json")
	data, err := os.ReadFile(p)
	if err != nil {
		return nil, err
	}
	var s Snapshot
	return &s, json.Unmarshal(data, &s)
}
