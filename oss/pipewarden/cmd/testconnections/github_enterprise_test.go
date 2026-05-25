//go:build integration

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	ghprovider "github.com/finsavvyai/pipewarden/internal/integrations/github"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newGHEClient(t *testing.T) *ghprovider.Client {
	t.Helper()
	token := os.Getenv("GITHUB_ENTERPRISE_TOKEN")
	baseURL := os.Getenv("GITHUB_ENTERPRISE_URL")
	if token == "" || baseURL == "" {
		t.Skip("GITHUB_ENTERPRISE_TOKEN or GITHUB_ENTERPRISE_URL not set — skipping GHE test")
	}
	logger, err := logging.New(&config.LoggingConfig{Level: "info"})
	require.NoError(t, err)
	return ghprovider.NewClient(ghprovider.Config{Token: token, BaseURL: baseURL}, logger)
}

// TestGitHubEnterpriseConnection tests connection to a GitHub Enterprise API.
func TestGitHubEnterpriseConnection(t *testing.T) {
	client := newGHEClient(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	status, err := client.TestConnection(ctx)
	require.NoError(t, err, "TestConnection should not error")
	require.True(t, status.Connected, "should be connected: %s", status.Message)
	assert.Equal(t, integrations.PlatformGitHub, status.Platform)
	assert.NotEmpty(t, status.User, "user should be populated")
	assert.True(t, status.RateLimitOK, "rate limit should be OK")
	t.Logf("GHE connected as %q, latency=%v", status.User, status.Latency)
}

// TestGitHubEnterpriseSSOFlow verifies that the token has org-level access (SSO).
func TestGitHubEnterpriseSSOFlow(t *testing.T) {
	client := newGHEClient(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	orgName := os.Getenv("GITHUB_ENTERPRISE_ORG")
	if orgName == "" {
		t.Skip("GITHUB_ENTERPRISE_ORG not set — skipping SSO org check")
	}

	// TestConnection validates the token itself; scopes reflect SSO-authorised access
	status, err := client.TestConnection(ctx)
	require.NoError(t, err)
	require.True(t, status.Connected, "token must be valid for SSO org check")

	// Attempt to list pipelines in the org to confirm org membership access
	_, err = client.ListPipelines(ctx, orgName, os.Getenv("GITHUB_ENTERPRISE_REPO"))
	// A missing repo env var is fine; a 401/403 would surface as an error
	if os.Getenv("GITHUB_ENTERPRISE_REPO") == "" {
		t.Log("GITHUB_ENTERPRISE_REPO not set — skipping ListPipelines org check")
		return
	}
	assert.NoError(t, err, "org-level access should work with SSO-authorised token")
	t.Logf("SSO org access confirmed for org=%s", orgName)
}

// TestGitHubEnterpriseSARIF runs a scan and validates the SARIF payload
// that would be uploaded to the GHE Security tab (upload endpoint is mocked).
func TestGitHubEnterpriseSARIF(t *testing.T) {
	client := newGHEClient(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	owner := os.Getenv("GITHUB_ENTERPRISE_ORG")
	repo := os.Getenv("GITHUB_ENTERPRISE_REPO")
	if owner == "" || repo == "" {
		t.Skip("GITHUB_ENTERPRISE_ORG/GITHUB_ENTERPRISE_REPO not set")
	}

	// Fetch a real run to scan
	runs, err := client.ListPipelineRuns(ctx, owner, repo, 1)
	require.NoError(t, err)
	if len(runs) == 0 {
		t.Skip("no pipeline runs available for GHE SARIF test")
	}
	run := runs[0]

	// Heuristic scan
	analyzer := analysis.NewHeuristicAnalyzer()
	conn := &integrations.Connection{Name: "ghe-live", Platform: integrations.PlatformGitHub}
	result := analyzer.AnalyzeRun(conn, &run)
	require.NotNil(t, result)

	// Build SARIF payload
	sarifDoc := result.ToSARIF()
	payload, err := json.Marshal(sarifDoc)
	require.NoError(t, err)

	// Mock GHE Security tab SARIF upload endpoint
	var received []byte
	mockUpload := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
		received, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusAccepted)
		fmt.Fprint(w, `{"id":1}`)
	}))
	defer mockUpload.Close()

	// Simulate upload to GHE code-scanning SARIF endpoint
	uploadURL := fmt.Sprintf("%s/repos/%s/%s/code-scanning/sarifs", mockUpload.URL, owner, repo)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, uploadURL, bytes.NewReader(payload))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+os.Getenv("GITHUB_ENTERPRISE_TOKEN"))

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()
	assert.Equal(t, http.StatusAccepted, resp.StatusCode)

	// Validate the payload that was sent
	require.NotEmpty(t, received, "upload payload must not be empty")
	var doc map[string]interface{}
	require.NoError(t, json.Unmarshal(received, &doc))
	assert.Equal(t, "2.1.0", doc["version"], "SARIF version must be 2.1.0")
	runsArr, ok := doc["runs"].([]interface{})
	require.True(t, ok, "SARIF must have runs array")
	assert.Greater(t, len(runsArr), 0, "SARIF runs must not be empty")
	t.Logf("GHE SARIF upload validated: %d bytes, risk=%d", len(payload), result.RiskScore)
}
