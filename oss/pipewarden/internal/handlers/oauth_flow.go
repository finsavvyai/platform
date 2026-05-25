package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

// HandleGitHubCallback processes GitHub App callback after installation.
// GET /api/v1/oauth/github/callback?installation_id=...&state=...
func (h *Handlers) HandleGitHubCallback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	state := r.URL.Query().Get("state")
	if state == "" {
		http.Error(w, "missing state parameter", http.StatusBadRequest)
		return
	}
	if err := h.db.ConsumeOAuthState(state, "github_app"); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	app, err := h.githubApp()
	if err != nil {
		jsonError(w, err.Error(), http.StatusServiceUnavailable)
		return
	}

	installationID, err := app.HandleCallback(r)
	if err != nil {
		h.logger.Errorw("failed to parse callback", "error", err)
		http.Error(w, fmt.Sprintf("callback error: %v", err), http.StatusBadRequest)
		return
	}

	token, err := app.GenerateInstallationToken(installationID, nil)
	if err != nil {
		h.logger.Errorw("failed to exchange installation token", "installation_id", installationID, "error", err)
		jsonError(w, "failed to exchange installation token", http.StatusBadGateway)
		return
	}

	identity, installURL := h.lookupGitHubInstallation(app, installationID)
	connectionName := fmt.Sprintf("github-app-%d", installationID)
	if identity != "" {
		connectionName = fmt.Sprintf("github-app-%s", slugify(identity))
	}

	rec := &storage.ConnectionRecord{
		Name:             connectionName,
		Platform:         string(integrations.PlatformGitHub),
		AuthMethod:       "github_app",
		Token:            token.Token,
		BaseURL:          app.APIBaseURL,
		ProviderIdentity: identity,
		InstallationID:   installationID,
		CredentialRef:    fmt.Sprintf("github_app:%d", installationID),
		HealthStatus:     "pending",
	}
	if installURL != "" {
		rec.BaseURL = app.APIBaseURL
		rec.ProviderIdentity = identity
		rec.CredentialRef = installURL
	}

	if err := h.EncryptCredentials(rec); err != nil {
		jsonError(w, err.Error(), vaultErrorStatus(err))
		return
	}
	if err := h.db.SaveConnection(rec); err != nil {
		h.logger.Errorw("failed to save github app connection", "error", err)
		jsonError(w, "failed to save connection", http.StatusInternalServerError)
		return
	}

	provider := buildProvider(rec.Platform, rec.AuthMethod, token.Token, "", "", rec.BaseURL, h.cfg, h.logger)
	if provider != nil {
		h.manager.Replace(rec.Name, provider)
	}

	h.recordAudit(r.Context(), "oauth_github_installed", auditActor(r), rec.Name, "connection", map[string]string{
		"installation_id":   fmt.Sprintf("%d", installationID),
		"provider_identity": rec.ProviderIdentity,
		"auth_method":       rec.AuthMethod,
	})

	jsonOK(w, map[string]interface{}{
		"success":           true,
		"installation_id":   installationID,
		"connection_name":   rec.Name,
		"provider_identity": rec.ProviderIdentity,
		"auth_method":       rec.AuthMethod,
	})
}

// HandleGitHubWebhook processes GitHub App webhook events.
// POST /api/v1/oauth/github/webhook
func (h *Handlers) HandleGitHubWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	app, err := h.githubApp()
	if err != nil {
		jsonError(w, err.Error(), http.StatusServiceUnavailable)
		return
	}

	signature := r.Header.Get("X-Hub-Signature-256")
	payload, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "failed to read body", http.StatusBadRequest)
		return
	}
	if !app.VerifyWebhookSignature(payload, signature) {
		http.Error(w, "invalid signature", http.StatusUnauthorized)
		return
	}

	var event map[string]interface{}
	if err := json.Unmarshal(payload, &event); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	action, _ := event["action"].(string)
	eventType := r.Header.Get("X-GitHub-Event")
	if eventType == "" {
		eventType = "installation"
	}

	if installation, ok := event["installation"].(map[string]interface{}); ok {
		if id, ok := installation["id"].(float64); ok {
			installationID := int64(id)
			details := map[string]string{
				"installation_id": fmt.Sprintf("%d", installationID),
				"event_type":      eventType,
				"action":          action,
			}
			switch {
			case eventType == "installation" && action == "deleted":
				h.deleteGitHubInstallation(installationID)
				h.recordAudit(r.Context(), "oauth_github_uninstalled", auditActor(r),
					fmt.Sprintf("github-app:%d", installationID), "connection", details)
			case eventType == "installation" && action == "created":
				h.logger.Infow("github installation created", "installation_id", installationID)
				h.recordAudit(r.Context(), "oauth_github_installed_webhook", auditActor(r),
					fmt.Sprintf("github-app:%d", installationID), "connection", details)
			}
		}
	}

	jsonOK(w, map[string]interface{}{
		"received":   true,
		"event_type": eventType,
		"action":     action,
	})
}

// ListGitHubInstallations returns all active GitHub App installations.
// GET /api/v1/oauth/github/installations
func (h *Handlers) ListGitHubInstallations(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	app, err := h.githubApp()
	if err != nil {
		jsonError(w, err.Error(), http.StatusServiceUnavailable)
		return
	}

	installations, err := app.ListInstallations(nil)
	if err != nil {
		h.logger.Errorw("failed to list installations", "error", err)
		http.Error(w, "failed to list installations", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]interface{}{
		"installations": installations,
		"count":         len(installations),
	})
}
