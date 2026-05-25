package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/analysis"
)

// TestPRCommentGeneration verifies the markdown comment body contains the
// expected table and risk score without calling any external API.
func TestPRCommentGeneration(t *testing.T) {
	findings := []analysis.Finding{
		{Severity: analysis.SeverityCritical, Title: "Hardcoded AWS key"},
		{Severity: analysis.SeverityCritical, Title: "Root container"},
		{Severity: analysis.SeverityHigh, Title: "Missing SAST step"},
		{Severity: analysis.SeverityMedium, Title: "Long-running pipeline"},
	}
	riskScore := 78

	body := buildPRCommentBody(findings, riskScore)

	if !strings.Contains(body, "## PipeWarden Security Scan Results") {
		t.Error("expected header in comment body")
	}
	if !strings.Contains(body, "| Severity | Count |") {
		t.Error("expected markdown table header")
	}
	if !strings.Contains(body, "🔴 Critical | 2") {
		t.Errorf("expected 2 critical findings in table, got:\n%s", body)
	}
	if !strings.Contains(body, "🟠 High | 1") {
		t.Errorf("expected 1 high finding in table, got:\n%s", body)
	}
	if !strings.Contains(body, "**Risk Score: 78/100**") {
		t.Errorf("expected risk score in comment, got:\n%s", body)
	}
	if !strings.Contains(body, "View Findings") {
		t.Error("expected collapsible findings section")
	}
	if !strings.Contains(body, "Powered by [PipeWarden]") {
		t.Error("expected powered-by footer")
	}
}

// TestPRCommentPost mocks the GitHub API and verifies the handler POSTs
// a comment with the correct JSON body.
func TestPRCommentPost(t *testing.T) {
	var receivedBody map[string]string

	mockGitHub := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if err := json.NewDecoder(r.Body).Decode(&receivedBody); err != nil {
			t.Fatalf("failed to decode request body: %v", err)
		}
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]int{"id": 1})
	}))
	defer mockGitHub.Close()

	// Patch the real postGitHubComment by wrapping at the unit level:
	// We call the function directly with a fake URL by temporarily redirecting
	// via a helper that accepts a base URL (tested via integration below).
	// For unit test, verify comment body content via postGitHubCommentToURL.
	findings := []analysis.Finding{
		{Severity: analysis.SeverityHigh, Title: "Exposed secret"},
	}
	body := buildPRCommentBody(findings, 30)

	err := postGitHubCommentToURL(
		mockGitHub.URL+"/repos/myorg/myrepo/issues/42/comments",
		"test-token",
		body,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(receivedBody["body"], "PipeWarden Security Scan Results") {
		t.Errorf("expected PipeWarden header in posted comment, got: %s", receivedBody["body"])
	}
}

// TestPRCommentMissingFields verifies that missing owner/repo/pr_number
// results in a 400 Bad Request.
func TestPRCommentMissingFields(t *testing.T) {
	h := &Handlers{}

	cases := []struct {
		name string
		body map[string]interface{}
	}{
		{"missing owner", map[string]interface{}{"repo": "myrepo", "pr_number": 1, "connection": "c"}},
		{"missing repo", map[string]interface{}{"owner": "myorg", "pr_number": 1, "connection": "c"}},
		{"missing pr_number", map[string]interface{}{"owner": "myorg", "repo": "myrepo", "connection": "c"}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			payload, _ := json.Marshal(tc.body)
			req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/github/pr-comment", bytes.NewReader(payload))
			req.Header.Set("Content-Type", "application/json")
			rr := httptest.NewRecorder()

			h.PostPRComment(rr, req)

			if rr.Code != http.StatusBadRequest {
				t.Errorf("expected 400, got %d", rr.Code)
			}
		})
	}
}
