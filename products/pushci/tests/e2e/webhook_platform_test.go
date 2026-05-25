package e2e

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/finsavvyai/pushci/internal/platform"
)

func loadWebhookFixture(t *testing.T, name string) []byte {
	t.Helper()
	path := filepath.Join(testdataDir(t), "webhooks", name)
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read fixture %s: %v", name, err)
	}
	return data
}

func makeRequest(t *testing.T, body []byte, headers map[string]string) *http.Request {
	t.Helper()
	req := httptest.NewRequest("POST", "/webhook", bytes.NewReader(body))
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	return req
}

// --- GitHub push ---

func TestWebhook_GitHub_Push(t *testing.T) {
	body := loadWebhookFixture(t, "github_push.json")
	req := makeRequest(t, body, map[string]string{
		"X-GitHub-Event": "push",
		"Content-Type":   "application/json",
	})

	gh := &platform.GitHub{} // no webhook secret = skip signature check
	event, err := gh.ParseWebhook(req)
	if err != nil {
		t.Fatalf("ParseWebhook returned error: %v", err)
	}
	if event.Provider != "github" {
		t.Errorf("expected provider=github, got %q", event.Provider)
	}
	if event.Repo != "myorg/myrepo" {
		t.Errorf("expected repo=myorg/myrepo, got %q", event.Repo)
	}
	if event.Branch != "main" {
		t.Errorf("expected branch=main, got %q", event.Branch)
	}
	if event.SHA != "abc123def456" {
		t.Errorf("expected sha=abc123def456, got %q", event.SHA)
	}
	if event.Action != "push" {
		t.Errorf("expected action=push, got %q", event.Action)
	}
}

// --- GitHub pull_request ---

func TestWebhook_GitHub_PullRequest(t *testing.T) {
	body := loadWebhookFixture(t, "github_pr.json")
	req := makeRequest(t, body, map[string]string{
		"X-GitHub-Event": "pull_request",
	})

	gh := &platform.GitHub{}
	event, err := gh.ParseWebhook(req)
	if err != nil {
		t.Fatalf("ParseWebhook returned error: %v", err)
	}
	if event.Action != "pull_request" {
		t.Errorf("expected action=pull_request, got %q", event.Action)
	}
	if event.PRNumber != 42 {
		t.Errorf("expected PRNumber=42, got %d", event.PRNumber)
	}
	if event.SHA != "deadbeef1234" {
		t.Errorf("expected sha=deadbeef1234, got %q", event.SHA)
	}
	if event.Branch != "feature/my-branch" {
		t.Errorf("expected branch=feature/my-branch, got %q", event.Branch)
	}
}

// --- GitHub signature verification ---

func TestWebhook_GitHub_SignatureRejected(t *testing.T) {
	body := loadWebhookFixture(t, "github_push.json")
	req := makeRequest(t, body, map[string]string{
		"X-GitHub-Event":      "push",
		"X-Hub-Signature-256": "sha256=badhash",
	})

	gh := &platform.GitHub{WebhookSecret: "mysecret"}
	_, err := gh.ParseWebhook(req)
	if err == nil {
		t.Error("expected signature verification to fail with wrong hash")
	}
}

// --- GitLab push ---

func TestWebhook_GitLab_Push(t *testing.T) {
	body := loadWebhookFixture(t, "gitlab_push.json")
	req := makeRequest(t, body, map[string]string{
		"Content-Type": "application/json",
	})

	gl := &platform.GitLab{} // no secret = skip token check
	event, err := gl.ParseWebhook(req)
	if err != nil {
		t.Fatalf("ParseWebhook returned error: %v", err)
	}
	if event.Provider != "gitlab" {
		t.Errorf("expected provider=gitlab, got %q", event.Provider)
	}
	if event.Repo != "mygroup/myproject" {
		t.Errorf("expected repo=mygroup/myproject, got %q", event.Repo)
	}
	if event.Branch != "main" {
		t.Errorf("expected branch=main, got %q", event.Branch)
	}
	if event.SHA != "cafe1234abcd" {
		t.Errorf("expected sha=cafe1234abcd, got %q", event.SHA)
	}
	if event.Action != "push" {
		t.Errorf("expected action=push, got %q", event.Action)
	}
}

// --- GitLab token verification ---

func TestWebhook_GitLab_TokenRejected(t *testing.T) {
	body := loadWebhookFixture(t, "gitlab_push.json")
	req := makeRequest(t, body, map[string]string{
		"X-Gitlab-Token": "wrongtoken",
	})

	gl := &platform.GitLab{WebhookSecret: "correctsecret"}
	_, err := gl.ParseWebhook(req)
	if err == nil {
		t.Error("expected GitLab token check to fail with wrong token")
	}
}

// --- Bitbucket push ---

func TestWebhook_Bitbucket_Push(t *testing.T) {
	body := loadWebhookFixture(t, "bitbucket_push.json")
	req := makeRequest(t, body, map[string]string{
		"X-Event-Key":  "repo:push",
		"Content-Type": "application/json",
	})

	bb := &platform.Bitbucket{}
	event, err := bb.ParseWebhook(req)
	if err != nil {
		t.Fatalf("ParseWebhook returned error: %v", err)
	}
	if event.Provider != "bitbucket" {
		t.Errorf("expected provider=bitbucket, got %q", event.Provider)
	}
	if event.Repo != "myworkspace/myrepo" {
		t.Errorf("expected repo=myworkspace/myrepo, got %q", event.Repo)
	}
	if event.Branch != "main" {
		t.Errorf("expected branch=main, got %q", event.Branch)
	}
	if event.SHA != "beef1234cafe" {
		t.Errorf("expected sha=beef1234cafe, got %q", event.SHA)
	}
	if event.Action != "push" {
		t.Errorf("expected action=push, got %q", event.Action)
	}
}

// --- Invalid JSON rejected ---

func TestWebhook_GitHub_InvalidJSON(t *testing.T) {
	req := makeRequest(t, []byte("{not valid json"), map[string]string{
		"X-GitHub-Event": "push",
	})

	gh := &platform.GitHub{}
	_, err := gh.ParseWebhook(req)
	if err == nil {
		t.Error("expected error for invalid JSON payload")
	}
}

// --- Event struct fields ---

func TestWebhook_EventFields_AllPlatforms(t *testing.T) {
	// Verify each fixture produces a non-empty Repo and a known Provider.
	cases := []struct {
		fixture  string
		eventKey string
		parse    func([]byte) (*platform.Event, error)
		wantProv string
		wantRepo string
	}{
		{
			fixture:  "github_push.json",
			eventKey: "push",
			parse: func(body []byte) (*platform.Event, error) {
				req := makeRequest(t, body, map[string]string{"X-GitHub-Event": "push"})
				return (&platform.GitHub{}).ParseWebhook(req)
			},
			wantProv: "github",
			wantRepo: "myorg/myrepo",
		},
		{
			fixture: "gitlab_push.json",
			parse: func(body []byte) (*platform.Event, error) {
				req := makeRequest(t, body, nil)
				return (&platform.GitLab{}).ParseWebhook(req)
			},
			wantProv: "gitlab",
			wantRepo: "mygroup/myproject",
		},
		{
			fixture: "bitbucket_push.json",
			parse: func(body []byte) (*platform.Event, error) {
				req := makeRequest(t, body, map[string]string{"X-Event-Key": "repo:push"})
				return (&platform.Bitbucket{}).ParseWebhook(req)
			},
			wantProv: "bitbucket",
			wantRepo: "myworkspace/myrepo",
		},
	}

	for _, tc := range cases {
		t.Run(tc.wantProv, func(t *testing.T) {
			body := loadWebhookFixture(t, tc.fixture)
			event, err := tc.parse(body)
			if err != nil {
				t.Fatalf("ParseWebhook error: %v", err)
			}
			if event.Provider != tc.wantProv {
				t.Errorf("provider: want %q, got %q", tc.wantProv, event.Provider)
			}
			if event.Repo != tc.wantRepo {
				t.Errorf("repo: want %q, got %q", tc.wantRepo, event.Repo)
			}
			if event.Repo == "" {
				t.Error("Repo must not be empty")
			}
		})
	}
}
