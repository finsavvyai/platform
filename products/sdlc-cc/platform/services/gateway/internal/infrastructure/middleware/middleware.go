//go:build ignore

package middleware

import (
	"compress/gzip"
	"context"
	"fmt"
	"net/http"
	"runtime/debug"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/cors"
	"github.com/go-chi/render"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/config"
)

// LoggingMiddleware creates a structured logging middleware
func LoggingMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Create response writer wrapper to capture status code
			wrapped := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

			// Log request
			logger := logrus.WithFields(logrus.Fields{
				"method":      r.Method,
				"path":        r.URL.Path,
				"query":       r.URL.RawQuery,
				"remote_addr": r.RemoteAddr,
				"user_agent":  r.UserAgent(),
				"request_id":  r.Header.Get("X-Request-ID"),
			})

			logger.Info("Request started")

			// Process request
			next.ServeHTTP(wrapped, r)

			// Log response
			duration := time.Since(start)
			logger.WithFields(logrus.Fields{
				"status_code": wrapped.statusCode,
				"duration_ms": duration.Milliseconds(),
				"size_bytes":  wrapped.size,
			}).Info("Request completed")
		})
	}
}

// TracingMiddleware creates an OpenTelemetry tracing middleware
func TracingMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract trace context from incoming headers
			propagator := propagation.TraceContext{}
			ctx := propagator.Extract(r.Context(), propagation.HeaderCarrier(r.Header))

			// Start span
			tracer := otel.Tracer("gateway")
			ctx, span := tracer.Start(ctx, fmt.Sprintf("%s %s", r.Method, r.URL.Path),
				trace.WithAttributes(
					attribute.String("http.method", r.Method),
					attribute.String("http.url", r.URL.String()),
					attribute.String("http.host", r.Host),
					attribute.String("http.scheme", "http"),
					attribute.String("http.user_agent", r.UserAgent()),
					attribute.String("http.remote_addr", r.RemoteAddr),
				),
			)
			defer span.End()

			// Continue with trace context
			r = r.WithContext(ctx)

			// Wrap response writer to capture status code
			wrapped := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

			// Process request
			next.ServeHTTP(wrapped, r)

			// Add response attributes to span
			span.SetAttributes(
				attribute.Int("http.status_code", wrapped.statusCode),
				attribute.Int("http.response_size", wrapped.size),
			)

			// Mark span as error if status code indicates error
			if wrapped.statusCode >= 400 {
				span.SetAttributes(attribute.String("error", fmt.Sprintf("HTTP %d", wrapped.statusCode)))
				if wrapped.statusCode >= 500 {
					span.RecordError(fmt.Errorf("server error: %d", wrapped.statusCode))
				}
			}
		})
	}
}

// CORSMiddleware creates CORS middleware with configurable options
func CORSMiddleware(cfg *config.Config) func(http.Handler) http.Handler {
	corsOptions := cors.Options{
		AllowedOrigins:   cfg.CORS.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Request-ID", "X-Tenant-ID"},
		ExposedHeaders:   []string{"X-Total-Count", "X-Rate-Limit-Limit", "X-Rate-Limit-Remaining", "X-Rate-Limit-Reset"},
		AllowCredentials: true,
		MaxAge:           300, // 5 minutes
		Debug:            cfg.Environment == "development",
	}

	return cors.Handler(corsOptions)
}

// SecurityHeadersMiddleware adds security headers to responses
func SecurityHeadersMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Security headers
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("X-XSS-Protection", "1; mode=block")
			w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
			w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
			w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")
			w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
			w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")

			// HSTS header — always set behind reverse proxy (X-Forwarded-Proto)
			if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
				w.Header().Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
			}

			// Prevent caching of API responses containing sensitive data
			w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, private")
			w.Header().Set("Pragma", "no-cache")

			// Content Security Policy — strict for API endpoints (no inline scripts)
			csp := "default-src 'none'; " +
				"frame-ancestors 'none'; " +
				"base-uri 'none'; " +
				"form-action 'none'; " +
				"sandbox"
			w.Header().Set("Content-Security-Policy", csp)

			next.ServeHTTP(w, r)
		})
	}
}

// CompressionMiddleware adds gzip compression
func CompressionMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Check if client accepts gzip
			if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
				next.ServeHTTP(w, r)
				return
			}

			// Don't compress already compressed content
			if strings.Contains(r.Header.Get("Content-Encoding"), "gzip") {
				next.ServeHTTP(w, r)
				return
			}

			// Create gzip writer
			gzipWriter := &gzipResponseWriter{
				ResponseWriter: w,
				gzipWriter:     gzip.NewWriter(w),
			}
			defer gzipWriter.gzipWriter.Close()

			// Set appropriate headers
			w.Header().Set("Content-Encoding", "gzip")
			w.Header().Set("Vary", "Accept-Encoding")

			next.ServeHTTP(gzipWriter, r)
		})
	}
}

// RateLimitMiddleware creates a rate limiting middleware
func RateLimitMiddleware(cfg *config.Config) func(http.Handler) http.Handler {
	// In-memory rate limiter (in production, use Redis or similar)
	limiter := &rateLimiter{
		clients: make(map[string]*clientLimiter),
		mutex:   &sync.RWMutex{},
		limit:   cfg.RateLimit.Requests,
		window:  cfg.RateLimit.Window,
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get client identifier (IP or user ID)
			clientID := getClientIdentifier(r)

			// Check rate limit
			if !limiter.allow(clientID) {
				// Set rate limit headers
				w.Header().Set("X-RateLimit-Limit", strconv.Itoa(cfg.RateLimit.Requests))
				w.Header().Set("X-RateLimit-Remaining", "0")
				w.Header().Set("X-RateLimit-Reset", strconv.Itoa(int(time.Now().Add(cfg.RateLimit.Window).Unix())))

				render.Status(r, http.StatusTooManyRequests)
				render.JSON(w, r, map[string]interface{}{
					"error": map[string]interface{}{
						"code":    "RATE_LIMIT_EXCEEDED",
						"message": "Rate limit exceeded",
					},
					"meta": map[string]interface{}{
						"timestamp": time.Now().UTC().Format(time.RFC3339),
					},
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// CircuitBreakerMiddleware creates a circuit breaker middleware
func CircuitBreaker(cfg *config.Config) func(http.Handler) http.Handler {
	breaker := &circuitBreaker{
		maxFailures:  cfg.CircuitBreaker.MaxFailures,
		resetTimeout: cfg.CircuitBreaker.ResetTimeout,
		state:        circuitClosed,
		lastFailure:  time.Now(),
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !breaker.allow() {
				render.Status(r, http.StatusServiceUnavailable)
				render.JSON(w, r, map[string]interface{}{
					"error": map[string]interface{}{
						"code":    "SERVICE_UNAVAILABLE",
						"message": "Service temporarily unavailable",
					},
					"meta": map[string]interface{}{
						"timestamp": time.Now().UTC().Format(time.RFC3339),
					},
				})
				return
			}

			// Wrap response writer to capture failures
			wrapped := &circuitBreakerResponseWriter{
				ResponseWriter: w,
				breaker:        breaker,
				statusCode:     http.StatusOK,
			}

			next.ServeHTTP(wrapped, r)
		})
	}
}

// AuthenticationMiddleware creates JWT authentication middleware
func AuthenticationMiddleware(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip authentication for health checks and metrics
			if isPublicPath(r.URL.Path) {
				next.ServeHTTP(w, r)
				return
			}

			// Extract JWT token from Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				render.Status(r, http.StatusUnauthorized)
				render.JSON(w, r, map[string]interface{}{
					"error": map[string]interface{}{
						"code":    "MISSING_TOKEN",
						"message": "Authorization header required",
					},
				})
				return
			}

			// Validate token format
			tokenParts := strings.Split(authHeader, " ")
			if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
				render.Status(r, http.StatusUnauthorized)
				render.JSON(w, r, map[string]interface{}{
					"error": map[string]interface{}{
						"code":    "INVALID_TOKEN_FORMAT",
						"message": "Invalid authorization header format",
					},
				})
				return
			}

			// TODO: Implement actual JWT validation
			// For now, we'll just pass through
			next.ServeHTTP(w, r)
		})
	}
}

// AuthorizationMiddleware creates OPA policy evaluation middleware
func AuthorizationMiddleware(policyEngine interface{}) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip authorization for health checks and metrics
			if isPublicPath(r.URL.Path) {
				next.ServeHTTP(w, r)
				return
			}

			// TODO: Implement actual OPA policy evaluation
			// For now, we'll just pass through
			next.ServeHTTP(w, r)
		})
	}
}

// RecoveryMiddleware creates a recovery middleware that catches panics
func RecoveryMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					// Log the panic
					logrus.WithFields(logrus.Fields{
						"error":       err,
						"stack":       string(debug.Stack()),
						"method":      r.Method,
						"path":        r.URL.Path,
						"remote_addr": r.RemoteAddr,
						"user_agent":  r.UserAgent(),
					}).Error("Request panic recovered")

					// Return error response
					render.Status(r, http.StatusInternalServerError)
					render.JSON(w, r, map[string]interface{}{
						"error": map[string]interface{}{
							"code":    "INTERNAL_SERVER_ERROR",
							"message": "Internal server error",
						},
						"meta": map[string]interface{}{
							"timestamp": time.Now().UTC().Format(time.RFC3339),
						},
					})
				}
			}()

			next.ServeHTTP(w, r)
		})
	}
}

// RequestTimeoutMiddleware adds timeout to requests
func RequestTimeoutMiddleware(timeout time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, cancel := context.WithTimeout(r.Context(), timeout)
			defer cancel()

			r = r.WithContext(ctx)
			next.ServeHTTP(w, r)
		})
	}
}

// Helper types and functions

type responseWriter struct {
	http.ResponseWriter
	statusCode int
	size       int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	n, err := rw.ResponseWriter.Write(b)
	rw.size += n
	return n, err
}

type gzipResponseWriter struct {
	http.ResponseWriter
	gzipWriter *gzip.Writer
}

func (grw *gzipResponseWriter) Write(b []byte) (int, error) {
	return grw.gzipWriter.Write(b)
}

type circuitBreakerState int

const (
	circuitClosed circuitBreakerState = iota
	circuitOpen
	circuitHalfOpen
)

type circuitBreaker struct {
	maxFailures  int
	resetTimeout time.Duration
	state        circuitBreakerState
	failures     int
	lastFailure  time.Time
	mutex        sync.RWMutex
}

func (cb *circuitBreaker) allow() bool {
	cb.mutex.Lock()
	defer cb.mutex.Unlock()

	switch cb.state {
	case circuitClosed:
		return true
	case circuitOpen:
		if time.Since(cb.lastFailure) > cb.resetTimeout {
			cb.state = circuitHalfOpen
			cb.failures = 0
			return true
		}
		return false
	case circuitHalfOpen:
		return true
	default:
		return false
	}
}

func (cb *circuitBreaker) recordSuccess() {
	cb.mutex.Lock()
	defer cb.mutex.Unlock()

	cb.failures = 0
	if cb.state == circuitHalfOpen {
		cb.state = circuitClosed
	}
}

func (cb *circuitBreaker) recordFailure() {
	cb.mutex.Lock()
	defer cb.mutex.Unlock()

	cb.failures++
	cb.lastFailure = time.Now()

	if cb.failures >= cb.maxFailures {
		cb.state = circuitOpen
	}
}

type circuitBreakerResponseWriter struct {
	http.ResponseWriter
	breaker    *circuitBreaker
	statusCode int
}

func (cbw *circuitBreakerResponseWriter) WriteHeader(code int) {
	cbw.statusCode = code
	if code >= 500 {
		cbw.breaker.recordFailure()
	} else {
		cbw.breaker.recordSuccess()
	}
	cbw.ResponseWriter.WriteHeader(code)
}

type rateLimiter struct {
	clients map[string]*clientLimiter
	mutex   *sync.RWMutex
	limit   int
	window  time.Duration
}

type clientLimiter struct {
	tokens     int
	lastRefill time.Time
	mutex      sync.Mutex
}

func (rl *rateLimiter) allow(clientID string) bool {
	rl.mutex.RLock()
	client, exists := rl.clients[clientID]
	rl.mutex.RUnlock()

	if !exists {
		rl.mutex.Lock()
		client = &clientLimiter{
			tokens:     rl.limit,
			lastRefill: time.Now(),
		}
		rl.clients[clientID] = client
		rl.mutex.Unlock()
	}

	client.mutex.Lock()
	defer client.mutex.Unlock()

	// Refill tokens based on time elapsed
	now := time.Now()
	elapsed := now.Sub(client.lastRefill)
	tokensToAdd := int(elapsed.Seconds()) * (rl.limit / int(rl.window.Seconds()))

	if tokensToAdd > 0 {
		client.tokens = min(rl.limit, client.tokens+tokensToAdd)
		client.lastRefill = now
	}

	if client.tokens > 0 {
		client.tokens--
		return true
	}

	return false
}

func getClientIdentifier(r *http.Request) string {
	// Try to get user ID from context (if authenticated)
	// For now, use IP address as fallback
	return r.RemoteAddr
}

func isPublicPath(path string) bool {
	publicPaths := []string{
		"/health",
		"/healthz",
		"/ready",
		"/readyz",
		"/live",
		"/livez",
		"/metrics",
		"/version",
	}

	for _, publicPath := range publicPaths {
		if strings.HasPrefix(path, publicPath) {
			return true
		}
	}
	return false
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
