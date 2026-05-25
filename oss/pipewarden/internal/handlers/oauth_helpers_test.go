package handlers

import (
	"testing"

	"github.com/finsavvyai/pipewarden/internal/config"
)

func TestGithubApp_NoConfig(t *testing.T) {
	h := newTestHandlers(t)
	h.cfg = nil
	if _, err := h.githubApp(); err == nil {
		t.Fatal("expected error when cfg is nil")
	}
}

func TestGithubApp_NotConfigured(t *testing.T) {
	h := newTestHandlers(t)
	h.cfg = &config.Config{}
	if _, err := h.githubApp(); err == nil {
		t.Fatal("expected error when GitHub App fields missing")
	}
}

func TestGithubApp_FullyConfigured(t *testing.T) {
	h := newTestHandlers(t)
	h.cfg = &config.Config{}
	h.cfg.Auth.GitHubApp.AppID = 123
	h.cfg.Auth.GitHubApp.PrivateKey = "fake-private-key"
	h.cfg.Auth.GitHubApp.ClientID = "Iv1.client"
	h.cfg.Auth.GitHubApp.WebhookSecret = "whsec"
	h.cfg.Auth.GitHubApp.ClientSecret = "secret"
	h.cfg.Auth.GitHubApp.Slug = "pipewarden"
	h.cfg.Auth.GitHubApp.APIBaseURL = "https://api.github.com"

	app, err := h.githubApp()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if app.Slug != "pipewarden" {
		t.Errorf("Slug = %q, want pipewarden", app.Slug)
	}
	if app.APIBaseURL != "https://api.github.com" {
		t.Errorf("APIBaseURL = %q", app.APIBaseURL)
	}
}

func TestGithubAppStatusPayload_NilCfg(t *testing.T) {
	h := newTestHandlers(t)
	h.cfg = nil
	got := h.githubAppStatusPayload()
	if got.Configured {
		t.Error("nil cfg cannot be configured")
	}
	if got.Message == "" {
		t.Error("expected diagnostic message")
	}
}

func TestGithubAppStatusPayload_PartialFlagsMissing(t *testing.T) {
	h := newTestHandlers(t)
	h.cfg = &config.Config{}
	h.cfg.Auth.GitHubApp.AppID = 99
	got := h.githubAppStatusPayload()
	if got.Configured {
		t.Error("expected Configured=false with most fields empty")
	}
	if len(got.Missing) == 0 {
		t.Error("expected Missing list to be non-empty")
	}
	for _, want := range []string{"slug", "private_key", "client_id", "client_secret", "webhook_secret"} {
		found := false
		for _, m := range got.Missing {
			if m == want {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("Missing list should contain %q, got %v", want, got.Missing)
		}
	}
}

func TestGithubAppStatusPayload_FullyConfigured(t *testing.T) {
	h := newTestHandlers(t)
	h.cfg = &config.Config{}
	h.cfg.Auth.GitHubApp.AppID = 123
	h.cfg.Auth.GitHubApp.PrivateKey = "key"
	h.cfg.Auth.GitHubApp.ClientID = "id"
	h.cfg.Auth.GitHubApp.ClientSecret = "secret"
	h.cfg.Auth.GitHubApp.WebhookSecret = "whsec"
	h.cfg.Auth.GitHubApp.Slug = "pipewarden"

	got := h.githubAppStatusPayload()
	if !got.Configured {
		t.Errorf("expected Configured=true, got Missing=%v", got.Missing)
	}
	if got.Message != "GitHub App ready" {
		t.Errorf("message = %q", got.Message)
	}
}

func TestMissingGitHubAppFields_AllEmpty(t *testing.T) {
	missing := missingGitHubAppFields(config.GitHubAppConfig{})
	want := []string{"slug", "app_id", "private_key", "client_id", "client_secret", "webhook_secret"}
	if len(missing) != len(want) {
		t.Fatalf("expected %d missing, got %d (%v)", len(want), len(missing), missing)
	}
}

func TestMissingGitHubAppFields_PrivateKeyPathSatisfies(t *testing.T) {
	cfg := config.GitHubAppConfig{
		Slug:           "x",
		AppID:          1,
		PrivateKeyPath: "/tmp/k.pem",
		ClientID:       "id",
		ClientSecret:   "sec",
		WebhookSecret:  "wh",
	}
	if got := missingGitHubAppFields(cfg); len(got) != 0 {
		t.Errorf("PrivateKeyPath should satisfy private_key requirement, got %v", got)
	}
}
