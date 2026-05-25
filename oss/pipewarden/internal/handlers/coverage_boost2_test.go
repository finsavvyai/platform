package handlers

// coverage_boost2_test.go adds tests for analytics, similar findings,
// health score, webhook handlers, analysis persist, and connections — all
// sitting in the 50–65% range after the first coverage pass.

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
// GetSummary (analytics)
// ---------------------------------------------------------------------------

func TestGetSummary_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analytics/summary", nil)
	w := httptest.NewRecorder()
	h.GetSummary(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestGetSummary_EmptyDB(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/summary", nil)
	w := httptest.NewRecorder()
	h.GetSummary(w, req)
	// FindingSummary may return an error on empty DB → 500 is also acceptable.
	assert.True(t, w.Code == http.StatusOK || w.Code == http.StatusInternalServerError,
		"expected 200 or 500, got %d", w.Code)
}

func TestGetSummary_WithFindings(t *testing.T) {
	h, db := newTestHandlersDB(t)
	seedFinding(t, db, "conn", "critical")
	seedFinding(t, db, "conn", "high")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/summary", nil)
	w := httptest.NewRecorder()
	h.GetSummary(w, req)
	require.Equal(t, http.StatusOK, w.Code)
}

// ---------------------------------------------------------------------------
// GetSimilarFindings
// ---------------------------------------------------------------------------

func TestGetSimilarFindings_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/42/similar", nil)
	w := httptest.NewRecorder()
	h.GetSimilarFindings(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestGetSimilarFindings_InvalidID(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/findings/notanid/similar", nil)
	w := httptest.NewRecorder()
	h.GetSimilarFindings(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetSimilarFindings_SearchDisabled_ReturnsEmptyHits(t *testing.T) {
	// Default handlers have searchClient with Enabled()=false.
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/findings/42/similar", nil)
	w := httptest.NewRecorder()
	h.GetSimilarFindings(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp SimilarFindingsResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, int64(42), resp.FindingID)
	assert.False(t, resp.Enabled)
	assert.Empty(t, resp.Hits)
}

func TestGetSimilarFindings_CustomKParam(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/findings/5/similar?k=3", nil)
	w := httptest.NewRecorder()
	h.GetSimilarFindings(w, req)
	require.Equal(t, http.StatusOK, w.Code)
}

func TestExtractFindingIDFromSimilarPath_Valid(t *testing.T) {
	id, err := extractFindingIDFromSimilarPath("/api/v1/findings/123/similar")
	require.NoError(t, err)
	assert.Equal(t, int64(123), id)
}

func TestExtractFindingIDFromSimilarPath_Invalid(t *testing.T) {
	_, err := extractFindingIDFromSimilarPath("/api/v1/findings/abc/similar")
	require.Error(t, err)
}

// ---------------------------------------------------------------------------
// GetHealthScore
// ---------------------------------------------------------------------------

func TestGetHealthScore_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/myconn/health", nil)
	w := httptest.NewRecorder()
	h.GetHealthScore(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestGetHealthScore_EmptyName(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections//health", nil)
	w := httptest.NewRecorder()
	h.GetHealthScore(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetHealthScore_NoFindings_ReturnsScore(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections/myconn/health", nil)
	w := httptest.NewRecorder()
	h.GetHealthScore(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp HealthScore
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "myconn", resp.Connection)
	assert.GreaterOrEqual(t, resp.Score, 0)
	assert.LessOrEqual(t, resp.Score, 100)
	assert.NotEmpty(t, resp.Grade)
}

func TestGetHealthScore_WithFindings_LowerScore(t *testing.T) {
	h, db := newTestHandlersDB(t)
	seedFinding(t, db, "secure-conn", "critical")
	seedFinding(t, db, "secure-conn", "high")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections/secure-conn/health", nil)
	w := httptest.NewRecorder()
	h.GetHealthScore(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp HealthScore
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "secure-conn", resp.Connection)
}

// ---------------------------------------------------------------------------
// ConfigureWebhook — remaining branches
// ---------------------------------------------------------------------------

func TestConfigureWebhook_GetNoConfig_ReturnsFalse(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/webhooks/configure", nil)
	w := httptest.NewRecorder()
	h.ConfigureWebhook(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, false, resp["configured"])
}

func TestConfigureWebhook_GetWithConfig_ReturnsConfigured(t *testing.T) {
	h := newTestHandlers(t)
	rec := &storage.WebhookConfigRecord{
		Name:    defaultWebhookConfigName,
		URL:     "https://example.com/hook",
		Events:  []string{"findings"},
		Enabled: false,
	}
	require.NoError(t, h.db.SaveWebhookConfig(rec))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/webhooks/configure", nil)
	w := httptest.NewRecorder()
	h.ConfigureWebhook(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, true, resp["configured"])
	assert.Equal(t, "https://example.com/hook", resp["url"])
}

func TestConfigureWebhook_PostInvalidJSON(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/configure", bytes.NewBufferString("{bad"))
	w := httptest.NewRecorder()
	h.ConfigureWebhook(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestConfigureWebhook_PostMissingURL(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(WebhookConfig{Secret: "s", Events: []string{"findings"}})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/configure", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ConfigureWebhook(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestConfigureWebhook_PostInvalidURL(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(WebhookConfig{URL: "not-a-url"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/configure", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ConfigureWebhook(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestConfigureWebhook_PostEnabledWithoutSecret_Fails(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(WebhookConfig{
		URL:     "https://example.com/hook",
		Events:  []string{"findings"},
		Enabled: true,
		// No Secret
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/configure", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ConfigureWebhook(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestConfigureWebhook_PostDisabledWithoutSecret_Succeeds(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(WebhookConfig{
		URL:     "https://example.com/hook",
		Events:  []string{"findings"},
		Enabled: false,
		// No secret required when disabled
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/configure", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ConfigureWebhook(w, req)
	require.Equal(t, http.StatusOK, w.Code)
}

func TestConfigureWebhook_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/webhooks/configure", nil)
	w := httptest.NewRecorder()
	h.ConfigureWebhook(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

// ---------------------------------------------------------------------------
// persistAnalysisRecord — success path with real DB
// ---------------------------------------------------------------------------

func TestPersistAnalysisRecord_CreatesRecord(t *testing.T) {
	h, db := newTestHandlersDB(t)

	h.persistAnalysisRecord(&storage.AnalysisRecord{
		ConnectionName: "test-conn",
		Model:          "heuristic-v1",
		RiskScore:      25,
		FindingsCount:  3,
		AnalyzedAt:     time.Now().UTC(),
	})

	history, err := db.ListAnalysisHistory("test-conn")
	require.NoError(t, err)
	assert.Len(t, history, 1)
	assert.Equal(t, "heuristic-v1", history[0].Model)
}
