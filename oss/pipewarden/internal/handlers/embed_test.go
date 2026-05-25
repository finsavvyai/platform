package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/storage"
	"github.com/finsavvyai/pipewarden/internal/vault"
)

func newTestHandlers(t *testing.T) *Handlers {
	t.Helper()

	logger, _ := logging.New(&config.LoggingConfig{Level: "info", JSON: true})
	db, _ := storage.NewInMemory(logger)
	manager := integrations.NewManager(logger)
	testVault, err := vault.New("test-master-key")
	if err != nil {
		t.Fatalf("failed to create test vault: %v", err)
	}
	return New(db, manager, nil, nil, logger, testVault)
}

// TestEmbedFindings_Success verifies successful embed findings retrieval.
func TestEmbedFindings_Success(t *testing.T) {
	h := newTestHandlers(t)

	// Insert test findings
	findings := []storage.FindingRecord{
		{
			ID:             1,
			ConnectionName: "test-conn",
			RunID:          "run-123",
			Severity:       "critical",
			Category:       "injection",
			Title:          "SQL Injection",
			Description:    "Potential SQL injection found",
			Status:         "open",
			CreatedAt:      time.Now(),
		},
		{
			ID:             2,
			ConnectionName: "test-conn",
			RunID:          "run-123",
			Severity:       "high",
			Category:       "auth",
			Title:          "Missing Auth Check",
			Description:    "No authentication on endpoint",
			Status:         "open",
			CreatedAt:      time.Now(),
		},
	}

	for _, f := range findings {
		_ = h.db.CreateFinding(&f)
	}

	req := httptest.NewRequest("GET", "/api/v1/embed/findings?connection=test-conn", nil)
	w := httptest.NewRecorder()

	h.EmbedFindings(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp EmbedFindingsResponse
	_ = json.NewDecoder(w.Body).Decode(&resp)

	if resp.Count != 2 {
		t.Errorf("expected 2 findings, got %d", resp.Count)
	}
	if len(resp.Findings) != 2 {
		t.Errorf("expected 2 findings in array, got %d", len(resp.Findings))
	}
}

// TestEmbedFindings_WithFilters applies severity and status filters.
func TestEmbedFindings_WithFilters(t *testing.T) {
	h := newTestHandlers(t)

	findings := []storage.FindingRecord{
		{
			ID:             1,
			ConnectionName: "test-conn",
			RunID:          "run-123",
			Severity:       "critical",
			Category:       "injection",
			Title:          "Critical Issue",
			Status:         "open",
			CreatedAt:      time.Now(),
		},
		{
			ID:             2,
			ConnectionName: "test-conn",
			RunID:          "run-123",
			Severity:       "low",
			Category:       "config",
			Title:          "Low Priority",
			Status:         "open",
			CreatedAt:      time.Now(),
		},
		{
			ID:             3,
			ConnectionName: "test-conn",
			RunID:          "run-123",
			Severity:       "critical",
			Category:       "injection",
			Title:          "Critical Resolved",
			Status:         "resolved",
			CreatedAt:      time.Now(),
		},
	}

	for _, f := range findings {
		_ = h.db.CreateFinding(&f)
	}

	// Filter by critical severity
	req := httptest.NewRequest("GET", "/api/v1/embed/findings?connection=test-conn&severity=critical", nil)
	w := httptest.NewRecorder()

	h.EmbedFindings(w, req)

	var resp EmbedFindingsResponse
	_ = json.NewDecoder(w.Body).Decode(&resp)

	if resp.Count != 2 {
		t.Errorf("expected 2 critical findings, got %d", resp.Count)
	}

	// Filter by status=open
	req = httptest.NewRequest("GET", "/api/v1/embed/findings?connection=test-conn&status=open", nil)
	w = httptest.NewRecorder()

	h.EmbedFindings(w, req)

	_ = json.NewDecoder(w.Body).Decode(&resp)

	if resp.Count != 2 {
		t.Errorf("expected 2 open findings, got %d", resp.Count)
	}
}

// TestEmbedSummary_Success verifies summary calculation.
func TestEmbedSummary_Success(t *testing.T) {
	h := newTestHandlers(t)

	findings := []storage.FindingRecord{
		{ID: 1, ConnectionName: "test-conn", Severity: "critical", Title: "Critical finding A", Status: "open", CreatedAt: time.Now()},
		{ID: 2, ConnectionName: "test-conn", Severity: "critical", Title: "Critical finding B", Status: "open", CreatedAt: time.Now()},
		{ID: 3, ConnectionName: "test-conn", Severity: "high", Title: "High finding A", Status: "open", CreatedAt: time.Now()},
		{ID: 4, ConnectionName: "test-conn", Severity: "high", Title: "High finding B", Status: "open", CreatedAt: time.Now()},
		{ID: 5, ConnectionName: "test-conn", Severity: "high", Title: "High finding C", Status: "open", CreatedAt: time.Now()},
		{ID: 6, ConnectionName: "test-conn", Severity: "medium", Title: "Medium finding A", Status: "open", CreatedAt: time.Now()},
		{ID: 7, ConnectionName: "test-conn", Severity: "low", Title: "Low finding A", Status: "open", CreatedAt: time.Now()},
	}

	for _, f := range findings {
		_ = h.db.CreateFinding(&f)
	}

	req := httptest.NewRequest("GET", "/api/v1/embed/summary?connection=test-conn", nil)
	w := httptest.NewRecorder()

	h.EmbedSummary(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var summary EmbedSummary
	_ = json.NewDecoder(w.Body).Decode(&summary)

	if summary.Total != 7 {
		t.Errorf("expected total 7, got %d", summary.Total)
	}
	if summary.Critical != 2 {
		t.Errorf("expected 2 critical, got %d", summary.Critical)
	}
	if summary.High != 3 {
		t.Errorf("expected 3 high, got %d", summary.High)
	}
	if summary.Medium != 1 {
		t.Errorf("expected 1 medium, got %d", summary.Medium)
	}
	if summary.Low != 1 {
		t.Errorf("expected 1 low, got %d", summary.Low)
	}
	if summary.RiskScore == 0 {
		t.Error("expected non-zero risk score")
	}
}

// TestEmbedSummary_CORSHeaders verifies CORS headers are set.
func TestEmbedSummary_CORSHeaders(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest("GET", "/api/v1/embed/summary", nil)
	w := httptest.NewRecorder()

	h.EmbedSummary(w, req)

	corsOrigin := w.Header().Get("Access-Control-Allow-Origin")
	if corsOrigin != "*" {
		t.Errorf("expected CORS origin *, got %s", corsOrigin)
	}

	corsMethods := w.Header().Get("Access-Control-Allow-Methods")
	if corsMethods == "" {
		t.Error("expected CORS methods header")
	}
}

// TestEmbedConfig_Success verifies config endpoint.
func TestEmbedConfig_Success(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest("GET", "/api/v1/embed/config", nil)
	w := httptest.NewRecorder()

	h.EmbedConfig(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var config map[string]interface{}
	_ = json.NewDecoder(w.Body).Decode(&config)

	if config["embed_url"] == nil {
		t.Error("expected embed_url in config")
	}
	if config["version"] == nil {
		t.Error("expected version in config")
	}
	if config["theme"] == nil {
		t.Error("expected theme in config")
	}

	features, ok := config["features"].(map[string]interface{})
	if !ok {
		t.Error("expected features map in config")
	}
	if features["filtering"] == nil {
		t.Error("expected filtering feature")
	}
}

// TestEmbedFindings_MethodNotAllowed rejects non-GET requests.
func TestEmbedFindings_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest("POST", "/api/v1/embed/findings", nil)
	w := httptest.NewRecorder()

	h.EmbedFindings(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected status 405, got %d", w.Code)
	}
}

// TestEmbedFindings_OptionsRequest handles CORS preflight.
func TestEmbedFindings_OptionsRequest(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest("OPTIONS", "/api/v1/embed/findings", nil)
	w := httptest.NewRecorder()

	h.EmbedFindings(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("expected status 204, got %d", w.Code)
	}
}

// TestEmbedSummary_EmptyFindings handles empty result.
func TestEmbedSummary_EmptyFindings(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest("GET", "/api/v1/embed/summary?connection=nonexistent", nil)
	w := httptest.NewRecorder()

	h.EmbedSummary(w, req)

	var summary EmbedSummary
	_ = json.NewDecoder(w.Body).Decode(&summary)

	if summary.Total != 0 {
		t.Errorf("expected total 0 for empty, got %d", summary.Total)
	}
	if summary.RiskScore != 0 {
		t.Errorf("expected risk score 0 for empty, got %d", summary.RiskScore)
	}
}

// TestCalculateRiskScore verifies risk scoring algorithm.
func TestCalculateRiskScore(t *testing.T) {
	tests := []struct {
		name     string
		summary  EmbedSummary
		minScore int
		maxScore int
	}{
		{
			name:     "no findings",
			summary:  EmbedSummary{Total: 0},
			minScore: 0,
			maxScore: 0,
		},
		{
			name:     "one critical",
			summary:  EmbedSummary{Critical: 1, Total: 1},
			minScore: 90,
			maxScore: 100,
		},
		{
			name:     "mixed findings",
			summary:  EmbedSummary{Critical: 1, High: 2, Medium: 3, Low: 4, Total: 10},
			minScore: 0,
			maxScore: 100,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := calculateRiskScore(tt.summary)
			if score < tt.minScore || score > tt.maxScore {
				t.Errorf("score %d outside range [%d, %d]", score, tt.minScore, tt.maxScore)
			}
		})
	}
}
