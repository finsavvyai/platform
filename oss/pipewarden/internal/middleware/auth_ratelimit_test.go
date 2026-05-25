package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestAuthRateLimit_BlocksAfterMaxAttempts(t *testing.T) {
	called := 0
	h := AuthRateLimit(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called++
	}))
	for i := 0; i < 10; i++ {
		r := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)
		r.RemoteAddr = "1.2.3.4:1234"
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != http.StatusOK {
			t.Errorf("attempt %d expected 200, got %d", i, w.Code)
		}
	}
	r := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)
	r.RemoteAddr = "1.2.3.4:1234"
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusTooManyRequests {
		t.Errorf("11th attempt should be 429, got %d", w.Code)
	}
	if w.Header().Get("Retry-After") == "" {
		t.Error("429 response must include Retry-After header")
	}
}

func TestAuthRateLimit_PerIPIsolated(t *testing.T) {
	h := AuthRateLimit(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	for i := 0; i < 10; i++ {
		r := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)
		r.RemoteAddr = "5.6.7.8:1"
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
	}
	// Different IP — should still be allowed.
	r := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)
	r.RemoteAddr = "9.10.11.12:1"
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Errorf("different IP should not be limited, got %d", w.Code)
	}
}

func TestAuthRateLimit_BypassesNonAuthPaths(t *testing.T) {
	h := AuthRateLimit(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	for i := 0; i < 50; i++ {
		r := httptest.NewRequest(http.MethodGet, "/api/v1/connections", nil)
		r.RemoteAddr = "1.1.1.1:1"
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != http.StatusOK {
			t.Fatalf("non-auth path should never be limited, got %d at iteration %d", w.Code, i)
		}
	}
}

func TestClientIPForAuth_PrefersCFConnectingIP(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "10.0.0.1:1234"
	r.Header.Set("CF-Connecting-IP", "203.0.113.5")
	r.Header.Set("X-Forwarded-For", "198.51.100.5")
	if ip := clientIPForAuth(r); ip != "203.0.113.5" {
		t.Errorf("CF-Connecting-IP should win, got %q", ip)
	}
}

func TestClientIPForAuth_FallsBackToXFF(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "10.0.0.1:1234"
	r.Header.Set("X-Forwarded-For", "198.51.100.5, 10.0.0.1")
	if ip := clientIPForAuth(r); ip != "198.51.100.5" {
		t.Errorf("XFF first hop should win, got %q", ip)
	}
}

func TestAuthLimiterWindowExpires(t *testing.T) {
	l := newAuthLimiter(2, 50*time.Millisecond)
	for i := 0; i < 2; i++ {
		if !l.allow("x") {
			t.Fatalf("call %d should be allowed under limit=2", i+1)
		}
	}
	if l.allow("x") {
		t.Fatal("3rd in window should be blocked")
	}
	time.Sleep(60 * time.Millisecond)
	if !l.allow("x") {
		t.Error("after window should be allowed again")
	}
}
