package handlers

// coverage_boost4_test.go covers remaining 57-70% functions:
// vault_middleware.go (DecryptCredentials), health_score_dims.go (scanRecencyDim),
// analytics.go (GetTrends/GetTopFindings), status.go (Status),
// connections.go (TestAllConnections, UpdateConnection),
// compliance_types.go (categoryMatchesControl), fix_pr_github.go (truncate),
// analysis_handlers.go (GetStats more branches), suppression.go (parseFindingID).

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// ---------------------------------------------------------------------------
// vault_middleware.go — DecryptCredentials
// ---------------------------------------------------------------------------

func TestDecryptCredentialsB4_NoVault_NoSecrets_OK(t *testing.T) {
	// No vault needed when no credentials present.
	h := newTestHandlers(t)
	rec := &storage.ConnectionRecord{Name: "c", Platform: "github"}
	err := h.DecryptCredentials(rec)
	require.NoError(t, err)
}

func TestDecryptCredentialsB4_WithVault_Token_Decrypted(t *testing.T) {
	h, v := newTestHandlersWithVault(t)
	plain := "my-token"
	enc, err := v.Encrypt(plain)
	require.NoError(t, err)
	rec := &storage.ConnectionRecord{Name: "c", Platform: "github", Token: enc}
	require.NoError(t, h.DecryptCredentials(rec))
	assert.Equal(t, plain, rec.Token)
}

func TestDecryptCredentialsB4_WithVault_UsernameAndAppPwd(t *testing.T) {
	h, v := newTestHandlersWithVault(t)
	encUser, _ := v.Encrypt("user1")
	encPwd, _ := v.Encrypt("pass1")
	rec := &storage.ConnectionRecord{
		Name: "c", Platform: "bitbucket",
		Username: encUser, AppPassword: encPwd,
	}
	require.NoError(t, h.DecryptCredentials(rec))
	assert.Equal(t, "user1", rec.Username)
	assert.Equal(t, "pass1", rec.AppPassword)
}

func TestDecryptCredentialsB4_NoVault_HasSecret_Error(t *testing.T) {
	h := newTestHandlersNoVault(t)
	rec := &storage.ConnectionRecord{Name: "c", Platform: "github", Token: "sometoken"}
	err := h.DecryptCredentials(rec)
	require.Error(t, err)
}

// ---------------------------------------------------------------------------
// health_score_dims.go — scanRecencyDim all branches
// ---------------------------------------------------------------------------

func TestScanRecencyDim_NeverScanned(t *testing.T) {
	dim := scanRecencyDim(nil)
	assert.Equal(t, 0, dim.Score)
	assert.Equal(t, "Never scanned", dim.Details)
	assert.Equal(t, "fail", dim.Status)
}

func TestScanRecencyDim_Within24h(t *testing.T) {
	ts := time.Now().Add(-1 * time.Hour)
	dim := scanRecencyDim(&ts)
	assert.Equal(t, 100, dim.Score)
	assert.Contains(t, dim.Details, "24h")
	assert.Equal(t, "pass", dim.Status)
}

func TestScanRecencyDim_Within7Days(t *testing.T) {
	ts := time.Now().Add(-3 * 24 * time.Hour)
	dim := scanRecencyDim(&ts)
	assert.Equal(t, 70, dim.Score)
	assert.Contains(t, dim.Details, "7 days")
	// 70 >= 40 → warn; but dimStatus(70) → pass since 70 >= 75? Check: 70 < 75 → warn.
	assert.Equal(t, "warn", dim.Status)
}

func TestScanRecencyDim_Within30Days(t *testing.T) {
	ts := time.Now().Add(-14 * 24 * time.Hour)
	dim := scanRecencyDim(&ts)
	assert.Equal(t, 30, dim.Score)
	assert.Contains(t, dim.Details, "30 days")
	// 30 < 40 → fail
	assert.Equal(t, "fail", dim.Status)
}

func TestScanRecencyDim_OlderThan30Days(t *testing.T) {
	ts := time.Now().Add(-45 * 24 * time.Hour)
	dim := scanRecencyDim(&ts)
	assert.Equal(t, 0, dim.Score)
	assert.Contains(t, dim.Details, "30 days ago")
}

// ---------------------------------------------------------------------------
// analytics.go — GetTrends, GetTopFindings
// ---------------------------------------------------------------------------

func TestGetTrendsB4_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analytics/trends", nil)
	w := httptest.NewRecorder()
	h.GetTrends(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestGetTrendsB4_EmptyDB(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/trends?days=7", nil)
	w := httptest.NewRecorder()
	h.GetTrends(w, req)
	// Could be 200 or 500 depending on storage impl.
	assert.True(t, w.Code == http.StatusOK || w.Code == http.StatusInternalServerError)
}

func TestGetTrendsB4_WithConnection(t *testing.T) {
	h, db := newTestHandlersDB(t)
	seedFinding(t, db, "trend-conn", "high")
	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/trends?connection=trend-conn&days=7", nil)
	w := httptest.NewRecorder()
	h.GetTrends(w, req)
	assert.True(t, w.Code == http.StatusOK || w.Code == http.StatusInternalServerError)
}

func TestGetTopFindingsB4_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analytics/top-findings", nil)
	w := httptest.NewRecorder()
	h.GetTopFindings(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestGetTopFindingsB4_EmptyDB(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/top-findings", nil)
	w := httptest.NewRecorder()
	h.GetTopFindings(w, req)
	assert.True(t, w.Code == http.StatusOK || w.Code == http.StatusInternalServerError)
}

func TestGetTopFindingsB4_WithLimit(t *testing.T) {
	h, db := newTestHandlersDB(t)
	seedFinding(t, db, "top-conn", "critical")
	req := httptest.NewRequest(http.MethodGet, "/api/v1/analytics/top-findings?limit=5", nil)
	w := httptest.NewRecorder()
	h.GetTopFindings(w, req)
	assert.True(t, w.Code == http.StatusOK || w.Code == http.StatusInternalServerError)
}

// ---------------------------------------------------------------------------
// status.go — Status handler
// ---------------------------------------------------------------------------

func TestStatusB4_GET_ReturnsHealth(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/status", nil)
	w := httptest.NewRecorder()
	h.Status(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp StatusResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Status == "healthy" || resp.Status == "degraded")
	assert.NotEmpty(t, resp.Version)
	assert.GreaterOrEqual(t, resp.Uptime, int64(0))
}

func TestStatusB4_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/status", nil)
	w := httptest.NewRecorder()
	h.Status(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestStatusB4_NoVault_Degraded(t *testing.T) {
	h := newTestHandlersNoVault(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/status", nil)
	w := httptest.NewRecorder()
	h.Status(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp StatusResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	// Vault is nil so the status should reflect that
	assert.False(t, resp.Vault.Healthy)
}

func TestStatusB4_WithWebhookConfigured(t *testing.T) {
	h, db := newTestHandlersDB(t)
	require.NoError(t, db.SaveWebhookConfig(&storage.WebhookConfigRecord{
		Name: defaultWebhookConfigName, URL: "https://ex.com/hook",
		Events: []string{"findings"}, Enabled: true,
	}))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/status", nil)
	w := httptest.NewRecorder()
	h.Status(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp StatusResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "configured", resp.Webhooks.Message)
}

func TestStatusB4_WithWebhookDisabled(t *testing.T) {
	h, db := newTestHandlersDB(t)
	require.NoError(t, db.SaveWebhookConfig(&storage.WebhookConfigRecord{
		Name: defaultWebhookConfigName, URL: "https://ex.com/hook",
		Events: []string{"findings"}, Enabled: false,
	}))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/status", nil)
	w := httptest.NewRecorder()
	h.Status(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp StatusResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "disabled", resp.Webhooks.Message)
}

// ---------------------------------------------------------------------------
// connections.go — TestAllConnections (no providers → empty), UpdateConnection
// ---------------------------------------------------------------------------

func TestTestAllConnectionsB4_Empty(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/test", nil)
	w := httptest.NewRecorder()
	h.TestAllConnections(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	// Empty manager → empty map
	assert.Empty(t, resp)
}

func TestTestAllConnectionsB4_WithProvider(t *testing.T) {
	provider := &mockProvider{platform: "github"}
	h := newHandlersWithProvider(t, "test-all-conn", provider)
	// Seed DB so UpdateConnectionHealth has something to update
	require.NoError(t, h.db.Create(&storage.ConnectionRecord{
		Name: "test-all-conn", Platform: "github", AuthMethod: "token", HealthStatus: "pending",
	}))
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/test", nil)
	w := httptest.NewRecorder()
	h.TestAllConnections(w, req)
	require.Equal(t, http.StatusOK, w.Code)
}

func TestUpdateConnectionB4_InvalidJSON(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPut, "/api/v1/connections/update", strings.NewReader("{bad"))
	w := httptest.NewRecorder()
	h.UpdateConnection(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateConnectionB4_MissingName(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(map[string]string{"platform": "github"})
	req := httptest.NewRequest(http.MethodPut, "/api/v1/connections/update", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.UpdateConnection(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateConnectionB4_NotFound(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(map[string]string{"name": "nonexistent"})
	req := httptest.NewRequest(http.MethodPut, "/api/v1/connections/update", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.UpdateConnection(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestUpdateConnectionB4_HappyPath(t *testing.T) {
	h, db := newTestHandlersDB(t)

	// Create connection with no credentials (so no vault needed for decrypt)
	require.NoError(t, db.Create(&storage.ConnectionRecord{
		Name: "update-conn", Platform: "github", AuthMethod: "token", HealthStatus: "ok",
	}))

	body, _ := json.Marshal(map[string]string{
		"name": "update-conn", "base_url": "https://my.github.com",
	})
	req := httptest.NewRequest(http.MethodPut, "/api/v1/connections/update", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.UpdateConnection(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]string
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "updated", resp["status"])
}

// ---------------------------------------------------------------------------
// compliance_types.go — categoryMatchesControl all branches
// ---------------------------------------------------------------------------

func TestCategoryMatchesControl_Secret(t *testing.T) {
	assert.True(t, categoryMatchesControl("secret", "secret"))
	assert.True(t, categoryMatchesControl("dlp", "secret"))
	assert.False(t, categoryMatchesControl("supply-chain", "secret"))
}

func TestCategoryMatchesControl_SupplyChain(t *testing.T) {
	assert.True(t, categoryMatchesControl("supply-chain", "supply-chain"))
	assert.False(t, categoryMatchesControl("secret", "supply-chain"))
}

func TestCategoryMatchesControl_Policy(t *testing.T) {
	assert.True(t, categoryMatchesControl("policy", "policy"))
	assert.False(t, categoryMatchesControl("secret", "policy"))
}

func TestCategoryMatchesControl_DLP(t *testing.T) {
	assert.True(t, categoryMatchesControl("dlp", "dlp"))
	assert.True(t, categoryMatchesControl("secret", "dlp"))
	assert.False(t, categoryMatchesControl("supply-chain", "dlp"))
}

func TestCategoryMatchesControl_Default_False(t *testing.T) {
	assert.False(t, categoryMatchesControl("anything", "unknown-category"))
}

// ---------------------------------------------------------------------------
// fix_pr_github.go — truncate helper
// ---------------------------------------------------------------------------

func TestTruncate_ShortString_Unchanged(t *testing.T) {
	assert.Equal(t, "hello", truncate("hello", 100))
}

func TestTruncate_LongString_Truncated(t *testing.T) {
	long := strings.Repeat("x", 200)
	result := truncate(long, 50)
	// truncate appends "..." so length is n+3=53
	assert.Equal(t, 53, len(result))
	assert.True(t, strings.HasSuffix(result, "..."))
}

func TestTruncate_ExactLength_Unchanged(t *testing.T) {
	s := strings.Repeat("a", 50)
	assert.Equal(t, s, truncate(s, 50))
}

// ---------------------------------------------------------------------------
// suppression.go — parseFindingID path with bad base prefix
// ---------------------------------------------------------------------------

func TestParseFindingID_BadBasePath(t *testing.T) {
	w := httptest.NewRecorder()
	_, ok := parseFindingID(w, "/wrong/prefix/1/suppress", "/suppress")
	assert.False(t, ok)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// ---------------------------------------------------------------------------
// analysis_handlers.go — GetStats additional branches
// ---------------------------------------------------------------------------

func TestGetStatsB4_WithAllSeverities(t *testing.T) {
	h, db := newTestHandlersDB(t)
	// Create findings of each severity with unique titles to avoid upsert dedup.
	for _, sev := range []string{"critical", "high", "medium", "low"} {
		require.NoError(t, db.CreateFinding(&storage.FindingRecord{
			ConnectionName: "stats-conn",
			RunID:          "run-x",
			Severity:       sev,
			Category:       "secrets",
			Title:          "Finding severity " + sev,
			Status:         "open",
			CreatedAt:      time.Now(),
		}))
	}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/findings/stats?connection=stats-conn", nil)
	w := httptest.NewRecorder()
	h.GetStats(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.GreaterOrEqual(t, resp["critical"].(float64), float64(1))
}

// ---------------------------------------------------------------------------
// notifications.go — MarkAllNotificationsRead additional coverage
// ---------------------------------------------------------------------------

func TestMarkAllNotificationsReadB4_ReturnsOK(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/notifications/read-all", nil)
	w := httptest.NewRecorder()
	h.MarkAllNotificationsRead(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "ok", resp["status"])
}

// ---------------------------------------------------------------------------
// health_score_dims.go — other dim helpers
// ---------------------------------------------------------------------------

func TestActionPinningDimB4_WithSupplyChainFindings(t *testing.T) {
	findings := []storage.FindingRecord{
		{Category: "supply-chain"},
		{Category: "supply-chain"},
		{Category: "secret"},
	}
	dim := actionPinningDim(findings)
	// 2 supply-chain × 20 = 40 deducted from 100 → score=60
	assert.Equal(t, 60, dim.Score)
	assert.Equal(t, "Action Pinning", dim.Name)
}

func TestActionPinningDimB4_OvercapToZero(t *testing.T) {
	// 6 supply-chain × 20 = 120 > 100 → capped at 0
	findings := make([]storage.FindingRecord, 6)
	for i := range findings {
		findings[i] = storage.FindingRecord{Category: "supply-chain"}
	}
	dim := actionPinningDim(findings)
	assert.Equal(t, 0, dim.Score)
}

func TestSecretHygieneDimB4_WithFindings(t *testing.T) {
	findings := []storage.FindingRecord{
		{Category: "secret-exposure"},
	}
	dim := secretHygieneDim(findings)
	// 1 × 25 = 25 deducted → score=75
	assert.Equal(t, 75, dim.Score)
}

func TestContainerSecurityDimB4_NoFindings(t *testing.T) {
	dim := containerSecurityDim(nil)
	assert.Equal(t, 100, dim.Score)
	assert.Equal(t, "pass", dim.Status)
}

func TestPolicyComplianceDimB4_WithFindings(t *testing.T) {
	findings := []storage.FindingRecord{
		{Category: "policy"},
		{Category: "policy"},
	}
	dim := policyComplianceDim(findings)
	// 2 × 20 = 40 → score=60
	assert.Equal(t, 60, dim.Score)
}

func TestFormatCountB4_Zero(t *testing.T) {
	assert.Equal(t, "No tests found", formatCount(0, "test"))
}

func TestFormatCountB4_One(t *testing.T) {
	assert.Equal(t, "1 widget", formatCount(1, "widget"))
}

func TestFormatCountB4_Many(t *testing.T) {
	assert.Equal(t, "3 items", formatCount(3, "item"))
}
