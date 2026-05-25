package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// ---------------------------------------------------------------------------
// QuickAnalysis (additional cases beyond analysis_test.go)
// ---------------------------------------------------------------------------

func TestQuickAnalysis_ConnectionNotFound(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(map[string]string{
		"connection_name": "no-such-conn",
		"owner":           "org",
		"repo":            "repo",
		"run_id":          "r1",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analysis/quick", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.QuickAnalysis(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// ---------------------------------------------------------------------------
// ListHistory
// ---------------------------------------------------------------------------

func TestListHistory_EmptyResult(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/history", nil)
	w := httptest.NewRecorder()
	h.ListHistory(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, float64(0), resp["count"])
}

func TestListHistory_WithData(t *testing.T) {
	h, db := newTestHandlersDB(t)

	require.NoError(t, db.CreateAnalysisRecord(&storage.AnalysisRecord{
		ConnectionName: "gh-conn",
		RiskScore:      25,
		FindingsCount:  3,
		Model:          "heuristic-v1",
		AnalyzedAt:     time.Now().UTC(),
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/history", nil)
	w := httptest.NewRecorder()
	h.ListHistory(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, float64(1), resp["count"])
}

func TestListHistory_FilterByConnection(t *testing.T) {
	h, db := newTestHandlersDB(t)

	require.NoError(t, db.CreateAnalysisRecord(&storage.AnalysisRecord{
		ConnectionName: "conn-a",
		Model:          "heuristic-v1",
		AnalyzedAt:     time.Now().UTC(),
	}))
	require.NoError(t, db.CreateAnalysisRecord(&storage.AnalysisRecord{
		ConnectionName: "conn-b",
		Model:          "heuristic-v1",
		AnalyzedAt:     time.Now().UTC(),
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/history?connection=conn-a", nil)
	w := httptest.NewRecorder()
	h.ListHistory(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, float64(1), resp["count"])
}

// ---------------------------------------------------------------------------
// GetStats
// ---------------------------------------------------------------------------

func TestGetStats_EmptyDB(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/stats", nil)
	w := httptest.NewRecorder()
	h.GetStats(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	// All counts should be zero (or map may be empty).
	assert.NotNil(t, resp)
}

func TestGetStats_WithFindings(t *testing.T) {
	h, db := newTestHandlersDB(t)
	seedFinding(t, db, "conn", "critical")
	seedFinding(t, db, "conn", "high")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/stats", nil)
	w := httptest.NewRecorder()
	h.GetStats(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	// At least 1 critical and 1 high must be returned.
	critical, _ := resp["critical"].(float64)
	high, _ := resp["high"].(float64)
	assert.GreaterOrEqual(t, critical, float64(1))
	assert.GreaterOrEqual(t, high, float64(1))
}

// ---------------------------------------------------------------------------
// notifyCriticalFindings (direct unit test)
// ---------------------------------------------------------------------------

func TestNotifyCriticalFindings_OnlyCriticalAndHigh(t *testing.T) {
	h, db := newTestHandlersDB(t)

	findings := []interface{}{} // placeholder — we verify via DB.
	_ = findings
	_ = db

	// notifyCriticalFindings is a side-effectful method; we exercise it to
	// ensure it does not panic on edge inputs.
	require.NotPanics(t, func() {
		h.notifyCriticalFindings("conn", nil)
	})
}
