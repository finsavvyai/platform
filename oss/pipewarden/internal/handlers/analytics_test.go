package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

func newAnalyticsHandler(t *testing.T) (*Handlers, *storage.DB) {
	t.Helper()
	db, err := storage.NewInMemory()
	if err != nil {
		t.Fatalf("db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	logger, _ := logging.New(&logging.Config{Level: "error"})
	return New(db, integrations.NewManager(logger), nil, nil, logger, nil), db
}

func seedFindings(t *testing.T, db *storage.DB) {
	t.Helper()
	for _, f := range []*storage.FindingRecord{
		{ConnectionName: "gh-main", RunID: "1", Severity: "critical", Category: "supply-chain", Title: "Pin actions", Status: "open"},
		{ConnectionName: "gh-main", RunID: "1", Severity: "high", Category: "secret-exposure", Title: "Exposed token", Status: "open"},
		{ConnectionName: "gl-prod", RunID: "2", Severity: "medium", Category: "supply-chain", Title: "Curl pipe", Status: "resolved"},
	} {
		if err := db.CreateFinding(f); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
}

func TestGetTrends(t *testing.T) {
	h, db := newAnalyticsHandler(t)
	seedFindings(t, db)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/trends?days=30", nil)
	w := httptest.NewRecorder()
	h.GetTrends(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp TrendResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Days != 30 {
		t.Errorf("expected days=30, got %d", resp.Days)
	}
}

func TestGetSummary(t *testing.T) {
	h, db := newAnalyticsHandler(t)
	seedFindings(t, db)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/summary", nil)
	w := httptest.NewRecorder()
	h.GetSummary(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp storage.SummaryResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.TotalFindings != 3 {
		t.Errorf("expected 3 total, got %d", resp.TotalFindings)
	}
	if resp.OpenFindings != 2 {
		t.Errorf("expected 2 open, got %d", resp.OpenFindings)
	}
	if resp.TrendDirection == "" {
		t.Error("expected trend_direction to be set")
	}
}

func TestGetTopFindings(t *testing.T) {
	h, db := newAnalyticsHandler(t)
	seedFindings(t, db)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/top-findings?limit=5", nil)
	w := httptest.NewRecorder()
	h.GetTopFindings(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	cats, ok := resp["categories"].([]interface{})
	if !ok {
		t.Fatal("expected categories array")
	}
	if len(cats) == 0 {
		t.Error("expected at least one category")
	}
}
