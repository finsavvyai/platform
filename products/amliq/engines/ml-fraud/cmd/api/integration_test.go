package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/stretchr/testify/assert"

	secmw "quantumbeam/internal/middleware"
)

// setupTestRouter creates a Chi router matching the production setup but without
// monitoring or otel dependencies, making it suitable for unit/integration tests.
func setupTestRouter() chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(secmw.SecurityHeadersChi)
	r.Use(middleware.AllowContentType("application/json", "text/plain"))
	r.Use(secmw.CORSMiddlewareChi(secmw.DefaultCORSConfig()))
	r.Use(secmw.BodyLimitChi(1 << 20))

	r.Get("/health", healthHandler)
	r.Get("/ready", readyHandler)

	r.Route("/api/v1", func(r chi.Router) {
		r.Route("/auth", func(r chi.Router) {
			r.Post("/login", loginHandler)
		})
		r.Route("/transactions", func(r chi.Router) {
			r.Use(authMiddleware)
			r.Get("/", listTransactionsHandler)
		})
	})

	r.Route("/monitoring", func(r chi.Router) {
		r.Get("/status", monitoringStatusHandler)
	})

	return r
}

// TestIntegration_ChiRouter_HealthEndpoint verifies GET /health returns 200.
func TestIntegration_ChiRouter_HealthEndpoint(t *testing.T) {
	r := setupTestRouter()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "application/json")

	var body map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, "healthy", body["status"])
}

// TestIntegration_ChiRouter_TransactionsWithoutAuth returns 401.
func TestIntegration_ChiRouter_TransactionsWithoutAuth(t *testing.T) {
	r := setupTestRouter()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/transactions", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

// TestIntegration_ChiRouter_TransactionsWithAuth returns 200.
func TestIntegration_ChiRouter_TransactionsWithAuth(t *testing.T) {
	r := setupTestRouter()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/transactions", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

// TestIntegration_ChiRouter_LoginNoAuth verifies POST /auth/login needs no auth.
func TestIntegration_ChiRouter_LoginNoAuth(t *testing.T) {
	r := setupTestRouter()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

// TestIntegration_ChiRouter_SecurityHeaders verifies OWASP security headers.
func TestIntegration_ChiRouter_SecurityHeaders(t *testing.T) {
	r := setupTestRouter()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	r.ServeHTTP(w, req)

	expectedHeaders := map[string]string{
		"X-Frame-Options":          "DENY",
		"X-Content-Type-Options":   "nosniff",
		"X-XSS-Protection":         "1; mode=block",
		"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
		"Referrer-Policy":           "strict-origin-when-cross-origin",
		"Cache-Control":             "no-store",
	}
	for header, expected := range expectedHeaders {
		assert.Equal(t, expected, w.Header().Get(header), "header %s", header)
	}
}

// TestIntegration_ChiRouter_CORSDisallowedOrigin verifies no CORS header for bad origin.
func TestIntegration_ChiRouter_CORSDisallowedOrigin(t *testing.T) {
	r := setupTestRouter()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	r.ServeHTTP(w, req)

	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
}

// TestIntegration_ChiRouter_CORSAllowedOrigin verifies CORS header for allowed origin.
func TestIntegration_ChiRouter_CORSAllowedOrigin(t *testing.T) {
	r := setupTestRouter()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	req.Header.Set("Origin", secmw.DefaultAllowedOrigin)
	r.ServeHTTP(w, req)

	assert.Equal(t, secmw.DefaultAllowedOrigin, w.Header().Get("Access-Control-Allow-Origin"))
}

// TestIntegration_ChiRouter_CORSPreflightDisallowed returns 403 for bad origin OPTIONS.
func TestIntegration_ChiRouter_CORSPreflightDisallowed(t *testing.T) {
	r := setupTestRouter()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodOptions, "/health", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}
