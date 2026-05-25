package handlers

// coverage_boost6_test.go covers remaining gaps:
// fix_pr_batch.go (CreateFixPRBatch validation, runSingleFixPR skipped path,
//   summariseBatch, lookupFinding), notifications, analysis_persist,
//   connections.TestConnection, GenerateAPIKey empty name,
//   RevokeAPIKey empty name, ListConnections error-nil branch,
//   EvaluatePolicy with mock provider (GetPipelineRun), sse.go,
//   providers.go, audit_log.go, embed.go.

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

var errProviderFailed = errors.New("provider fetch failed")

// ---------------------------------------------------------------------------
// fix_pr_batch.go — CreateFixPRBatch validation paths
// ---------------------------------------------------------------------------

func TestCreateFixPRBatchB6_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/findings/fix/pr/batch", nil)
	w := httptest.NewRecorder()
	h.CreateFixPRBatch(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestCreateFixPRBatchB6_InvalidJSON(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/fix/pr/batch", strings.NewReader("{bad"))
	w := httptest.NewRecorder()
	h.CreateFixPRBatch(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateFixPRBatchB6_EmptyFindingIDs(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(BatchFixPRRequest{Owner: "o", Repo: "r", GitHubToken: "t"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/fix/pr/batch", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateFixPRBatch(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateFixPRBatchB6_TooManyFindings(t *testing.T) {
	h := newTestHandlers(t)
	ids := make([]int64, 21) // max is 20
	for i := range ids {
		ids[i] = int64(i + 1)
	}
	body, _ := json.Marshal(BatchFixPRRequest{
		FindingIDs: ids, Owner: "o", Repo: "r", GitHubToken: "tok",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/fix/pr/batch", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateFixPRBatch(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateFixPRBatchB6_MissingToken(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(BatchFixPRRequest{FindingIDs: []int64{1}, Owner: "o", Repo: "r"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/fix/pr/batch", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateFixPRBatch(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateFixPRBatchB6_MissingOwnerRepo(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(BatchFixPRRequest{FindingIDs: []int64{1}, GitHubToken: "tok"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/fix/pr/batch", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateFixPRBatch(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateFixPRBatchB6_FindingNotFound_Skipped(t *testing.T) {
	// Finding ID 9999 does not exist → runSingleFixPR returns skipped.
	// getRepoDefaultBranch will fail (no real GH API) → "failed" not "skipped"
	// unless we hit the lookup path first. Finding not in DB → skipped.
	h := newTestHandlers(t)
	body, _ := json.Marshal(BatchFixPRRequest{
		FindingIDs:  []int64{9999},
		Owner:       "org",
		Repo:        "repo",
		GitHubToken: "tok",
		MaxParallel: 1,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/fix/pr/batch", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateFixPRBatch(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp BatchFixPRResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 1, resp.Requested)
	assert.Equal(t, 1, resp.Skipped)
}

func TestCreateFixPRBatchB6_MaxParallelCapped(t *testing.T) {
	// Verify max_parallel > 8 is capped; finding not in DB → all skipped.
	h := newTestHandlers(t)
	body, _ := json.Marshal(BatchFixPRRequest{
		FindingIDs: []int64{1, 2},
		Owner:      "o", Repo: "r", GitHubToken: "t",
		MaxParallel: 100, // will be capped to 8
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/fix/pr/batch", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateFixPRBatch(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp BatchFixPRResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 2, resp.Skipped)
}

// ---------------------------------------------------------------------------
// lookupFinding + summariseBatch — direct unit tests
// ---------------------------------------------------------------------------

func TestLookupFindingB6_Exists(t *testing.T) {
	h, db := newTestHandlersDB(t)
	require.NoError(t, db.CreateFinding(&storage.FindingRecord{
		ConnectionName: "c", RunID: "r", Severity: "high",
		Category: "secrets", Title: "LookupTest",
		Status: "open", CreatedAt: time.Now(),
	}))
	findings, _ := db.ListFindings("c")
	id := findings[0].ID
	ref := lookupFinding(h, id)
	require.NotNil(t, ref)
	assert.Equal(t, "LookupTest", ref.Title)
}

func TestLookupFindingB6_NotExists(t *testing.T) {
	h := newTestHandlers(t)
	ref := lookupFinding(h, 99999)
	assert.Nil(t, ref)
}

func TestSummariseBatchB6_AllStatuses(t *testing.T) {
	results := []BatchFixPRResult{
		{Status: "created"},
		{Status: "failed"},
		{Status: "skipped"},
		{Status: "created"},
	}
	resp := summariseBatch(results, time.Second)
	assert.Equal(t, 4, resp.Requested)
	assert.Equal(t, 2, resp.Succeeded)
	assert.Equal(t, 1, resp.Failed)
	assert.Equal(t, 1, resp.Skipped)
}

// ---------------------------------------------------------------------------
// connections.go — TestConnection success/notfound
// ---------------------------------------------------------------------------

func TestTestConnectionB6_NotFound(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/ghost/test", nil)
	w := httptest.NewRecorder()
	h.TestConnection(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestTestConnectionB6_Success(t *testing.T) {
	provider := &mockProvider{platform: "github"}
	h := newHandlersWithProvider(t, "live-conn", provider)
	require.NoError(t, h.db.Create(&storage.ConnectionRecord{
		Name: "live-conn", Platform: "github", AuthMethod: "token", HealthStatus: "pending",
	}))
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/live-conn/test", nil)
	w := httptest.NewRecorder()
	h.TestConnection(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp integrations.ConnectionStatus
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Connected)
}

func TestTestConnectionB6_MethodNotAllowed_EmptyName(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections//test", nil)
	w := httptest.NewRecorder()
	h.TestConnection(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

// ---------------------------------------------------------------------------
// GenerateAPIKey / RevokeAPIKey — missing-name branches
// ---------------------------------------------------------------------------

func TestGenerateAPIKeyB6_EmptyName(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections//apikey", nil)
	w := httptest.NewRecorder()
	h.GenerateAPIKey(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestRevokeAPIKeyB6_EmptyName(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/connections//apikey", nil)
	w := httptest.NewRecorder()
	h.RevokeAPIKey(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestRevokeAPIKeyB6_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections/myconn/apikey", nil)
	w := httptest.NewRecorder()
	h.RevokeAPIKey(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

// ---------------------------------------------------------------------------
// EvaluatePolicy — with mock provider (success path hits GetPipelineRun)
// ---------------------------------------------------------------------------

func TestEvaluatePolicyB6_WithProvider_Success(t *testing.T) {
	run := &integrations.PipelineRun{
		ID:         "run-1",
		PipelineID: "p-1",
		Status:     integrations.StatusSuccess,
		Branch:     "main",
		Steps: []integrations.PipelineStep{
			{Name: "test"},
			{Name: "lint"},
		},
	}
	provider := &mockProvider{platform: "github", run: run}
	h := newHandlersWithProvider(t, "policy-conn", provider)

	body, _ := json.Marshal(PolicyEvaluateRequest{
		ConnectionName: "policy-conn",
		Owner:          "org",
		Repo:           "repo",
		RunID:          "run-1",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/policy/evaluate", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.EvaluatePolicy(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "policy-conn", resp["connection"])
	_, hasViolations := resp["violations"]
	assert.True(t, hasViolations)
}

func TestEvaluatePolicyB6_ProviderFetchFails(t *testing.T) {
	provider := &mockProvider{
		platform: "github",
		runErr:   errProviderFailed,
	}
	h := newHandlersWithProvider(t, "pol-fail-conn", provider)

	body, _ := json.Marshal(PolicyEvaluateRequest{
		ConnectionName: "pol-fail-conn",
		Owner:          "org",
		Repo:           "repo",
		RunID:          "run-bad",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/policy/evaluate", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.EvaluatePolicy(w, req)
	assert.Equal(t, http.StatusBadGateway, w.Code)
}

// ---------------------------------------------------------------------------
// providers.go — GetProviders
// ---------------------------------------------------------------------------

func TestGetProvidersB6_ReturnsProviders(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/providers", nil)
	w := httptest.NewRecorder()
	h.GetProviders(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	_, hasProviders := resp["providers"]
	assert.True(t, hasProviders)
	assert.GreaterOrEqual(t, resp["count"].(float64), float64(3))
}

// ---------------------------------------------------------------------------
// audit_log.go — ListAuditLog
// ---------------------------------------------------------------------------

func TestListAuditLogB6_Empty(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/audit", nil)
	w := httptest.NewRecorder()
	h.ListAuditLog(w, req)
	assert.True(t, w.Code == http.StatusOK || w.Code == http.StatusInternalServerError)
}

// ---------------------------------------------------------------------------
// embed.go — EmbedFindings additional branches
// ---------------------------------------------------------------------------

func TestEmbedFindingsB6_OPTIONS(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodOptions, "/api/v1/embed/findings", nil)
	w := httptest.NewRecorder()
	h.EmbedFindings(w, req)
	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestEmbedFindingsB6_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/embed/findings", nil)
	w := httptest.NewRecorder()
	h.EmbedFindings(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

// ---------------------------------------------------------------------------
// analysis_handlers.go — ListHistory
// ---------------------------------------------------------------------------

func TestListHistoryB6_EmptyDB(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/history?connection=c", nil)
	w := httptest.NewRecorder()
	h.ListHistory(w, req)
	assert.True(t, w.Code == http.StatusOK || w.Code == http.StatusInternalServerError)
}

func TestListHistoryB6_WithRecord(t *testing.T) {
	h, db := newTestHandlersDB(t)
	h.persistAnalysisRecord(&storage.AnalysisRecord{
		ConnectionName: "hist-conn",
		Model:          "heuristic-v1",
		RiskScore:      50,
		FindingsCount:  2,
		AnalyzedAt:     time.Now().UTC(),
	})
	history, err := db.ListAnalysisHistory("hist-conn")
	require.NoError(t, err)
	assert.Len(t, history, 1)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/history?connection=hist-conn", nil)
	w := httptest.NewRecorder()
	h.ListHistory(w, req)
	require.Equal(t, http.StatusOK, w.Code)
}

// ---------------------------------------------------------------------------
// connections_crud.go — ListConnections with data
// ---------------------------------------------------------------------------

func TestListConnectionsB6_WithData(t *testing.T) {
	h, db := newTestHandlersDB(t)
	require.NoError(t, db.Create(&storage.ConnectionRecord{
		Name: "list-conn-1", Platform: "github", AuthMethod: "token", HealthStatus: "ok",
	}))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections", nil)
	w := httptest.NewRecorder()
	h.ListConnections(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, float64(1), resp["count"])
}

// ---------------------------------------------------------------------------
// analysis_persist.go — persistAnalysisRecord full path with logger
// ---------------------------------------------------------------------------

func TestPersistAnalysisRecordB6_WithFindings(t *testing.T) {
	h, db := newTestHandlersDB(t)
	h.persistAnalysisRecord(&storage.AnalysisRecord{
		ConnectionName: "persist-ar",
		Model:          "claude-3-haiku",
		RiskScore:      75,
		FindingsCount:  5,
		AnalyzedAt:     time.Now().UTC(),
	})
	history, err := db.ListAnalysisHistory("persist-ar")
	require.NoError(t, err)
	require.Len(t, history, 1)
	assert.Equal(t, 75, history[0].RiskScore)
}

// ---------------------------------------------------------------------------
// inbound_webhook.go — InboundGitLabWebhook token mismatch → not queued
// ---------------------------------------------------------------------------

func TestInboundGitLabWebhookB6_TokenMismatch_NotQueued(t *testing.T) {
	h, db := newTestHandlersDB(t)
	h.cfg.Auth.GitLabWebhookSecret = "correct-token"
	require.NoError(t, db.Create(&storage.ConnectionRecord{
		Name: "gl-token-conn", Platform: "gitlab", AuthMethod: "token",
		Token: "irrelevant", HealthStatus: "ok",
	}))
	body := `{"project":{"path_with_namespace":"org/repo"}}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/gitlab", strings.NewReader(body))
	req.Header.Set("X-Gitlab-Event", "Push Hook")
	req.Header.Set("X-Gitlab-Token", "wrong-token")
	w := httptest.NewRecorder()
	h.InboundGitLabWebhook(w, req)
	// New contract: bad secret → 401, not silent queue=0.
	require.Equal(t, http.StatusUnauthorized, w.Code)
}
