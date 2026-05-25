package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/config"
)

func TestAuthDisabled(t *testing.T) {
	cfg := &config.Config{
		Auth: config.AuthConfig{
			Disabled: true,
		},
	}

	handler := Auth(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestAuthMissingToken(t *testing.T) {
	cfg := &config.Config{
		Auth: config.AuthConfig{
			Disabled: false,
			Token:    "secret",
		},
	}

	handler := Auth(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthValidToken(t *testing.T) {
	cfg := &config.Config{
		Auth: config.AuthConfig{
			Disabled: false,
			Token:    "secret",
		},
	}

	handler := Auth(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer secret")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestAuthInvalidToken(t *testing.T) {
	cfg := &config.Config{
		Auth: config.AuthConfig{
			Disabled: false,
			Token:    "secret",
		},
	}

	handler := Auth(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer wrong")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthBadFormat(t *testing.T) {
	cfg := &config.Config{
		Auth: config.AuthConfig{
			Disabled: false,
			Token:    "secret",
		},
	}

	handler := Auth(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Basic xyz")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}
