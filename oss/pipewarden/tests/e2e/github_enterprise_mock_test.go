package e2e

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// newGHEMockServer builds a minimal GitHub Enterprise API mock.
// It handles both standard GitHub paths (/user, /repos/...) used by the
// GitHub provider client, and GHE API paths (/api/v3/...) used by tests
// that directly POST to the mock code-scanning endpoint.
func newGHEMockServer(t *testing.T) *httptest.Server {
	t.Helper()

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		path := r.URL.Path

		// Normalise: strip /api/v3 prefix so both GHE and standard paths match.
		normalised := strings.TrimPrefix(path, "/api/v3")
		if normalised == "" {
			normalised = "/"
		}

		switch {
		// User identity endpoint
		case normalised == "/user":
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"login":      "admin",
				"id":         1,
				"site_admin": true,
			})

		// SSO org membership: /orgs/{org}/members/{username}
		case strings.Contains(normalised, "/orgs/") && strings.Contains(normalised, "/members/"):
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"login": "admin",
			})

		// SARIF status GET: /repos/{o}/{r}/code-scanning/sarifs/{id}
		case strings.Contains(normalised, "/code-scanning/sarifs/"):
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"processing_status": "complete",
			})

		// SARIF upload POST: /repos/{o}/{r}/code-scanning/sarifs
		case strings.Contains(normalised, "/code-scanning/sarifs") && r.Method == http.MethodPost:
			w.WriteHeader(http.StatusAccepted)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"id": "sarif-upload-1",
			})

		// Jobs for a run: /repos/{o}/{r}/actions/runs/{id}/jobs
		case strings.Contains(normalised, "/actions/runs/") && strings.HasSuffix(normalised, "/jobs"):
			now := time.Now().UTC()
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"total_count": 2,
				"jobs": []map[string]interface{}{
					{
						"id": 1, "name": "build",
						"status": "completed", "conclusion": "success",
						"started_at":   now.Add(-5 * time.Minute).Format(time.RFC3339),
						"completed_at": now.Format(time.RFC3339),
					},
					{
						"id": 2, "name": "test",
						"status": "completed", "conclusion": "success",
						"started_at":   now.Add(-3 * time.Minute).Format(time.RFC3339),
						"completed_at": now.Format(time.RFC3339),
					},
				},
			})

		// Single run GET: /repos/{o}/{r}/actions/runs/{id}
		case strings.Contains(normalised, "/actions/runs/"):
			now := time.Now().UTC()
			runID := ghePathTail(normalised)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"id": 101, "name": "CI", "workflow_id": 55,
				"status":         "completed",
				"conclusion":     "success",
				"head_branch":    "main",
				"head_sha":       "abc123def456",
				"html_url":       "https://ghe.example.com/runs/" + runID,
				"created_at":     now.Add(-3 * time.Minute).Format(time.RFC3339),
				"updated_at":     now.Format(time.RFC3339),
				"run_started_at": now.Add(-4 * time.Minute).Format(time.RFC3339),
			})

		// List runs: /repos/{o}/{r}/actions/runs
		case strings.Contains(normalised, "/actions/runs"):
			now := time.Now().UTC()
			runs := make([]map[string]interface{}, 3)
			for i := range runs {
				runs[i] = map[string]interface{}{
					"id": 100 + i, "name": fmt.Sprintf("CI run %d", i+1),
					"workflow_id": 55, "status": "completed", "conclusion": "success",
					"head_branch":    "main",
					"head_sha":       "abc123",
					"created_at":     now.Add(time.Duration(-(i + 1)) * time.Minute).Format(time.RFC3339),
					"updated_at":     now.Format(time.RFC3339),
					"run_started_at": now.Add(time.Duration(-(i + 2)) * time.Minute).Format(time.RFC3339),
				}
			}
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"total_count": 3, "workflow_runs": runs,
			})

		default:
			http.NotFound(w, r)
		}
	}))
}

// ghePathTail returns the last path segment.
func ghePathTail(path string) string {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) == 0 {
		return ""
	}
	return parts[len(parts)-1]
}

// signGHEWebhook computes X-Hub-Signature-256 for the given body and secret.
func signGHEWebhook(body []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}
