package e2e

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newMockGitLabAPIServer returns an httptest.Server that stubs GitLab API v4 endpoints.
func newMockGitLabAPIServer() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("RateLimit-Remaining", "1000")

		switch {
		case r.URL.Path == "/api/v4/user":
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"id": 1, "username": "admin", "name": "Admin User",
			})

		case r.URL.Path == "/api/v4/projects":
			_ = json.NewEncoder(w).Encode([]map[string]interface{}{
				{"id": 1, "name": "project-alpha", "path_with_namespace": "group/project-alpha"},
				{"id": 2, "name": "project-beta", "path_with_namespace": "group/project-beta"},
			})

		// /api/v4/projects/{id}/pipelines/{pid}/jobs
		case strings.Contains(r.URL.Path, "/pipelines/") && strings.HasSuffix(r.URL.Path, "/jobs"):
			_ = json.NewEncoder(w).Encode([]map[string]interface{}{
				{"id": 101, "name": "build", "status": "success",
					"artifacts_file": map[string]interface{}{"filename": "artifacts.zip", "size": 1024}},
				{"id": 102, "name": "test", "status": "failed"},
			})

		// /api/v4/projects/{id}/pipelines/{pid} — single pipeline run
		case strings.Contains(r.URL.Path, "/pipelines/"):
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"id": 10, "status": "failed", "ref": "main", "sha": "aaa111",
				"web_url":     "https://gitlab.example.com/group/project/-/pipelines/10",
				"created_at":  "2026-04-01T00:00:00Z",
				"updated_at":  "2026-04-01T00:05:00Z",
				"started_at":  "2026-04-01T00:01:00Z",
				"finished_at": "2026-04-01T00:05:00Z",
			})

		// /api/v4/projects/{id}/pipelines — list
		case strings.Contains(r.URL.Path, "/pipelines"):
			_ = json.NewEncoder(w).Encode([]map[string]interface{}{
				{"id": 10, "status": "failed", "ref": "main", "sha": "aaa111"},
				{"id": 11, "status": "success", "ref": "main", "sha": "bbb222"},
				{"id": 12, "status": "success", "ref": "feat/x", "sha": "ccc333"},
			})

		default:
			http.NotFound(w, r)
		}
	}))
}

// setupServerWithGitLab creates a PipeWarden test server and returns both the
// app server URL and the mock GitLab base URL (the api/v4 prefix is included).
func setupServerWithGitLab(t *testing.T) (appServer *httptest.Server, glBaseURL string) {
	t.Helper()
	glMock := newMockGitLabAPIServer()
	appServer, _ = setupServer(t)
	// GitLab provider appends /api/v4 internally only when base_url doesn't already have it.
	// Pass the full base including /api/v4 so the mock routes match exactly.
	glBaseURL = glMock.URL + "/api/v4"
	t.Cleanup(glMock.Close)
	return appServer, glBaseURL
}

// addGitLabConnection is a helper that creates a GitLab connection pointing at mockURL.
func addGitLabConnection(t *testing.T, server *httptest.Server, name, mockBaseURL string) {
	t.Helper()
	payload, _ := json.Marshal(map[string]interface{}{
		"name":     name,
		"platform": "gitlab",
		"token":    "glpat-test-token",
		"base_url": mockBaseURL,
	})
	resp, err := http.Post(
		fmt.Sprintf("%s/api/v1/connections", server.URL),
		"application/json",
		bytes.NewBuffer(payload),
	)
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, resp.StatusCode, "failed to create GitLab connection %q", name)
	_ = resp.Body.Close()
}

// TestGitLabAdminEndToEnd exercises the full admin journey via the HTTP API.
func TestGitLabAdminEndToEnd(t *testing.T) {
	server, glBaseURL := setupServerWithGitLab(t)
	connName := "gitlab-admin"

	// Step 1 — create connection
	addGitLabConnection(t, server, connName, glBaseURL)

	// Step 2 — verify connection exists
	resp, err := http.Get(fmt.Sprintf("%s/api/v1/connections/%s", server.URL, connName))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var connResp map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&connResp))
	assert.NotNil(t, connResp)
	_ = resp.Body.Close()

	// Step 3 — run heuristic analysis
	scanPayload, _ := json.Marshal(quickScanPayload(connName, "gl-run-1"))
	resp, err = http.Post(
		fmt.Sprintf("%s/api/v1/analysis/quick", server.URL),
		"application/json", bytes.NewBuffer(scanPayload),
	)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode, "heuristic scan should succeed")
	_ = resp.Body.Close()

	// Step 4 — get findings
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/analysis/findings?connection=%s", server.URL, connName))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var findingsResp struct {
		Findings []map[string]interface{} `json:"findings"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&findingsResp))
	assert.NotNil(t, findingsResp.Findings, "findings array must exist")
	_ = resp.Body.Close()

	// Step 5 — SARIF export
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/analysis/findings/export?format=sarif&connection=%s", server.URL, connName))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var sarifDoc map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&sarifDoc))
	assert.Equal(t, "2.1.0", sarifDoc["version"], "SARIF version must be 2.1.0")
	_, hasRuns := sarifDoc["runs"]
	assert.True(t, hasRuns, "SARIF must have runs array")
	_ = resp.Body.Close()

	// Step 6 — SBOM endpoint
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/connections/%s/sbom", server.URL, connName))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var sbomDoc map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&sbomDoc))
	assert.Equal(t, "CycloneDX", sbomDoc["bomFormat"], "SBOM must use CycloneDX format")
	_ = resp.Body.Close()

	// Step 7 — compliance SOC2 report
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/compliance/soc2?connection=%s", server.URL, connName))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var complianceDoc map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&complianceDoc))
	summary, hasSummary := complianceDoc["summary"].(map[string]interface{})
	require.True(t, hasSummary, "compliance report must have summary")
	score, _ := summary["score"].(float64)
	assert.GreaterOrEqual(t, int(score), 0)
	assert.LessOrEqual(t, int(score), 100)
	_ = resp.Body.Close()

	// Step 8 — set scan schedule
	schedPayload, _ := json.Marshal(map[string]interface{}{
		"cron_expr": "0 */6 * * *", "enabled": true, "notify_on": "findings_only",
	})
	resp, err = http.Post(
		fmt.Sprintf("%s/api/v1/connections/%s/schedule", server.URL, connName),
		"application/json", bytes.NewBuffer(schedPayload),
	)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode, "schedule set should return 200")
	_ = resp.Body.Close()

	// Step 9 — retrieve schedule and verify cron_expr
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/connections/%s/schedule", server.URL, connName))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var schedDoc map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&schedDoc))
	assert.Equal(t, "0 */6 * * *", schedDoc["cron_expr"], "cron_expr must match what was set")
	_ = resp.Body.Close()
}
