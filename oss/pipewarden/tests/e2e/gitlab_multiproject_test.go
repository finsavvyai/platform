package e2e

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestGitLabMultiProjectScan runs heuristic analysis on 3 GitLab connections concurrently
// and verifies the embed widget aggregates findings across all of them.
func TestGitLabMultiProjectScan(t *testing.T) {
	server, glBaseURL := setupServerWithGitLab(t)

	projects := []string{"gitlab-proj-1", "gitlab-proj-2", "gitlab-proj-3"}
	for _, name := range projects {
		addGitLabConnection(t, server, name, glBaseURL)
	}

	// Run heuristic scans concurrently.
	type scanResult struct {
		name string
		code int
	}
	results := make([]scanResult, len(projects))
	var wg sync.WaitGroup
	for i, name := range projects {
		wg.Add(1)
		go func(idx int, connName string) {
			defer wg.Done()
			payload, _ := json.Marshal(quickScanPayload(connName, fmt.Sprintf("gl-run-%d", idx+10)))
			resp, err := http.Post(
				fmt.Sprintf("%s/api/v1/analysis/quick", server.URL),
				"application/json", bytes.NewBuffer(payload),
			)
			if err != nil {
				results[idx] = scanResult{name: connName, code: 0}
				return
			}
			_ = resp.Body.Close()
			results[idx] = scanResult{name: connName, code: resp.StatusCode}
		}(i, name)
	}
	wg.Wait()

	// All scans must have succeeded.
	for _, r := range results {
		assert.Equal(t, http.StatusOK, r.code, "scan for %q should return 200", r.name)
	}

	// Verify each connection has a findings array.
	totalFindings := 0
	for _, name := range projects {
		resp, err := http.Get(fmt.Sprintf("%s/api/v1/analysis/findings?connection=%s", server.URL, name))
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		var fr struct {
			Findings []map[string]interface{} `json:"findings"`
			Count    float64                  `json:"count"`
		}
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&fr))
		totalFindings += int(fr.Count)
		_ = resp.Body.Close()
	}

	// Embed widget aggregates findings across all connections.
	resp, err := http.Get(fmt.Sprintf("%s/api/v1/embed/findings", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var embedResp map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&embedResp))
	embedCount, _ := embedResp["count"].(float64)
	assert.GreaterOrEqual(t, int(embedCount), totalFindings,
		"embed widget count (%d) must be >= sum across connections (%d)", int(embedCount), totalFindings)
	_ = resp.Body.Close()
}

// TestGitLabFindingLifecycle verifies suppress → verify suppressed → reopen → verify open.
func TestGitLabFindingLifecycle(t *testing.T) {
	server, glBaseURL := setupServerWithGitLab(t)
	connName := "gitlab-lifecycle"

	// Add connection and run a scan to generate findings.
	addGitLabConnection(t, server, connName, glBaseURL)
	scanPayload, _ := json.Marshal(quickScanPayload(connName, "gl-lifecycle-1"))
	resp, err := http.Post(
		fmt.Sprintf("%s/api/v1/analysis/quick", server.URL),
		"application/json", bytes.NewBuffer(scanPayload),
	)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	_ = resp.Body.Close()

	// Fetch findings and pick the first one.
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/analysis/findings?connection=%s", server.URL, connName))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var fr struct {
		Findings []map[string]interface{} `json:"findings"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&fr))
	_ = resp.Body.Close()

	if len(fr.Findings) == 0 {
		t.Skip("no findings generated — skipping lifecycle test")
	}

	findingID := fmt.Sprintf("%v", fr.Findings[0]["id"])

	// Step 2 — suppress the finding.
	suppressPayload, _ := json.Marshal(map[string]string{
		"reason": "false_positive",
		"note":   "test env secret",
	})
	resp, err = http.Post(
		fmt.Sprintf("%s/api/v1/findings/%s/suppress", server.URL, findingID),
		"application/json", bytes.NewBuffer(suppressPayload),
	)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode, "suppress should return 200")
	var suppressResp map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&suppressResp))
	assert.Equal(t, "suppressed", suppressResp["status"])
	_ = resp.Body.Close()

	// Step 3 — verify the finding is suppressed.
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/analysis/findings?connection=%s", server.URL, connName))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var fr2 struct {
		Findings []map[string]interface{} `json:"findings"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&fr2))
	_ = resp.Body.Close()
	foundSuppressed := false
	for _, f := range fr2.Findings {
		if fmt.Sprintf("%v", f["id"]) == findingID {
			assert.Equal(t, "suppressed", f["status"], "finding %s should be suppressed", findingID)
			foundSuppressed = true
			break
		}
	}
	assert.True(t, foundSuppressed, "suppressed finding should still appear in list")

	// Step 4 — reopen the finding.
	resp, err = http.Post(
		fmt.Sprintf("%s/api/v1/findings/%s/reopen", server.URL, findingID),
		"application/json", nil,
	)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode, "reopen should return 200")
	var reopenResp map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&reopenResp))
	assert.Equal(t, "open", reopenResp["status"])
	_ = resp.Body.Close()

	// Step 5 — verify the finding is back to open.
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/analysis/findings?connection=%s", server.URL, connName))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var fr3 struct {
		Findings []map[string]interface{} `json:"findings"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&fr3))
	_ = resp.Body.Close()
	for _, f := range fr3.Findings {
		if fmt.Sprintf("%v", f["id"]) == findingID {
			assert.Equal(t, "open", f["status"], "finding %s should be open after reopen", findingID)
			break
		}
	}
}
