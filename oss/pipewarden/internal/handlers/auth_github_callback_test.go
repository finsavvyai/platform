package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAuthGitHubCallbackFullHappyPath(t *testing.T) {
	withSessionSecret(t)
	t.Setenv("PIPEWARDEN_GITHUB_CLIENT_ID", "id")
	t.Setenv("PIPEWARDEN_GITHUB_CLIENT_SECRET", "secret")

	// Mock GitHub OAuth + API.
	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/login/oauth/access_token":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"access_token":"gho_test"}`))
		case "/user":
			_, _ = w.Write([]byte(`{"id":12345,"email":"oauth@pipewarden.io","name":"OAuth User","login":"oauthuser"}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer mock.Close()
	patchGitHubURLs(t, mock.URL, mock.URL)

	h, _ := newTestHandlersDB(t)

	req := httptest.NewRequest("GET", "/api/v1/auth/github/callback?code=abc&state=xyz", nil)
	req.AddCookie(&http.Cookie{Name: "pipewarden_gh_state", Value: "xyz"})
	w := httptest.NewRecorder()
	h.AuthGitHubCallback(w, req)

	if w.Code != http.StatusFound {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	loc := w.Header().Get("Location")
	if loc != "/onboarding" && loc != "/dashboard" {
		t.Fatalf("Location=%q, want /onboarding or /dashboard", loc)
	}
	// Should have issued a session cookie.
	found := false
	for _, c := range w.Result().Cookies() {
		if c.Name == "pipewarden_session" && c.Value != "" {
			found = true
		}
	}
	if !found {
		t.Fatalf("no session cookie issued")
	}
}

func TestAuthGitHubCallbackEmailConflict(t *testing.T) {
	withSessionSecret(t)
	t.Setenv("PIPEWARDEN_GITHUB_CLIENT_ID", "id")
	t.Setenv("PIPEWARDEN_GITHUB_CLIENT_SECRET", "secret")

	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/login/oauth/access_token":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"access_token":"gho_test"}`))
		case "/user":
			_, _ = w.Write([]byte(`{"id":99999,"email":"existing@pipewarden.io","name":"X","login":"x"}`))
		}
	}))
	defer mock.Close()
	patchGitHubURLs(t, mock.URL, mock.URL)

	h, db := newTestHandlersDB(t)
	// Seed local password user with same email — should trigger conflict.
	_, _ = db.CreateUser("existing@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "X", "")

	req := httptest.NewRequest("GET", "/api/v1/auth/github/callback?code=abc&state=xyz", nil)
	req.AddCookie(&http.Cookie{Name: "pipewarden_gh_state", Value: "xyz"})
	w := httptest.NewRecorder()
	h.AuthGitHubCallback(w, req)

	if w.Code != http.StatusConflict {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
}

func TestAuthGitHubCallbackTokenExchangeFails(t *testing.T) {
	withSessionSecret(t)
	t.Setenv("PIPEWARDEN_GITHUB_CLIENT_ID", "id")
	t.Setenv("PIPEWARDEN_GITHUB_CLIENT_SECRET", "secret")

	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer mock.Close()
	patchGitHubURLs(t, mock.URL, mock.URL)

	h, _ := newTestHandlersDB(t)
	req := httptest.NewRequest("GET", "/api/v1/auth/github/callback?code=abc&state=xyz", nil)
	req.AddCookie(&http.Cookie{Name: "pipewarden_gh_state", Value: "xyz"})
	w := httptest.NewRecorder()
	h.AuthGitHubCallback(w, req)

	if w.Code != http.StatusBadGateway {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
}

func TestAuthGitHubCallbackUserFetchFails(t *testing.T) {
	withSessionSecret(t)
	t.Setenv("PIPEWARDEN_GITHUB_CLIENT_ID", "id")
	t.Setenv("PIPEWARDEN_GITHUB_CLIENT_SECRET", "secret")

	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/login/oauth/access_token":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"access_token":"gho_test"}`))
		default:
			w.WriteHeader(http.StatusForbidden)
		}
	}))
	defer mock.Close()
	patchGitHubURLs(t, mock.URL, mock.URL)

	h, _ := newTestHandlersDB(t)
	req := httptest.NewRequest("GET", "/api/v1/auth/github/callback?code=abc&state=xyz", nil)
	req.AddCookie(&http.Cookie{Name: "pipewarden_gh_state", Value: "xyz"})
	w := httptest.NewRecorder()
	h.AuthGitHubCallback(w, req)

	if w.Code != http.StatusBadGateway {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
}

func TestAuthPasswordResetFinishHappyPath(t *testing.T) {
	h, db := newTestHandlersDB(t)
	withSessionSecret(t)

	u, _ := db.CreateUser("reset@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "R", "")
	// Use the public reset-begin to issue a token.
	tok, err := db.CreateAuthToken(u.ID, "password_reset", 60_000_000_000)
	if err != nil {
		t.Fatalf("CreateAuthToken: %v", err)
	}

	body, _ := json.Marshal(map[string]string{"token": tok, "password": "longenoughpassword"})
	w, cookies := doJSON(t, h.AuthPasswordResetFinish, "POST", string(body), nil)
	if w.Code != http.StatusOK {
		t.Fatalf("reset finish: %d body=%s", w.Code, w.Body.String())
	}
	if len(cookies) == 0 {
		t.Fatalf("expected session cookie after reset")
	}
	if !strings.Contains(w.Body.String(), "/dashboard") {
		t.Fatalf("expected next=/dashboard: %s", w.Body.String())
	}
}
