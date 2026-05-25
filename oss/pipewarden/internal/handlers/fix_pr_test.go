package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// mockGitHubServer starts a local server that stubs the GitHub API calls needed
// by CreateFixPR: get-ref, create-ref, create-PR (and optionally the
// dependabot content check).
func mockGitHubServer(t *testing.T, createPRExtra func(w http.ResponseWriter)) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		switch {
		// GET ref (base branch SHA)
		case strings.HasSuffix(path, "/git/refs/heads/main"):
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"object": map[string]string{"sha": "abc123def456"},
			})
		// POST create-ref (new branch)
		case strings.HasSuffix(path, "/git/refs"):
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{}`))
		// GET dependabot.yml check — 404 so we attempt to create it
		case strings.Contains(path, "dependabot.yml"):
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"message":"Not Found"}`))
		// POST create-PR
		case strings.HasSuffix(path, "/pulls"):
			w.WriteHeader(http.StatusCreated)
			if createPRExtra != nil {
				createPRExtra(w)
			} else {
				_ = json.NewEncoder(w).Encode(map[string]interface{}{
					"number":   42,
					"html_url": "https://github.com/owner/repo/pull/42",
				})
			}
		// POST dependabot.yml create
		case strings.Contains(path, "/contents/"):
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

func newHandlersForPRTest(t *testing.T, findings []storage.FindingRecord) *Handlers {
	t.Helper()
	db, err := storage.NewInMemory()
	if err != nil {
		t.Fatalf("new in-memory db: %v", err)
	}
	for i := range findings {
		if err := db.CreateFinding(&findings[i]); err != nil {
			t.Fatalf("seed finding: %v", err)
		}
	}
	return &Handlers{
		db:               db,
		ProgressRegistry: NewScanProgressRegistry(),
		AutoScanQueue:    NewAutoScanQueue(),
	}
}

// TestCreateFixPR verifies a PR is created with the correct title and body.
func TestCreateFixPR(t *testing.T) {
	srv := mockGitHubServer(t, nil)
	defer srv.Close()
	overrideGitHubBase(t, srv.URL)

	f := storage.FindingRecord{
		ConnectionName: "gh-prod",
		RunID:          "run-1",
		Severity:       "high",
		Category:       "network",
		Title:          "Hardcoded IP address",
		Description:    "IP found in workflow",
		Status:         "open",
		Confidence:     0.9,
	}
	h := newHandlersForPRTest(t, []storage.FindingRecord{f})

	body, _ := json.Marshal(FixPRRequest{
		Owner:       "owner",
		Repo:        "repo",
		BaseBranch:  "main",
		GitHubToken: "ghp_test",
	})
	// We need the finding ID — fetch it
	findings, _ := h.db.ListFindings("")
	id := findings[0].ID

	req := httptest.NewRequest(http.MethodPost,
		fmt.Sprintf("/api/v1/findings/%d/fix/pr", id),
		bytes.NewReader(body))
	rr := httptest.NewRecorder()
	req.URL.Path = fmt.Sprintf("/api/v1/findings/%d/fix/pr", id)
	h.CreateFixPR(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d — body: %s", rr.Code, rr.Body.String())
	}
	var resp FixPRResponse
	_ = json.NewDecoder(rr.Body).Decode(&resp)
	if resp.PRNumber != 42 {
		t.Errorf("expected PR number 42, got %d", resp.PRNumber)
	}
	if !strings.Contains(resp.Title, "Hardcoded IP address") {
		t.Errorf("title should contain finding title, got %q", resp.Title)
	}
	if !strings.HasPrefix(resp.Branch, "pipewarden/fix-") {
		t.Errorf("unexpected branch name: %q", resp.Branch)
	}
}

// TestCreateFixPRAutoFixable checks that an action-pinning finding triggers
// the dependabot.yml commit path as well.
func TestCreateFixPRAutoFixable(t *testing.T) {
	dependabotCreated := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		switch {
		case strings.HasSuffix(path, "/git/refs/heads/main"):
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"object": map[string]string{"sha": "deadbeef"},
			})
		case strings.HasSuffix(path, "/git/refs"):
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{}`))
		case strings.Contains(path, "dependabot.yml") && r.Method == http.MethodGet:
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"message":"Not Found"}`))
		case strings.Contains(path, "/contents/") && r.Method == http.MethodPost:
			dependabotCreated = true
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{}`))
		case strings.HasSuffix(path, "/pulls"):
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"number": 7, "html_url": "https://github.com/o/r/pull/7",
			})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()
	overrideGitHubBase(t, srv.URL)

	f := storage.FindingRecord{
		ConnectionName: "gh",
		RunID:          "r1",
		Severity:       "high",
		Category:       "supply-chain",
		Title:          "Unpinned action ref",
		Description:    "Action uses @v3",
		Status:         "open",
		Confidence:     1.0,
	}
	h := newHandlersForPRTest(t, []storage.FindingRecord{f})
	findings, _ := h.db.ListFindings("")
	id := findings[0].ID

	body, _ := json.Marshal(FixPRRequest{
		Owner: "o", Repo: "r", BaseBranch: "main", GitHubToken: "tok",
	})
	req := httptest.NewRequest(http.MethodPost,
		fmt.Sprintf("/api/v1/findings/%d/fix/pr", id),
		bytes.NewReader(body))
	req.URL.Path = fmt.Sprintf("/api/v1/findings/%d/fix/pr", id)
	rr := httptest.NewRecorder()
	h.CreateFixPR(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d — %s", rr.Code, rr.Body.String())
	}
	if !dependabotCreated {
		t.Error("expected dependabot.yml to be committed for auto-fixable supply-chain finding")
	}
}

// TestCreateFixPRMissingToken expects a 400 when github_token is absent.
func TestCreateFixPRMissingToken(t *testing.T) {
	h := newHandlersForPRTest(t, nil)
	body, _ := json.Marshal(FixPRRequest{Owner: "o", Repo: "r"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/1/fix/pr", bytes.NewReader(body))
	req.URL.Path = "/api/v1/findings/1/fix/pr"
	rr := httptest.NewRecorder()
	h.CreateFixPR(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// TestFixPRBranchNaming verifies the branch name format pipewarden/fix-*.
func TestFixPRBranchNaming(t *testing.T) {
	cases := []struct {
		category string
		wantPfx  string
	}{
		{"supply-chain", "pipewarden/fix-supply-chain-"},
		{"container-security", "pipewarden/fix-container-security-"},
		{"network", "pipewarden/fix-network-"},
	}
	for _, tc := range cases {
		t.Run(tc.category, func(t *testing.T) {
			branch := fmt.Sprintf("pipewarden/fix-%s-%d",
				sanitizeBranchSegment(tc.category), int64(99))
			if !strings.HasPrefix(branch, tc.wantPfx) {
				t.Errorf("branch %q doesn't have prefix %q", branch, tc.wantPfx)
			}
		})
	}
}

// overrideGitHubBase patches the githubAPIBase package-level var for a test
// and restores it via t.Cleanup.
func overrideGitHubBase(t *testing.T, base string) {
	t.Helper()
	orig := githubAPIBase
	// package-level var is not exported — use the unexported accessor
	setGithubAPIBase(base)
	t.Cleanup(func() { setGithubAPIBase(orig) })
}
