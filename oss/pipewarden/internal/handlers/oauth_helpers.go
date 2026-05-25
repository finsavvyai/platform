package handlers

import (
	"fmt"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/auth"
	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/integrations"
)

func (h *Handlers) githubApp() (*auth.GitHubApp, error) {
	if h.cfg == nil {
		return nil, fmt.Errorf("github app configuration is unavailable")
	}
	cfg := h.cfg.Auth.GitHubApp
	if cfg.AppID == 0 || cfg.PrivateKey == "" || cfg.ClientID == "" {
		return nil, fmt.Errorf("github app is not fully configured")
	}

	app := auth.NewGitHubApp(cfg.AppID, cfg.PrivateKey, cfg.WebhookSecret, cfg.ClientID, cfg.ClientSecret)
	app.Slug = cfg.Slug
	app.APIBaseURL = cfg.APIBaseURL
	return app, nil
}

func (h *Handlers) githubAppStatusPayload() GitHubAppStatusResponse {
	status := GitHubAppStatusResponse{
		InstallPath:  "/api/v1/oauth/github/install",
		CallbackPath: "/api/v1/oauth/github/callback",
		WebhookPath:  "/api/v1/oauth/github/webhook",
		Missing:      []string{},
		Message:      "github app configuration is unavailable",
	}
	if h.cfg == nil {
		return status
	}

	cfg := h.cfg.Auth.GitHubApp
	status.Enabled = cfg.Enabled
	status.Slug = cfg.Slug
	status.APIBaseURL = cfg.APIBaseURL
	status.Missing = missingGitHubAppFields(cfg)
	status.Configured = len(status.Missing) == 0
	if status.Configured {
		status.Message = "GitHub App ready"
		return status
	}

	status.Message = fmt.Sprintf("Missing GitHub App configuration: %s", strings.Join(status.Missing, ", "))
	return status
}

func missingGitHubAppFields(cfg config.GitHubAppConfig) []string {
	var missing []string
	if cfg.Slug == "" {
		missing = append(missing, "slug")
	}
	if cfg.AppID == 0 {
		missing = append(missing, "app_id")
	}
	if cfg.PrivateKey == "" && cfg.PrivateKeyPath == "" {
		missing = append(missing, "private_key")
	}
	if cfg.ClientID == "" {
		missing = append(missing, "client_id")
	}
	if cfg.ClientSecret == "" {
		missing = append(missing, "client_secret")
	}
	if cfg.WebhookSecret == "" {
		missing = append(missing, "webhook_secret")
	}
	return missing
}

func (h *Handlers) lookupGitHubInstallation(app *auth.GitHubApp, installationID int64) (string, string) {
	installations, err := app.ListInstallations(nil)
	if err != nil {
		h.logger.Warnw("failed to list github installations", "error", err)
		return "", ""
	}
	for _, installation := range installations {
		if installation.ID == installationID {
			return installation.Account.Login, installation.HTMLURL
		}
	}
	return "", ""
}

func (h *Handlers) deleteGitHubInstallation(installationID int64) {
	records, err := h.db.List()
	if err != nil {
		h.logger.Errorw("failed to list connections for installation cleanup", "error", err)
		return
	}
	for _, rec := range records {
		if rec.Platform != string(integrations.PlatformGitHub) || rec.AuthMethod != "github_app" || rec.InstallationID != installationID {
			continue
		}
		if err := h.db.Delete(rec.Name); err != nil {
			h.logger.Errorw("failed to delete github installation connection", "name", rec.Name, "error", err)
			continue
		}
		_ = h.manager.Remove(rec.Name)
	}
}

func slugify(value string) string {
	value = strings.TrimSpace(strings.ToLower(value))
	value = strings.ReplaceAll(value, " ", "-")
	value = strings.ReplaceAll(value, "/", "-")
	return value
}
