package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAuthRateLimiterAllows(t *testing.T) {
	rl := NewAuthRateLimiter(5, 1)
	handler := rl.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("POST", "/login", nil)
	req.RemoteAddr = "1.2.3.4:1234"
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestAuthRateLimiterBlocks(t *testing.T) {
	rl := NewAuthRateLimiter(3, 1)
	handler := rl.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for i := 0; i < 5; i++ {
		req := httptest.NewRequest("POST", "/login", nil)
		req.RemoteAddr = "1.2.3.4:1234"
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
	}

	// Next request should be blocked
	req := httptest.NewRequest("POST", "/login", nil)
	req.RemoteAddr = "1.2.3.4:1234"
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusTooManyRequests {
		t.Errorf("expected 429, got %d", w.Code)
	}
}

func TestAuthRateLimiterDifferentIPs(t *testing.T) {
	rl := NewAuthRateLimiter(2, 1)
	handler := rl.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// Exhaust limit for IP1
	for i := 0; i < 4; i++ {
		req := httptest.NewRequest("POST", "/login", nil)
		req.RemoteAddr = "1.1.1.1:1234"
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
	}

	// IP2 should still work
	req := httptest.NewRequest("POST", "/login", nil)
	req.RemoteAddr = "2.2.2.2:1234"
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("different IP should not be blocked, got %d", w.Code)
	}
}
