package intel

import (
	"testing"
)

func TestHistoryRecordAndMatch(t *testing.T) {
	h := NewHistory(t.TempDir())
	h.Record(FailureRecord{Check: "build", Pattern: "go-missing-dep", Fix: "go mod tidy"})
	h.Record(FailureRecord{Check: "test", Pattern: "test-fail", Fix: "fix test"})
	h.Record(FailureRecord{Check: "build", Pattern: "go-missing-dep", Fix: "go mod tidy v2"})

	matches := h.MatchPattern("go-missing-dep")
	if len(matches) != 2 {
		t.Errorf("matches = %d, want 2", len(matches))
	}
}

func TestHistoryFrequentFailures(t *testing.T) {
	h := NewHistory(t.TempDir())
	h.Record(FailureRecord{Pattern: "dep"})
	h.Record(FailureRecord{Pattern: "dep"})
	h.Record(FailureRecord{Pattern: "test"})

	freq := h.FrequentFailures(5)
	if freq["dep"] != 2 {
		t.Errorf("dep count = %d, want 2", freq["dep"])
	}
}

func TestHistoryLastFixFor(t *testing.T) {
	h := NewHistory(t.TempDir())
	h.Record(FailureRecord{Pattern: "dep", Fix: "npm install"})
	h.Record(FailureRecord{Pattern: "dep", Fix: "npm ci"})

	fix := h.LastFixFor("dep")
	if fix != "npm ci" {
		t.Errorf("last fix = %q, want %q", fix, "npm ci")
	}
}

func TestHistorySaveLoad(t *testing.T) {
	dir := t.TempDir()
	h := NewHistory(dir)
	h.Record(FailureRecord{Pattern: "test", Fix: "fix it"})
	if err := h.Save(); err != nil {
		t.Fatalf("save: %v", err)
	}

	h2 := NewHistory(dir)
	h2.Load()
	if len(h2.Records) != 1 {
		t.Errorf("records = %d, want 1", len(h2.Records))
	}
}

func TestHistoryCapAt500(t *testing.T) {
	h := NewHistory(t.TempDir())
	for i := 0; i < 510; i++ {
		h.Record(FailureRecord{Pattern: "x"})
	}
	if len(h.Records) != 500 {
		t.Errorf("records = %d, want 500", len(h.Records))
	}
}
