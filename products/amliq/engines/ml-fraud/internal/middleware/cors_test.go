package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func newCORSHandler(origins []string) http.Handler {
	cfg := &CORSConfig{
		AllowedOrigins: origins,
		AllowedMethods: "GET, POST, PUT, DELETE, OPTIONS",
		AllowedHeaders: "Authorization, Content-Type, X-API-Key",
		MaxAge:         "3600",
	}
	handler := CORSMiddlewareChi(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	return handler
}

func TestCORSMiddleware_AllowedOrigin(t *testing.T) {
	handler := newCORSHandler([]string{"https://dashboard.fintech.io"})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://dashboard.fintech.io")
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "https://dashboard.fintech.io", w.Header().Get("Access-Control-Allow-Origin"))
	assert.Equal(t, "true", w.Header().Get("Access-Control-Allow-Credentials"))
}

func TestCORSMiddleware_DisallowedOrigin(t *testing.T) {
	handler := newCORSHandler([]string{"https://dashboard.fintech.io"})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSMiddleware_MissingOrigin(t *testing.T) {
	handler := newCORSHandler([]string{"https://dashboard.fintech.io"})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSMiddleware_Preflight_AllowedOrigin(t *testing.T) {
	handler := newCORSHandler([]string{"https://dashboard.fintech.io"})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodOptions, "/test", nil)
	req.Header.Set("Origin", "https://dashboard.fintech.io")
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)
	assert.Equal(t, "https://dashboard.fintech.io", w.Header().Get("Access-Control-Allow-Origin"))
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Methods"), "POST")
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Headers"), "Authorization")
}

func TestCORSMiddleware_Preflight_DisallowedOrigin(t *testing.T) {
	handler := newCORSHandler([]string{"https://dashboard.fintech.io"})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodOptions, "/test", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSMiddleware_NullOriginRejected(t *testing.T) {
	handler := newCORSHandler([]string{"https://dashboard.fintech.io"})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "null")
	handler.ServeHTTP(w, req)

	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSMiddleware_MultipleOrigins(t *testing.T) {
	handler := newCORSHandler([]string{
		"https://dashboard.fintech.io",
		"https://staging.fintech.io",
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://staging.fintech.io")
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "https://staging.fintech.io", w.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSMiddleware_VaryHeaderAlwaysSet(t *testing.T) {
	handler := newCORSHandler([]string{"https://dashboard.fintech.io"})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	handler.ServeHTTP(w, req)

	assert.Equal(t, "Origin", w.Header().Get("Vary"))
}

func TestParseAllowedOrigins_RejectsWildcard(t *testing.T) {
	origins := ParseAllowedOrigins("*")
	assert.Empty(t, origins)
}

func TestParseAllowedOrigins_Empty(t *testing.T) {
	origins := ParseAllowedOrigins("")
	assert.Nil(t, origins)
}

func TestParseAllowedOrigins_CommaSeparated(t *testing.T) {
	origins := ParseAllowedOrigins("https://a.com, https://b.com , https://c.com")
	assert.Equal(t, []string{"https://a.com", "https://b.com", "https://c.com"}, origins)
}
