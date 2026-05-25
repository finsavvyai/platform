package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"

	secmw "quantumbeam/internal/middleware"
)

// setupContractRouter creates a minimal Chi router mirroring the production
// route structure with security headers, CORS, and auth middleware, but
// without the heavy monitoring integration dependencies.
func setupContractRouter() chi.Router {
	r := chi.NewRouter()
	r.Use(secmw.SecurityHeadersChi)
	r.Use(secmw.CORSMiddlewareChi(secmw.DefaultCORSConfig()))

	// Non-versioned health endpoint
	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
	})

	// Versioned API routes
	r.Route("/api/v1", func(r chi.Router) {
		r.Route("/auth", func(r chi.Router) {
			r.Post("/login", func(w http.ResponseWriter, _ *http.Request) {
				json.NewEncoder(w).Encode(map[string]string{"token": "ok"})
			})
		})
		r.Route("/transactions", func(r chi.Router) {
			r.Use(authMiddleware)
			r.Get("/", func(w http.ResponseWriter, _ *http.Request) {
				json.NewEncoder(w).Encode([]string{})
			})
		})
	})

	return r
}

// -- API Versioning Tests --

func TestContract_Versioning_V1_TransactionsWithAuth(t *testing.T) {
	r := setupContractRouter()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/transactions", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestContract_Versioning_V2_Returns404(t *testing.T) {
	r := setupContractRouter()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v2/transactions", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestContract_Versioning_NoPrefix_Returns404(t *testing.T) {
	r := setupContractRouter()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/transactions", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestContract_Versioning_HealthNoPrefix_Returns200(t *testing.T) {
	r := setupContractRouter()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestContract_Versioning_AuthNoPrefix_Returns401(t *testing.T) {
	r := setupContractRouter()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/transactions", nil)
	// No Authorization header
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

// -- CORS Tests --

func TestContract_CORS_AllowedOrigin_GET(t *testing.T) {
	r := setupContractRouter()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	req.Header.Set("Origin", secmw.DefaultAllowedOrigin)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, secmw.DefaultAllowedOrigin,
		w.Header().Get("Access-Control-Allow-Origin"))
}

func TestContract_CORS_DisallowedOrigin_GET(t *testing.T) {
	r := setupContractRouter()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	r.ServeHTTP(w, req)

	// Request proceeds but no CORS header set
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
}

func TestContract_CORS_AllowedOrigin_Preflight(t *testing.T) {
	r := setupContractRouter()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodOptions, "/api/v1/transactions", nil)
	req.Header.Set("Origin", secmw.DefaultAllowedOrigin)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)
	assert.Equal(t, secmw.DefaultAllowedOrigin,
		w.Header().Get("Access-Control-Allow-Origin"))
	assert.NotEmpty(t, w.Header().Get("Access-Control-Allow-Methods"))
}

func TestContract_CORS_DisallowedOrigin_Preflight(t *testing.T) {
	r := setupContractRouter()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodOptions, "/api/v1/transactions", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
}

func TestContract_CORS_NoOrigin_NoHeader(t *testing.T) {
	r := setupContractRouter()
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	r.ServeHTTP(w, req)

	// No Origin header -> no CORS header in response
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
}
