package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/config"
)

func TestSCAScanValidation(t *testing.T) {
	h, _ := newTestHandlersDB(t)

	w, _ := doJSON(t, h.SCAScan, "GET", "", nil)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("method: %d", w.Code)
	}
	w, _ = doJSON(t, h.SCAScan, "POST", `bad`, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("bad json: %d", w.Code)
	}
	w, _ = doJSON(t, h.SCAScan, "POST", `{}`, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("missing logs: %d", w.Code)
	}
}

func TestSCAScanWithGoModExtractsAndQueries(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	body := `{"logs":"module example.com/test\n\ngo 1.22\n\nrequire github.com/sirupsen/logrus v1.9.0\n"}`
	w, _ := doJSON(t, h.SCAScan, "POST", body, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status: %d body: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "dependencies") {
		t.Fatalf("expected dependencies in response: %s", w.Body.String())
	}
}

func TestGitHistoryScanGuards(t *testing.T) {
	h, _ := newTestHandlersDB(t)

	// Wrong method
	w, _ := doJSON(t, h.GitHistoryScan, "GET", "", nil)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("method: %d", w.Code)
	}
	// Bad json
	w, _ = doJSON(t, h.GitHistoryScan, "POST", `bad`, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("bad json: %d", w.Code)
	}
	// Relative path
	w, _ = doJSON(t, h.GitHistoryScan, "POST", `{"repo_path":"./relative"}`, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("relative path: %d body=%s", w.Code, w.Body.String())
	}
	// Absolute but not in allowlist (env unset by default)
	t.Setenv("PIPEWARDEN_GIT_SCAN_ROOTS", "")
	w, _ = doJSON(t, h.GitHistoryScan, "POST", `{"repo_path":"/etc"}`, nil)
	if w.Code != http.StatusForbidden {
		t.Fatalf("not allowed: %d body=%s", w.Code, w.Body.String())
	}
}

func TestGitHistoryScanAllowedButInvalidRepo(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	tmp := t.TempDir()
	t.Setenv("PIPEWARDEN_GIT_SCAN_ROOTS", tmp)
	body := `{"repo_path":"` + tmp + `"}`
	w, _ := doJSON(t, h.GitHistoryScan, "POST", body, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("invalid repo: %d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "error") {
		t.Fatalf("missing error message: %s", w.Body.String())
	}
}

func TestGitHubOAuthClientIDFallback(t *testing.T) {
	h, _ := newTestHandlersDB(t)

	// No env set, no cfg -> empty -> 503
	w, _ := doJSON(t, h.AuthGitHubStart, "GET", "", nil)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("no client id: %d body=%s", w.Code, w.Body.String())
	}

	// Env-only fallback works
	t.Setenv("PIPEWARDEN_GITHUB_CLIENT_ID", "fake-id")
	t.Setenv("PIPEWARDEN_GITHUB_CLIENT_SECRET", "fake-secret")
	w, _ = doJSON(t, h.AuthGitHubStart, "GET", "", nil)
	if w.Code != http.StatusFound {
		t.Fatalf("env fallback: %d body=%s", w.Code, w.Body.String())
	}
	loc := w.Header().Get("Location")
	if !strings.HasPrefix(loc, "https://github.com/login/oauth/authorize?") {
		t.Fatalf("redirect: %q", loc)
	}
}

func TestGitHubOAuthCallbackStateMismatch(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	req := httptest.NewRequest("GET", "/api/v1/auth/github/callback?code=x&state=mismatch", nil)
	w := httptest.NewRecorder()
	h.AuthGitHubCallback(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("state mismatch: %d body=%s", w.Code, w.Body.String())
	}
}

func TestGitHubOAuthCallbackMissingCode(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	req := httptest.NewRequest("GET", "/api/v1/auth/github/callback?state=stateval", nil)
	req.AddCookie(&http.Cookie{Name: "pipewarden_gh_state", Value: "stateval"})
	w := httptest.NewRecorder()
	h.AuthGitHubCallback(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("no code: %d body=%s", w.Code, w.Body.String())
	}
}

func TestGitHubHelpersFallbackPrecedence(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	t.Setenv("PIPEWARDEN_GITHUB_CLIENT_ID", "envid")
	t.Setenv("PIPEWARDEN_GITHUB_CLIENT_SECRET", "envsecret")
	if got := h.githubClientID(); got != "envid" {
		t.Fatalf("env clientID: %q", got)
	}
	if got := h.githubClientSecret(); got != "envsecret" {
		t.Fatalf("env clientSecret: %q", got)
	}

	h.cfg = &config.Config{}
	h.cfg.Auth.GitHubApp.ClientID = "cfgid"
	h.cfg.Auth.GitHubApp.ClientSecret = "cfgsecret"
	if got := h.githubClientID(); got != "cfgid" {
		t.Fatalf("cfg overrides env: %q", got)
	}
	if got := h.githubClientSecret(); got != "cfgsecret" {
		t.Fatalf("cfg overrides env secret: %q", got)
	}
}

func TestGitHubRedirectURIRespectsXForwardedProto(t *testing.T) {
	h, _ := newTestHandlersDB(t)

	req := httptest.NewRequest("GET", "/start", nil)
	req.Host = "test.example.com"
	uri := h.githubRedirectURI(req)
	if uri != "http://test.example.com/api/v1/auth/github/callback" {
		t.Fatalf("plain http: %q", uri)
	}

	req.Header.Set("X-Forwarded-Proto", "https")
	uri = h.githubRedirectURI(req)
	if !strings.HasPrefix(uri, "https://") {
		t.Fatalf("X-Forwarded-Proto ignored: %q", uri)
	}
}

func TestPasskeyHandlersRequireSession(t *testing.T) {
	h, _ := newTestHandlersDB(t)

	for _, hf := range []http.HandlerFunc{
		h.AuthPasskeyRegisterBegin,
		h.AuthPasskeyRegisterFinish,
	} {
		w := httptest.NewRecorder()
		req := httptest.NewRequest("POST", "/", nil)
		hf(w, req)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", w.Code)
		}
	}
}

func TestPasskeyLoginBeginDiscoverableNoBody(t *testing.T) {
	// Passkey login is discoverable — empty body returns publicKey options.
	h, _ := newTestHandlersDB(t)
	w, _ := doJSON(t, h.AuthPasskeyLoginBegin, "POST", "", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status: %d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "challenge") {
		t.Fatalf("missing challenge in response: %s", w.Body.String())
	}
}

func TestPasskeyLoginFinishMissingChallenge(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	req := httptest.NewRequest("POST", "/", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.AuthPasskeyLoginFinish(w, req)
	if w.Code != http.StatusBadRequest && w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 4xx/5xx, got %d body=%s", w.Code, w.Body.String())
	}
}
