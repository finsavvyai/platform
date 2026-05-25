package auth

import (
	"crypto/tls"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestSessionSecret_NilWhenUnset(t *testing.T) {
	t.Setenv("PIPEWARDEN_SESSION_SECRET", "")
	if SessionSecret() != nil {
		t.Error("unset env should yield nil secret")
	}
}

func TestIssueSession_FailsWithoutSecret(t *testing.T) {
	t.Setenv("PIPEWARDEN_SESSION_SECRET", "")
	if _, err := IssueSession(1, "a@b.com", false, 1); err == nil {
		t.Error("should fail when secret unset")
	}
}

func TestIssueAndVerifySession_RoundTrip(t *testing.T) {
	t.Setenv("PIPEWARDEN_SESSION_SECRET", "test-secret-do-not-use-in-prod")
	tok, err := IssueSession(42, "user@example.com", true, 1)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	claims, err := VerifySession(tok)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if claims.UserID != 42 || claims.Email != "user@example.com" || !claims.Onboarded {
		t.Errorf("claims roundtrip mismatch: %+v", claims)
	}
}

func TestVerifySession_RejectsTamperedToken(t *testing.T) {
	t.Setenv("PIPEWARDEN_SESSION_SECRET", "test-secret-do-not-use-in-prod")
	tok, _ := IssueSession(1, "x@y.z", false, 1)
	tampered := tok[:len(tok)-3] + "AAA"
	_, err := VerifySession(tampered)
	if !errors.Is(err, ErrInvalidSession) {
		t.Errorf("tampered token should yield ErrInvalidSession, got %v", err)
	}
}

func TestSessionFromRequest_MissingCookie(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	_, err := SessionFromRequest(r)
	if !errors.Is(err, ErrInvalidSession) {
		t.Errorf("missing cookie should yield ErrInvalidSession, got %v", err)
	}
}

func TestSessionFromRequest_ValidCookie(t *testing.T) {
	t.Setenv("PIPEWARDEN_SESSION_SECRET", "test-secret-do-not-use-in-prod")
	tok, _ := IssueSession(7, "u@e.com", false, 1)
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.AddCookie(&http.Cookie{Name: SessionCookie, Value: tok})
	claims, err := SessionFromRequest(r)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if claims.UserID != 7 {
		t.Errorf("uid mismatch: %d", claims.UserID)
	}
}

func TestIssueSessionCookie_SetsExpectedFlags(t *testing.T) {
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "https://example.com/", nil)
	r.TLS = &tls.ConnectionState{}
	IssueSessionCookie(w, r, "tok")
	cookies := w.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("expected 1 cookie, got %d", len(cookies))
	}
	c := cookies[0]
	if c.Name != SessionCookie || !c.HttpOnly || !c.Secure || c.SameSite != http.SameSiteLaxMode {
		t.Errorf("cookie flags wrong: %+v", c)
	}
	if c.Expires.Before(time.Now()) {
		t.Errorf("cookie should not expire in the past, got %v", c.Expires)
	}
}

func TestClearSessionCookie_NegativeMaxAge(t *testing.T) {
	w := httptest.NewRecorder()
	ClearSessionCookie(w, httptest.NewRequest(http.MethodGet, "/", nil))
	cookies := w.Result().Cookies()
	if len(cookies) != 1 || cookies[0].MaxAge >= 0 {
		t.Errorf("expected MaxAge<0 to clear cookie, got %+v", cookies)
	}
}
