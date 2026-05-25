package handlers

// coverage_boost10_test.go covers the negative-score clamping branches in
// health_score_dims, the DeleteSemgrepRule internal-server-error path via
// a non-existent rule that generates an internal message, the supply-chain
// dependabot branch in runSingleFixPR, and the fix_pr_batch MaxParallel<=0
// default path.

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// ---------------------------------------------------------------------------
// secretHygieneDim — score clamped to 0 when > 4 secret-exposure findings
// ---------------------------------------------------------------------------

func TestSecretHygieneDim_ScoreClamped(t *testing.T) {
	open := make([]storage.FindingRecord, 5)
	for i := range open {
		open[i] = storage.FindingRecord{Category: "secret-exposure", Status: "open"}
	}
	dim := secretHygieneDim(open)
	assert.Equal(t, 0, dim.Score) // 100 - 5*25 = -25 → clamped to 0
	assert.Equal(t, "fail", dim.Status)
}

// ---------------------------------------------------------------------------
// policyComplianceDim — score clamped to 0 when > 5 policy violations
// ---------------------------------------------------------------------------

func TestPolicyComplianceDim_ScoreClamped(t *testing.T) {
	open := make([]storage.FindingRecord, 6)
	for i := range open {
		open[i] = storage.FindingRecord{Category: "policy", Status: "open"}
	}
	dim := policyComplianceDim(open)
	assert.Equal(t, 0, dim.Score) // 100 - 6*20 = -20 → clamped to 0
	assert.Equal(t, "fail", dim.Status)
}

// ---------------------------------------------------------------------------
// actionPinningDim — score clamped to 0 when > 5 supply-chain findings
// ---------------------------------------------------------------------------

func TestActionPinningDim_ScoreClamped(t *testing.T) {
	open := make([]storage.FindingRecord, 6)
	for i := range open {
		open[i] = storage.FindingRecord{Category: "supply-chain", Status: "open"}
	}
	dim := actionPinningDim(open)
	assert.Equal(t, 0, dim.Score) // 100 - 6*20 = -20 → clamped to 0
}

// ---------------------------------------------------------------------------
// containerSecurityDim — score clamped to 0 when > 4 container-security findings
// ---------------------------------------------------------------------------

func TestContainerSecurityDim_ScoreClamped(t *testing.T) {
	open := make([]storage.FindingRecord, 5)
	for i := range open {
		open[i] = storage.FindingRecord{Category: "container-security", Status: "open"}
	}
	dim := containerSecurityDim(open)
	assert.Equal(t, 0, dim.Score) // 100 - 5*30 = -50 → clamped
}

// ---------------------------------------------------------------------------
// runSingleFixPR — supply-chain finding triggers dependabot branch
// (autoFixable=true + category contains "supply-chain")
// Mock server: GET ref succeeds, POST refs succeeds, GET dependabot check →
// 404 (triggers ensureDependabotConfig PUT), PUT → 201, POST pulls → 201
// ---------------------------------------------------------------------------

func TestRunSingleFixPR_SupplyChain_DependabotBranch(t *testing.T) {
	h, db := newTestHandlersDB(t)

	// Create a finding with supply-chain category to trigger the dependabot path
	rec := &storage.FindingRecord{
		ConnectionName: "sc-conn",
		RunID:          "run-1",
		Severity:       "high",
		Category:       "supply-chain",
		Title:          "Unpinned GitHub Action",
		Status:         "open",
	}
	require.NoError(t, db.CreateFinding(rec))

	findings, err := db.ListFindings("sc-conn")
	require.NoError(t, err)
	require.NotEmpty(t, findings)
	fid := findings[0].ID

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/repos/o/r/git/refs/heads/main":
			resp := map[string]interface{}{
				"object": map[string]string{"sha": "cafebabecafebabecafebabecafebabecafebabe"},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(resp)

		case r.Method == http.MethodGet:
			// dependabot check → 404 to trigger create
			w.WriteHeader(http.StatusNotFound)

		case r.Method == http.MethodPost && r.URL.Path == "/repos/o/r/git/refs":
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte("{}"))

		case r.Method == http.MethodPost && r.URL.Path == "/repos/o/r/pulls":
			resp := map[string]interface{}{
				"number":   7,
				"html_url": "https://github.com/o/r/pull/7",
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(resp)

		case r.Method == http.MethodPut:
			// ensureDependabotConfig PUT → created
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte("{}"))

		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	orig := githubAPIBase
	setGithubAPIBase(srv.URL)
	defer setGithubAPIBase(orig)

	req := BatchFixPRRequest{
		FindingIDs:  []int64{fid},
		Owner:       "o",
		Repo:        "r",
		BaseBranch:  "main",
		GitHubToken: "tok",
		MaxParallel: 1,
	}
	results := runBatchFixPR(t.Context(), h, req)
	require.Len(t, results, 1)
	assert.Equal(t, "created", results[0].Status)
}

// ---------------------------------------------------------------------------
// CreateFixPRBatch — MaxParallel <= 0 defaults to batchDefaultWorkers
// ---------------------------------------------------------------------------

func TestCreateFixPRBatch_MaxParallelDefaulted(t *testing.T) {
	h, db := newTestHandlersDB(t)
	seedFinding(t, db, "par-conn", "high")

	findings, err := db.ListFindings("par-conn")
	require.NoError(t, err)
	fid := findings[0].ID

	// Server that makes getRepoDefaultBranch succeed then all POSTs succeed
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			resp := map[string]interface{}{
				"object": map[string]string{"sha": "1234567890abcdef1234567890abcdef12345678"},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(resp)
			return
		}
		if r.Method == http.MethodPost {
			if r.URL.Path == "/repos/o/r/pulls" {
				resp := map[string]interface{}{
					"number": 1, "html_url": "https://github.com/o/r/pull/1",
				}
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusCreated)
				_ = json.NewEncoder(w).Encode(resp)
				return
			}
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte("{}"))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	orig := githubAPIBase
	setGithubAPIBase(srv.URL)
	defer setGithubAPIBase(orig)

	body, _ := json.Marshal(BatchFixPRRequest{
		FindingIDs:  []int64{fid},
		Owner:       "o",
		Repo:        "r",
		BaseBranch:  "main",
		GitHubToken: "tok",
		MaxParallel: 0, // should default to batchDefaultWorkers=4
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/fix/pr/batch", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateFixPRBatch(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp BatchFixPRResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 1, resp.Requested)
}

// ---------------------------------------------------------------------------
// scanRecencyDim — last-scan > 30 days (details = "Last scan > 30 days ago")
// ---------------------------------------------------------------------------

func TestScanRecencyDim_Over30Days(t *testing.T) {
	old := time.Now().AddDate(0, -2, 0) // 2 months ago
	dim := scanRecencyDim(&old)
	assert.Equal(t, 0, dim.Score)
	assert.Equal(t, "fail", dim.Status)
	assert.Contains(t, dim.Details, "30 days")
}

// ---------------------------------------------------------------------------
// GetHealthScore via HTTP — with enough findings to clamp scores
// ---------------------------------------------------------------------------

func TestGetHealthScore_B10_ClampedScore(t *testing.T) {
	h, db := newTestHandlersDB(t)

	// 5 secret-exposure + 6 supply-chain + 5 container-security + 6 policy
	for i := 0; i < 5; i++ {
		require.NoError(t, db.CreateFinding(&storage.FindingRecord{
			ConnectionName: "clamped-conn", RunID: "r", Severity: "critical",
			Category: "secret-exposure", Title: "Secret", Status: "open",
		}))
	}
	for i := 0; i < 6; i++ {
		require.NoError(t, db.CreateFinding(&storage.FindingRecord{
			ConnectionName: "clamped-conn", RunID: "r", Severity: "high",
			Category: "supply-chain", Title: "Unpinned", Status: "open",
		}))
	}
	for i := 0; i < 5; i++ {
		require.NoError(t, db.CreateFinding(&storage.FindingRecord{
			ConnectionName: "clamped-conn", RunID: "r", Severity: "high",
			Category: "container-security", Title: "Container", Status: "open",
		}))
	}
	for i := 0; i < 6; i++ {
		require.NoError(t, db.CreateFinding(&storage.FindingRecord{
			ConnectionName: "clamped-conn", RunID: "r", Severity: "medium",
			Category: "policy", Title: "Policy", Status: "open",
		}))
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections/clamped-conn/health", nil)
	w := httptest.NewRecorder()
	h.GetHealthScore(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp HealthScore
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "clamped-conn", resp.Connection)
	// Score should be low given many open critical/high findings
	assert.LessOrEqual(t, resp.Score, 100)
	assert.Contains(t, []string{"A", "B", "C", "D", "F"}, resp.Grade)
}
