package handlers

// coverage_boost3_test.go targets functions in the 50-67% range:
// team.go, connections_crud.go, suppression.go, inbound_webhook.go,
// embed_helpers.go, payment.go, dlp_policy.go, webhook_templates.go,
// policies.go, pipelines.go.

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// ---------------------------------------------------------------------------
// team.go — ListTeamMembers, InviteTeamMember, RemoveTeamMember, UpdateTeamMemberRole
// ---------------------------------------------------------------------------

func TestListTeamMembers_Empty(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/team/members", nil)
	w := httptest.NewRecorder()
	h.ListTeamMembers(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, float64(0), resp["count"])
}

func TestInviteTeamMember_Success(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(map[string]string{"email": "alice@example.com", "role": "member"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/team/members", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.InviteTeamMember(w, req)
	require.Equal(t, http.StatusCreated, w.Code)
}

func TestInviteTeamMember_InvalidEmail(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(map[string]string{"email": "not-an-email", "role": "member"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/team/members", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.InviteTeamMember(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestInviteTeamMember_InvalidJSON(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/team/members", strings.NewReader("{bad"))
	w := httptest.NewRecorder()
	h.InviteTeamMember(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestInviteTeamMember_InvalidRole(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(map[string]string{"email": "bob@example.com", "role": "superadmin"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/team/members", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.InviteTeamMember(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestInviteTeamMember_DefaultRoleIsMember(t *testing.T) {
	h := newTestHandlers(t)
	// No role supplied → defaults to "member"
	body, _ := json.Marshal(map[string]string{"email": "carol@example.com"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/team/members", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.InviteTeamMember(w, req)
	require.Equal(t, http.StatusCreated, w.Code)
	var resp map[string]string
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "member", resp["role"])
}

func TestRemoveTeamMember_NotFound(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/team/members/ghost@example.com", nil)
	w := httptest.NewRecorder()
	h.RemoveTeamMember(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestRemoveTeamMember_Success(t *testing.T) {
	h, db := newTestHandlersDB(t)
	require.NoError(t, db.InviteMember("dave@example.com", "viewer"))
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/team/members/dave@example.com", nil)
	w := httptest.NewRecorder()
	h.RemoveTeamMember(w, req)
	require.Equal(t, http.StatusOK, w.Code)
}

func TestRemoveTeamMember_EmptyEmail(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/team/members/", nil)
	w := httptest.NewRecorder()
	h.RemoveTeamMember(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateTeamMemberRole_Success(t *testing.T) {
	h, db := newTestHandlersDB(t)
	require.NoError(t, db.InviteMember("eve@example.com", "viewer"))
	body, _ := json.Marshal(map[string]string{"role": "admin"})
	req := httptest.NewRequest(http.MethodPut, "/api/v1/team/members/eve@example.com/role", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.UpdateTeamMemberRole(w, req)
	require.Equal(t, http.StatusOK, w.Code)
}

func TestUpdateTeamMemberRole_InvalidRole(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(map[string]string{"role": "god"})
	req := httptest.NewRequest(http.MethodPut, "/api/v1/team/members/eve@example.com/role", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.UpdateTeamMemberRole(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateTeamMemberRole_InvalidJSON(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPut, "/api/v1/team/members/eve@example.com/role", strings.NewReader("{bad"))
	w := httptest.NewRecorder()
	h.UpdateTeamMemberRole(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateTeamMemberRole_EmptyEmail(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(map[string]string{"role": "member"})
	req := httptest.NewRequest(http.MethodPut, "/api/v1/team/members//role", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.UpdateTeamMemberRole(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateTeamMemberRole_NotFound(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(map[string]string{"role": "member"})
	req := httptest.NewRequest(http.MethodPut, "/api/v1/team/members/nobody@example.com/role", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.UpdateTeamMemberRole(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

// ---------------------------------------------------------------------------
// suppression.go — ReopenFinding success (new path; error paths exist in suppression_test.go)
// ---------------------------------------------------------------------------

func TestReopenFinding_SuccessAfterSuppress(t *testing.T) {
	h, db := newTestHandlersDB(t)
	id := seedFinding(t, db, "conn-reopen", "critical")
	require.NoError(t, db.SuppressFinding(id, "false_positive", ""))
	path := "/api/v1/findings/" + fmtID(id) + "/reopen"
	req := httptest.NewRequest(http.MethodPost, path, nil)
	w := httptest.NewRecorder()
	h.ReopenFinding(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "open", resp["status"])
}

func TestSuppressFinding_WontFix_Success(t *testing.T) {
	h, db := newTestHandlersDB(t)
	id := seedFinding(t, db, "conn-wf", "medium")
	body, _ := json.Marshal(SuppressionRequest{Reason: "wont_fix", Note: "intentional"})
	path := "/api/v1/findings/" + fmtID(id) + "/suppress"
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.SuppressFinding(w, req)
	require.Equal(t, http.StatusOK, w.Code)
}

// fmtID converts int64 to decimal string for URL construction.
func fmtID(id int64) string {
	if id == 0 {
		return "0"
	}
	s := ""
	n := id
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	return s
}

// ---------------------------------------------------------------------------
// inbound_webhook.go — InboundGitHubWebhook, InboundGitLabWebhook, verifyGitHubSignature
// ---------------------------------------------------------------------------

func TestInboundGitHubWebhook_WrongEvent_NoContent(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/github", strings.NewReader("{}"))
	req.Header.Set("X-GitHub-Event", "issues")
	w := httptest.NewRecorder()
	h.InboundGitHubWebhook(w, req)
	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestInboundGitHubWebhook_PushEvent_NoSecret_Queues(t *testing.T) {
	h, db := newTestHandlersDB(t)
	// Seed a github connection
	require.NoError(t, db.Create(&storage.ConnectionRecord{
		Name: "gh-conn", Platform: "github", AuthMethod: "token", HealthStatus: "ok",
	}))
	body := `{"repository":{"full_name":"myorg/myrepo"}}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/github", strings.NewReader(body))
	req.Header.Set("X-GitHub-Event", "push")
	w := httptest.NewRecorder()
	h.InboundGitHubWebhook(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, float64(1), resp["connections"])
}

func TestInboundGitHubWebhook_PREvent_Queues(t *testing.T) {
	h, db := newTestHandlersDB(t)
	require.NoError(t, db.Create(&storage.ConnectionRecord{
		Name: "gh-conn2", Platform: "github", AuthMethod: "token", HealthStatus: "ok",
	}))
	body := `{"repository":{"full_name":"myorg/myrepo"}}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/github", strings.NewReader(body))
	req.Header.Set("X-GitHub-Event", "pull_request")
	w := httptest.NewRecorder()
	h.InboundGitHubWebhook(w, req)
	require.Equal(t, http.StatusOK, w.Code)
}

func TestInboundGitLabWebhook_WrongEvent_NoContent(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/gitlab", strings.NewReader("{}"))
	req.Header.Set("X-Gitlab-Event", "Issue Hook")
	w := httptest.NewRecorder()
	h.InboundGitLabWebhook(w, req)
	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestInboundGitLabWebhook_PushHook_Queues(t *testing.T) {
	h, db := newTestHandlersDB(t)
	const secret = "gl-shared-secret"
	h.cfg.Auth.GitLabWebhookSecret = secret
	require.NoError(t, db.Create(&storage.ConnectionRecord{
		Name: "gl-conn", Platform: "gitlab", AuthMethod: "token", HealthStatus: "ok",
	}))
	body := `{"project":{"path_with_namespace":"myorg/myrepo"}}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/gitlab", strings.NewReader(body))
	req.Header.Set("X-Gitlab-Event", "Push Hook")
	req.Header.Set("X-Gitlab-Token", secret)
	w := httptest.NewRecorder()
	h.InboundGitLabWebhook(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, float64(1), resp["connections"])
}

func TestInboundGitLabWebhook_MRHook_Queues(t *testing.T) {
	h, db := newTestHandlersDB(t)
	const secret = "gl-shared-secret"
	h.cfg.Auth.GitLabWebhookSecret = secret
	require.NoError(t, db.Create(&storage.ConnectionRecord{
		Name: "gl-conn2", Platform: "gitlab", AuthMethod: "token", HealthStatus: "ok",
	}))
	body := `{"project":{"path_with_namespace":"myorg/myrepo"}}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/gitlab", strings.NewReader(body))
	req.Header.Set("X-Gitlab-Event", "Merge Request Hook")
	req.Header.Set("X-Gitlab-Token", secret)
	w := httptest.NewRecorder()
	h.InboundGitLabWebhook(w, req)
	require.Equal(t, http.StatusOK, w.Code)
}

func TestVerifyGitHubSignature_NoSecret_AlwaysTrue(t *testing.T) {
	assert.True(t, verifyGitHubSignature([]byte("body"), "sha256=anything", ""))
}

func TestVerifyGitHubSignature_MissingPrefix_False(t *testing.T) {
	assert.False(t, verifyGitHubSignature([]byte("body"), "nope", "secret"))
}

// ---------------------------------------------------------------------------
// embed_helpers.go — EmbedConfig OPTIONS/MethodNotAllowed + parseTenantID
// ---------------------------------------------------------------------------

func TestEmbedConfigB3_OPTIONS_NoContent(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodOptions, "/api/v1/embed/config", nil)
	w := httptest.NewRecorder()
	h.EmbedConfig(w, req)
	assert.Equal(t, http.StatusNoContent, w.Code)
	assert.Equal(t, "*", w.Header().Get("Access-Control-Allow-Origin"))
}

func TestEmbedConfigB3_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/embed/config", nil)
	w := httptest.NewRecorder()
	h.EmbedConfig(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestEmbedConfigB3_GET_ReturnsConfig(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/embed/config", nil)
	w := httptest.NewRecorder()
	h.EmbedConfig(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "/static/embed.html", resp["embed_url"])
}

func TestEmbedSummaryB3_OPTIONS_NoContent(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodOptions, "/api/v1/embed/summary", nil)
	w := httptest.NewRecorder()
	h.EmbedSummary(w, req)
	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestEmbedSummaryB3_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/embed/summary", nil)
	w := httptest.NewRecorder()
	h.EmbedSummary(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestParseTenantIDB3_FromQuery(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/embed/summary?tenant_id=acme", nil)
	assert.Equal(t, "acme", h.parseTenantID(req))
}

func TestParseTenantIDB3_FromHeader(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/embed/summary", nil)
	req.Header.Set("X-Tenant-ID", "tenant-42")
	assert.Equal(t, "tenant-42", h.parseTenantID(req))
}

func TestParseTenantIDB3_Empty(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/embed/summary", nil)
	assert.Equal(t, "", h.parseTenantID(req))
}

// ---------------------------------------------------------------------------
// payment.go — CreateCheckoutSession community+trial path and HandleBillingWebhook 503
// ---------------------------------------------------------------------------

func TestCreateCheckoutSessionB3_Community_TrialMode(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(CheckoutRequest{Plan: "community", TenantID: "t1"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/billing/checkout", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateCheckoutSession(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, true, resp["trial_mode"])
}

func TestCreateCheckoutSessionB3_DefaultTenantID(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(CheckoutRequest{Plan: "enterprise"}) // no tenant_id → defaults
	req := httptest.NewRequest(http.MethodPost, "/api/v1/billing/checkout", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateCheckoutSession(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "local-eval", resp["tenant_id"])
}

// ---------------------------------------------------------------------------
// dlp_policy.go — EvaluatePolicy connection-not-found path (new branch)
// ---------------------------------------------------------------------------

func TestEvaluatePolicyB3_ConnectionNotFound(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(PolicyEvaluateRequest{
		ConnectionName: "nonexistent",
		Owner:          "org",
		Repo:           "repo",
		RunID:          "run-1",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/policy/evaluate", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.EvaluatePolicy(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestScanDLP_WithConnectionAndRunID_PersistsFindings(t *testing.T) {
	h, db := newTestHandlersDB(t)
	body, _ := json.Marshal(DLPScanRequest{
		Content:    "aws_access_key_id: AKIAIOSFODNN7EXAMPLE",
		Source:     "pipeline.yml",
		Connection: "dlp-conn",
		RunID:      "run-dlp",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/dlp/scan", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ScanDLP(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	count := resp["count"].(float64)
	if count > 0 {
		findings, err := db.ListFindings("dlp-conn")
		require.NoError(t, err)
		assert.NotEmpty(t, findings)
	}
}

// ---------------------------------------------------------------------------
// webhook_templates.go — RenderWebhookTemplate success path (new)
// ---------------------------------------------------------------------------

func TestRenderWebhookTemplateB3_Success(t *testing.T) {
	h := newTestHandlers(t)
	// Create template first
	createBody, _ := json.Marshal(storage.TemplateRow{
		ID:          "render-b3",
		Name:        "Render B3",
		Destination: "generic",
		Template:    `Alert: {{.Connection}} score={{.RiskScore}}`,
	})
	h.CreateWebhookTemplate(httptest.NewRecorder(),
		httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/templates", bytes.NewReader(createBody)))

	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/templates/render-b3/render", nil)
	w := httptest.NewRecorder()
	h.RenderWebhookTemplate(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Contains(t, resp["rendered"].(string), "Alert:")
}

func TestListWebhookTemplatesB3_AfterCreate(t *testing.T) {
	h := newTestHandlers(t)
	createBody, _ := json.Marshal(storage.TemplateRow{
		ID: "b3-list", Name: "B3 List", Destination: "slack", Template: "hi",
	})
	h.CreateWebhookTemplate(httptest.NewRecorder(),
		httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/templates", bytes.NewReader(createBody)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/webhooks/templates", nil)
	w := httptest.NewRecorder()
	h.ListWebhookTemplates(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, float64(1), resp["count"])
}

// ---------------------------------------------------------------------------
// policies.go — UpdatePolicy success path (new branch not covered elsewhere)
// ---------------------------------------------------------------------------

func TestUpdatePolicyB3_Success(t *testing.T) {
	h := newTestHandlers(t)
	// Create first
	createBody, _ := json.Marshal(storage.PolicyRow{
		ID: "update-b3", Name: "Original", Pattern: ".*foo.*", Message: "msg",
	})
	h.CreatePolicy(httptest.NewRecorder(),
		httptest.NewRequest(http.MethodPost, "/api/v1/policies", bytes.NewReader(createBody)))

	// Update it
	updateBody, _ := json.Marshal(storage.PolicyRow{
		ID: "update-b3", Name: "Updated Name", Pattern: ".*bar.*", Message: "updated msg",
	})
	req := httptest.NewRequest(http.MethodPut, "/api/v1/policies/update-b3", bytes.NewReader(updateBody))
	w := httptest.NewRecorder()
	h.UpdatePolicy(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "Updated Name", resp["name"])
}

// ---------------------------------------------------------------------------
// pipelines.go — ListPipelineRuns and ListPipelines with mock provider
// ---------------------------------------------------------------------------

func TestListPipelineRuns_WithProvider_Success(t *testing.T) {
	provider := &mockProvider{platform: "github"}
	h := newHandlersWithProvider(t, "gh-conn", provider)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/pipelines/runs?connection=gh-conn&owner=org&repo=myrepo", nil)
	w := httptest.NewRecorder()
	h.ListPipelineRuns(w, req)
	require.Equal(t, http.StatusOK, w.Code)
}

func TestListPipelines_WithProvider_Success(t *testing.T) {
	provider := &mockProvider{platform: "github"}
	h := newHandlersWithProvider(t, "gh-conn2", provider)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/pipelines?connection=gh-conn2&owner=org&repo=myrepo", nil)
	w := httptest.NewRecorder()
	h.ListPipelines(w, req)
	require.Equal(t, http.StatusOK, w.Code)
}

// ---------------------------------------------------------------------------
// connections_crud.go — CreateConnection (new branches), GetConnection (found), DeleteConnection (success)
// ---------------------------------------------------------------------------

func TestCreateConnectionB3_UnsupportedPlatform(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(map[string]string{"name": "myconn", "platform": "unknownci"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateConnection(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetConnection_Found(t *testing.T) {
	h, db := newTestHandlersDB(t)
	require.NoError(t, db.Create(&storage.ConnectionRecord{
		Name: "found-conn", Platform: "github", AuthMethod: "token", HealthStatus: "ok",
	}))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections/found-conn", nil)
	w := httptest.NewRecorder()
	h.GetConnection(w, req)
	require.Equal(t, http.StatusOK, w.Code)
}

func TestDeleteConnection_Success(t *testing.T) {
	h, db := newTestHandlersDB(t)
	require.NoError(t, db.Create(&storage.ConnectionRecord{
		Name: "del-conn", Platform: "github", AuthMethod: "token", HealthStatus: "ok",
	}))
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/connections/del-conn", nil)
	w := httptest.NewRecorder()
	h.DeleteConnection(w, req)
	require.Equal(t, http.StatusOK, w.Code)
}
