package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

// ---------------------------------------------------------------------------
// helpers shared within this file
// ---------------------------------------------------------------------------

// webhookSecret used across all HandleGitHubWebhook tests in this file.
const testWebhookSecret = "test-webhook-secret-1234"

func signGitHubPayload(t *testing.T, secret string, payload []byte) string {
	t.Helper()
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return fmt.Sprintf("sha256=%x", mac.Sum(nil))
}

// buildFullGitHubAppConfig returns a config with all required GitHubApp fields,
// pointing the APIBaseURL at the given mock server.
func buildFullGitHubAppConfig(apiBaseURL string) *config.Config {
	cfg := &config.Config{}
	cfg.Auth.GitHubApp.AppID = 1
	cfg.Auth.GitHubApp.Slug = "pipewarden-test"
	cfg.Auth.GitHubApp.ClientID = "Iv1.testclient"
	cfg.Auth.GitHubApp.ClientSecret = "client-secret"
	cfg.Auth.GitHubApp.WebhookSecret = testWebhookSecret
	// Use a minimal RSA key just to make GenerateJWT not fail; real GH calls go to the mock.
	cfg.Auth.GitHubApp.PrivateKey = minimalRSAPrivateKey()
	cfg.Auth.GitHubApp.APIBaseURL = apiBaseURL
	return cfg
}

// minimalRSAPrivateKey returns a test RSA-2048 private key PEM (PKCS1 format).
// Generated for test use only — not sensitive, not used in production.
func minimalRSAPrivateKey() string {
	return `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAzOhNNe3/xHD5a6LsBDutabxzIEmQckeO1rE4j2HCM95OMnDI
v4LT1CTz80XgIInq+yheDPb/UEx9u39HaDAhAPwXimiBwtvEry3lBYmyys+AYcFb
+Kz8lKur7irjvZBYwFcjnSaYMvc9hbe40YtVwHXj6JkcfzHM/QuPBugeNRI0AaO6
KAVNuTMYisFc6cUk1knX8payMP/F2SqXJZHKR/yqRO8+v3tMfW2hdKlL8vR1ZM+A
Zw70WSqGK+Q9auN5CRg+VqewcRt6GbaS3aEDPNNK4KTbC8UarR2Of95bcgAyGtay
ur3kHSotmACY7Bb1g58GOug+jRmy5eTrv1T0lQIDAQABAoIBAAUJ20gts4HVk1SB
u5L5ErEMaLpNBMfCmbEOx4jDCx7yYvLbkhwfb+0CAZukRrgWHBiT7AgelLWZQ+g1
34Ag2tbm2/9TxYkQlVwHYV/K/IH/KzV8JzJMsqNHO2GOXW4+W+hS3DXTip+KM9GT
bHB+oBus6m9AQJKiG1vHintNftyoLCp+yCvr7KzTtySI80Y6UTEcaB1NA+IXBplB
0Mck3e3GiX7Rs0xtz3FZMY2fVqy48unK8XcAQ1cMzB+X75RSZi/+thMhFYzsRAFI
D+4nONcgB3FgGXD4DvJ9wQtT/xHfBKZRwuG81FgPga7kEg842cUHVdlswfbkQAj8
miBGK4ECgYEA59a09Diw8GgK2C9Tij8RDtNvYohks9rfGril/6JX5BkXQUJzmzlq
e4YrGPLOFPS85i4r8QCQJJlLcLr7z4Ocuu2Js0Fl92aSSOfMQYVBABDbsPzFhtJC
8x21qzNPE8z2LL7pBU4VYHbtSQ+fkafr1tIQISj5/Q3Y6siQMnwVX0ECgYEA4kMW
Yb4ReEhv+w4hNEHDWWDhuvY1TOAH76EglcWGxmOQI8U2R0k0qL/gS4jxVA3sot+b
fzSoOCYnftxdt/hHDxAOQRSYlvcGivE/1EoiDwftWA7+5Df/0x6BTLA8nEH6Ib24
ROVbYCl6fbA2TaxkyWfpJUlvRCyIhI/s5FU7VFUCgYB0cAZT/kEHjQmdSC+p6EDV
9GUl1KDXH98bmY9tk4iW++8NDKXpWO3c+iadEh1kswJIjPnuwbyjVQZpqM+dillm
HLUi/X6Lwc1IpnqUkatysATWoC1IqEONvOcoA838gN1G3d9EldHwr+o+3oTi77Zo
HvqQ3PapHJJMYMzjPiSxwQKBgQDiOV2JgLaK4zJDfA8q5o3hMYLAoicMo/qLVzjz
RrnIZgfaG/Z3M/SYvLAQFe3ksr9k4dnhR87hxRQ8PSzfIjg6ET2PSH6AgqBiD3BY
W37ONIjUQLoNiQgaGCgDezo+qaDkV4KEMCY6cX5taOACrVlgHqr3gwLi0Pv2PskG
S0m0uQKBgBvjSIrDml2GwzFDQKjDD4FZrnv/BETal+NzQMe1NfTl9Yw8JKRl73bu
GNnXxgLzYpEjy5M5Uc5150MGUr6em45M5LkNEvAv+MO3g6RJIURpSTvySVeCpC/K
6UCfisNQRPIKiTGPgV/cOlgKA4z3+/YqoGzLlUdZ9siIbE/cOvNL
-----END RSA PRIVATE KEY-----`
}

// ---------------------------------------------------------------------------
// HandleGitHubCallback — full success path
// ---------------------------------------------------------------------------

func TestHandleGitHubCallback_FullSuccess(t *testing.T) {
	// Mock GitHub API server: serves installation token + installations list.
	mockGH := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && pathContains(r.URL.Path, "access_tokens"):
			// POST /app/installations/:id/access_tokens → return token
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"token":      "ghs_test_installation_token",
				"expires_at": time.Now().Add(time.Hour).Format(time.RFC3339),
			})
		case r.Method == http.MethodGet && r.URL.Path == "/app/installations":
			// GET /app/installations → return list
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]map[string]interface{}{
				{
					"id":       float64(42),
					"app_id":   float64(1),
					"html_url": "https://github.com/installations/42",
					"account":  map[string]interface{}{"login": "testorg", "id": float64(100)},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer mockGH.Close()

	h, db := newTestHandlersDB(t)
	h.cfg = buildFullGitHubAppConfig(mockGH.URL)

	// Seed a valid OAuth state into DB.
	state := "test-state-value-abc123"
	require.NoError(t, db.SaveOAuthState(state, "github_app", time.Now().Add(10*time.Minute)))

	url := fmt.Sprintf("/api/v1/oauth/github/callback?state=%s&installation_id=42", state)
	req := httptest.NewRequest(http.MethodGet, url, nil)
	w := httptest.NewRecorder()
	h.HandleGitHubCallback(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp["success"].(bool))
	assert.Equal(t, float64(42), resp["installation_id"])
	assert.NotEmpty(t, resp["connection_name"])
}

func TestHandleGitHubCallback_NoCfg_ServiceUnavailable(t *testing.T) {
	h, db := newTestHandlersDB(t)
	// h.cfg is nil by default — githubApp() should fail.

	state := "state-no-cfg"
	require.NoError(t, db.SaveOAuthState(state, "github_app", time.Now().Add(10*time.Minute)))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/oauth/github/callback?state="+state, nil)
	w := httptest.NewRecorder()
	h.HandleGitHubCallback(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
}

func TestHandleGitHubCallback_MissingInstallationID(t *testing.T) {
	h, db := newTestHandlersDB(t)
	h.cfg = buildFullGitHubAppConfig("https://api.github.com") // real URL won't be hit

	state := "state-missing-id"
	require.NoError(t, db.SaveOAuthState(state, "github_app", time.Now().Add(10*time.Minute)))

	// No installation_id in query → HandleCallback returns error → 400
	req := httptest.NewRequest(http.MethodGet, "/api/v1/oauth/github/callback?state="+state, nil)
	w := httptest.NewRecorder()
	h.HandleGitHubCallback(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleGitHubCallback_TokenExchangeFails(t *testing.T) {
	// Mock GitHub API that rejects token exchange.
	mockGH := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if pathContains(r.URL.Path, "access_tokens") {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		http.NotFound(w, r)
	}))
	defer mockGH.Close()

	h, db := newTestHandlersDB(t)
	h.cfg = buildFullGitHubAppConfig(mockGH.URL)

	state := "state-token-fail"
	require.NoError(t, db.SaveOAuthState(state, "github_app", time.Now().Add(10*time.Minute)))

	url := fmt.Sprintf("/api/v1/oauth/github/callback?state=%s&installation_id=42", state)
	req := httptest.NewRequest(http.MethodGet, url, nil)
	w := httptest.NewRecorder()
	h.HandleGitHubCallback(w, req)

	assert.Equal(t, http.StatusBadGateway, w.Code)
}

// ---------------------------------------------------------------------------
// HandleGitHubWebhook — full paths
// ---------------------------------------------------------------------------

func TestHandleGitHubWebhook_ValidSignature_InstallationCreated(t *testing.T) {
	h := newTestHandlers(t)
	h.cfg = buildFullGitHubAppConfig("https://api.github.com")

	payload, _ := json.Marshal(map[string]interface{}{
		"action": "created",
		"installation": map[string]interface{}{
			"id":     float64(99),
			"app_id": float64(1),
		},
	})
	sig := signGitHubPayload(t, testWebhookSecret, payload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/oauth/github/webhook", bytes.NewReader(payload))
	req.Header.Set("X-Hub-Signature-256", sig)
	req.Header.Set("X-GitHub-Event", "installation")
	w := httptest.NewRecorder()
	h.HandleGitHubWebhook(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.True(t, resp["received"].(bool))
	assert.Equal(t, "installation", resp["event_type"])
	assert.Equal(t, "created", resp["action"])
}

func TestHandleGitHubWebhook_ValidSignature_InstallationDeleted(t *testing.T) {
	h, db := newTestHandlersDB(t)
	h.cfg = buildFullGitHubAppConfig("https://api.github.com")

	// Seed a github_app connection for installation 77 so deletion can find it.
	rec := &storage.ConnectionRecord{
		Name:           "github-app-testorg",
		Platform:       "github",
		AuthMethod:     "github_app",
		InstallationID: 77,
		Token:          "tok",
		HealthStatus:   "connected",
	}
	require.NoError(t, db.SaveConnection(rec))

	payload, _ := json.Marshal(map[string]interface{}{
		"action": "deleted",
		"installation": map[string]interface{}{
			"id":     float64(77),
			"app_id": float64(1),
		},
	})
	sig := signGitHubPayload(t, testWebhookSecret, payload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/oauth/github/webhook", bytes.NewReader(payload))
	req.Header.Set("X-Hub-Signature-256", sig)
	req.Header.Set("X-GitHub-Event", "installation")
	w := httptest.NewRecorder()
	h.HandleGitHubWebhook(w, req)

	require.Equal(t, http.StatusOK, w.Code)
}

func TestHandleGitHubWebhook_InvalidSignature(t *testing.T) {
	h := newTestHandlers(t)
	h.cfg = buildFullGitHubAppConfig("https://api.github.com")

	payload := []byte(`{"action":"created"}`)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/oauth/github/webhook", bytes.NewReader(payload))
	req.Header.Set("X-Hub-Signature-256", "sha256=badbadbadbad")
	req.Header.Set("X-GitHub-Event", "installation")
	w := httptest.NewRecorder()
	h.HandleGitHubWebhook(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestHandleGitHubWebhook_InvalidJSON(t *testing.T) {
	h := newTestHandlers(t)
	h.cfg = buildFullGitHubAppConfig("https://api.github.com")

	payload := []byte(`not valid json`)
	sig := signGitHubPayload(t, testWebhookSecret, payload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/oauth/github/webhook", bytes.NewReader(payload))
	req.Header.Set("X-Hub-Signature-256", sig)
	req.Header.Set("X-GitHub-Event", "installation")
	w := httptest.NewRecorder()
	h.HandleGitHubWebhook(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandleGitHubWebhook_NoEventTypeHeader_DefaultsToInstallation(t *testing.T) {
	h := newTestHandlers(t)
	h.cfg = buildFullGitHubAppConfig("https://api.github.com")

	payload, _ := json.Marshal(map[string]interface{}{
		"action": "created",
		"installation": map[string]interface{}{
			"id": float64(11),
		},
	})
	sig := signGitHubPayload(t, testWebhookSecret, payload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/oauth/github/webhook", bytes.NewReader(payload))
	req.Header.Set("X-Hub-Signature-256", sig)
	// No X-GitHub-Event header → should default to "installation"
	w := httptest.NewRecorder()
	h.HandleGitHubWebhook(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "installation", resp["event_type"])
}

// ---------------------------------------------------------------------------
// ListGitHubInstallations — success path via mock
// ---------------------------------------------------------------------------

func TestListGitHubInstallations_FullSuccess(t *testing.T) {
	mockGH := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/app/installations" && r.Method == http.MethodGet {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]map[string]interface{}{
				{"id": float64(1), "app_id": float64(1), "account": map[string]interface{}{"login": "myorg"}},
			})
			return
		}
		http.NotFound(w, r)
	}))
	defer mockGH.Close()

	h := newTestHandlers(t)
	h.cfg = buildFullGitHubAppConfig(mockGH.URL)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/oauth/github/installations", nil)
	w := httptest.NewRecorder()
	h.ListGitHubInstallations(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, float64(1), resp["count"])
}

func TestListGitHubInstallations_APIError(t *testing.T) {
	mockGH := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "server error", http.StatusInternalServerError)
	}))
	defer mockGH.Close()

	h := newTestHandlers(t)
	h.cfg = buildFullGitHubAppConfig(mockGH.URL)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/oauth/github/installations", nil)
	w := httptest.NewRecorder()
	h.ListGitHubInstallations(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func pathContains(s, substr string) bool {
	if len(substr) == 0 {
		return true
	}
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
