package handlers

import (
	"testing"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

func newDedupDB(t *testing.T) *storage.DB {
	t.Helper()
	db, err := storage.NewInMemory()
	if err != nil {
		t.Fatalf("db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func TestFindingDeduplication(t *testing.T) {
	db := newDedupDB(t)

	f1 := &storage.FindingRecord{
		ConnectionName: "gh-main",
		RunID:          "run-1",
		Severity:       "high",
		Category:       "supply-chain",
		Title:          "Unpinned action",
		Description:    "Action uses @v3 tag",
		Status:         "open",
	}
	if err := db.CreateFinding(f1); err != nil {
		t.Fatalf("first create: %v", err)
	}
	firstID := f1.ID
	if firstID == 0 {
		t.Fatal("expected non-zero ID for first finding")
	}

	// Create identical finding — should be deduplicated
	f2 := &storage.FindingRecord{
		ConnectionName: "gh-main",
		RunID:          "run-2",
		Severity:       "high",
		Category:       "supply-chain",
		Title:          "Unpinned action",
		Description:    "Duplicate",
		Status:         "open",
	}
	if err := db.CreateFinding(f2); err != nil {
		t.Fatalf("second create: %v", err)
	}
	if f2.ID != firstID {
		t.Errorf("expected dedup to return first ID %d, got %d", firstID, f2.ID)
	}

	// Only 1 finding should be in DB
	findings, err := db.ListFindings("gh-main")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(findings) != 1 {
		t.Errorf("expected 1 finding after dedup, got %d", len(findings))
	}
}

func TestFindingNoDedupDifferentSeverity(t *testing.T) {
	db := newDedupDB(t)

	base := &storage.FindingRecord{
		ConnectionName: "gh-main",
		RunID:          "run-1",
		Severity:       "high",
		Category:       "supply-chain",
		Title:          "Unpinned action",
		Status:         "open",
	}
	if err := db.CreateFinding(base); err != nil {
		t.Fatalf("create base: %v", err)
	}

	different := &storage.FindingRecord{
		ConnectionName: "gh-main",
		RunID:          "run-2",
		Severity:       "critical", // different severity
		Category:       "supply-chain",
		Title:          "Unpinned action",
		Status:         "open",
	}
	if err := db.CreateFinding(different); err != nil {
		t.Fatalf("create different: %v", err)
	}

	findings, _ := db.ListFindings("gh-main")
	if len(findings) != 2 {
		t.Errorf("expected 2 findings for different severity, got %d", len(findings))
	}
}

func TestFindingNoDedupDifferentConnection(t *testing.T) {
	db := newDedupDB(t)

	f1 := &storage.FindingRecord{
		ConnectionName: "gh-main",
		RunID:          "run-1",
		Severity:       "high",
		Category:       "supply-chain",
		Title:          "Unpinned action",
		Status:         "open",
	}
	if err := db.CreateFinding(f1); err != nil {
		t.Fatalf("create f1: %v", err)
	}

	f2 := &storage.FindingRecord{
		ConnectionName: "gl-prod", // different connection
		RunID:          "run-1",
		Severity:       "high",
		Category:       "supply-chain",
		Title:          "Unpinned action",
		Status:         "open",
	}
	if err := db.CreateFinding(f2); err != nil {
		t.Fatalf("create f2: %v", err)
	}

	all, _ := db.ListFindings("")
	if len(all) != 2 {
		t.Errorf("expected 2 findings for different connections, got %d", len(all))
	}
}
