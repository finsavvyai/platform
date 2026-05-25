package security

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/mcpoverflow/api-service/internal/config"
	"github.com/mcpoverflow/api-service/internal/handlers"
	"github.com/mcpoverflow/api-service/internal/middleware"
)

// SetupTestRouter initializes the router with security middleware for testing
func SetupTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{
		Environment: "test",
		Server: config.ServerConfig{
			// Host and Port can be left empty or set if needed
		},
		Domains: config.DomainConfig{
			Developer: config.Domain{
				Headers: map[string]string{"Access-Control-Allow-Origin": "http://localhost:3000"},
			},
		},
	}
	
	router := gin.New()
	router.Use(gin.Recovery())
	
	// Apply comprehensive security middleware
	handlers.SetupRoutes(router, cfg, nil)
	
	return router
}

func TestSQLInjection_Fuzzing(t *testing.T) {
	router := SetupTestRouter()

	// List of common SQL Injection payloads
	payloads := []string{
		"' OR '1'='1",
		"\"; DROP TABLE users; --",
		"' UNION SELECT username, password FROM users --",
	}

	// We only fuzz query parameters where injection is common and URL-valid
	// For paths, we'd need to assume the router handles routing first. 
	// Injecting into valid IDs is better tested with specifically crafted IDs.
	
	baseURL := "/api/v1/connectors/search"

	for _, payload := range payloads {
		t.Run("Endpoint: Search Payload: "+payload, func(t *testing.T) {
			// Properly encode the payload
			encodedPayload := url.QueryEscape(payload)
			req := httptest.NewRequest("GET", baseURL+"?q="+encodedPayload, nil)
			
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// We expect 400 Bad Request (validation) or 200 OK (empty search)
			// We DO NOT expect 500 Internal Server Error (often indicates SQL error leakage)
			assert.NotEqual(t, http.StatusInternalServerError, w.Code, "Potential SQL Injection vulnerability detected (500 error)")
		})
	}
}

func TestXSS_Payloads(t *testing.T) {
	router := SetupTestRouter()

	payloads := []string{
		"<script>alert(1)</script>",
		"<img src=x onerror=alert(1)>",
		"javascript:alert(1)",
	}

	// Test endpoints that might reflect input
	t.Run("Reflected XSS", func(t *testing.T) {
		for _, payload := range payloads {
			req := httptest.NewRequest("POST", "/api/v1/connectors", bytes.NewBufferString(`{"name":"`+payload+`"}`))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// The response should NOT contain the raw executable script if properly sanitized/encoded
			// Note: APIs returning JSON are generally safe from XSS unless consumed as HTML. 
			// We check Content-Type header enforces JSON.
			assert.Contains(t, w.Header().Get("Content-Type"), "application/json", "Response should be JSON to prevent XSS")
		}
	})
}

func TestCSRF_Protection(t *testing.T) {
	// CSRF is primarily mitigated by SameSite cookies and Origin checks in `cross_domain.go`
	// This test simulates a cross-origin request without proper headers
	
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{
		Domains: config.DomainConfig{
			Marketing: config.Domain{URL: "https://mcpoverflow.com"},
		},
		JWT: config.JWTConfig{Secret: "test-secret"},
	}
	ssoService := middleware.NewSSOService(cfg)

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(ssoService.Middleware())
	
	// Protected endpoint
	router.GET("/protected", middleware.RequireCrossDomainAuth(), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	// 1. Missing Cookie -> 401
	t.Run("Missing Cookie", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/protected", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})

	// 2. Invalid Cookie -> 401
	t.Run("Invalid Cookie", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/protected", nil)
		req.AddCookie(&http.Cookie{Name: "mcpoverflow_sso", Value: "invalid"})
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})
	
	// 3. Valid Session but Bad Origin -> 403
	t.Run("Bad Origin", func(t *testing.T) {
		// Create session
		session, _ := ssoService.CreateSSOSession("user1", "test@example.com", "user", []string{"https://good.com"})
		
		req := httptest.NewRequest("GET", "/protected", nil)
		req.AddCookie(&http.Cookie{Name: "mcpoverflow_sso", Value: session.SessionID})
		req.Header.Set("Origin", "https://evil.com")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusForbidden, w.Code)
	})

	// 4. Valid Session and Good Origin -> 200
	t.Run("Good Origin", func(t *testing.T) {
		session, _ := ssoService.CreateSSOSession("user1", "test@example.com", "user", []string{"https://good.com"})
		
		req := httptest.NewRequest("GET", "/protected", nil)
		req.AddCookie(&http.Cookie{Name: "mcpoverflow_sso", Value: session.SessionID})
		req.Header.Set("Origin", "https://good.com")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	})
}

func TestSessionHijacking_Simulation(t *testing.T) {
	// Simulation:
	// 1. User A logs in (gets Session ID)
	// 2. Attacker B tries to use Session ID from a different "Origin" or IP (if we had IP binding)
	
	// Currently, MCPOverflow uses Bearer tokens and SSO cookies.
	// Use of HTTPS (Secure cookie) and HttpOnly is the primary defense against Hijacking via XSS.
	// This test asserts those flags on cookies.

	gin.SetMode(gin.TestMode)
	cfg := &config.Config{
		JWT: config.JWTConfig{Secret: "test-secret"},
	}
	ssoService := middleware.NewSSOService(cfg)
	
	router := gin.New()
	router.GET("/login", func(c *gin.Context) {
		// Mock successful login
		session, _ := ssoService.CreateSSOSession("u1", "e@e.com", "user", nil)
		ssoService.SetSSOCookie(c, session)
		c.Status(200)
	})

	// Simulate Login
	req := httptest.NewRequest("GET", "/login", nil) 
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Inspect the Cookie setting code path
	cookies := w.Result().Cookies()
	found := false
	for _, cookie := range cookies {
		if cookie.Name == "mcpoverflow_sso" {
			found = true
			assert.True(t, cookie.HttpOnly, "Session cookie must be HttpOnly to prevent XSS hijacking")
			assert.True(t, cookie.Secure, "Session cookie must be Secure to prevent sniffing")
			assert.Equal(t, http.SameSiteLaxMode, cookie.SameSite, "Session cookie must be SameSite=Lax/Strict")
		}
	}
	assert.True(t, found, "SSO cookie not found in response")
}

func TestDirectoryTraversal(t *testing.T) {
	router := SetupTestRouter()
	
	payloads := []string{
		"../etc/passwd",
		"..%2F..%2Fetc%2Fpasswd",
	}
	
	for _, payload := range payloads {
		req := httptest.NewRequest("GET", "/api/v1/static/"+payload, nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		
		assert.NotEqual(t, http.StatusOK, w.Code, "Directory traversal should not return 200 OK")
		// Should definitively NOT return file content
	}
}

func TestMethodFuzzing(t *testing.T) {
	router := SetupTestRouter()

	// Endpoints that should only support GET or POST
	tests := []struct {
		endpoint string
		method   string
	}{
		{"/api/v1/connectors", "PUT"},
		{"/api/v1/auth/login", "GET"}, // Login is strictly POST
		{"/api/v1/static/file", "POST"},
	}

	for _, tt := range tests {
		t.Run("Method "+tt.method+" on "+tt.endpoint, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.endpoint, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Should return 405 Method Not Allowed or 404 Not Found
			assert.Contains(t, []int{http.StatusMethodNotAllowed, http.StatusNotFound}, w.Code)
		})
	}
}

func TestLargePayloadDoS(t *testing.T) {
	router := SetupTestRouter()

	// 11MB payload (assuming default limit is 10MB)
	largePayload := bytes.Repeat([]byte("a"), 11*1024*1024)
	
	req := httptest.NewRequest("POST", "/api/v1/connectors", bytes.NewReader(largePayload))
	req.Header.Set("Content-Type", "application/json")
	
	w := httptest.NewRecorder()
	
	// We expect the server to likely handle this or error out gracefully, 
	// typically 413 Payload Too Large if configured, or just not crash.
	// Since we are mocking the router, standard Gin defaults apply (no strict limit by default unless configured)
	// But we assert it doesn't Panic (using Recovery middleware already).
	
	router.ServeHTTP(w, req)
	
	// Validating it didn't crash is the main test here, handled by Gin Recovery
	assert.NotEqual(t, http.StatusInternalServerError, w.Code)
}

func TestHeaderInjection(t *testing.T) {
	router := SetupTestRouter()
	
	injectionHeaders := map[string]string{
		"User-Agent":      "' OR '1'='1",
		"X-Forwarded-For": "<script>alert(1)</script>",
	}
	
	for header, payload := range injectionHeaders {
		t.Run("Header "+header, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/connectors", nil)
			req.Header.Set(header, payload)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			
			// Generally these headers are logged or used for analytics
			// We ensure no 500 error occurs processing them
			assert.NotEqual(t, http.StatusInternalServerError, w.Code)
		})
	}
}

func TestAdminPathProbing(t *testing.T) {
	router := SetupTestRouter()
	
	adminPaths := []string{
		"/admin",
		"/metrics",
		"/debug/pprof",
		"/server-status",
	}
	
	for _, path := range adminPaths {
		t.Run("Path "+path, func(t *testing.T) {
			req := httptest.NewRequest("GET", path, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			
			// Should be 404 (Not Found) or 401/403 (Protected)
			// Should NOT be 200 OK (Publicly exposed)
			assert.NotEqual(t, http.StatusOK, w.Code)
		})
	}
}
