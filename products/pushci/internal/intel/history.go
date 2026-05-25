package intel

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"time"
)

// FailureRecord stores a single failure event for pattern matching.
type FailureRecord struct {
	Check     string    `json:"check"`
	Pattern   string    `json:"pattern"`
	Category  string    `json:"category"`
	Output    string    `json:"output"`
	Fix       string    `json:"fix"`
	Timestamp time.Time `json:"timestamp"`
	Resolved  bool      `json:"resolved"`
}

// History tracks historical failure patterns for analysis.
type History struct {
	path    string
	Records []FailureRecord `json:"records"`
}

// NewHistory creates a history store backed by .pushci/history.json.
func NewHistory(root string) *History {
	return &History{
		path:    filepath.Join(root, ".pushci", "history.json"),
		Records: make([]FailureRecord, 0),
	}
}

// Load reads the history file from disk.
func (h *History) Load() {
	data, err := os.ReadFile(h.path)
	if err != nil {
		return
	}
	_ = json.Unmarshal(data, h)
}

// Save writes the history file to disk.
func (h *History) Save() error {
	if err := os.MkdirAll(filepath.Dir(h.path), 0o755); err != nil {
		return err
	}
	data, err := json.Marshal(h)
	if err != nil {
		return err
	}
	return os.WriteFile(h.path, data, 0o644)
}

// Record adds a failure event to history.
func (h *History) Record(rec FailureRecord) {
	rec.Timestamp = time.Now()
	h.Records = append(h.Records, rec)
	if len(h.Records) > 500 {
		h.Records = h.Records[len(h.Records)-500:]
	}
}

// MatchPattern finds historical failures matching the given pattern.
func (h *History) MatchPattern(pattern string) []FailureRecord {
	var matches []FailureRecord
	for _, r := range h.Records {
		if r.Pattern == pattern {
			matches = append(matches, r)
		}
	}
	sort.Slice(matches, func(i, j int) bool {
		return matches[i].Timestamp.After(matches[j].Timestamp)
	})
	if len(matches) > 10 {
		matches = matches[:10]
	}
	return matches
}

// FrequentFailures returns the most common failure patterns.
func (h *History) FrequentFailures(limit int) map[string]int {
	counts := make(map[string]int)
	for _, r := range h.Records {
		counts[r.Pattern]++
	}
	return counts
}

// LastFixFor returns the most recent fix for a given pattern.
func (h *History) LastFixFor(pattern string) string {
	for i := len(h.Records) - 1; i >= 0; i-- {
		if h.Records[i].Pattern == pattern && h.Records[i].Fix != "" {
			return h.Records[i].Fix
		}
	}
	return ""
}
