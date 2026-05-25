package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/analysis"
)

// GitHistoryScan handles POST /api/v1/git/scan — scans the local git
// repo at the given path for secrets in commit history (DLP applied to
// every introduced line in `git log -p`).
//
// Request: {"repo_path": "/abs/path/to/repo"}
// Response: {"hits": [...], "findings": [...]}
//
// The path must be absolute and inside an allowlist (PIPEWARDEN_GIT_SCAN_ROOTS).
// Without the allowlist set the endpoint refuses — preventing arbitrary
// filesystem reads through this path.
func (h *Handlers) GitHistoryScan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		http.Error(w, `{"error":"failed to read body"}`, http.StatusBadRequest)
		return
	}
	defer func() { _ = r.Body.Close() }()

	var req struct {
		RepoPath   string `json:"repo_path"`
		Connection string `json:"connection"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}
	if !filepath.IsAbs(req.RepoPath) {
		http.Error(w, `{"error":"repo_path must be absolute"}`, http.StatusBadRequest)
		return
	}
	if !pathIsAllowed(req.RepoPath) {
		http.Error(w, `{"error":"repo_path is not under PIPEWARDEN_GIT_SCAN_ROOTS — set this env var to enable"}`, http.StatusForbidden)
		return
	}

	scanner := analysis.NewGitHistoryScanner()
	hits, err := scanner.ScanRepo(r.Context(), req.RepoPath)
	if err != nil {
		http.Error(w, `{"error":"`+escapeJSON(err.Error())+`"}`, http.StatusBadRequest)
		return
	}

	findings := analysis.HistorySecretsToFindings(req.Connection, hits)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"hits":     hits,
		"findings": findings,
	})
}

// pathIsAllowed validates repo_path against PIPEWARDEN_GIT_SCAN_ROOTS.
// Empty env var = endpoint disabled (refuse all paths). Each root is
// matched as a prefix; cleaned to prevent "../" escape.
func pathIsAllowed(p string) bool {
	roots := strings.Split(os.Getenv("PIPEWARDEN_GIT_SCAN_ROOTS"), string(filepath.ListSeparator))
	cleaned := filepath.Clean(p)
	for _, root := range roots {
		root = strings.TrimSpace(root)
		if root == "" {
			continue
		}
		if strings.HasPrefix(cleaned, filepath.Clean(root)) {
			return true
		}
	}
	return false
}

// escapeJSON quotes a string for embedding in a hand-built JSON literal.
// Used only for error bodies to keep the handler dependency-free.
func escapeJSON(s string) string {
	b, err := json.Marshal(s)
	if err != nil {
		return ""
	}
	// Strip surrounding quotes — caller wraps in quotes itself.
	return string(b[1 : len(b)-1])
}
