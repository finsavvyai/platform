package siem

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/logging"
)

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func criticalFinding() analysis.Finding {
	return analysis.Finding{
		ID:             10,
		ConnectionName: "github-prod",
		RunID:          "run-abc",
		Severity:       analysis.SeverityCritical,
		Category:       analysis.CategorySecrets,
		Title:          "AWS key exposed",
		Description:    "AWS access key found in pipeline logs",
		Remediation:    "Rotate key immediately",
		Confidence:     0.99,
		Status:         "open",
		File:           "ci.yml",
		Line:           42,
	}
}

func highFinding() analysis.Finding {
	f := criticalFinding()
	f.Severity = analysis.SeverityHigh
	return f
}

func mediumFinding() analysis.Finding {
	f := criticalFinding()
	f.Severity = analysis.SeverityMedium
	f.Remediation = "" // exercise absent-remediation path
	return f
}

func lowFinding() analysis.Finding {
	f := criticalFinding()
	f.Severity = analysis.SeverityLow
	f.File = "" // exercise absent-file path
	return f
}

// httpClientFor returns an *http.Client whose transport is bound to srv so
// requests hit the httptest server regardless of URL scheme/host.
func httpClientFor(srv *httptest.Server) *http.Client {
	return srv.Client()
}

// timeoutClient returns an *http.Client that times out almost immediately.
func timeoutClient() *http.Client {
	return &http.Client{
		Timeout: 1 * time.Millisecond,
		Transport: &http.Transport{
			DialContext: (&net.Dialer{Timeout: 1 * time.Millisecond}).DialContext,
		},
	}
}

// ---------------------------------------------------------------------------
// Slack — error paths
// ---------------------------------------------------------------------------

func TestSlackNotifier_SendFinding_NonOKStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "rate limited", http.StatusTooManyRequests)
	}))
	defer srv.Close()

	s := &SlackNotifier{
		config:     SlackConfig{WebhookURL: srv.URL},
		httpClient: httpClientFor(srv),
	}
	err := s.SendFinding(context.Background(), criticalFinding(), "https://dash")
	if err == nil {
		t.Fatal("expected error for non-200 response")
	}
	if !strings.Contains(err.Error(), "429") {
		t.Errorf("error should mention status code, got: %v", err)
	}
}

func TestSlackNotifier_SendFinding_NetworkError(t *testing.T) {
	s := &SlackNotifier{
		config:     SlackConfig{WebhookURL: "http://127.0.0.1:1"}, // nothing listening
		httpClient: timeoutClient(),
	}
	err := s.SendFinding(context.Background(), criticalFinding(), "")
	if err == nil {
		t.Fatal("expected network error")
	}
}

func TestSlackNotifier_SendBatch_NonOKStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("server error"))
	}))
	defer srv.Close()

	s := &SlackNotifier{
		config:     SlackConfig{WebhookURL: srv.URL},
		httpClient: httpClientFor(srv),
	}
	err := s.SendBatch(context.Background(), []analysis.Finding{criticalFinding()}, "conn", "run", "")
	if err == nil {
		t.Fatal("expected error for 500 response")
	}
	if !strings.Contains(err.Error(), "500") {
		t.Errorf("error should mention status code, got: %v", err)
	}
}

func TestSlackNotifier_SendBatch_Disabled(t *testing.T) {
	s := NewSlackNotifier(SlackConfig{})
	// Should no-op, not error
	err := s.SendBatch(context.Background(), []analysis.Finding{criticalFinding()}, "conn", "run", "")
	if err != nil {
		t.Errorf("unexpected error from disabled notifier: %v", err)
	}
}

func TestSlackNotifier_SendBatch_EmptyFindings(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("should not receive a request for empty findings")
	}))
	defer srv.Close()

	s := &SlackNotifier{
		config:     SlackConfig{WebhookURL: srv.URL},
		httpClient: httpClientFor(srv),
	}
	err := s.SendBatch(context.Background(), nil, "conn", "run", "")
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

// ---------------------------------------------------------------------------
// Slack — payload completeness
// ---------------------------------------------------------------------------

func TestSlackNotifier_SendFinding_NoDashURL(t *testing.T) {
	var body map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&body)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()

	s := &SlackNotifier{
		config:     SlackConfig{WebhookURL: srv.URL, Username: "TestBot"},
		httpClient: httpClientFor(srv),
	}
	err := s.SendFinding(context.Background(), mediumFinding(), "") // no dashURL
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if body["username"] != "TestBot" {
		t.Errorf("expected username 'TestBot', got %v", body["username"])
	}
}

func TestSlackNotifier_SendFinding_WithChannel(t *testing.T) {
	var body map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&body)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()

	s := &SlackNotifier{
		config:     SlackConfig{WebhookURL: srv.URL, Channel: "#alerts"},
		httpClient: httpClientFor(srv),
	}
	err := s.SendFinding(context.Background(), highFinding(), "https://dash/1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if body["channel"] != "#alerts" {
		t.Errorf("expected channel '#alerts', got %v", body["channel"])
	}
}

func TestSlackNotifier_SendBatch_WithChannel(t *testing.T) {
	var body map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&body)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()

	s := &SlackNotifier{
		config:     SlackConfig{WebhookURL: srv.URL, Channel: "#siem"},
		httpClient: httpClientFor(srv),
	}
	findings := []analysis.Finding{criticalFinding(), highFinding(), mediumFinding(), lowFinding()}
	err := s.SendBatch(context.Background(), findings, "myconn", "myrun", "https://dash")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if body["channel"] != "#siem" {
		t.Errorf("expected channel '#siem', got %v", body["channel"])
	}
}

// ---------------------------------------------------------------------------
// Severity helpers — full branches
// ---------------------------------------------------------------------------

func TestSeverityEmoji_AllBranches(t *testing.T) {
	cases := []struct {
		sev  analysis.Severity
		want string
	}{
		{analysis.SeverityCritical, "🔴"},
		{analysis.SeverityHigh, "🟠"},
		{analysis.SeverityMedium, "🟡"},
		{analysis.SeverityLow, "⚪"},
		{analysis.SeverityInfo, "⚪"}, // default branch
	}
	for _, c := range cases {
		got := severityEmoji(c.sev)
		if got != c.want {
			t.Errorf("severityEmoji(%s) = %q, want %q", c.sev, got, c.want)
		}
	}
}

func TestSeverityColor_AllBranches(t *testing.T) {
	cases := []struct {
		sev  analysis.Severity
		want string
	}{
		{analysis.SeverityCritical, "#FF0000"},
		{analysis.SeverityHigh, "#FF6600"},
		{analysis.SeverityMedium, "#FFD700"},
		{analysis.SeverityLow, "#808080"},
		{analysis.SeverityInfo, "#808080"}, // default branch
	}
	for _, c := range cases {
		got := severityColor(c.sev)
		if got != c.want {
			t.Errorf("severityColor(%s) = %q, want %q", c.sev, got, c.want)
		}
	}
}

// ---------------------------------------------------------------------------
// PagerDuty — send path + error paths
// ---------------------------------------------------------------------------

func TestPagerDutyNotifier_TriggerAlert_Critical(t *testing.T) {
	var received map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&received)
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`{"status":"success"}`))
	}))
	defer srv.Close()

	p := &PagerDutyNotifier{
		config:     PagerDutyConfig{IntegrationKey: "test-key"},
		httpClient: httpClientFor(srv),
	}
	// Temporarily redirect the PD URL via the notifier's httpClient base.
	// We use a transport wrapper to redirect pdEventsV2URL to the test server.
	p.httpClient.Transport = redirectTransport(srv.URL)

	err := p.TriggerAlert(context.Background(), criticalFinding(), "https://dash")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if received["event_action"] != "trigger" {
		t.Errorf("expected event_action 'trigger', got %v", received["event_action"])
	}
}

func TestPagerDutyNotifier_TriggerAlert_High(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusAccepted)
	}))
	defer srv.Close()

	p := &PagerDutyNotifier{
		config:     PagerDutyConfig{IntegrationKey: "key"},
		httpClient: httpClientFor(srv),
	}
	p.httpClient.Transport = redirectTransport(srv.URL)

	err := p.TriggerAlert(context.Background(), highFinding(), "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestPagerDutyNotifier_TriggerAlert_NoDashURL(t *testing.T) {
	var received map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&received)
		w.WriteHeader(http.StatusAccepted)
	}))
	defer srv.Close()

	p := &PagerDutyNotifier{
		config:     PagerDutyConfig{IntegrationKey: "key"},
		httpClient: httpClientFor(srv),
	}
	p.httpClient.Transport = redirectTransport(srv.URL)

	err := p.TriggerAlert(context.Background(), criticalFinding(), "") // empty dashURL
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// links should be nil/absent when dashURL is empty
	if _, ok := received["links"]; ok {
		// links key may be present as null — that is fine, just verify no href
		if received["links"] != nil {
			t.Errorf("expected no links when dashURL is empty, got %v", received["links"])
		}
	}
}

func TestPagerDutyNotifier_TriggerAlert_ErrorStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"message":"invalid routing key"}`))
	}))
	defer srv.Close()

	p := &PagerDutyNotifier{
		config:     PagerDutyConfig{IntegrationKey: "bad-key"},
		httpClient: httpClientFor(srv),
	}
	p.httpClient.Transport = redirectTransport(srv.URL)

	err := p.TriggerAlert(context.Background(), criticalFinding(), "")
	if err == nil {
		t.Fatal("expected error for 400 response")
	}
	if !strings.Contains(err.Error(), "400") {
		t.Errorf("error should mention status code, got: %v", err)
	}
}

func TestPagerDutyNotifier_TriggerAlert_NetworkError(t *testing.T) {
	p := &PagerDutyNotifier{
		config:     PagerDutyConfig{IntegrationKey: "key"},
		httpClient: timeoutClient(),
	}
	err := p.TriggerAlert(context.Background(), criticalFinding(), "")
	if err == nil {
		t.Fatal("expected network error")
	}
}

func TestPagerDutyNotifier_ResolveAlert_Disabled(t *testing.T) {
	p := NewPagerDutyNotifier(PagerDutyConfig{})
	err := p.ResolveAlert(context.Background(), criticalFinding())
	if err != nil {
		t.Errorf("unexpected error from disabled notifier: %v", err)
	}
}

func TestPagerDutyNotifier_ResolveAlert_Success(t *testing.T) {
	var received map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&received)
		w.WriteHeader(http.StatusAccepted)
	}))
	defer srv.Close()

	p := &PagerDutyNotifier{
		config:     PagerDutyConfig{IntegrationKey: "key"},
		httpClient: httpClientFor(srv),
	}
	p.httpClient.Transport = redirectTransport(srv.URL)

	err := p.ResolveAlert(context.Background(), criticalFinding())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if received["event_action"] != "resolve" {
		t.Errorf("expected event_action 'resolve', got %v", received["event_action"])
	}
}

func TestPagerDutyNotifier_ResolveAlert_ErrorStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnprocessableEntity)
		_, _ = w.Write([]byte("unprocessable"))
	}))
	defer srv.Close()

	p := &PagerDutyNotifier{
		config:     PagerDutyConfig{IntegrationKey: "key"},
		httpClient: httpClientFor(srv),
	}
	p.httpClient.Transport = redirectTransport(srv.URL)

	err := p.ResolveAlert(context.Background(), criticalFinding())
	if err == nil {
		t.Fatal("expected error for non-202/200 response")
	}
}

func TestBuildPDLinks_Empty(t *testing.T) {
	links := buildPDLinks("")
	if links != nil {
		t.Errorf("expected nil links for empty dashURL, got %v", links)
	}
}

func TestBuildPDLinks_WithURL(t *testing.T) {
	links := buildPDLinks("https://dash")
	if len(links) != 1 {
		t.Fatalf("expected 1 link, got %d", len(links))
	}
	if links[0]["href"] != "https://dash" {
		t.Errorf("expected href 'https://dash', got %v", links[0]["href"])
	}
}

// ---------------------------------------------------------------------------
// Jira — error paths
// ---------------------------------------------------------------------------

func TestJiraNotifier_CreateIssue_ErrorStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"message":"invalid credentials"}`))
	}))
	defer srv.Close()

	j := &JiraNotifier{
		config: JiraConfig{
			BaseURL:    srv.URL,
			Email:      "x@example.com",
			APIToken:   "bad",
			ProjectKey: "SEC",
			IssueType:  "Bug",
		},
		httpClient: httpClientFor(srv),
	}
	_, err := j.CreateIssue(context.Background(), criticalFinding())
	if err == nil {
		t.Fatal("expected error for 401 response")
	}
	if !strings.Contains(err.Error(), "401") {
		t.Errorf("error should mention status code, got: %v", err)
	}
}

func TestJiraNotifier_CreateIssue_NetworkError(t *testing.T) {
	j := &JiraNotifier{
		config: JiraConfig{
			BaseURL:    "http://127.0.0.1:1",
			Email:      "x@example.com",
			APIToken:   "token",
			ProjectKey: "SEC",
			IssueType:  "Bug",
		},
		httpClient: timeoutClient(),
	}
	_, err := j.CreateIssue(context.Background(), criticalFinding())
	if err == nil {
		t.Fatal("expected network error")
	}
}

func TestJiraNotifier_CreateIssue_MalformedResponseJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{NOT VALID JSON`))
	}))
	defer srv.Close()

	j := &JiraNotifier{
		config: JiraConfig{
			BaseURL:    srv.URL,
			Email:      "x@example.com",
			APIToken:   "token",
			ProjectKey: "SEC",
			IssueType:  "Bug",
		},
		httpClient: httpClientFor(srv),
	}
	_, err := j.CreateIssue(context.Background(), criticalFinding())
	if err == nil {
		t.Fatal("expected decode error for malformed JSON")
	}
}

func TestJiraNotifier_CreateIssue_DefaultIssueType(t *testing.T) {
	var body map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&body)
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"key":"SEC-1"}`))
	}))
	defer srv.Close()

	// IssueType is blank — NewJiraNotifier should default it to "Bug"
	j := NewJiraNotifier(JiraConfig{
		BaseURL:    srv.URL,
		Email:      "x@example.com",
		APIToken:   "token",
		ProjectKey: "SEC",
	})
	j.httpClient = httpClientFor(srv)

	key, err := j.CreateIssue(context.Background(), criticalFinding())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if key != "SEC-1" {
		t.Errorf("expected 'SEC-1', got %q", key)
	}
}

func TestJiraNotifier_CreateIssue_AllSeverities(t *testing.T) {
	severities := []analysis.Severity{
		analysis.SeverityCritical,
		analysis.SeverityHigh,
		analysis.SeverityMedium,
		analysis.SeverityLow,
		analysis.SeverityInfo,
	}

	for _, sev := range severities {
		sev := sev
		t.Run(string(sev), func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusCreated)
				_, _ = w.Write([]byte(`{"key":"TEST-1"}`))
			}))
			defer srv.Close()

			j := &JiraNotifier{
				config: JiraConfig{
					BaseURL: srv.URL, Email: "a@b.com",
					APIToken: "tok", ProjectKey: "TEST", IssueType: "Bug",
				},
				httpClient: httpClientFor(srv),
			}
			f := criticalFinding()
			f.Severity = sev
			_, err := j.CreateIssue(context.Background(), f)
			if err != nil {
				t.Errorf("severity %s: unexpected error: %v", sev, err)
			}
		})
	}
}

func TestJiraPriority_AllBranches(t *testing.T) {
	cases := []struct {
		sev  analysis.Severity
		want string
	}{
		{analysis.SeverityCritical, "Highest"},
		{analysis.SeverityHigh, "High"},
		{analysis.SeverityMedium, "Medium"},
		{analysis.SeverityLow, "Low"},
		{analysis.SeverityInfo, "Low"}, // default branch
	}
	for _, c := range cases {
		got := jiraPriority(c.sev)
		if got != c.want {
			t.Errorf("jiraPriority(%s) = %q, want %q", c.sev, got, c.want)
		}
	}
}

func TestBuildJiraDescription_WithFile(t *testing.T) {
	f := criticalFinding() // has File + Line
	desc := buildJiraDescription(f)
	if !strings.Contains(desc, "ci.yml") {
		t.Error("expected file name in description")
	}
	if !strings.Contains(desc, "line 42") {
		t.Error("expected line number in description")
	}
}

func TestBuildJiraDescription_WithoutFile(t *testing.T) {
	f := lowFinding() // File = ""
	desc := buildJiraDescription(f)
	if strings.Contains(desc, "File:") {
		t.Error("did not expect 'File:' in description when file is empty")
	}
}

func TestBuildJiraDescription_WithRemediation(t *testing.T) {
	f := criticalFinding() // has Remediation
	desc := buildJiraDescription(f)
	if !strings.Contains(desc, "Remediation") {
		t.Error("expected remediation section in description")
	}
}

func TestBuildJiraDescription_NoRemediation(t *testing.T) {
	f := mediumFinding() // Remediation = ""
	desc := buildJiraDescription(f)
	if strings.Contains(desc, "Remediation") {
		t.Error("did not expect remediation section when empty")
	}
}

func TestBuildJiraDescription_FileNoLine(t *testing.T) {
	f := criticalFinding()
	f.Line = 0 // file present, no line number
	desc := buildJiraDescription(f)
	// "(line N)" should not appear when Line == 0; the word "line" may appear elsewhere
	if strings.Contains(desc, "(line ") {
		t.Error("did not expect '(line N)' reference when Line=0")
	}
	// The file name itself should still appear
	if !strings.Contains(desc, "ci.yml") {
		t.Error("expected file name in description even without line number")
	}
}

// ---------------------------------------------------------------------------
// Router — full routing paths
// ---------------------------------------------------------------------------

func TestRouter_Enabled_WithSlack(t *testing.T) {
	cfg := RouterConfig{
		Slack: SlackConfig{WebhookURL: "https://hooks.slack.com/xxx"},
	}
	r := NewRouter(cfg, logging.NewDefault())
	if !r.Enabled() {
		t.Error("expected Enabled=true with Slack configured")
	}
}

func TestRouter_Enabled_WithPagerDuty(t *testing.T) {
	cfg := RouterConfig{
		PagerDuty: PagerDutyConfig{IntegrationKey: "key"},
	}
	r := NewRouter(cfg, logging.NewDefault())
	if !r.Enabled() {
		t.Error("expected Enabled=true with PagerDuty configured")
	}
}

func TestRouter_Enabled_WithJira(t *testing.T) {
	cfg := RouterConfig{
		Jira: JiraConfig{BaseURL: "https://x.atlassian.net", APIToken: "tok", ProjectKey: "SEC"},
	}
	r := NewRouter(cfg, logging.NewDefault())
	if !r.Enabled() {
		t.Error("expected Enabled=true with Jira configured")
	}
}

func TestRouter_Route_SlackError_ContinuesToOtherDestinations(t *testing.T) {
	// Slack returns 500; Jira and PD should still be attempted.
	slackSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer slackSrv.Close()

	jiraSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"key":"SEC-1"}`))
	}))
	defer jiraSrv.Close()

	r := &Router{
		slack: &SlackNotifier{
			config:     SlackConfig{WebhookURL: slackSrv.URL},
			httpClient: httpClientFor(slackSrv),
		},
		pd: NewPagerDutyNotifier(PagerDutyConfig{}), // disabled
		jira: &JiraNotifier{
			config: JiraConfig{
				BaseURL: jiraSrv.URL, Email: "a@b.com",
				APIToken: "tok", ProjectKey: "SEC", IssueType: "Bug",
			},
			httpClient: httpClientFor(jiraSrv),
		},
		logger:  logging.NewDefault(),
		dashURL: "",
	}

	// Should not panic; error logged but routing continues
	r.Route(context.Background(), criticalFinding())
}

func TestRouter_Route_AllDestinations(t *testing.T) {
	slackSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	defer slackSrv.Close()

	pdSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusAccepted)
	}))
	defer pdSrv.Close()

	jiraSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"key":"SEC-10"}`))
	}))
	defer jiraSrv.Close()

	pdClient := pdSrv.Client()
	pdClient.Transport = redirectTransport(pdSrv.URL)

	r := &Router{
		slack: &SlackNotifier{
			config:     SlackConfig{WebhookURL: slackSrv.URL},
			httpClient: httpClientFor(slackSrv),
		},
		pd: &PagerDutyNotifier{
			config:     PagerDutyConfig{IntegrationKey: "key"},
			httpClient: pdClient,
		},
		jira: &JiraNotifier{
			config: JiraConfig{
				BaseURL: jiraSrv.URL, Email: "a@b.com",
				APIToken: "tok", ProjectKey: "SEC", IssueType: "Bug",
			},
			httpClient: httpClientFor(jiraSrv),
		},
		logger:  logging.NewDefault(),
		dashURL: "https://dash",
	}

	r.Route(context.Background(), criticalFinding())
}

func TestRouter_Route_JiraError_LogsAndContinues(t *testing.T) {
	jiraSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte("forbidden"))
	}))
	defer jiraSrv.Close()

	r := &Router{
		slack: NewSlackNotifier(SlackConfig{}),
		pd:    NewPagerDutyNotifier(PagerDutyConfig{}),
		jira: &JiraNotifier{
			config: JiraConfig{
				BaseURL: jiraSrv.URL, Email: "a@b.com",
				APIToken: "tok", ProjectKey: "SEC", IssueType: "Bug",
			},
			httpClient: httpClientFor(jiraSrv),
		},
		logger:  logging.NewDefault(),
		dashURL: "",
	}

	// Should not panic; error is logged
	r.Route(context.Background(), criticalFinding())
}

func TestRouter_RouteBatch_CriticalAndHighOnly(t *testing.T) {
	pdCalls := 0
	pdSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		pdCalls++
		w.WriteHeader(http.StatusAccepted)
	}))
	defer pdSrv.Close()

	pdClient := pdSrv.Client()
	pdClient.Transport = redirectTransport(pdSrv.URL)

	slackSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	defer slackSrv.Close()

	r := &Router{
		slack: &SlackNotifier{
			config:     SlackConfig{WebhookURL: slackSrv.URL},
			httpClient: httpClientFor(slackSrv),
		},
		pd: &PagerDutyNotifier{
			config:     PagerDutyConfig{IntegrationKey: "key"},
			httpClient: pdClient,
		},
		jira:    NewJiraNotifier(JiraConfig{}),
		logger:  logging.NewDefault(),
		dashURL: "",
	}

	findings := []analysis.Finding{
		criticalFinding(), // should trigger PD
		highFinding(),     // should trigger PD
		mediumFinding(),   // should NOT trigger PD
		lowFinding(),      // should NOT trigger PD
	}

	r.RouteBatch(context.Background(), findings, "conn", "run")

	if pdCalls != 2 {
		t.Errorf("expected 2 PD calls (critical+high), got %d", pdCalls)
	}
}

func TestRouter_RouteBatch_JiraForCriticalAndHigh(t *testing.T) {
	jiraCalls := 0
	jiraSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		jiraCalls++
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"key":"SEC-99"}`))
	}))
	defer jiraSrv.Close()

	slackSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	defer slackSrv.Close()

	r := &Router{
		slack: &SlackNotifier{
			config:     SlackConfig{WebhookURL: slackSrv.URL},
			httpClient: httpClientFor(slackSrv),
		},
		pd: NewPagerDutyNotifier(PagerDutyConfig{}),
		jira: &JiraNotifier{
			config: JiraConfig{
				BaseURL: jiraSrv.URL, Email: "a@b.com",
				APIToken: "tok", ProjectKey: "SEC", IssueType: "Bug",
			},
			httpClient: httpClientFor(jiraSrv),
		},
		logger:  logging.NewDefault(),
		dashURL: "https://dash",
	}

	findings := []analysis.Finding{
		criticalFinding(), // Jira ticket
		highFinding(),     // Jira ticket
		mediumFinding(),   // no Jira
	}

	r.RouteBatch(context.Background(), findings, "conn", "run")

	if jiraCalls != 2 {
		t.Errorf("expected 2 Jira calls (critical+high), got %d", jiraCalls)
	}
}

func TestRouter_RouteBatch_SlackError_Continues(t *testing.T) {
	slackSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer slackSrv.Close()

	r := &Router{
		slack: &SlackNotifier{
			config:     SlackConfig{WebhookURL: slackSrv.URL},
			httpClient: httpClientFor(slackSrv),
		},
		pd:      NewPagerDutyNotifier(PagerDutyConfig{}),
		jira:    NewJiraNotifier(JiraConfig{}),
		logger:  logging.NewDefault(),
		dashURL: "",
	}

	// Should not panic even if Slack fails
	r.RouteBatch(context.Background(), []analysis.Finding{criticalFinding()}, "conn", "run")
}

func TestRouter_RouteBatch_JiraError_LogsAndContinues(t *testing.T) {
	jiraSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte("unauthorized"))
	}))
	defer jiraSrv.Close()

	r := &Router{
		slack: NewSlackNotifier(SlackConfig{}),
		pd:    NewPagerDutyNotifier(PagerDutyConfig{}),
		jira: &JiraNotifier{
			config: JiraConfig{
				BaseURL: jiraSrv.URL, Email: "a@b.com",
				APIToken: "tok", ProjectKey: "SEC", IssueType: "Bug",
			},
			httpClient: httpClientFor(jiraSrv),
		},
		logger:  logging.NewDefault(),
		dashURL: "",
	}

	r.RouteBatch(context.Background(), []analysis.Finding{criticalFinding(), highFinding()}, "conn", "run")
}

func TestRouter_RouteBatch_PDError_LogsAndContinues(t *testing.T) {
	pdSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("internal server error"))
	}))
	defer pdSrv.Close()

	pdClient := pdSrv.Client()
	pdClient.Transport = redirectTransport(pdSrv.URL)

	r := &Router{
		slack: NewSlackNotifier(SlackConfig{}),
		pd: &PagerDutyNotifier{
			config:     PagerDutyConfig{IntegrationKey: "key"},
			httpClient: pdClient,
		},
		jira:    NewJiraNotifier(JiraConfig{}),
		logger:  logging.NewDefault(),
		dashURL: "",
	}

	r.RouteBatch(context.Background(), []analysis.Finding{criticalFinding()}, "conn", "run")
}

// ---------------------------------------------------------------------------
// hostRedirect — redirects all requests to a fixed base URL so we can
// point pdEventsV2URL (a package-level const) at an httptest server.
// ---------------------------------------------------------------------------

type hostRedirect struct {
	base     string
	delegate http.RoundTripper
}

func (rt *hostRedirect) RoundTrip(req *http.Request) (*http.Response, error) {
	// Replace scheme + host with the test server base URL
	req2 := req.Clone(req.Context())
	base := strings.TrimRight(rt.base, "/")
	req2.URL.Scheme = "http"
	req2.URL.Host = strings.TrimPrefix(base, "http://")
	return rt.delegate.RoundTrip(req2)
}

// redirectTransport constructs a transport that routes all requests to baseURL.
func redirectTransport(baseURL string) http.RoundTripper {
	return &hostRedirect{
		base:     baseURL,
		delegate: http.DefaultTransport,
	}
}
