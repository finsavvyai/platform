package e2e

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestFirstTimeVisitorJourney tests the public-facing surfaces a brand-new
// visitor (human, search crawler, or AI agent) lands on before signing up.
// Journey: AI discovery files -> SPA login page -> signup gate -> OpenAPI
// inspection -> public viral assets.
func TestFirstTimeVisitorJourney(t *testing.T) {
	server, _ := setupServer(t)

	// Step 1: llms.txt is reachable and mentions PipeWarden's purpose.
	resp, err := http.Get(fmt.Sprintf("%s/llms.txt", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode, "llms.txt must return 200")
	body, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	assert.Contains(t, strings.ToLower(string(body)), "pipewarden", "llms.txt should describe PipeWarden")

	// Step 2: AI plugin manifest validates.
	resp, err = http.Get(fmt.Sprintf("%s/.well-known/ai-plugin.json", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var manifest map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&manifest))
	_ = resp.Body.Close()
	assert.NotEmpty(t, manifest["name_for_human"])

	// Step 3: security.txt (RFC 9116) is reachable.
	resp, err = http.Get(fmt.Sprintf("%s/.well-known/security.txt", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body, _ = io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	assert.Contains(t, string(body), "Contact:", "security.txt must include Contact line")

	// Step 4: OpenAPI spec is valid JSON.
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/openapi.json", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var spec map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&spec))
	_ = resp.Body.Close()
	assert.NotEmpty(t, spec["paths"], "OpenAPI spec must declare paths")

	// Step 5: Status endpoint reachable without auth.
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/status", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	_ = resp.Body.Close()

	// Step 6: Marketing badge + OG card render as SVG.
	for _, path := range []string{"/api/v1/badge/demo.svg", "/api/v1/og/demo.svg"} {
		resp, err = http.Get(server.URL + path)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode, path)
		_ = resp.Body.Close()
	}

	// Step 7: Security audit endpoint exposes posture.
	resp, err = http.Get(fmt.Sprintf("%s/api/v1/security/audit", server.URL))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var audit map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&audit))
	_ = resp.Body.Close()
	assert.NotNil(t, audit, "audit must return body")

	// Step 8: Embed widget surfaces respond.
	for _, path := range []string{"/api/v1/embed/findings", "/api/v1/embed/summary", "/api/v1/embed/config"} {
		resp, err = http.Get(server.URL + path)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode, path)
		_ = resp.Body.Close()
	}
}

// TestFirstTimeVisitorSignupFlow walks a new user through signup → auth/me.
func TestFirstTimeVisitorSignupFlow(t *testing.T) {
	t.Setenv("PIPEWARDEN_SESSION_SECRET", "first-time-visitor-test-secret-x")

	server, _ := setupServer(t)
	client := &http.Client{}

	// Signup.
	signupBody := `{"email":"newbie@pipewarden.io","password":"strongpass1234"}`
	req, _ := http.NewRequest("POST", server.URL+"/api/v1/auth/signup", strings.NewReader(signupBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode, "signup must succeed")
	cookies := resp.Cookies()
	_ = resp.Body.Close()
	require.NotEmpty(t, cookies, "signup must issue session cookie")

	// AuthMe with the issued cookie.
	req, _ = http.NewRequest("GET", server.URL+"/api/v1/auth/me", nil)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	resp, err = client.Do(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	assert.Contains(t, string(body), "newbie@pipewarden.io", "auth/me should echo new user email")

	// Logout.
	req, _ = http.NewRequest("POST", server.URL+"/api/v1/auth/logout", nil)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	resp, err = client.Do(req)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	_ = resp.Body.Close()
}
