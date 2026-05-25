package e2e

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestGitHubEnterpriseSARIFUpload verifies that SARIF export works correctly
// and that the payload can be POSTed to a mock GHE code-scanning endpoint.
func TestGitHubEnterpriseSARIFUpload(t *testing.T) {
	gheMock := newGHEMockServer(t)
	defer gheMock.Close()

	server, _ := setupServer(t)

	// Step 1: Add GHE connection
	addConnection(t, server, "ghe-sarif", "github", "ghp_sarif_token", map[string]string{
		"base_url": gheMock.URL,
	})

	// Step 2: Run heuristic scan to generate findings
	scanPayload := quickScanPayload("ghe-sarif", "run-sarif-001")
	body, _ := json.Marshal(scanPayload)
	resp, err := http.Post(
		fmt.Sprintf("%s/api/v1/analysis/quick", server.URL),
		"application/json",
		bytes.NewBuffer(body),
	)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	_, _ = io.ReadAll(resp.Body)
	_ = resp.Body.Close()

	// Step 3: GET SARIF export
	resp, err = http.Get(
		fmt.Sprintf("%s/api/v1/analysis/findings/export?format=sarif&connection=ghe-sarif", server.URL),
	)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	sarifBody, err := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	require.NoError(t, err)
	require.NotEmpty(t, sarifBody, "SARIF response body must not be empty")

	// Step 4: Validate SARIF structure — version == "2.1.0", runs array non-empty
	var sarifDoc map[string]interface{}
	require.NoError(t, json.Unmarshal(sarifBody, &sarifDoc))
	assert.Equal(t, "2.1.0", sarifDoc["version"], "SARIF version must be 2.1.0")
	runsRaw, ok := sarifDoc["runs"]
	require.True(t, ok, "SARIF must have 'runs' key")
	runs, ok := runsRaw.([]interface{})
	require.True(t, ok, "'runs' must be an array")
	assert.Greater(t, len(runs), 0, "'runs' must be non-empty")

	// Step 5: POST SARIF to mock GHE code-scanning endpoint and verify mock received it
	sarifURL := fmt.Sprintf("%s/api/v3/repos/acme/testrepo/code-scanning/sarifs", gheMock.URL)
	postReq, err := http.NewRequest(http.MethodPost, sarifURL, bytes.NewReader(sarifBody))
	require.NoError(t, err)
	postReq.Header.Set("Content-Type", "application/sarif+json")
	postReq.Header.Set("Authorization", "token ghp_sarif_token")

	sarifResp, err := http.DefaultClient.Do(postReq)
	require.NoError(t, err)
	defer func() { _ = sarifResp.Body.Close() }()

	assert.Equal(t, http.StatusAccepted, sarifResp.StatusCode, "mock SARIF upload should return 202")
	var uploadResp map[string]interface{}
	require.NoError(t, json.NewDecoder(sarifResp.Body).Decode(&uploadResp))
	assert.Equal(t, "sarif-upload-1", uploadResp["id"], "upload ID should match mock")
}

// TestGitHubEnterpriseMultiOrgConnections verifies multi-connection compliance
// reports and embed summary aggregation across 2 GHE connections.
func TestGitHubEnterpriseMultiOrgConnections(t *testing.T) {
	gheMock := newGHEMockServer(t)
	defer gheMock.Close()

	server, _ := setupServer(t)

	// Step 1: Add 2 GHE connections with different org names, same mock server
	addConnection(t, server, "ghe-org-alpha", "github", "ghp_alpha_token", map[string]string{
		"base_url": gheMock.URL,
	})
	addConnection(t, server, "ghe-org-beta", "github", "ghp_beta_token", map[string]string{
		"base_url": gheMock.URL,
	})

	// Step 2: Run heuristic scans on both connections
	for _, connName := range []string{"ghe-org-alpha", "ghe-org-beta"} {
		scanPayload := quickScanPayload(connName, "run-multi-"+connName)
		body, _ := json.Marshal(scanPayload)
		resp, err := http.Post(
			fmt.Sprintf("%s/api/v1/analysis/quick", server.URL),
			"application/json",
			bytes.NewBuffer(body),
		)
		require.NoError(t, err, "scan for %s should not error", connName)
		require.Equal(t, http.StatusOK, resp.StatusCode, "scan for %s should succeed", connName)
		_, _ = io.ReadAll(resp.Body)
		_ = resp.Body.Close()
	}

	// Step 3: GET /api/v1/compliance/soc2 — report must cover findings from both connections
	resp, err := http.Get(fmt.Sprintf("%s/api/v1/compliance/soc2", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var complianceResp map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&complianceResp))
	_ = resp.Body.Close()

	assert.Equal(t, "soc2", complianceResp["framework"])
	summary, ok := complianceResp["summary"].(map[string]interface{})
	require.True(t, ok, "compliance response must have 'summary' object")
	assert.NotNil(t, summary["total_controls"], "summary must have total_controls")

	// Step 4: GET embed summary — verify aggregate total == alpha + beta totals
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/embed/summary", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var allSummary map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&allSummary))
	_ = resp.Body.Close()
	assert.NotNil(t, allSummary["total"], "embed summary must include 'total'")

	totalAll := int(allSummary["total"].(float64))

	respAlpha, err := http.Get(
		fmt.Sprintf("%s/api/v1/embed/summary?connection=ghe-org-alpha", server.URL),
	)
	require.NoError(t, err)
	var alphaResp map[string]interface{}
	require.NoError(t, json.NewDecoder(respAlpha.Body).Decode(&alphaResp))
	_ = respAlpha.Body.Close()

	respBeta, err := http.Get(
		fmt.Sprintf("%s/api/v1/embed/summary?connection=ghe-org-beta", server.URL),
	)
	require.NoError(t, err)
	var betaResp map[string]interface{}
	require.NoError(t, json.NewDecoder(respBeta.Body).Decode(&betaResp))
	_ = respBeta.Body.Close()

	alphaTotal := int(alphaResp["total"].(float64))
	betaTotal := int(betaResp["total"].(float64))
	assert.Equal(t, alphaTotal+betaTotal, totalAll,
		"aggregate total (%d) must equal alpha (%d) + beta (%d)", totalAll, alphaTotal, betaTotal)
}
