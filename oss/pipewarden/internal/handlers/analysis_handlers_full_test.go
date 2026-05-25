package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/pipewarden/internal/aianalysis"
	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/storage"
	"github.com/finsavvyai/pipewarden/internal/vault"
)

// ---------------------------------------------------------------------------
// mockProvider implements integrations.Provider for test injection.
// ---------------------------------------------------------------------------

type mockProvider struct {
	platform integrations.Platform
	run      *integrations.PipelineRun
	runErr   error
}

func (m *mockProvider) Name() integrations.Platform { return m.platform }

func (m *mockProvider) TestConnection(_ context.Context) (*integrations.ConnectionStatus, error) {
	return &integrations.ConnectionStatus{Connected: true}, nil
}

func (m *mockProvider) ListPipelines(_ context.Context, _, _ string) ([]integrations.Pipeline, error) {
	return nil, nil
}

func (m *mockProvider) GetPipelineRun(_ context.Context, _, _, _ string) (*integrations.PipelineRun, error) {
	return m.run, m.runErr
}

func (m *mockProvider) ListPipelineRuns(_ context.Context, _, _ string, _ int) ([]integrations.PipelineRun, error) {
	return nil, nil
}

func (m *mockProvider) TriggerPipeline(_ context.Context, _, _, _, _ string) (*integrations.PipelineRun, error) {
	return nil, nil
}

// newHandlersWithProvider creates test Handlers with a named mock provider pre-registered.
func newHandlersWithProvider(t *testing.T, connName string, provider *mockProvider) *Handlers {
	t.Helper()
	logger, _ := logging.New(&config.LoggingConfig{Level: "error", JSON: false})
	db, err := storage.NewInMemory(logger)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	v, err := vault.New("test-master-key-for-unit-tests")
	require.NoError(t, err)

	mgr := integrations.NewManager(logger)
	require.NoError(t, mgr.Add(connName, provider))

	h := New(db, mgr, nil, analysis.NewHeuristicAnalyzer(), logger, v)
	return h
}

// minimalPipelineRun returns a non-nil run suitable for heuristic analysis.
func minimalPipelineRun() *integrations.PipelineRun {
	now := time.Now()
	return &integrations.PipelineRun{
		ID:         "run-001",
		PipelineID: "pipeline-001",
		Status:     integrations.StatusSuccess,
		Branch:     "main",
		CommitSHA:  "abc123",
		StartedAt:  now.Add(-5 * time.Minute),
		FinishedAt: now,
		Duration:   5 * time.Minute,
		Steps: []integrations.PipelineStep{
			{Name: "checkout", Status: integrations.StatusSuccess, Duration: 5 * time.Second},
			{Name: "build", Status: integrations.StatusSuccess, Duration: 2 * time.Minute},
		},
	}
}

// ---------------------------------------------------------------------------
// QuickAnalysis — full happy path with mock provider + heuristic analyzer
// ---------------------------------------------------------------------------

func TestQuickAnalysis_HappyPath(t *testing.T) {
	provider := &mockProvider{
		platform: integrations.PlatformGitHub,
		run:      minimalPipelineRun(),
	}
	h := newHandlersWithProvider(t, "test-conn", provider)

	body, _ := json.Marshal(map[string]string{
		"connection_name": "test-conn",
		"owner":           "myorg",
		"repo":            "myrepo",
		"run_id":          "run-001",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/quick", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.QuickAnalysis(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp analysis.AnalysisResult
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "heuristic-v1", resp.Model)
	assert.GreaterOrEqual(t, resp.RiskScore, 0)
}

func TestQuickAnalysis_InvalidJSONBody(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/quick", bytes.NewBufferString("{not-json"))
	w := httptest.NewRecorder()
	h.QuickAnalysis(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestQuickAnalysis_AllMissingRequiredFields(t *testing.T) {
	h := newTestHandlers(t)

	// Body with none of the four required fields.
	body, _ := json.Marshal(map[string]string{"other": "value"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/quick", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.QuickAnalysis(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestQuickAnalysis_ProviderGetRunFails_BadGateway(t *testing.T) {
	provider := &mockProvider{
		platform: integrations.PlatformGitHub,
		runErr:   errors.New("upstream error"),
	}
	h := newHandlersWithProvider(t, "test-conn", provider)

	body, _ := json.Marshal(map[string]string{
		"connection_name": "test-conn",
		"owner":           "org",
		"repo":            "repo",
		"run_id":          "1",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/quick", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.QuickAnalysis(w, req)

	assert.Equal(t, http.StatusBadGateway, w.Code)
}

// ---------------------------------------------------------------------------
// RunAnalysis — with mocked Claude HTTP endpoint
// ---------------------------------------------------------------------------

// claudeAnalysisResponse returns minimal valid JSON that ClaudeAnalyzer expects.
func claudeAnalysisResponse() map[string]interface{} {
	return map[string]interface{}{
		"id":    "msg_test",
		"type":  "message",
		"role":  "assistant",
		"model": "claude-sonnet-4-20250514",
		"content": []map[string]interface{}{
			{
				"type": "text",
				"text": `{"findings":[],"risk_score":0,"summary":"No issues found","recommendations":[]}`,
			},
		},
		"usage": map[string]interface{}{
			"input_tokens":  100,
			"output_tokens": 50,
		},
		"stop_reason": "end_turn",
	}
}

func TestRunAnalysis_NoClaudeAnalyzer_ServiceUnavailable(t *testing.T) {
	h := newTestHandlers(t) // claudeAnalyzer is nil by default

	body, _ := json.Marshal(map[string]string{
		"connection_name": "test-conn",
		"owner":           "org",
		"repo":            "repo",
		"run_id":          "1",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/run", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.RunAnalysis(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
}

func TestRunAnalysis_InvalidJSONBody(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/run", bytes.NewBufferString("{not-valid"))
	w := httptest.NewRecorder()
	h.RunAnalysis(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestRunAnalysis_AllFieldsMissing_BadRequest(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(map[string]string{}) // all four fields absent
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/run", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.RunAnalysis(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestRunAnalysis_ConnectionNotFound(t *testing.T) {
	mockClaude := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(claudeAnalysisResponse())
	}))
	defer mockClaude.Close()

	logger, _ := logging.New(&config.LoggingConfig{Level: "error", JSON: false})
	db, err := storage.NewInMemory(logger)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	v, _ := vault.New("test-master-key")
	claudeAnalyzer := aianalysis.NewClaudeAnalyzer(aianalysis.ClaudeConfig{
		APIKey:  "test-key",
		BaseURL: mockClaude.URL,
	}, logger)

	mgr := integrations.NewManager(logger)
	h := New(db, mgr, claudeAnalyzer, nil, logger, v)

	body, _ := json.Marshal(map[string]string{
		"connection_name": "no-such-conn",
		"owner":           "org",
		"repo":            "repo",
		"run_id":          "1",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/run", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.RunAnalysis(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestRunAnalysis_HappyPath_WithMockClaude(t *testing.T) {
	mockClaude := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(claudeAnalysisResponse())
	}))
	defer mockClaude.Close()

	logger, _ := logging.New(&config.LoggingConfig{Level: "error", JSON: false})
	db, err := storage.NewInMemory(logger)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	v, _ := vault.New("test-master-key")
	claudeAnalyzer := aianalysis.NewClaudeAnalyzer(aianalysis.ClaudeConfig{
		APIKey:  "test-key",
		BaseURL: mockClaude.URL,
	}, logger)

	provider := &mockProvider{
		platform: integrations.PlatformGitHub,
		run:      minimalPipelineRun(),
	}
	mgr := integrations.NewManager(logger)
	require.NoError(t, mgr.Add("test-conn", provider))

	h := New(db, mgr, claudeAnalyzer, nil, logger, v)

	body, _ := json.Marshal(map[string]string{
		"connection_name": "test-conn",
		"owner":           "myorg",
		"repo":            "myrepo",
		"run_id":          "run-001",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/run", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.RunAnalysis(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotNil(t, resp)
}

func TestRunAnalysis_ProviderFetchFails_BadGateway(t *testing.T) {
	mockClaude := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(claudeAnalysisResponse())
	}))
	defer mockClaude.Close()

	logger, _ := logging.New(&config.LoggingConfig{Level: "error", JSON: false})
	db, err := storage.NewInMemory(logger)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	v, _ := vault.New("test-master-key")
	claudeAnalyzer := aianalysis.NewClaudeAnalyzer(aianalysis.ClaudeConfig{
		APIKey:  "test-key",
		BaseURL: mockClaude.URL,
	}, logger)

	provider := &mockProvider{
		platform: integrations.PlatformGitHub,
		runErr:   errors.New("provider fetch error"),
	}
	mgr := integrations.NewManager(logger)
	require.NoError(t, mgr.Add("test-conn", provider))

	h := New(db, mgr, claudeAnalyzer, nil, logger, v)

	body, _ := json.Marshal(map[string]string{
		"connection_name": "test-conn",
		"owner":           "org",
		"repo":            "repo",
		"run_id":          "1",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/run", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.RunAnalysis(w, req)

	assert.Equal(t, http.StatusBadGateway, w.Code)
}

// ---------------------------------------------------------------------------
// GetStats — additional coverage
// ---------------------------------------------------------------------------

func TestGetStats_MultipleFindings(t *testing.T) {
	h, db := newTestHandlersDB(t)
	seedFinding(t, db, "conn", "critical")
	seedFinding(t, db, "conn", "critical")
	seedFinding(t, db, "conn", "medium")
	seedFinding(t, db, "conn", "low")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/stats", nil)
	w := httptest.NewRecorder()
	h.GetStats(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	// GetFindingStats returns map[string]int keyed by severity string.
	// JSON decode yields map[string]interface{} with float64 values.
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	// The key is the raw severity string. At least one critical must be present.
	criticalVal, ok := resp["critical"]
	require.True(t, ok, "expected 'critical' key in stats response")
	assert.GreaterOrEqual(t, criticalVal.(float64), float64(1))
}
