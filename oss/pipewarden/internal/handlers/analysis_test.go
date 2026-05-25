package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/aianalysis"
	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

func TestRunAnalysis_ClaudeNotConfigured(t *testing.T) {
	h := newAnalysisTestHandlers(t)

	req := analysis.AnalysisRequest{
		ConnectionName: "test-conn",
		Owner:          "owner",
		Repo:           "repo",
		RunID:          "run-123",
	}

	body, _ := json.Marshal(req)
	httpReq := httptest.NewRequest("POST", "/api/v1/analysis/run", bytes.NewReader(body))
	w := httptest.NewRecorder()

	h.RunAnalysis(w, httpReq)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503 (Claude not configured), got %d", w.Code)
	}
}

func TestRunAnalysis_InvalidJSON(t *testing.T) {
	h := newAnalysisTestHandlers(t)

	httpReq := httptest.NewRequest("POST", "/api/v1/analysis/run", bytes.NewReader([]byte("invalid")))
	w := httptest.NewRecorder()

	h.RunAnalysis(w, httpReq)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestRunAnalysis_MissingFields(t *testing.T) {
	h := newAnalysisTestHandlers(t)

	req := analysis.AnalysisRequest{ConnectionName: "test"}
	body, _ := json.Marshal(req)
	httpReq := httptest.NewRequest("POST", "/api/v1/analysis/run", bytes.NewReader(body))
	w := httptest.NewRecorder()

	h.RunAnalysis(w, httpReq)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestQuickAnalysis_InvalidJSON(t *testing.T) {
	h := newAnalysisTestHandlers(t)

	httpReq := httptest.NewRequest("POST", "/api/v1/analysis/quick", bytes.NewReader([]byte("{bad")))
	w := httptest.NewRecorder()

	h.QuickAnalysis(w, httpReq)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestQuickAnalysis_MissingFields(t *testing.T) {
	h := newAnalysisTestHandlers(t)

	req := analysis.AnalysisRequest{ConnectionName: "test"}
	body, _ := json.Marshal(req)
	httpReq := httptest.NewRequest("POST", "/api/v1/analysis/quick", bytes.NewReader(body))
	w := httptest.NewRecorder()

	h.QuickAnalysis(w, httpReq)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestListHistory_Success(t *testing.T) {
	h := newAnalysisTestHandlers(t)

	httpReq := httptest.NewRequest("GET", "/api/v1/analysis/history?connection=test", nil)
	w := httptest.NewRecorder()

	h.ListHistory(w, httpReq)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	_ = json.NewDecoder(w.Body).Decode(&resp)
	if _, exists := resp["history"]; !exists {
		t.Error("expected history in response")
	}
}

func TestGetStats_Success(t *testing.T) {
	h := newAnalysisTestHandlers(t)

	httpReq := httptest.NewRequest("GET", "/api/v1/analysis/stats", nil)
	w := httptest.NewRecorder()

	h.GetStats(w, httpReq)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// newAnalysisTestHandlers creates a Handlers instance for testing analysis endpoints.
func newAnalysisTestHandlers(t *testing.T) *Handlers {
	t.Helper()

	db, err := storage.New(":memory:")
	if err != nil {
		t.Fatalf("failed to create test DB: %v", err)
	}

	logger := logging.NewDefault()

	claudeAnalyzer := aianalysis.NewClaudeAnalyzer(aianalysis.ClaudeConfig{}, logger)
	heuristicAnalyzer := analysis.NewHeuristicAnalyzer()

	return &Handlers{
		db:                db,
		claudeAnalyzer:    claudeAnalyzer,
		heuristicAnalyzer: heuristicAnalyzer,
		logger:            logger,
	}
}
