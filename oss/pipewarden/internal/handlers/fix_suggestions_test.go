package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

func newFixHandler(t *testing.T) (*Handlers, *storage.DB) {
	t.Helper()
	db, err := storage.NewInMemory()
	if err != nil {
		t.Fatalf("db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	logger, _ := logging.New(&logging.Config{Level: "error"})
	return New(db, integrations.NewManager(logger), nil, nil, logger, nil), db
}

func insertFindingWithCategory(t *testing.T, db *storage.DB, category, title string) int64 {
	t.Helper()
	f := &storage.FindingRecord{
		ConnectionName: "gh-main",
		RunID:          "run-1",
		Severity:       "high",
		Category:       category,
		Title:          title,
		Description:    "test",
		Status:         "open",
	}
	if err := db.CreateFinding(f); err != nil {
		t.Fatalf("insert finding: %v", err)
	}
	return f.ID
}

func TestFixSuggestionByCategory(t *testing.T) {
	h, db := newFixHandler(t)
	id := insertFindingWithCategory(t, db, "supply-chain", "Unpinned action ref")

	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/v1/findings/%d/fix", id), nil)
	w := httptest.NewRecorder()
	h.GetFixSuggestion(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp FixSuggestion
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(resp.Steps) != 3 {
		t.Errorf("expected 3 steps, got %d", len(resp.Steps))
	}
	if resp.Category != "supply-chain" {
		t.Errorf("expected supply-chain category, got %s", resp.Category)
	}
}

func TestFixSuggestionAutoFixable(t *testing.T) {
	h, db := newFixHandler(t)
	id := insertFindingWithCategory(t, db, "supply-chain", "action pin required")

	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/v1/findings/%d/fix", id), nil)
	w := httptest.NewRecorder()
	h.GetFixSuggestion(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp FixSuggestion
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !resp.AutoFixable {
		t.Error("expected auto_fixable=true for action pinning finding")
	}
	if resp.PRTemplate == "" {
		t.Error("expected pr_template to be set for auto-fixable finding")
	}
}

func TestFixSuggestionNotFound(t *testing.T) {
	h, _ := newFixHandler(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/findings/999/fix", nil)
	w := httptest.NewRecorder()
	h.GetFixSuggestion(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}
