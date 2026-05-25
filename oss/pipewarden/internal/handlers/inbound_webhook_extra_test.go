package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/config"
)

func TestGitLabWebhookSecretBranches(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	// cfg present, secret unset → "".
	if got := h.gitlabWebhookSecret(); got != "" {
		t.Fatalf("default: %q", got)
	}
	// cfg present, secret set.
	h.cfg = &config.Config{}
	h.cfg.Auth.GitLabWebhookSecret = "shh"
	if got := h.gitlabWebhookSecret(); got != "shh" {
		t.Fatalf("set: %q", got)
	}
	// cfg nil → "".
	h.cfg = nil
	if got := h.gitlabWebhookSecret(); got != "" {
		t.Fatalf("nil cfg: %q", got)
	}
}

func TestGitHubWebhookSecretBranches(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	if got := h.githubWebhookSecret(); got != "" {
		t.Fatalf("default: %q", got)
	}
	h.cfg = &config.Config{}
	h.cfg.Auth.GitHubApp.WebhookSecret = "shh"
	if got := h.githubWebhookSecret(); got != "shh" {
		t.Fatalf("set: %q", got)
	}
	h.cfg = nil
	if got := h.githubWebhookSecret(); got != "" {
		t.Fatalf("nil cfg: %q", got)
	}
}

func TestVerifyGitLabToken(t *testing.T) {
	if verifyGitLabToken("", "secret") {
		t.Fatal("empty incoming")
	}
	if verifyGitLabToken("incoming", "") {
		t.Fatal("empty secret")
	}
	if !verifyGitLabToken("shh", "shh") {
		t.Fatal("match")
	}
	if verifyGitLabToken("a", "b") {
		t.Fatal("mismatch")
	}
}

func TestVerifyGitHubSignatureNoSecret(t *testing.T) {
	if !verifyGitHubSignature([]byte("body"), "", "") {
		t.Fatal("empty secret should pass (open mode)")
	}
}

func TestVerifyGitHubSignatureBadPrefix(t *testing.T) {
	if verifyGitHubSignature([]byte("body"), "md5=xyz", "secret") {
		t.Fatal("non-sha256 prefix")
	}
}

func TestVerifyGitHubSignatureValid(t *testing.T) {
	secret := "shh"
	body := []byte("hello")
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	sig := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	if !verifyGitHubSignature(body, sig, secret) {
		t.Fatal("valid signature rejected")
	}
}

func TestVerifyGitHubSignatureInvalid(t *testing.T) {
	if verifyGitHubSignature([]byte("body"), "sha256=deadbeef", "secret") {
		t.Fatal("invalid signature accepted")
	}
}

func TestParseGitHubPayload(t *testing.T) {
	body := []byte(`{"repository":{"full_name":"owner/repo"}}`)
	repo, trig := parseGitHubPayload("push", body)
	if repo != "owner/repo" || trig != "github_push" {
		t.Fatalf("push: %q %q", repo, trig)
	}
	repo, trig = parseGitHubPayload("pull_request", body)
	if repo != "owner/repo" || trig == "" {
		t.Fatalf("PR: %q %q", repo, trig)
	}
}

func TestParseGitLabPayload(t *testing.T) {
	body := []byte(`{"project":{"path_with_namespace":"group/proj"}}`)
	repo, trig := parseGitLabPayload("Push Hook", body)
	if repo != "group/proj" || trig == "" {
		t.Fatalf("push: %q %q", repo, trig)
	}
	repo, trig = parseGitLabPayload("Merge Request Hook", body)
	if repo == "" || trig == "" {
		t.Fatalf("MR: %q %q", repo, trig)
	}
}
