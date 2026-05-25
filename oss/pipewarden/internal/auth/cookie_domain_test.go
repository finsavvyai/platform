package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestIssueSessionCookie_HonorsCookieDomainEnv(t *testing.T) {
	t.Setenv("PIPEWARDEN_SESSION_SECRET", "test-secret")
	t.Setenv("PIPEWARDEN_COOKIE_DOMAIN", "pipewarden.io")

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	IssueSessionCookie(w, r, "tok")

	cookies := w.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("expected 1 cookie, got %d", len(cookies))
	}
	if cookies[0].Domain != "pipewarden.io" {
		t.Errorf("Domain = %q, want pipewarden.io", cookies[0].Domain)
	}
}

func TestIssueSessionCookie_NoDomainWhenEnvUnset(t *testing.T) {
	t.Setenv("PIPEWARDEN_SESSION_SECRET", "test-secret")
	t.Setenv("PIPEWARDEN_COOKIE_DOMAIN", "")

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	IssueSessionCookie(w, r, "tok")

	cookies := w.Result().Cookies()
	if cookies[0].Domain != "" {
		t.Errorf("Domain should be empty (host-only), got %q", cookies[0].Domain)
	}
}

func TestClearSessionCookie_MatchesIssueDomain(t *testing.T) {
	t.Setenv("PIPEWARDEN_COOKIE_DOMAIN", "pipewarden.io")
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	ClearSessionCookie(w, r)
	cookies := w.Result().Cookies()
	if cookies[0].Domain != "pipewarden.io" {
		t.Errorf("logout cookie must match issue domain or browser keeps stale cookie; got %q", cookies[0].Domain)
	}
	if cookies[0].MaxAge >= 0 {
		t.Errorf("logout cookie MaxAge should be negative, got %d", cookies[0].MaxAge)
	}
}
