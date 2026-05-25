package platform

import (
	"bytes"
	"net/http"
	"testing"
)

func TestBitbucketParsePush(t *testing.T) {
	body := `{
		"repository":{"full_name":"team/repo"},
		"actor":{"display_name":"Eve"},
		"push":{"changes":[{"new":{"name":"main","target":{"hash":"bbabc"}}}]}}`
	req, _ := http.NewRequest("POST", "/", bytes.NewReader([]byte(body)))
	req.Header.Set("X-Event-Key", "repo:push")

	bb := &Bitbucket{}
	ev, err := bb.ParseWebhook(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	tests := []struct {
		name, got, want string
	}{
		{"provider", ev.Provider, "bitbucket"},
		{"action", ev.Action, "push"},
		{"repo", ev.Repo, "team/repo"},
		{"branch", ev.Branch, "main"},
		{"sha", ev.SHA, "bbabc"},
		{"sender", ev.Sender, "Eve"},
	}
	for _, tt := range tests {
		if tt.got != tt.want {
			t.Errorf("%s = %q, want %q", tt.name, tt.got, tt.want)
		}
	}
}

func TestBitbucketParsePR(t *testing.T) {
	body := `{
		"repository":{"full_name":"team/repo"},
		"actor":{"display_name":"Frank"},
		"pullrequest":{
			"id":99,
			"source":{
				"branch":{"name":"feature"},
				"commit":{"hash":"prhash"}
			}
		}}`
	req, _ := http.NewRequest("POST", "/", bytes.NewReader([]byte(body)))
	req.Header.Set("X-Event-Key", "pullrequest:created")

	bb := &Bitbucket{}
	ev, err := bb.ParseWebhook(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Action != "pull_request" {
		t.Errorf("action = %q, want pull_request", ev.Action)
	}
	if ev.PRNumber != 99 {
		t.Errorf("PRNumber = %d, want 99", ev.PRNumber)
	}
	if ev.Branch != "feature" {
		t.Errorf("Branch = %q, want feature", ev.Branch)
	}
	if ev.SHA != "prhash" {
		t.Errorf("SHA = %q, want prhash", ev.SHA)
	}
}

func TestBitbucketParsePRUpdated(t *testing.T) {
	body := `{
		"repository":{"full_name":"team/repo"},
		"actor":{"display_name":"Grace"},
		"pullrequest":{
			"id":5,
			"source":{
				"branch":{"name":"fix"},
				"commit":{"hash":"updhash"}
			}
		}}`
	req, _ := http.NewRequest("POST", "/", bytes.NewReader([]byte(body)))
	req.Header.Set("X-Event-Key", "pullrequest:updated")

	bb := &Bitbucket{}
	ev, err := bb.ParseWebhook(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Action != "pull_request" {
		t.Errorf("action = %q, want pull_request", ev.Action)
	}
	if ev.PRNumber != 5 {
		t.Errorf("PRNumber = %d, want 5", ev.PRNumber)
	}
}
