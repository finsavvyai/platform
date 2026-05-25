package platform

import (
	"bytes"
	"net/http"
	"testing"
)

func TestGitLabParsePush(t *testing.T) {
	body := `{"object_kind":"push","ref":"refs/heads/main","after":"sha789",
		"project":{"path_with_namespace":"group/proj","git_http_url":"https://gitlab.com/group/proj.git"},
		"user":{"username":"carol"}}`
	req, _ := http.NewRequest("POST", "/", bytes.NewReader([]byte(body)))
	req.Header.Set("X-Gitlab-Token", "tok")

	gl := &GitLab{WebhookSecret: "tok"}
	ev, err := gl.ParseWebhook(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	tests := []struct {
		name, got, want string
	}{
		{"provider", ev.Provider, "gitlab"},
		{"action", ev.Action, "push"},
		{"repo", ev.Repo, "group/proj"},
		{"branch", ev.Branch, "main"},
		{"sha", ev.SHA, "sha789"},
		{"sender", ev.Sender, "carol"},
	}
	for _, tt := range tests {
		if tt.got != tt.want {
			t.Errorf("%s = %q, want %q", tt.name, tt.got, tt.want)
		}
	}
}

func TestGitLabParseMR(t *testing.T) {
	body := `{"object_kind":"merge_request",
		"project":{"path_with_namespace":"group/proj","git_http_url":"https://gitlab.com/group/proj.git"},
		"user":{"username":"dan"},
		"object_attributes":{"iid":7,"source_branch":"feat","source":{},"last_commit":"mrabc"}}`
	req, _ := http.NewRequest("POST", "/", bytes.NewReader([]byte(body)))

	gl := &GitLab{}
	ev, err := gl.ParseWebhook(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Action != "merge_request" {
		t.Errorf("action = %q, want merge_request", ev.Action)
	}
	if ev.PRNumber != 7 {
		t.Errorf("PRNumber = %d, want 7", ev.PRNumber)
	}
	if ev.Branch != "feat" {
		t.Errorf("Branch = %q, want feat", ev.Branch)
	}
}

func TestGitLabTokenVerification(t *testing.T) {
	tests := []struct {
		name    string
		secret  string
		token   string
		wantErr bool
	}{
		{"valid token", "secret", "secret", false},
		{"invalid token", "secret", "wrong", true},
		{"no secret skips", "", "anything", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := `{"object_kind":"push","ref":"refs/heads/main","after":"x",
				"project":{"path_with_namespace":"a/b"}}`
			req, _ := http.NewRequest("POST", "/", bytes.NewReader([]byte(body)))
			req.Header.Set("X-Gitlab-Token", tt.token)
			gl := &GitLab{WebhookSecret: tt.secret}
			_, err := gl.ParseWebhook(req)
			if (err != nil) != tt.wantErr {
				t.Errorf("err = %v, wantErr = %v", err, tt.wantErr)
			}
		})
	}
}
