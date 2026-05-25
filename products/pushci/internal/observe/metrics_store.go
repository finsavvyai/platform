package observe

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

type storedRecord struct {
	ID        string        `json:"id"`
	Passed    bool          `json:"passed"`
	Duration  time.Duration `json:"duration_ns"`
	Timestamp time.Time     `json:"timestamp"`
	CostSaved float64       `json:"cost_saved"`
}

func defaultStorePath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".pushci", "runs.json")
}

func loadRecords(path string) []RunRecord {
	if path == "" {
		return nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var stored []storedRecord
	if err := json.Unmarshal(data, &stored); err != nil {
		return nil
	}
	out := make([]RunRecord, 0, len(stored))
	for _, s := range stored {
		out = append(out, RunRecord(s))
	}
	return out
}

func saveRecords(path string, records []RunRecord) {
	if path == "" {
		return
	}
	_ = os.MkdirAll(filepath.Dir(path), 0755)
	stored := make([]storedRecord, 0, len(records))
	for _, r := range records {
		stored = append(stored, storedRecord(r))
	}
	data, err := json.Marshal(stored)
	if err != nil {
		return
	}
	_ = os.WriteFile(path, data, 0644)
}
