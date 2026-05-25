package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/finsavvyai/pipewarden/internal/auth"
)

// GitHubAppStatusResponse reports whether GitHub App onboarding is runnable.
type GitHubAppStatusResponse struct {
	Configured   bool     `json:"configured"`
	Enabled      bool     `json:"enabled"`
	Slug         string   `json:"slug,omitempty"`
	APIBaseURL   string   `json:"api_base_url,omitempty"`
	InstallPath  string   `json:"install_path"`
	CallbackPath string   `json:"callback_path"`
	WebhookPath  string   `json:"webhook_path"`
	Missing      []string `json:"missing"`
	Message      string   `json:"message"`
}

// InstallGitHubApp redirects the user to the configured GitHub App installation page.
// GET /api/v1/oauth/github/install
func (h *Handlers) InstallGitHubApp(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	status := h.githubAppStatusPayload()
	if !status.Configured {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error":  "github app is not fully configured",
			"status": status,
		})
		return
	}

	app, err := h.githubApp()
	if err != nil {
		jsonError(w, err.Error(), http.StatusServiceUnavailable)
		return
	}
	if app.Slug == "" {
		jsonError(w, "github app slug is not configured", http.StatusServiceUnavailable)
		return
	}

	state, err := auth.GenerateState()
	if err != nil {
		h.logger.Errorw("failed to generate state", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	if err := h.db.SaveOAuthState(state, "github_app", time.Now().UTC().Add(10*time.Minute)); err != nil {
		h.logger.Errorw("failed to persist oauth state", "error", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	installURL := fmt.Sprintf("https://github.com/apps/%s/installations/new?state=%s", app.Slug, url.QueryEscape(state))
	http.Redirect(w, r, installURL, http.StatusFound)
}

// GitHubAppStatus reports current GitHub App readiness and missing configuration.
func (h *Handlers) GitHubAppStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	jsonOK(w, h.githubAppStatusPayload())
}
