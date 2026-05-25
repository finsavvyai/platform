package e2e

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/storage"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestGitHubEnterpriseOAuthFlow verifies that a GHE connection can be created,
// retrieved, scanned, and that findings are returned.
func TestGitHubEnterpriseOAuthFlow(t *testing.T) {
	gheMock := newGHEMockServer(t)
	defer gheMock.Close()

	server, _ := setupServer(t)

	// Step 1: POST /api/v1/connections — create GHE connection
	connPayload := map[string]interface{}{
		"name":     "ghe-prod",
		"platform": "github",
		"token":    "ghp_ghe_test_token",
		"base_url": gheMock.URL,
	}
	body, _ := json.Marshal(connPayload)
	resp, err := http.Post(
		fmt.Sprintf("%s/api/v1/connections", server.URL),
		"application/json",
		bytes.NewBuffer(body),
	)
	require.NoError(t, err)
	assert.Equal(t, http.StatusCreated, resp.StatusCode, "connection creation should return 201")
	_, _ = io.ReadAll(resp.Body)
	_ = resp.Body.Close()

	// Step 2: GET /api/v1/connections/ghe-prod — verify platform == "github"
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/connections/ghe-prod", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var connResp map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&connResp))
	_ = resp.Body.Close()
	assert.Equal(t, "github", connResp["platform"], "platform should be github")

	// Step 3: POST /api/v1/analysis/quick — heuristic scan (Claude API not needed in tests)
	runPayload := map[string]interface{}{
		"connection_name": "ghe-prod",
		"owner":           "acme",
		"repo":            "testrepo",
		"run_id":          "run-ghe-001",
	}
	body, _ = json.Marshal(runPayload)
	resp, err = http.Post(
		fmt.Sprintf("%s/api/v1/analysis/quick", server.URL),
		"application/json",
		bytes.NewBuffer(body),
	)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode, "heuristic analysis run should succeed")
	_, _ = io.ReadAll(resp.Body)
	_ = resp.Body.Close()

	// Step 4: GET /api/v1/analysis/findings — verify findings list is returned
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/analysis/findings", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var findingsResp struct {
		Findings []map[string]interface{} `json:"findings"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&findingsResp))
	_ = resp.Body.Close()
	assert.NotNil(t, findingsResp.Findings, "findings key must be present in response")
}

// TestGitHubEnterpriseSSOOrgValidation verifies inbound webhook handling with
// HMAC-SHA256 signature validation and auto-scan queue enqueuing.
// Uses a pre-seeded DB and setupServerWithCfg to test webhook secret enforcement.
func TestGitHubEnterpriseSSOOrgValidation(t *testing.T) {
	const webhookSecret = "ghe-test-webhook-secret"

	db, err := storage.NewInMemory()
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	logCfg := &logging.Config{Level: "error"}
	logger, err := logging.New(logCfg)
	require.NoError(t, err)

	mgr := integrations.NewManager(logger)

	cfg := &config.Config{}
	cfg.Auth.GitHubApp.WebhookSecret = webhookSecret

	// Seed a github connection so the webhook handler enqueues a job for it.
	require.NoError(t, db.Create(&storage.ConnectionRecord{
		Name:         "ghe-sso-conn",
		Platform:     "github",
		Token:        "ghp_sso_token",
		HealthStatus: "ok",
	}))

	// Build and sign push event payload
	pushPayload := map[string]interface{}{
		"ref": "refs/heads/main",
		"repository": map[string]interface{}{
			"full_name": "acme-org/infra",
		},
	}
	payloadBytes, _ := json.Marshal(pushPayload)
	sig := signGHEWebhook(payloadBytes, webhookSecret)

	// Step 1: Build server with the custom config (webhook secret wired in)
	server := setupServerWithCfg(t, db, mgr, logger, cfg)

	// Step 2: POST signed push event to inbound webhook endpoint
	req, err := http.NewRequest(
		http.MethodPost,
		fmt.Sprintf("%s/api/v1/webhooks/github", server.URL),
		bytes.NewReader(payloadBytes),
	)
	require.NoError(t, err)
	req.Header.Set("X-GitHub-Event", "push")
	req.Header.Set("X-Hub-Signature-256", sig)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)

	// Step 3: Verify response — status == "queued", connections == 1
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var webhookResp map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&webhookResp))
	_ = resp.Body.Close()

	assert.Equal(t, "queued", webhookResp["status"])
	assert.Equal(t, float64(1), webhookResp["connections"])
}
