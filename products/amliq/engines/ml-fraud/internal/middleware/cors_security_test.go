package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

// corsSecurityHandler creates a test handler with a single allowed origin.
func corsSecurityHandler(origins []string) http.Handler {
	cfg := &CORSConfig{
		AllowedOrigins: origins,
		AllowedMethods: "GET, POST, PUT, DELETE, OPTIONS",
		AllowedHeaders: "Authorization, Content-Type, X-API-Key",
		MaxAge:         "3600",
	}
	return CORSMiddlewareChi(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
}

func TestCORSSecurity_NullOriginRejected(t *testing.T) {
	handler := corsSecurityHandler([]string{"https://dashboard.fintech.io"})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
	req.Header.Set("Origin", "null")
	handler.ServeHTTP(w, req)

	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"),
		"null origin must not receive CORS headers")
}

func TestCORSSecurity_SubdomainMismatch(t *testing.T) {
	handler := corsSecurityHandler([]string{"https://dashboard.fintech.io"})

	attacks := []string{
		"https://evil.dashboard.fintech.io",
		"https://dashboard.fintech.io.evil.com",
		"https://fintech.io",
		"https://dashboard-fintech.io",
		"https://dashboardxfintech.io",
	}

	for _, origin := range attacks {
		t.Run(origin, func(t *testing.T) {
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
			req.Header.Set("Origin", origin)
			handler.ServeHTTP(w, req)

			assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"),
				"subdomain mismatch must not receive CORS headers")
		})
	}
}

func TestCORSSecurity_PreflightAllowedOrigin(t *testing.T) {
	handler := corsSecurityHandler([]string{"https://dashboard.fintech.io"})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodOptions, "/api/v1/test", nil)
	req.Header.Set("Origin", "https://dashboard.fintech.io")
	req.Header.Set("Access-Control-Request-Method", "POST")
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)
	assert.Equal(t, "https://dashboard.fintech.io",
		w.Header().Get("Access-Control-Allow-Origin"))
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Methods"), "POST")
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Headers"), "Authorization")
}

func TestCORSSecurity_PreflightDisallowedOrigin(t *testing.T) {
	handler := corsSecurityHandler([]string{"https://dashboard.fintech.io"})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodOptions, "/api/v1/test", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	req.Header.Set("Access-Control-Request-Method", "POST")
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSSecurity_WildcardNotAccepted(t *testing.T) {
	// Even if someone configures "*", it should be filtered out
	origins := ParseAllowedOrigins("*")
	assert.Empty(t, origins, "wildcard must be rejected")
}

func TestCORSSecurity_VaryHeaderPresent(t *testing.T) {
	handler := corsSecurityHandler([]string{"https://dashboard.fintech.io"})

	// Even disallowed origins should get Vary: Origin to prevent
	// proxy cache poisoning attacks.
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	handler.ServeHTTP(w, req)

	assert.Equal(t, "Origin", w.Header().Get("Vary"),
		"Vary header must always be set for cache safety")
}

func TestCORSSecurity_CredentialsOnlyForAllowed(t *testing.T) {
	handler := corsSecurityHandler([]string{"https://dashboard.fintech.io"})

	// Allowed origin gets credentials header
	w1 := httptest.NewRecorder()
	req1 := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
	req1.Header.Set("Origin", "https://dashboard.fintech.io")
	handler.ServeHTTP(w1, req1)
	assert.Equal(t, "true", w1.Header().Get("Access-Control-Allow-Credentials"))

	// Disallowed origin does not
	w2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
	req2.Header.Set("Origin", "https://evil.example.com")
	handler.ServeHTTP(w2, req2)
	assert.Empty(t, w2.Header().Get("Access-Control-Allow-Credentials"))
}

func TestCORSSecurity_EmptyOriginPassesThrough(t *testing.T) {
	handler := corsSecurityHandler([]string{"https://dashboard.fintech.io"})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/test", nil)
	// No Origin header set
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code,
		"same-origin requests (no Origin header) should pass through")
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
}
