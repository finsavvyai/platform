package platform

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"testing"
)

func TestCircleCIParseWorkflow(t *testing.T) {
	body := `{"type":"workflow-completed",
		"project":{"slug":"gh/acme/repo"},
		"organization":{"name":"acme"},
		"workflow":{"name":"build","status":"success"},
		"pipeline":{
			"vcs":{"revision":"cirsha","branch":"main","origin_repository_url":"https://github.com/acme/repo"},
			"trigger":{"actor":{"login":"hank"}}}}`
	req, _ := http.NewRequest("POST", "/", bytes.NewReader([]byte(body)))

	cc := &CircleCI{}
	ev, err := cc.ParseWebhook(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	tests := []struct{ name, got, want string }{
		{"provider", ev.Provider, "circleci"},
		{"action", ev.Action, "workflow-completed"},
		{"repo", ev.Repo, "acme/repo"},
		{"branch", ev.Branch, "main"},
		{"sha", ev.SHA, "cirsha"},
		{"sender", ev.Sender, "hank"},
	}
	for _, tt := range tests {
		if tt.got != tt.want {
			t.Errorf("%s = %q, want %q", tt.name, tt.got, tt.want)
		}
	}
}

func TestCircleCIHMAC(t *testing.T) {
	secret := "circlesecret"
	body := []byte(`{"type":"job-completed"}`)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	validSig := "v1=" + hex.EncodeToString(mac.Sum(nil))

	tests := []struct {
		name    string
		sig     string
		wantErr bool
	}{
		{"valid signature", validSig, false},
		{"rotating secrets", "v1=bad," + validSig, false},
		{"invalid signature", "v1=deadbeef", true},
		{"empty rejects", "", true},
		{"no secret skips", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cc := &CircleCI{WebhookSecret: secret}
			if tt.name == "no secret skips" {
				cc.WebhookSecret = ""
			}
			err := cc.verifySignature(body, tt.sig)
			if (err != nil) != tt.wantErr {
				t.Errorf("err = %v, wantErr = %v", err, tt.wantErr)
			}
		})
	}
}

func TestCircleCIStripVCSPrefix(t *testing.T) {
	cases := map[string]string{
		"gh/acme/repo":        "acme/repo",
		"bb/acme/repo":        "acme/repo",
		"github/acme/repo":    "acme/repo",
		"bitbucket/acme/repo": "acme/repo",
		"acme/repo":           "acme/repo",
		"":                    "",
	}
	for in, want := range cases {
		if got := stripVCSPrefix(in); got != want {
			t.Errorf("stripVCSPrefix(%q) = %q, want %q", in, got, want)
		}
	}
}
