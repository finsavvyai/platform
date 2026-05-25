package artifacts

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// SizeChange represents a change in artifact size between runs.
type SizeChange struct {
	Name        string
	OldSize     int64
	NewSize     int64
	DiffBytes   int64
	DiffPercent float64
}

// IsBloat returns true if the artifact grew more than 20%.
func (s SizeChange) IsBloat() bool {
	return s.DiffPercent > 20.0
}

// ArtifactRecord stores a single artifact measurement.
type ArtifactRecord struct {
	Name string `json:"name"`
	Size int64  `json:"size"`
}

// Tracker records and compares build artifact sizes.
type Tracker struct {
	StoragePath string
}

// NewTracker creates a tracker with the given storage directory.
func NewTracker(path string) *Tracker {
	return &Tracker{StoragePath: path}
}

// Record saves an artifact record for a given run ID.
func (t *Tracker) Record(runID, name string, size int64) error {
	dir := filepath.Join(t.StoragePath, runID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	records, _ := t.loadRecords(runID)
	records = append(records, ArtifactRecord{Name: name, Size: size})

	return t.saveRecords(runID, records)
}

// Compare computes size changes between two runs.
func (t *Tracker) Compare(current, previous string) []SizeChange {
	cur, _ := t.loadRecords(current)
	prev, _ := t.loadRecords(previous)

	oldMap := make(map[string]int64, len(prev))
	for _, r := range prev {
		oldMap[r.Name] = r.Size
	}

	var changes []SizeChange
	for _, r := range cur {
		old := oldMap[r.Name]
		diff := r.Size - old
		pct := 0.0
		if old > 0 {
			pct = float64(diff) / float64(old) * 100
		}
		changes = append(changes, SizeChange{
			Name: r.Name, OldSize: old, NewSize: r.Size,
			DiffBytes: diff, DiffPercent: pct,
		})
	}
	return changes
}

func (t *Tracker) loadRecords(runID string) ([]ArtifactRecord, error) {
	p := filepath.Join(t.StoragePath, runID, "artifacts.json")
	data, err := os.ReadFile(p)
	if err != nil {
		return nil, err
	}
	var records []ArtifactRecord
	return records, json.Unmarshal(data, &records)
}

func (t *Tracker) saveRecords(runID string, recs []ArtifactRecord) error {
	p := filepath.Join(t.StoragePath, runID, "artifacts.json")
	data, err := json.Marshal(recs)
	if err != nil {
		return err
	}
	return os.WriteFile(p, data, 0644)
}
