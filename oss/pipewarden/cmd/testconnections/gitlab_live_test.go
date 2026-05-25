//go:build integration

package main

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/integrations/gitlab"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newGitLabClient(t *testing.T) *gitlab.Client {
	t.Helper()
	token := os.Getenv("GITLAB_TOKEN")
	baseURL := os.Getenv("GITLAB_URL")
	if token == "" {
		t.Skip("GITLAB_TOKEN not set — skipping live GitLab test")
	}
	logger, err := logging.New(&config.LoggingConfig{Level: "info"})
	require.NoError(t, err)
	return gitlab.NewClient(gitlab.Config{Token: token, BaseURL: baseURL}, logger)
}

// TestGitLabLiveConnection verifies real GitLab API access via env credentials.
func TestGitLabLiveConnection(t *testing.T) {
	client := newGitLabClient(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// TestConnection
	status, err := client.TestConnection(ctx)
	require.NoError(t, err, "TestConnection should not error")
	require.True(t, status.Connected, "should be connected: %s", status.Message)
	assert.NotEmpty(t, status.User, "user should be populated")
	assert.True(t, status.RateLimitOK, "rate limit should be OK")
	assert.NotZero(t, status.Latency, "latency should be measured")
	t.Logf("Connected as %q, scopes=%v, latency=%v", status.User, status.Scopes, status.Latency)

	// ListPipelines
	owner := os.Getenv("GITLAB_OWNER")
	repo := os.Getenv("GITLAB_REPO")
	if owner == "" || repo == "" {
		t.Log("GITLAB_OWNER/GITLAB_REPO not set — skipping ListPipelines/ListPipelineRuns")
		return
	}

	pipelines, err := client.ListPipelines(ctx, owner, repo)
	require.NoError(t, err, "ListPipelines should not error")
	t.Logf("Found %d pipelines", len(pipelines))

	// ListPipelineRuns
	runs, err := client.ListPipelineRuns(ctx, owner, repo, 5)
	require.NoError(t, err, "ListPipelineRuns should not error")
	t.Logf("Found %d pipeline runs", len(runs))
}

// TestGitLabLiveSARIFExport runs a heuristic scan on a GitLab run and validates SARIF output.
func TestGitLabLiveSARIFExport(t *testing.T) {
	client := newGitLabClient(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	owner := os.Getenv("GITLAB_OWNER")
	repo := os.Getenv("GITLAB_REPO")
	if owner == "" || repo == "" {
		t.Skip("GITLAB_OWNER/GITLAB_REPO not set — skipping SARIF export test")
	}

	// Fetch a real pipeline run to scan
	runs, err := client.ListPipelineRuns(ctx, owner, repo, 1)
	require.NoError(t, err)
	if len(runs) == 0 {
		t.Skip("no pipeline runs available for SARIF export test")
	}
	run := runs[0]

	// Run heuristic scan
	analyzer := analysis.NewHeuristicAnalyzer()
	conn := &integrations.Connection{Name: "gitlab-live", Platform: integrations.PlatformGitLab}
	result := analyzer.AnalyzeRun(conn, &run)
	require.NotNil(t, result, "analysis result should not be nil")
	assert.GreaterOrEqual(t, result.RiskScore, 0)
	assert.LessOrEqual(t, result.RiskScore, 100)
	t.Logf("Risk score: %d, findings: %d", result.RiskScore, len(result.Findings))

	// Export to SARIF
	sarifResult := result.ToSARIF()
	raw, err := json.Marshal(sarifResult)
	require.NoError(t, err, "SARIF marshal should not error")

	// Validate SARIF schema
	var doc map[string]interface{}
	require.NoError(t, json.Unmarshal(raw, &doc))
	assert.Equal(t, "2.1.0", doc["version"], "SARIF version must be 2.1.0")
	schema, _ := doc["$schema"].(string)
	assert.True(t, strings.Contains(schema, "sarif") || schema == "",
		"$schema should reference sarif if present")
	runs2, ok := doc["runs"].([]interface{})
	require.True(t, ok, "SARIF must have runs array")
	assert.Greater(t, len(runs2), 0, "SARIF runs array must not be empty")
	t.Logf("SARIF output: %d bytes, %d runs", len(raw), len(runs2))
}
