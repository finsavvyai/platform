package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/analysis"
)

// prCommentRequest is the request body for PostPRComment.
type prCommentRequest struct {
	Owner       string `json:"owner"`
	Repo        string `json:"repo"`
	PRNumber    int    `json:"pr_number"`
	Connection  string `json:"connection"`
	GitHubToken string `json:"github_token"`
}

// PostPRComment posts a finding summary as a GitHub PR comment.
// POST /api/v1/webhooks/github/pr-comment
func (h *Handlers) PostPRComment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req prCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	if req.Owner == "" || req.Repo == "" || req.PRNumber == 0 {
		jsonError(w, "owner, repo, and pr_number are required", http.StatusBadRequest)
		return
	}

	findings, riskScore, err := h.loadFindingsForConnection(req.Connection)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	body := buildPRCommentBody(findings, riskScore)

	if req.GitHubToken != "" {
		if err := postGitHubComment(req.Owner, req.Repo, req.PRNumber, req.GitHubToken, body); err != nil {
			jsonError(w, fmt.Sprintf("failed to post GitHub comment: %v", err), http.StatusBadGateway)
			return
		}
	}

	jsonOK(w, map[string]interface{}{
		"comment_body":   body,
		"findings_count": len(findings),
		"risk_score":     riskScore,
	})
}

// loadFindingsForConnection retrieves the latest findings for a connection from storage.
func (h *Handlers) loadFindingsForConnection(connection string) ([]analysis.Finding, int, error) {
	if h.db == nil {
		return nil, 0, nil
	}
	dbFindings, err := h.db.ListFindings(connection)
	if err != nil {
		return nil, 0, err
	}
	findings := make([]analysis.Finding, 0, len(dbFindings))
	riskScore := 0
	for _, f := range dbFindings {
		findings = append(findings, analysis.Finding{
			ID:             f.ID,
			ConnectionName: f.ConnectionName,
			RunID:          f.RunID,
			Severity:       analysis.Severity(f.Severity),
			Category:       analysis.Category(f.Category),
			Title:          f.Title,
			Description:    f.Description,
			Remediation:    f.Remediation,
		})
	}
	for _, f := range findings {
		switch f.Severity {
		case analysis.SeverityCritical:
			riskScore += 25
		case analysis.SeverityHigh:
			riskScore += 15
		case analysis.SeverityMedium:
			riskScore += 8
		case analysis.SeverityLow:
			riskScore += 3
		}
	}
	if riskScore > 100 {
		riskScore = 100
	}
	return findings, riskScore, nil
}

// buildPRCommentBody assembles the markdown PR comment from findings.
func buildPRCommentBody(findings []analysis.Finding, riskScore int) string {
	counts := map[analysis.Severity]int{}
	for _, f := range findings {
		counts[f.Severity]++
	}

	var sb strings.Builder
	sb.WriteString("## PipeWarden Security Scan Results\n\n")
	sb.WriteString("| Severity | Count |\n")
	sb.WriteString("|----------|-------|\n")
	fmt.Fprintf(&sb, "| 🔴 Critical | %d |\n", counts[analysis.SeverityCritical])
	fmt.Fprintf(&sb, "| 🟠 High | %d |\n", counts[analysis.SeverityHigh])
	fmt.Fprintf(&sb, "| 🟡 Medium | %d |\n", counts[analysis.SeverityMedium])
	fmt.Fprintf(&sb, "| 🟢 Low | %d |\n", counts[analysis.SeverityLow])
	sb.WriteString("\n")
	fmt.Fprintf(&sb, "**Risk Score: %d/100**\n\n", riskScore)

	if len(findings) > 0 {
		sb.WriteString("<details><summary>View Findings</summary>\n\n")
		for _, f := range findings {
			fmt.Fprintf(&sb, "- **[%s]** %s\n", strings.ToUpper(string(f.Severity)), f.Title)
		}
		sb.WriteString("\n</details>\n\n")
	}

	sb.WriteString("_Powered by [PipeWarden](https://pipewarden.com)_\n")
	return sb.String()
}

// postGitHubComment POSTs a comment to a GitHub PR via the REST API.
func postGitHubComment(owner, repo string, prNumber int, token, body string) error {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues/%d/comments", owner, repo, prNumber)
	return postGitHubCommentToURL(url, token, body)
}

// postGitHubCommentToURL posts a comment body to any GitHub-compatible comments URL.
// Extracted for testability with mock servers.
func postGitHubCommentToURL(url, token, body string) error {
	payload, err := json.Marshal(map[string]string{"body": body})
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("post comment: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("GitHub API returned %d", resp.StatusCode)
	}
	return nil
}
