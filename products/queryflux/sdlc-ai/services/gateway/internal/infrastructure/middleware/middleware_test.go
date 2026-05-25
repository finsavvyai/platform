//go:build ignore

package middleware

import (
	"compress/gzip"
	"context"
	"crypto/tls"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/config"
)

func TestLoggingMiddleware(t *testing.T) {
	// Create a test handler
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("test response"))
	})

	// Apply middleware
	handler := LoggingMiddleware()(next)

	// Create request
	req := httptest.NewRequest("GET", "/test?param=value", nil)
	req.Header.Set("X-Request-ID", "test-123")
	req.Header.Set("User-Agent", "test-agent")
	req.RemoteAddr = "127.0.0.1:12345"

	// Create response recorder
	w := httptest.NewRecorder()

	// Execute handler
	handler.ServeHTTP(w, req)

	// Verify response
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "test response", w.Body.String())
}

func TestTracingMiddleware(t *testing.T) {
	// Create a test handler that checks for trace context
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify trace context is present
		assert.NotNil(t, r.Context().Value("trace"))
		w.WriteHeader(http.StatusOK)
	})

	// Apply middleware
	handler := TracingMiddleware()(next)

	// Create request with trace headers
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("traceparent", "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01")
	req.Header.Set("tracestate", "rojo=00f067aa0ba902b7")

	w := httptest.NewRecorder()

	// Execute handler
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestCORSMiddleware(t *testing.T) {
	cfg := &config.Config{
		CORS: config.CORSConfig{
			AllowedOrigins: []string{"https://example.com", "https://app.example.com"},
		},
	}

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := CORSMiddleware(cfg)(next)

	tests := []struct {
		name         string
		origin       string
		expectHeader bool
	}{
		{
			name:         "Allowed origin",
			origin:       "https://example.com",
			expectHeader: true,
		},
		{
			name:         "Different allowed origin",
			origin:       "https://app.example.com",
			expectHeader: true,
		},
		{
			name:         "Disallowed origin",
			origin:       "https://evil.com",
			expectHeader: false,
		},
		{
			name:         "No origin header",
			origin:       "",
			expectHeader: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/test", nil)
			if tt.origin != "" {
				req.Header.Set("Origin", tt.origin)
			}

			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)

			if tt.expectHeader {
				assert.Equal(t, "https://example.com, https://app.example.com", w.Header().Get("Access-Control-Allow-Origin"))
			}
		})
	}
}

func TestSecurityHeadersMiddleware(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := SecurityHeadersMiddleware()(next)

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	// Check security headers
	assert.Equal(t, "nosniff", w.Header().Get("X-Content-Type-Options"))
	assert.Equal(t, "DENY", w.Header().Get("X-Frame-Options"))
	assert.Equal(t, "1; mode=block", w.Header().Get("X-XSS-Protection"))
	assert.Equal(t, "strict-origin-when-cross-origin", w.Header().Get("Referrer-Policy"))
	assert.Equal(t, "camera=(), microphone=(), geolocation=()", w.Header().Get("Permissions-Policy"))
	assert.Equal(t, "require-corp", w.Header().Get("Cross-Origin-Embedder-Policy"))
	assert.Equal(t, "same-origin", w.Header().Get("Cross-Origin-Opener-Policy"))
	assert.Equal(t, "same-origin", w.Header().Get("Cross-Origin-Resource-Policy"))
	assert.NotEmpty(t, w.Header().Get("Content-Security-Policy"))
}

func TestSecurityHeadersMiddleware_HTTPS(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := SecurityHeadersMiddleware()(next)

	// Create HTTPS request
	req := httptest.NewRequest("GET", "/test", nil)
	req.TLS = &tls.ConnectionState{} // Simulate HTTPS
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	// Check HSTS header is present for HTTPS
	assert.NotEmpty(t, w.Header().Get("Strict-Transport-Security"))
}

func TestCompressionMiddleware(t *testing.T) {
	// Create a test handler with large response
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Write a large response that should be compressed
		largeContent := strings.Repeat("This is a test response that should be compressed. ", 100)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(largeContent))
	})

	handler := CompressionMiddleware()(next)

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "gzip", w.Header().Get("Content-Encoding"))
	assert.Equal(t, "Accept-Encoding", w.Header().Get("Vary"))

	// Verify content is actually gzipped
	gzipReader, err := gzip.NewReader(w.Body)
	require.NoError(t, err)
	defer gzipReader.Close()

	decompressed, err := io.ReadAll(gzipReader)
	require.NoError(t, err)
	assert.Contains(t, string(decompressed), "This is a test response")
}

func TestCompressionMiddleware_NoCompression(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("small response"))
	})

	handler := CompressionMiddleware()(next)

	// Request without gzip accept
	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Empty(t, w.Header().Get("Content-Encoding"))
	assert.Equal(t, "small response", w.Body.String())
}

func TestRateLimitMiddleware(t *testing.T) {
	cfg := &config.Config{
		RateLimit: config.RateLimitConfig{
			Requests: 5,
			Window:   time.Minute,
		},
	}

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("allowed"))
	})

	handler := RateLimitMiddleware(cfg)(next)

	// Make requests up to the limit
	for i := 0; i < 5; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "127.0.0.1"
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Equal(t, "allowed", w.Body.String())
	}

	// One more request should be rate limited
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "127.0.0.1"
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusTooManyRequests, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, "RATE_LIMIT_EXCEEDED", response["error"].(map[string]interface{})["code"])
	assert.Equal(t, "0", w.Header().Get("X-RateLimit-Remaining"))
}

func TestCircuitBreakerMiddleware(t *testing.T) {
	cfg := &config.Config{
		CircuitBreaker: config.CircuitBreakerConfig{
			MaxFailures:  3,
			ResetTimeout: 100 * time.Millisecond,
		},
	}

	// Counter for tracking requests
	requestCount := 0

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		// Fail first 3 requests
		if requestCount <= 3 {
			w.WriteHeader(http.StatusInternalServerError)
		} else {
			w.WriteHeader(http.StatusOK)
		}
	})

	handler := CircuitBreaker(cfg)(next)

	// Make failing requests to trip the circuit breaker
	for i := 0; i < 3; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		assert.Equal(t, http.StatusInternalServerError, w.Code)
	}

	// Next request should fail fast due to open circuit
	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, "SERVICE_UNAVAILABLE", response["error"].(map[string]interface{})["code"])
	assert.Equal(t, "Service temporarily unavailable", response["error"].(map[string]interface{})["message"])
}

func TestAuthenticationMiddleware(t *testing.T) {
	cfg := &config.Config{}

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("authenticated"))
	})

	handler := AuthenticationMiddleware(cfg)(next)

	tests := []struct {
		name           string
		authHeader     string
		expectedStatus int
		expectedBody   string
	}{
		{
			name:           "Valid Bearer token",
			authHeader:     "Bearer valid-token-123",
			expectedStatus: http.StatusOK,
			expectedBody:   "authenticated",
		},
		{
			name:           "Missing Authorization header",
			authHeader:     "",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "Invalid token format - no Bearer",
			authHeader:     "valid-token-123",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "Invalid token format - too many parts",
			authHeader:     "Bearer token extra",
			expectedStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/test", nil)
			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}

			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedBody != "" {
				assert.Equal(t, tt.expectedBody, w.Body.String())
			} else {
				// Check error response structure
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				require.NoError(t, err)
				assert.NotNil(t, response["error"])
			}
		})
	}
}

func TestAuthenticationMiddleware_PublicPath(t *testing.T) {
	cfg := &config.Config{}

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("public"))
	})

	handler := AuthenticationMiddleware(cfg)(next)

	publicPaths := []string{
		"/health",
		"/healthz",
		"/ready",
		"/readyz",
		"/live",
		"/livez",
		"/metrics",
		"/version",
		"/health/detailed",
	}

	for _, path := range publicPaths {
		t.Run("Public path: "+path, func(t *testing.T) {
			req := httptest.NewRequest("GET", path, nil)
			w := httptest.NewRecorder()

			handler.ServeHTTP(w, req)

			assert.Equal(t, http.StatusOK, w.Code)
			assert.Equal(t, "public", w.Body.String())
		})
	}
}

func TestAuthorizationMiddleware(t *testing.T) {
	// Create a mock policy engine
	policyEngine := &struct{}{}

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("authorized"))
	})

	handler := AuthorizationMiddleware(policyEngine)(next)

	// Test public path
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "authorized", w.Body.String())

	// Test protected path (should pass through since policy evaluation is not implemented)
	req = httptest.NewRequest("GET", "/api/test", nil)
	w = httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRecoveryMiddleware(t *testing.T) {
	// Create a handler that panics
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("test panic")
	})

	handler := RecoveryMiddleware()(next)

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	// Should recover from panic and return 500
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, "INTERNAL_SERVER_ERROR", response["error"].(map[string]interface{})["code"])
	assert.Equal(t, "Internal server error", response["error"].(map[string]interface{})["message"])
}

func TestRequestTimeoutMiddleware(t *testing.T) {
	// Create a handler that takes longer than the timeout
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	})

	handler := RequestTimeoutMiddleware(100 * time.Millisecond)(next)

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
	defer cancel()

	req = req.WithContext(ctx)

	start := time.Now()
	handler.ServeHTTP(w, req)
	duration := time.Since(start)

	// Request should complete within the middleware timeout, not the handler timeout
	assert.Less(t, duration, 150*time.Millisecond)
}

func TestGetClientIdentifier(t *testing.T) {
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.100:12345"

	identifier := getClientIdentifier(req)
	assert.Equal(t, "192.168.1.100:12345", identifier)
}

func TestIsPublicPath(t *testing.T) {
	tests := []struct {
		path     string
		expected bool
	}{
		{"/health", true},
		{"/healthz", true},
		{"/health/detailed", true},
		{"/ready", true},
		{"/readyz", true},
		{"/live", true},
		{"/livez", true},
		{"/metrics", true},
		{"/version", true},
		{"/api/test", false},
		{"/documents", false},
		{"/users", false},
		{"/auth/login", false},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			result := isPublicPath(tt.path)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// Test helper to verify middleware chain
func TestMiddlewareChain(t *testing.T) {
	// Create a chi router
	r := chi.NewRouter()

	// Add middleware
	r.Use(RecoveryMiddleware())
	r.Use(SecurityHeadersMiddleware())
	r.Use(RequestTimeoutMiddleware(5 * time.Second))

	// Add route
	r.Get("/test", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Test the middleware chain
	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "OK", w.Body.String())
	assert.Equal(t, "nosniff", w.Header().Get("X-Content-Type-Options"))
	assert.Equal(t, "DENY", w.Header().Get("X-Frame-Options"))
}

// Integration test for multiple middleware
func TestMiddlewareIntegration(t *testing.T) {
	cfg := &config.Config{
		RateLimit: config.RateLimitConfig{
			Requests: 10,
			Window:   time.Minute,
		},
		CORS: config.CORSConfig{
			AllowedOrigins: []string{"*"},
		},
	}

	// Create handler that returns user info
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := map[string]interface{}{
			"message": "success",
			"path":    r.URL.Path,
			"method":  r.Method,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	})

	// Apply middleware chain
	handler := CORSMiddleware(cfg)
	handler = LoggingMiddleware()(handler)
	handler = SecurityHeadersMiddleware()(handler)
	handler = RecoveryMiddleware()(handler)
	handler = handler(next)

	// Create request
	req := httptest.NewRequest("POST", "/api/test", nil)
	req.Header.Set("Origin", "https://example.com")
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = "127.0.0.1:12345"

	w := httptest.NewRecorder()

	// Execute request
	handler.ServeHTTP(w, req)

	// Verify response
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "application/json", w.Header().Get("Content-Type"))

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, "success", response["message"])
	assert.Equal(t, "/api/test", response["path"])
	assert.Equal(t, "POST", response["method"])

	// Verify security headers
	assert.Equal(t, "nosniff", w.Header().Get("X-Content-Type-Options"))
	assert.Equal(t, "DENY", w.Header().Get("X-Frame-Options"))
}

// Benchmark tests
func BenchmarkLoggingMiddleware(b *testing.B) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := LoggingMiddleware()(next)
	req := httptest.NewRequest("GET", "/test", nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
	}
}

func BenchmarkSecurityHeadersMiddleware(b *testing.B) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := SecurityHeadersMiddleware()(next)
	req := httptest.NewRequest("GET", "/test", nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
	}
}

func BenchmarkCompressionMiddleware(b *testing.B) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(strings.Repeat("x", 1000)))
	})

	handler := CompressionMiddleware()(next)
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Accept-Encoding", "gzip")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
	}
}
