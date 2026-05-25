package siem

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/analysis"
)

// JiraConfig holds Jira REST API v3 configuration.
type JiraConfig struct {
	BaseURL    string // e.g. https://yourorg.atlassian.net
	Email      string // Atlassian account email
	APIToken   string // Atlassian API token
	ProjectKey string // Jira project key, e.g. "SEC"
	IssueType  string // default "Bug" or "Task"
}

// JiraNotifier creates Jira issues from security findings.
type JiraNotifier struct {
	config     JiraConfig
	httpClient *http.Client
}

// NewJiraNotifier creates a Jira notifier.
func NewJiraNotifier(cfg JiraConfig) *JiraNotifier {
	if cfg.IssueType == "" {
		cfg.IssueType = "Bug"
	}
	return &JiraNotifier{
		config:     cfg,
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

// Enabled reports whether Jira is configured.
func (j *JiraNotifier) Enabled() bool {
	return j.config.BaseURL != "" && j.config.APIToken != "" && j.config.ProjectKey != ""
}

// CreateIssue opens a Jira issue for a security finding.
// Returns the created issue key (e.g. "SEC-42").
func (j *JiraNotifier) CreateIssue(ctx context.Context, f analysis.Finding) (string, error) {
	if !j.Enabled() {
		return "", nil
	}

	priority := jiraPriority(f.Severity)
	description := buildJiraDescription(f)

	issue := map[string]interface{}{
		"fields": map[string]interface{}{
			"project":   map[string]string{"key": j.config.ProjectKey},
			"issuetype": map[string]string{"name": j.config.IssueType},
			"summary":   fmt.Sprintf("[PipeWarden] [%s] %s", strings.ToUpper(string(f.Severity)), f.Title),
			"description": map[string]interface{}{
				"version": 1,
				"type":    "doc",
				"content": []map[string]interface{}{
					{
						"type": "paragraph",
						"content": []map[string]interface{}{
							{"type": "text", "text": description},
						},
					},
				},
			},
			"priority": map[string]string{"name": priority},
			"labels":   []string{"pipewarden", "security", string(f.Category)},
		},
	}

	body, err := json.Marshal(issue)
	if err != nil {
		return "", fmt.Errorf("marshal jira issue: %w", err)
	}

	url := strings.TrimRight(j.config.BaseURL, "/") + "/rest/api/3/issue"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("create jira request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Basic "+j.basicAuth())

	resp, err := j.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("jira request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("jira API error (%d): %s", resp.StatusCode, string(respBody))
	}

	var created struct {
		Key string `json:"key"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&created); err != nil {
		return "", fmt.Errorf("decode jira response: %w", err)
	}

	return created.Key, nil
}

func (j *JiraNotifier) basicAuth() string {
	creds := j.config.Email + ":" + j.config.APIToken
	return base64.StdEncoding.EncodeToString([]byte(creds))
}

func jiraPriority(s analysis.Severity) string {
	switch s {
	case analysis.SeverityCritical:
		return "Highest"
	case analysis.SeverityHigh:
		return "High"
	case analysis.SeverityMedium:
		return "Medium"
	default:
		return "Low"
	}
}

func buildJiraDescription(f analysis.Finding) string {
	var sb strings.Builder
	fmt.Fprintf(&sb, "Security finding detected by PipeWarden.\n\n")
	fmt.Fprintf(&sb, "Connection: %s\n", f.ConnectionName)
	fmt.Fprintf(&sb, "Run ID: %s\n", f.RunID)
	fmt.Fprintf(&sb, "Category: %s\n", f.Category)
	fmt.Fprintf(&sb, "Severity: %s\n", f.Severity)
	fmt.Fprintf(&sb, "Confidence: %.0f%%\n\n", f.Confidence*100)
	fmt.Fprintf(&sb, "Description:\n%s\n\n", f.Description)
	if f.Remediation != "" {
		fmt.Fprintf(&sb, "Remediation:\n%s\n\n", f.Remediation)
	}
	if f.File != "" {
		fmt.Fprintf(&sb, "File: %s", f.File)
		if f.Line > 0 {
			fmt.Fprintf(&sb, " (line %d)", f.Line)
		}
		sb.WriteString("\n")
	}
	fmt.Fprintf(&sb, "\nDetected at: %s", time.Now().UTC().Format(time.RFC3339))
	return sb.String()
}
