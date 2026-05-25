package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// ---------------------------------------------------------------------------
// InstallGitHubApp — success path (state saved, redirect issued)
// ---------------------------------------------------------------------------

func TestInstallGitHubApp_FullSuccess_Redirect(t *testing.T) {
	h := newTestHandlers(t)
	h.cfg = buildFullGitHubAppConfig("https://api.github.com")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/oauth/github/install", nil)
	w := httptest.NewRecorder()
	h.InstallGitHubApp(w, req)

	// Expect 302 redirect to GitHub's install page.
	assert.Equal(t, http.StatusFound, w.Code)
	loc := w.Header().Get("Location")
	assert.Contains(t, loc, "https://github.com/apps/pipewarden-test/installations/new")
	assert.Contains(t, loc, "state=")
}

func TestInstallGitHubApp_ConfiguredButNoSlug_ServiceUnavailable(t *testing.T) {
	h := newTestHandlers(t)
	cfg := buildFullGitHubAppConfig("https://api.github.com")
	cfg.Auth.GitHubApp.Slug = "" // slug missing → not configured → 503
	h.cfg = cfg

	req := httptest.NewRequest(http.MethodGet, "/api/v1/oauth/github/install", nil)
	w := httptest.NewRecorder()
	h.InstallGitHubApp(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
}

// TestInstallGitHubApp_StateSavedToDB verifies the generated state token is
// persisted and can be consumed during a subsequent callback.
func TestInstallGitHubApp_StateSavedToDB(t *testing.T) {
	h, db := newTestHandlersDB(t)
	h.cfg = buildFullGitHubAppConfig("https://api.github.com")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/oauth/github/install", nil)
	w := httptest.NewRecorder()
	h.InstallGitHubApp(w, req)

	require.Equal(t, http.StatusFound, w.Code)

	loc := w.Header().Get("Location")
	require.Contains(t, loc, "state=")

	// Parse the redirect URL properly to recover the original state value.
	u, err := url.Parse(loc)
	require.NoError(t, err)
	state := u.Query().Get("state")
	require.NotEmpty(t, state, "state must be present in redirect URL")

	// ConsumeOAuthState succeeds only if the state was actually saved to DB.
	err = db.ConsumeOAuthState(state, "github_app")
	require.NoError(t, err, "state must be persisted and consumable after InstallGitHubApp")
}

// ---------------------------------------------------------------------------
// lookupGitHubInstallation — mock ListInstallations via APIBaseURL
// ---------------------------------------------------------------------------

func TestLookupGitHubInstallation_Found(t *testing.T) {
	mockGH := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/app/installations" {
			_ = json.NewEncoder(w).Encode([]map[string]interface{}{
				{
					"id":       float64(55),
					"app_id":   float64(1),
					"html_url": "https://github.com/installations/55",
					"account":  map[string]interface{}{"login": "myorg", "id": float64(10)},
				},
			})
			return
		}
		http.NotFound(w, r)
	}))
	defer mockGH.Close()

	h := newTestHandlers(t)
	h.cfg = buildFullGitHubAppConfig(mockGH.URL)

	app, err := h.githubApp()
	require.NoError(t, err)

	login, htmlURL := h.lookupGitHubInstallation(app, 55)
	assert.Equal(t, "myorg", login)
	assert.Equal(t, "https://github.com/installations/55", htmlURL)
}

func TestLookupGitHubInstallation_IDNotInList_ReturnsEmpty(t *testing.T) {
	mockGH := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/app/installations" {
			_ = json.NewEncoder(w).Encode([]map[string]interface{}{
				{"id": float64(99), "app_id": float64(1), "account": map[string]interface{}{"login": "other"}},
			})
			return
		}
		http.NotFound(w, r)
	}))
	defer mockGH.Close()

	h := newTestHandlers(t)
	h.cfg = buildFullGitHubAppConfig(mockGH.URL)

	app, err := h.githubApp()
	require.NoError(t, err)

	login, htmlURL := h.lookupGitHubInstallation(app, 55) // 55 not in list
	assert.Equal(t, "", login)
	assert.Equal(t, "", htmlURL)
}

func TestLookupGitHubInstallation_APIError_ReturnsEmpty(t *testing.T) {
	mockGH := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "server error", http.StatusInternalServerError)
	}))
	defer mockGH.Close()

	h := newTestHandlers(t)
	h.cfg = buildFullGitHubAppConfig(mockGH.URL)

	app, err := h.githubApp()
	require.NoError(t, err)

	login, htmlURL := h.lookupGitHubInstallation(app, 55)
	assert.Equal(t, "", login)
	assert.Equal(t, "", htmlURL)
}

// ---------------------------------------------------------------------------
// deleteGitHubInstallation — removes matching connection records from DB
// ---------------------------------------------------------------------------

func TestDeleteGitHubInstallation_RemovesMatchingConnections(t *testing.T) {
	h, db := newTestHandlersDB(t)

	recMatch := &storage.ConnectionRecord{
		Name:           "github-app-myorg",
		Platform:       "github",
		AuthMethod:     "github_app",
		InstallationID: 42,
		Token:          "tok",
		HealthStatus:   "connected",
	}
	recOther := &storage.ConnectionRecord{
		Name:           "github-app-otherorg",
		Platform:       "github",
		AuthMethod:     "github_app",
		InstallationID: 99,
		Token:          "tok",
		HealthStatus:   "connected",
	}
	require.NoError(t, db.SaveConnection(recMatch))
	require.NoError(t, db.SaveConnection(recOther))

	h.deleteGitHubInstallation(42)

	list, err := db.List()
	require.NoError(t, err)
	names := make([]string, 0, len(list))
	for _, r := range list {
		names = append(names, r.Name)
	}
	assert.NotContains(t, names, "github-app-myorg")
	assert.Contains(t, names, "github-app-otherorg")
}

func TestDeleteGitHubInstallation_NoMatch_IsNoop(t *testing.T) {
	h, db := newTestHandlersDB(t)

	rec := &storage.ConnectionRecord{
		Name:           "github-app-other",
		Platform:       "github",
		AuthMethod:     "github_app",
		InstallationID: 99,
		Token:          "tok",
		HealthStatus:   "connected",
	}
	require.NoError(t, db.SaveConnection(rec))

	require.NotPanics(t, func() {
		h.deleteGitHubInstallation(77) // no connection has installationID 77
	})

	list, err := db.List()
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestDeleteGitHubInstallation_SkipsNonGitHubApp(t *testing.T) {
	h, db := newTestHandlersDB(t)

	// A github connection using PAT auth (not github_app) — must be preserved.
	rec := &storage.ConnectionRecord{
		Name:           "github-pat-conn",
		Platform:       "github",
		AuthMethod:     "token",
		InstallationID: 42, // same ID but not github_app
		Token:          "ghp_test",
		HealthStatus:   "connected",
	}
	require.NoError(t, db.SaveConnection(rec))

	h.deleteGitHubInstallation(42)

	list, err := db.List()
	require.NoError(t, err)
	assert.Len(t, list, 1, "PAT connection with same installationID must not be deleted")
}

// ---------------------------------------------------------------------------
// GitHubAppStatus — configured case
// ---------------------------------------------------------------------------

func TestGitHubAppStatus_FullyConfiguredResponse(t *testing.T) {
	h := newTestHandlers(t)
	h.cfg = buildFullGitHubAppConfig("https://api.github.com")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/oauth/github/status", nil)
	w := httptest.NewRecorder()
	h.GitHubAppStatus(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp GitHubAppStatusResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp.Configured)
	assert.Equal(t, "GitHub App ready", resp.Message)
	assert.Equal(t, "pipewarden-test", resp.Slug)
	assert.Empty(t, resp.Missing)
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
