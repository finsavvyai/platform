package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

func TestDashboardOverview_Empty(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/dashboard/overview", nil)
	w := httptest.NewRecorder()
	h.DashboardOverview(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, float64(100), resp["security_score"])
	assert.Equal(t, float64(0), resp["total_findings"])
	assert.NotNil(t, resp["recommendations"])
}

func TestDashboardOverview_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/dashboard/overview", nil)
	w := httptest.NewRecorder()
	h.DashboardOverview(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestDashboardOverview_WithFindings(t *testing.T) {
	h, db := newTestHandlersDB(t)

	// Insert two findings: one critical (open), one low (resolved).
	open := &storage.FindingRecord{
		ConnectionName: "myconn",
		Severity:       "critical",
		Category:       "secrets",
		Title:          "Critical issue",
		Status:         "open",
		Confidence:     0.99,
		CreatedAt:      time.Now().UTC(),
	}
	resolved := &storage.FindingRecord{
		ConnectionName: "myconn",
		Severity:       "low",
		Category:       "config",
		Title:          "Low issue",
		Status:         "resolved",
		Confidence:     0.5,
		CreatedAt:      time.Now().UTC(),
	}
	require.NoError(t, db.CreateFinding(open))
	require.NoError(t, db.CreateFinding(resolved))

	// Insert an analysis record to drive the risk-score average.
	require.NoError(t, db.CreateAnalysisRecord(&storage.AnalysisRecord{
		ConnectionName: "myconn",
		RiskScore:      60,
		FindingsCount:  2,
		Model:          "heuristic-v1",
		AnalyzedAt:     time.Now().UTC(),
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/dashboard/overview", nil)
	w := httptest.NewRecorder()
	h.DashboardOverview(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))

	// security_score = 100 - avg_risk = 100 - 60 = 40
	assert.Equal(t, float64(40), resp["security_score"])
	// Only the open finding contributes to open_findings count.
	assert.Equal(t, float64(1), resp["open_findings"])
	assert.Equal(t, float64(2), resp["total_findings"])
	// Oldest open finding timestamp should be non-empty.
	assert.NotEmpty(t, resp["oldest_open"])
}

func TestDashboardOverview_RecentTrend(t *testing.T) {
	h, db := newTestHandlersDB(t)

	// Insert more than 10 analysis records to verify the limit logic.
	for i := 0; i < 12; i++ {
		require.NoError(t, db.CreateAnalysisRecord(&storage.AnalysisRecord{
			ConnectionName: "myconn",
			RiskScore:      i * 5,
			FindingsCount:  i,
			Model:          "heuristic-v1",
			AnalyzedAt:     time.Now().UTC(),
		}))
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/dashboard/overview", nil)
	w := httptest.NewRecorder()
	h.DashboardOverview(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	trend, ok := resp["recent_trend"].([]interface{})
	require.True(t, ok)
	// Trend is capped at 10.
	assert.LessOrEqual(t, len(trend), 10)
}

// ---------------------------------------------------------------------------
// buildRecommendations — exercised via DashboardOverview but also directly.
// ---------------------------------------------------------------------------

func TestBuildRecommendations_NoConnections(t *testing.T) {
	recs := buildRecommendations(map[string]int{}, 0, 0, nil)
	require.NotEmpty(t, recs)
	// Should recommend adding a connection.
	found := false
	for _, r := range recs {
		if r["priority"] == "info" {
			found = true
		}
	}
	assert.True(t, found)
}

func TestBuildRecommendations_CriticalFindings(t *testing.T) {
	stats := map[string]int{"critical": 3, "high": 0}
	recs := buildRecommendations(stats, 0, 1, nil)
	require.NotEmpty(t, recs)
	assert.Equal(t, "critical", recs[0]["priority"])
}

func TestBuildRecommendations_HighFindingsOnly(t *testing.T) {
	stats := map[string]int{"critical": 0, "high": 5}
	recs := buildRecommendations(stats, 0, 1, nil)
	found := false
	for _, r := range recs {
		if r["priority"] == "high" {
			found = true
		}
	}
	assert.True(t, found)
}

func TestBuildRecommendations_ManyOpenFindings(t *testing.T) {
	recs := buildRecommendations(map[string]int{}, 15, 1, nil)
	found := false
	for _, r := range recs {
		if r["priority"] == "medium" {
			found = true
		}
	}
	assert.True(t, found)
}

func TestBuildRecommendations_AllClear(t *testing.T) {
	// connections > 0, findings > 0, no critical/high.
	findings := []storage.FindingRecord{{ConnectionName: "a"}}
	recs := buildRecommendations(map[string]int{"critical": 0}, 0, 1, findings)
	found := false
	for _, r := range recs {
		if r["title"] == "All clear" {
			found = true
		}
	}
	assert.True(t, found)
}
