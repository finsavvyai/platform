package siem

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/logging"
)

// --- Slack tests ---

func TestSlackNotifier_Disabled(t *testing.T) {
	s := NewSlackNotifier(SlackConfig{})
	if s.Enabled() {
		t.Error("expected Enabled=false without webhook URL")
	}
	// Should be a no-op when disabled
	err := s.SendFinding(context.Background(), analysis.Finding{}, "")
	if err != nil {
		t.Errorf("unexpected error from disabled notifier: %v", err)
	}
}

func TestSlackNotifier_SendFinding(t *testing.T) {
	var received map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&received)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()

	s := &SlackNotifier{
		config:     SlackConfig{WebhookURL: srv.URL, Channel: "#security"},
		httpClient: srv.Client(),
	}

	f := analysis.Finding{
		ID:             1,
		ConnectionName: "github-main",
		RunID:          "run123",
		Severity:       analysis.SeverityCritical,
		Category:       analysis.CategorySecrets,
		Title:          "AWS key exposed",
		Description:    "AWS access key found in pipeline logs",
		Remediation:    "Rotate key immediately",
		Confidence:     0.99,
		Status:         "open",
	}

	err := s.SendFinding(context.Background(), f, "https://pipewarden.com/findings/1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if received["channel"] != "#security" {
		t.Errorf("expected channel '#security', got %v", received["channel"])
	}
}

func TestSlackNotifier_SendBatch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()

	s := &SlackNotifier{
		config:     SlackConfig{WebhookURL: srv.URL},
		httpClient: srv.Client(),
	}

	findings := []analysis.Finding{
		{Severity: analysis.SeverityCritical},
		{Severity: analysis.SeverityHigh},
		{Severity: analysis.SeverityMedium},
	}

	err := s.SendBatch(context.Background(), findings, "conn1", "run1", "https://dash.url")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestSeverityEmoji(t *testing.T) {
	if severityEmoji(analysis.SeverityCritical) != "🔴" {
		t.Error("expected 🔴 for critical")
	}
	if severityEmoji(analysis.SeverityHigh) != "🟠" {
		t.Error("expected 🟠 for high")
	}
}

// --- PagerDuty tests ---

func TestPagerDutyNotifier_Disabled(t *testing.T) {
	p := NewPagerDutyNotifier(PagerDutyConfig{})
	if p.Enabled() {
		t.Error("expected Enabled=false")
	}
	err := p.TriggerAlert(context.Background(), analysis.Finding{Severity: analysis.SeverityCritical}, "")
	if err != nil {
		t.Errorf("unexpected error from disabled notifier: %v", err)
	}
}

func TestPagerDutyNotifier_SkipsLowSeverity(t *testing.T) {
	called := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusAccepted)
	}))
	defer srv.Close()

	p := &PagerDutyNotifier{
		config:     PagerDutyConfig{IntegrationKey: "key"},
		httpClient: srv.Client(),
	}

	err := p.TriggerAlert(context.Background(), analysis.Finding{Severity: analysis.SeverityLow}, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if called {
		t.Error("expected no HTTP call for low severity finding")
	}
}

func TestPDSeverity(t *testing.T) {
	if pdSeverity(analysis.SeverityCritical) != "critical" {
		t.Error("expected critical")
	}
	if pdSeverity(analysis.SeverityHigh) != "error" {
		t.Error("expected error")
	}
	if pdSeverity(analysis.SeverityMedium) != "warning" {
		t.Error("expected warning")
	}
	if pdSeverity(analysis.SeverityLow) != "info" {
		t.Error("expected info")
	}
}

// --- Jira tests ---

func TestJiraNotifier_Disabled(t *testing.T) {
	j := NewJiraNotifier(JiraConfig{})
	if j.Enabled() {
		t.Error("expected Enabled=false")
	}
	key, err := j.CreateIssue(context.Background(), analysis.Finding{})
	if err != nil || key != "" {
		t.Error("expected no-op when disabled")
	}
}

func TestJiraNotifier_CreateIssue(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if !strings.HasSuffix(r.URL.Path, "/rest/api/3/issue") {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"key":"SEC-42"}`))
	}))
	defer srv.Close()

	j := &JiraNotifier{
		config: JiraConfig{
			BaseURL:    srv.URL,
			Email:      "test@example.com",
			APIToken:   "token",
			ProjectKey: "SEC",
			IssueType:  "Bug",
		},
		httpClient: srv.Client(),
	}

	f := analysis.Finding{
		ConnectionName: "gitlab-prod",
		Severity:       analysis.SeverityCritical,
		Category:       analysis.CategorySecrets,
		Title:          "Secret exposed",
		Description:    "AWS key in logs",
	}

	key, err := j.CreateIssue(context.Background(), f)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if key != "SEC-42" {
		t.Errorf("expected 'SEC-42', got %q", key)
	}
}

func TestJiraPriority(t *testing.T) {
	if jiraPriority(analysis.SeverityCritical) != "Highest" {
		t.Error("expected Highest for critical")
	}
	if jiraPriority(analysis.SeverityHigh) != "High" {
		t.Error("expected High")
	}
}

// --- Router tests ---

func TestRouter_Enabled_NoDestinations(t *testing.T) {
	r := NewRouter(RouterConfig{}, logging.NewDefault())
	if r.Enabled() {
		t.Error("expected Enabled=false with no destinations configured")
	}
}

func TestRouter_Route_NoOp(t *testing.T) {
	r := NewRouter(RouterConfig{}, logging.NewDefault())
	// Should not panic or error when no destinations configured
	r.Route(context.Background(), analysis.Finding{})
}

func TestRouter_RouteBatch_Empty(t *testing.T) {
	r := NewRouter(RouterConfig{}, logging.NewDefault())
	r.RouteBatch(context.Background(), nil, "conn", "run")
}
