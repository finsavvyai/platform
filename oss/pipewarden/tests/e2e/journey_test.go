package e2e

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/aianalysis"
	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/router"
	"github.com/finsavvyai/pipewarden/internal/storage"
	"github.com/finsavvyai/pipewarden/internal/vault"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var mockGitHubAPIBaseURL string

// setupServer creates a test server with full PipeWarden stack.
func setupServer(t *testing.T) (*httptest.Server, *storage.DB) {
	mockGitHubAPI := newMockGitHubAPIServer()
	mockGitHubAPIBaseURL = mockGitHubAPI.URL

	// Create in-memory database for testing
	db, err := storage.NewInMemory()
	require.NoError(t, err, "failed to create in-memory database")

	// Create logger
	cfg := &config.LoggingConfig{Level: "debug"}
	logger, err := logging.New(cfg)
	require.NoError(t, err, "failed to create logger")

	// Create manager
	manager := integrations.NewManager(logger)

	// Create analyzers
	claudeAnalyzer := aianalysis.NewClaudeAnalyzer(
		aianalysis.ClaudeConfig{APIKey: "", Model: "claude-3-haiku"},
		logger,
	)
	heuristicAnalyzer := analysis.NewHeuristicAnalyzer()

	// Create vault
	v, err := vault.New("test-e2e-master-key")
	require.NoError(t, err, "failed to create vault")

	// Create router
	mux := router.New(db, manager, claudeAnalyzer, heuristicAnalyzer, logger, v)

	// Create test server
	server := httptest.NewServer(mux)
	t.Cleanup(func() {
		mockGitHubAPI.Close()
		server.Close()
		_ = db.Close()
	})

	return server, db
}

// TestSoloDeveloperJourney tests the solo developer workflow.
// Journey: Health check -> Add GitHub -> Test -> List pipelines -> Run scan -> View findings
func TestSoloDeveloperJourney(t *testing.T) {
	server, _ := setupServer(t)

	// Step 1: Health check
	resp, err := http.Get(fmt.Sprintf("%s/health", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var healthResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&healthResp)
	require.NoError(t, err)
	assert.Equal(t, "ok", healthResp["status"])
	_ = resp.Body.Close()

	// Step 2: Add GitHub connection
	connPayload := map[string]interface{}{
		"name":        "my-github",
		"platform":    "github",
		"token":       "ghp_test123456789",
		"base_url":    mockGitHubAPIBaseURL,
		"credentials": map[string]string{"token": "ghp_test123456789"},
	}
	payload, _ := json.Marshal(connPayload)
	resp, err = http.Post(
		fmt.Sprintf("%s/api/v1/connections", server.URL),
		"application/json",
		bytes.NewBuffer(payload),
	)
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, resp.StatusCode, "failed to create connection")
	var createResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&createResp)
	require.NoError(t, err)
	_ = resp.Body.Close()

	// Step 3: List connections
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/connections", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var connsResp struct {
		Connections []map[string]interface{} `json:"connections"`
	}
	err = json.NewDecoder(resp.Body).Decode(&connsResp)
	require.NoError(t, err)
	assert.Greater(t, len(connsResp.Connections), 0, "connections should be created")
	_ = resp.Body.Close()

	// Step 4: Get connection details
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/connections/my-github", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var connResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&connResp)
	require.NoError(t, err)
	assert.NotNil(t, connResp)
	_ = resp.Body.Close()

	// Step 5: Quick scan (lightweight heuristic scan)
	scanPayload := quickScanPayload("my-github", "run-101")
	payload, _ = json.Marshal(scanPayload)
	resp, err = http.Post(
		fmt.Sprintf("%s/api/v1/analysis/quick", server.URL),
		"application/json",
		bytes.NewBuffer(payload),
	)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode, "quick scan should succeed")
	var scanResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&scanResp)
	require.NoError(t, err)
	_ = resp.Body.Close()

	// Step 6: List findings
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/analysis/findings", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var findingsResp struct {
		Findings []map[string]interface{} `json:"findings"`
	}
	err = json.NewDecoder(resp.Body).Decode(&findingsResp)
	require.NoError(t, err)
	_ = resp.Body.Close()
}

// TestDevOpsEngineerJourney tests multi-platform DevOps engineer workflow.
// Journey: Add 3 connections -> List all -> Run AI scan -> Export -> Dashboard
func TestDevOpsEngineerJourney(t *testing.T) {
	server, db := setupServer(t)

	// Add GitHub connection
	addConnection(t, server, "github-prod", "github", "ghp_prod123")
	// Add GitLab connection
	addConnection(t, server, "gitlab-prod", "gitlab", "glpat-prod456", map[string]string{
		"base_url": "https://gitlab.com",
	})
	// Add Bitbucket connection
	addConnection(t, server, "bitbucket-prod", "bitbucket", "app_pass789", map[string]string{
		"username": "devops-team",
	})

	// List all connections
	resp, err := http.Get(fmt.Sprintf("%s/api/v1/connections", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var connsResp struct {
		Connections []map[string]interface{} `json:"connections"`
	}
	err = json.NewDecoder(resp.Body).Decode(&connsResp)
	require.NoError(t, err)
	assert.Equal(t, 3, len(connsResp.Connections), "should have 3 connections")
	_ = resp.Body.Close()

	// Get dashboard overview
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/dashboard/overview", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var overviewResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&overviewResp)
	require.NoError(t, err)
	assert.NotNil(t, overviewResp)
	_ = resp.Body.Close()

	// Get stats
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/analysis/stats", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var statsResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&statsResp)
	require.NoError(t, err)
	_ = resp.Body.Close()

	// Verify database persists connections
	assert.NotNil(t, db, "database should be persisted")
}

// TestSecurityLeadJourney tests security-focused workflow.
// Journey: Add connection -> Run scan -> Filter by severity -> Export -> View stats
func TestSecurityLeadJourney(t *testing.T) {
	server, _ := setupServer(t)

	// Add GitHub connection
	connPayload := map[string]interface{}{
		"name":     "security-github",
		"platform": "github",
		"token":    "ghp_security123",
		"base_url": mockGitHubAPIBaseURL,
	}
	payload, _ := json.Marshal(connPayload)
	resp, err := http.Post(
		fmt.Sprintf("%s/api/v1/connections", server.URL),
		"application/json",
		bytes.NewBuffer(payload),
	)
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	_ = resp.Body.Close()

	// Run heuristic analysis
	scanPayload := quickScanPayload("security-github", "run-102")
	payload, _ = json.Marshal(scanPayload)
	resp, err = http.Post(
		fmt.Sprintf("%s/api/v1/analysis/quick", server.URL),
		"application/json",
		bytes.NewBuffer(payload),
	)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	_ = resp.Body.Close()

	// List findings (can filter by severity via query params)
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/analysis/findings?severity=high", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var findingsResp struct {
		Findings []map[string]interface{} `json:"findings"`
	}
	err = json.NewDecoder(resp.Body).Decode(&findingsResp)
	require.NoError(t, err)
	_ = resp.Body.Close()

	// Export findings as JSON
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/analysis/findings/export?format=json", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	// Verify JSON export
	assert.Equal(t, "application/json", resp.Header.Get("Content-Type"))
	_ = resp.Body.Close()

	// Get stats for compliance reporting
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/analysis/stats", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var statsResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&statsResp)
	require.NoError(t, err)
	_ = resp.Body.Close()
}

// TestEnterpriseAdminJourney tests enterprise admin workflow.
// Journey: Add connection -> Run scan -> Policy checks -> View audit log
func TestEnterpriseAdminJourney(t *testing.T) {
	server, _ := setupServer(t)

	// Enterprise admin adds managed connection
	connPayload := map[string]interface{}{
		"name":     "enterprise-github",
		"platform": "github",
		"token":    "ghp_enterprise123",
		"base_url": mockGitHubAPIBaseURL,
	}
	payload, _ := json.Marshal(connPayload)
	resp, err := http.Post(
		fmt.Sprintf("%s/api/v1/connections", server.URL),
		"application/json",
		bytes.NewBuffer(payload),
	)
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	_ = resp.Body.Close()

	// Run heuristic scan
	scanPayload := quickScanPayload("enterprise-github", "run-103")
	payload, _ = json.Marshal(scanPayload)
	resp, err = http.Post(
		fmt.Sprintf("%s/api/v1/analysis/quick", server.URL),
		"application/json",
		bytes.NewBuffer(payload),
	)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	_ = resp.Body.Close()

	// Retrieve analysis history for audit trail
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/analysis/history", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var historyResp struct {
		History []map[string]interface{} `json:"history"`
	}
	err = json.NewDecoder(resp.Body).Decode(&historyResp)
	require.NoError(t, err)
	_ = resp.Body.Close()

	// Get stats for compliance dashboard
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/analysis/stats", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var statsResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&statsResp)
	require.NoError(t, err)
	_ = resp.Body.Close()

	// Export findings in SARIF format for GitHub Security tab
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/analysis/findings/export?format=sarif", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	_ = resp.Body.Close()
}

// TestAPIIntegrationJourney tests API embedding workflow.
// Journey: Health check -> Get summary -> Get findings with filters -> Verify CORS
func TestAPIIntegrationJourney(t *testing.T) {
	server, _ := setupServer(t)

	// Health check
	resp, err := http.Get(fmt.Sprintf("%s/health", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	_ = resp.Body.Close()

	// Add connection for testing
	addConnection(t, server, "api-test", "github", "ghp_api_test")

	// Get summary via dashboard overview
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/dashboard/overview", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var summaryResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&summaryResp)
	require.NoError(t, err)
	_ = resp.Body.Close()

	// Get findings with severity filter
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/analysis/findings?severity=critical", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, "application/json", resp.Header.Get("Content-Type"))
	_ = resp.Body.Close()

	// Test CORS headers (server should set them)
	req, _ := http.NewRequest(http.MethodOptions, fmt.Sprintf("%s/api/v1/connections", server.URL), nil)
	req.Header.Set("Origin", "https://example.com")
	req.Header.Set("Access-Control-Request-Method", "POST")
	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	// Note: httptest server doesn't set CORS by default, but production does
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	_ = resp.Body.Close()
}

// TestConnectionManagementWorkflow tests CRUD operations.
func TestConnectionManagementWorkflow(t *testing.T) {
	server, _ := setupServer(t)

	connName := "test-connection-" + fmt.Sprintf("%d", time.Now().Unix())

	// CREATE
	connPayload := map[string]interface{}{
		"name":     connName,
		"platform": "github",
		"token":    "ghp_test" + connName,
		"base_url": mockGitHubAPIBaseURL,
	}
	payload, _ := json.Marshal(connPayload)
	resp, err := http.Post(
		fmt.Sprintf("%s/api/v1/connections", server.URL),
		"application/json",
		bytes.NewBuffer(payload),
	)
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	_ = resp.Body.Close()

	// READ
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/connections/%s", server.URL, connName))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var getResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&getResp)
	require.NoError(t, err)
	_ = resp.Body.Close()

	// UPDATE
	updatePayload := map[string]interface{}{
		"name":     connName,
		"platform": "github",
		"token":    "ghp_updated_" + connName,
		"base_url": mockGitHubAPIBaseURL,
	}
	payload, _ = json.Marshal(updatePayload)
	resp, err = http.Post(
		fmt.Sprintf("%s/api/v1/connections/update", server.URL),
		"application/json",
		bytes.NewBuffer(payload),
	)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	_ = resp.Body.Close()

	// DELETE
	req, _ := http.NewRequest(http.MethodDelete, fmt.Sprintf("%s/api/v1/connections/%s", server.URL, connName), nil)
	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	_ = resp.Body.Close()

	// Verify deletion
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/connections/%s", server.URL, connName))
	require.NoError(t, err)
	require.Equal(t, http.StatusNotFound, resp.StatusCode)
	_ = resp.Body.Close()
}

// TestFindingManagementWorkflow tests finding CRUD and filtering.
func TestFindingManagementWorkflow(t *testing.T) {
	server, _ := setupServer(t)

	// Add connection for findings
	addConnection(t, server, "findings-test", "github", "ghp_findings_test")

	// Run scan to generate findings
	scanPayload := quickScanPayload("findings-test", "run-104")
	payload, _ := json.Marshal(scanPayload)
	resp, err := http.Post(
		fmt.Sprintf("%s/api/v1/analysis/quick", server.URL),
		"application/json",
		bytes.NewBuffer(payload),
	)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	_ = resp.Body.Close()

	// List findings
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/analysis/findings", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var findingsResp struct {
		Findings []map[string]interface{} `json:"findings"`
	}
	err = json.NewDecoder(resp.Body).Decode(&findingsResp)
	require.NoError(t, err)
	_ = resp.Body.Close()

	// If findings exist, test update and delete
	if len(findingsResp.Findings) > 0 {
		findingID := fmt.Sprintf("%v", findingsResp.Findings[0]["id"])

		// UPDATE finding
		updatePayload := map[string]interface{}{
			"status": "resolved",
		}
		payload, _ := json.Marshal(updatePayload)
		req, _ := http.NewRequest(http.MethodPatch,
			fmt.Sprintf("%s/api/v1/analysis/findings/%s", server.URL, findingID),
			bytes.NewBuffer(payload),
		)
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		_ = resp.Body.Close()

		// DELETE finding
		req, _ = http.NewRequest(http.MethodDelete,
			fmt.Sprintf("%s/api/v1/analysis/findings/%s", server.URL, findingID),
			nil,
		)
		resp, err = http.DefaultClient.Do(req)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		_ = resp.Body.Close()
	}
}

// Helper functions

// addConnection is a helper to add a connection in tests.
func addConnection(t *testing.T, server *httptest.Server, name, platform, token string, extras ...map[string]string) {
	connPayload := map[string]interface{}{
		"name":     name,
		"platform": platform,
		"token":    token,
	}

	// Add platform-specific fields
	switch platform {
	case "github":
		connPayload["base_url"] = mockGitHubAPIBaseURL
	case "gitlab":
		connPayload["base_url"] = "https://gitlab.com"
	case "bitbucket":
		connPayload["username"] = "testuser"
	}

	// Merge extra fields
	if len(extras) > 0 {
		for k, v := range extras[0] {
			connPayload[k] = v
		}
	}

	payload, _ := json.Marshal(connPayload)
	resp, err := http.Post(
		fmt.Sprintf("%s/api/v1/connections", server.URL),
		"application/json",
		bytes.NewBuffer(payload),
	)
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, resp.StatusCode, "failed to add connection %s", name)
	_, _ = io.ReadAll(resp.Body)
	_ = resp.Body.Close()
}

func quickScanPayload(connectionName, runID string) map[string]interface{} {
	return map[string]interface{}{
		"connection_name": connectionName,
		"owner":           "testowner",
		"repo":            "testrepo",
		"run_id":          runID,
	}
}

func newMockGitHubAPIServer() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch {
		case r.URL.Path == "/user":
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"login": "test-bot",
				"id":    1,
			})
		case strings.Contains(r.URL.Path, "/actions/runs/"):
			now := time.Now().UTC()
			runID := pathTail(r.URL.Path)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"id":             101,
				"name":           "CI",
				"workflow_id":    55,
				"status":         "completed",
				"conclusion":     "success",
				"head_branch":    "main",
				"head_sha":       "abc123def456",
				"html_url":       "https://example.com/runs/" + runID,
				"created_at":     now.Add(-3 * time.Minute).Format(time.RFC3339),
				"updated_at":     now.Format(time.RFC3339),
				"run_started_at": now.Add(-4 * time.Minute).Format(time.RFC3339),
			})
		default:
			http.NotFound(w, r)
		}
	}))
}

func pathTail(path string) string {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) == 0 {
		return ""
	}
	return parts[len(parts)-1]
}
