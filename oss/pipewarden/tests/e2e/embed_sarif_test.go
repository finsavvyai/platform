package e2e

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/storage"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestMultiConnectionEmbedWidget adds 2 GitHub + 1 GitLab mock connection,
// calls GET /api/v1/embed/findings, and verifies CORS headers + response shape.
func TestMultiConnectionEmbedWidget(t *testing.T) {
	server, _ := setupServer(t)

	// Add 2 GitHub connections
	addConnection(t, server, "embed-gh-1", "github", "ghp_embed1")
	addConnection(t, server, "embed-gh-2", "github", "ghp_embed2")
	// Add 1 GitLab connection
	addConnection(t, server, "embed-gl-1", "gitlab", "glpat-embed1")

	// Call embed findings endpoint
	resp, err := http.Get(fmt.Sprintf("%s/api/v1/embed/findings", server.URL))
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	// Verify CORS header is present (middleware applies to all routes)
	corsHeader := resp.Header.Get("Access-Control-Allow-Origin")
	assert.NotEmpty(t, corsHeader, "Access-Control-Allow-Origin header must be present")

	// Verify response shape
	var body struct {
		Findings []map[string]interface{} `json:"findings"`
		Count    int                      `json:"count"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.NotNil(t, body.Findings, "findings array must be present (may be empty)")
	assert.GreaterOrEqual(t, body.Count, 0, "count must be >= 0")
	assert.Equal(t, len(body.Findings), body.Count, "count must match findings length")
}

// TestSARIFExportEndToEnd runs a heuristic scan via API then exports SARIF and
// validates Content-Type and schema.
func TestSARIFExportEndToEnd(t *testing.T) {
	server, _ := setupServer(t)

	// Add connection and run a quick scan to generate findings
	addConnection(t, server, "sarif-gh", "github", "ghp_sarif_test")

	scanPayload := quickScanPayload("sarif-gh", "run-sarif-001")
	payload, _ := json.Marshal(scanPayload)
	resp, err := http.Post(
		fmt.Sprintf("%s/api/v1/analysis/quick", server.URL),
		"application/json",
		bytes.NewBuffer(payload),
	)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	_ = resp.Body.Close()

	// Export findings as SARIF
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/analysis/findings/export?format=sarif", server.URL))
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	// Verify Content-Type — SARIF responses use the dedicated MIME type
	ct := resp.Header.Get("Content-Type")
	assert.Equal(t, "application/sarif+json", ct, "SARIF export must use application/sarif+json Content-Type")

	// Verify SARIF 2.1.0 schema in response body
	var doc map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&doc))
	assert.Equal(t, "2.1.0", doc["version"], "SARIF version must be 2.1.0")
	runsArr, ok := doc["runs"].([]interface{})
	require.True(t, ok, "SARIF document must have a runs array")
	assert.Greater(t, len(runsArr), 0, "SARIF runs array must not be empty")
}

// TestEmbedSummaryRiskScore inserts findings of multiple severities then verifies
// the embed summary risk_score is 0-100 and total matches the inserted count.
func TestEmbedSummaryRiskScore(t *testing.T) {
	server, db := setupServer(t)

	// Insert findings directly into the DB to control severity distribution
	severities := []string{"critical", "high", "medium", "low"}
	total := 0
	for _, sev := range severities {
		f := &storage.FindingRecord{
			ConnectionName: "summary-test",
			RunID:          "run-summary-001",
			Severity:       sev,
			Category:       "configuration",
			Title:          fmt.Sprintf("Test finding %s", sev),
			Description:    "Auto-inserted by embed summary test",
			Status:         "open",
		}
		require.NoError(t, db.CreateFinding(f))
		total++
	}

	// Call embed summary endpoint
	resp, err := http.Get(fmt.Sprintf("%s/api/v1/embed/summary", server.URL))
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var summary struct {
		RiskScore int `json:"risk_score"`
		Total     int `json:"total"`
		Critical  int `json:"critical"`
		High      int `json:"high"`
		Medium    int `json:"medium"`
		Low       int `json:"low"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&summary))

	// risk_score must be 0-100
	assert.GreaterOrEqual(t, summary.RiskScore, 0, "risk_score must be >= 0")
	assert.LessOrEqual(t, summary.RiskScore, 100, "risk_score must be <= 100")

	// total must match inserted count
	assert.Equal(t, total, summary.Total, "total must match inserted finding count")

	// individual severity counts
	assert.Equal(t, 1, summary.Critical)
	assert.Equal(t, 1, summary.High)
	assert.Equal(t, 1, summary.Medium)
	assert.Equal(t, 1, summary.Low)
}
