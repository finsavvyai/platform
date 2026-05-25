package platform

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"testing"
)

func TestGitHubParsePush(t *testing.T) {
	body := `{"ref":"refs/heads/main","after":"abc123",
		"repository":{"full_name":"owner/repo","clone_url":"https://github.com/owner/repo.git"},
		"sender":{"login":"alice"}}`
	req, _ := http.NewRequest("POST", "/", bytes.NewReader([]byte(body)))
	req.Header.Set("X-GitHub-Event", "push")

	gh := &GitHub{}
	ev, err := gh.ParseWebhook(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	tests := []struct {
		name, got, want string
	}{
		{"provider", ev.Provider, "github"},
		{"action", ev.Action, "push"},
		{"repo", ev.Repo, "owner/repo"},
		{"branch", ev.Branch, "main"},
		{"sha", ev.SHA, "abc123"},
		{"sender", ev.Sender, "alice"},
	}
	for _, tt := range tests {
		if tt.got != tt.want {
			t.Errorf("%s = %q, want %q", tt.name, tt.got, tt.want)
		}
	}
}

func TestGitHubParsePR(t *testing.T) {
	body := `{"pull_request":{"number":42,"head":{"sha":"def456","ref":"feat"}},
		"repository":{"full_name":"owner/repo","clone_url":"https://github.com/owner/repo.git"},
		"sender":{"login":"bob"}}`
	req, _ := http.NewRequest("POST", "/", bytes.NewReader([]byte(body)))
	req.Header.Set("X-GitHub-Event", "pull_request")

	gh := &GitHub{}
	ev, err := gh.ParseWebhook(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ev.Action != "pull_request" {
		t.Errorf("action = %q, want pull_request", ev.Action)
	}
	if ev.PRNumber != 42 {
		t.Errorf("PRNumber = %d, want 42", ev.PRNumber)
	}
	if ev.SHA != "def456" {
		t.Errorf("SHA = %q, want def456", ev.SHA)
	}
}

func TestGitHubHMAC(t *testing.T) {
	secret := "mysecret"
	body := []byte(`{"test":true}`)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	validSig := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	tests := []struct {
		name    string
		sig     string
		wantErr bool
	}{
		{"valid signature", validSig, false},
		{"invalid signature", "sha256=bad", true},
		{"empty rejects", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gh := &GitHub{WebhookSecret: secret}
			err := gh.verifySignature(body, tt.sig)
			if (err != nil) != tt.wantErr {
				t.Errorf("err = %v, wantErr = %v", err, tt.wantErr)
			}
		})
	}
}
