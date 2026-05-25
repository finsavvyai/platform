package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/pipewarden/internal/config"
)

// ---------------------------------------------------------------------------
// GitHubAppStatus
// ---------------------------------------------------------------------------

func TestGitHubAppStatus_NoCfg(t *testing.T) {
	h := newTestHandlers(t) // no cfg → unavailable

	req := httptest.NewRequest(http.MethodGet, "/api/v1/oauth/github/status", nil)
	w := httptest.NewRecorder()
	h.GitHubAppStatus(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp GitHubAppStatusResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.False(t, resp.Configured)
	assert.NotEmpty(t, resp.InstallPath)
	assert.NotEmpty(t, resp.Message)
}

func TestGitHubAppStatus_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/oauth/github/status", nil)
	w := httptest.NewRecorder()
	h.GitHubAppStatus(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

// ---------------------------------------------------------------------------
// InstallGitHubApp
// ---------------------------------------------------------------------------

func TestInstallGitHubApp_NoCfg_ServiceUnavailable(t *testing.T) {
	h := newTestHandlers(t) // no cfg → configured=false → 503

	req := httptest.NewRequest(http.MethodGet, "/api/v1/oauth/github/install", nil)
	w := httptest.NewRecorder()
	h.InstallGitHubApp(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
}

func TestInstallGitHubApp_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/oauth/github/install", nil)
	w := httptest.NewRecorder()
	h.InstallGitHubApp(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

// ---------------------------------------------------------------------------
// HandleGitHubCallback
// ---------------------------------------------------------------------------

func TestHandleGitHubCallback_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/oauth/github/callback", nil)
	w := httptest.NewRecorder()
	h.HandleGitHubCallback(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestHandleGitHubCallback_MissingState(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/oauth/github/callback", nil)
	w := httptest.NewRecorder()
	h.HandleGitHubCallback(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleGitHubCallback_InvalidState(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/oauth/github/callback?state=bogusstate", nil)
	w := httptest.NewRecorder()
	h.HandleGitHubCallback(w, req)

	// State is not in DB → ConsumeOAuthState returns error → 400.
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// ---------------------------------------------------------------------------
// HandleGitHubWebhook
// ---------------------------------------------------------------------------

func TestHandleGitHubWebhook_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/oauth/github/webhook", nil)
	w := httptest.NewRecorder()
	h.HandleGitHubWebhook(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestHandleGitHubWebhook_NoCfg_ServiceUnavailable(t *testing.T) {
	h := newTestHandlers(t) // no cfg → githubApp() fails → 503

	req := httptest.NewRequest(http.MethodPost, "/api/v1/oauth/github/webhook", nil)
	w := httptest.NewRecorder()
	h.HandleGitHubWebhook(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
}

// ---------------------------------------------------------------------------
// ListGitHubInstallations
// ---------------------------------------------------------------------------

func TestListGitHubInstallations_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/oauth/github/installations", nil)
	w := httptest.NewRecorder()
	h.ListGitHubInstallations(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestListGitHubInstallations_NoCfg_ServiceUnavailable(t *testing.T) {
	h := newTestHandlers(t) // no cfg → githubApp() fails → 503

	req := httptest.NewRequest(http.MethodGet, "/api/v1/oauth/github/installations", nil)
	w := httptest.NewRecorder()
	h.ListGitHubInstallations(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
}

// ---------------------------------------------------------------------------
// missingGitHubAppFields — internal helper
// ---------------------------------------------------------------------------

func TestMissingGitHubAppFields_AllMissing(t *testing.T) {
	cfg := config.GitHubAppConfig{} // zero value = all missing

	missing := missingGitHubAppFields(cfg)
	assert.Contains(t, missing, "slug")
	assert.Contains(t, missing, "app_id")
	assert.Contains(t, missing, "private_key")
	assert.Contains(t, missing, "client_id")
	assert.Contains(t, missing, "client_secret")
	assert.Contains(t, missing, "webhook_secret")
}

func TestMissingGitHubAppFields_PrivateKeyPathCountsAsPresent(t *testing.T) {
	cfg := config.GitHubAppConfig{
		Slug:           "my-app",
		AppID:          123,
		PrivateKeyPath: "/etc/app.pem", // path instead of inline key
		ClientID:       "Iv1.abc",
		ClientSecret:   "sec",
		WebhookSecret:  "whsec",
	}

	missing := missingGitHubAppFields(cfg)
	for _, m := range missing {
		assert.NotEqual(t, "private_key", m, "private_key_path satisfies the private_key requirement")
	}
}

func TestMissingGitHubAppFields_NothingMissing(t *testing.T) {
	cfg := config.GitHubAppConfig{
		Slug:          "my-app",
		AppID:         123,
		PrivateKey:    "---BEGIN KEY---",
		ClientID:      "Iv1.abc",
		ClientSecret:  "secret",
		WebhookSecret: "whsec",
	}

	missing := missingGitHubAppFields(cfg)
	assert.Empty(t, missing)
}

// ---------------------------------------------------------------------------
// slugify
// ---------------------------------------------------------------------------

func TestSlugify_Basic(t *testing.T) {
	assert.Equal(t, "my-org", slugify("My Org"))
	assert.Equal(t, "my-org", slugify("my/org"))
	assert.Equal(t, "lowercase", slugify("LOWERCASE"))
	assert.Equal(t, "trim-me", slugify("  Trim Me  "))
}

func TestSlugify_AlreadyLower(t *testing.T) {
	assert.Equal(t, "myorg", slugify("myorg"))
}
