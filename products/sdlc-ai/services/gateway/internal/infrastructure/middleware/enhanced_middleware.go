//go:build ignore

package middleware

import (
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/render"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/circuitbreaker"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/config"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/observability"
)

// EnhancedMiddlewareConfig holds configuration for enhanced middleware
type EnhancedMiddlewareConfig struct {
	EnableRequestLogging  bool          `yaml:"enable_request_logging"`
	EnableResponseLogging bool          `yaml:"enable_response_logging"`
	EnableBodyLogging     bool          `yaml:"enable_body_logging"`
	EnableTracing         bool          `yaml:"enable_tracing"`
	EnableMetrics         bool          `yaml:"enable_metrics"`
	EnableCircuitBreaker  bool          `yaml:"enable_circuit_breaker"`
	MaxBodySize           int           `yaml:"max_body_size"`
	SanitizeHeaders       []string      `yaml:"sanitize_headers"`
	PublicPaths           []string      `yaml:"public_paths"`
	TrustedProxies        []string      `yaml:"trusted_proxies"`
	RequestTimeout        time.Duration `yaml:"request_timeout"`
}

// EnhancedMiddleware provides a comprehensive middleware pipeline
type EnhancedMiddleware struct {
	config      *config.Config
	mwConfig    EnhancedMiddlewareConfig
	logger      *observability.Logger
	traceHelper *observability.TraceHelper
	cbRegistry  *circuitbreaker.Registry
	sensitive   map[string]bool
	publicPaths map[string]bool
}

// NewEnhancedMiddleware creates a new enhanced middleware instance
func NewEnhancedMiddleware(
	cfg *config.Config,
	logger *observability.Logger,
	traceHelper *observability.TraceHelper,
	cbRegistry *circuitbreaker.Registry,
) *EnhancedMiddleware {
	// Initialize sensitive headers
	sensitive := make(map[string]bool)
	sensitiveHeaders := []string{
		"authorization", "cookie", "set-cookie",
		"x-api-key", "x-auth-token", "x-session-token",
		"password", "secret", "token", "key",
	}

	for _, header := range sensitiveHeaders {
		sensitive[strings.ToLower(header)] = true
	}

	// Initialize public paths
	publicPaths := make(map[string]bool)
	publicPathList := []string{
		"/health", "/healthz", "/ready", "/readyz", "/live", "/livez",
		"/metrics", "/version", "/favicon.ico", "/robots.txt",
		"/swagger", "/openapi.json", "/docs",
	}

	for _, path := range publicPathList {
		publicPaths[path] = true
	}

	mwConfig := EnhancedMiddlewareConfig{
		EnableRequestLogging:  true,
		EnableResponseLogging: true,
		EnableBodyLogging:     false, // Disabled by default for security
		EnableTracing:         true,
		EnableMetrics:         true,
		EnableCircuitBreaker:  true,
		MaxBodySize:           1024 * 64, // 64KB
		SanitizeHeaders:       sensitiveHeaders,
		PublicPaths:           publicPathList,
		TrustedProxies:        []string{},
		RequestTimeout:        30 * time.Second,
	}

	return &EnhancedMiddleware{
		config:      cfg,
		mwConfig:    mwConfig,
		logger:      logger,
		traceHelper: traceHelper,
		cbRegistry:  cbRegistry,
		sensitive:   sensitive,
		publicPaths: publicPaths,
	}
}

// RequestIDMiddleware adds a unique request ID to each request
func (em *EnhancedMiddleware) RequestIDMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			requestID := r.Header.Get("X-Request-ID")
			if requestID == "" {
				requestID = uuid.New().String()
			}

			// Add request ID to context and headers
			ctx := context.WithValue(r.Context(), "request_id", requestID)
			r = r.WithContext(ctx)
			w.Header().Set("X-Request-ID", requestID)

			// Add to trace helper
			observability.SetAttributes(ctx, "http", map[string]interface{}{
				"request_id": requestID,
			})

			next.ServeHTTP(w, r)
		})
	}
}

// CorrelationMiddleware handles correlation context propagation
func (em *EnhancedMiddleware) CorrelationMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()

			// Extract correlation ID from headers
			correlationID := r.Header.Get("X-Correlation-ID")
			if correlationID == "" {
				correlationID = r.Header.Get("X-Request-ID")
			}

			// Add trace context from headers
			propagator := otel.GetTextMapPropagator()
			ctx = propagator.Extract(ctx, &headerCarrier{r.Header})

			// Set correlation context
			corrCtx := observability.CorrelationContext{
				RequestID:     getFromContext(ctx, "request_id"),
				CorrelationID: correlationID,
				TraceID:       observability.GetCorrelationContext(ctx).TraceID,
				SpanID:        observability.GetCorrelationContext(ctx).SpanID,
			}

			// Add to context
			ctx = context.WithValue(ctx, "correlation_context", corrCtx)
			r = r.WithContext(ctx)

			// Set correlation headers for downstream services
			observability.SetRequestHeaders(r, ctx)

			next.ServeHTTP(w, r)
		})
	}
}

// EnhancedLoggingMiddleware provides comprehensive request/response logging
func (em *EnhancedMiddleware) EnhancedLoggingMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !em.mwConfig.EnableRequestLogging {
				next.ServeHTTP(w, r)
				return
			}

			start := time.Now()
			ctx := r.Context()

			// Create response writer wrapper
			rw := &observability.NewResponseWriter(w)

			// Log request
			em.logRequest(ctx, r)

			// Process request
			next.ServeHTTP(rw, r)

			// Log response
			duration := time.Since(start)
			em.logResponse(ctx, r, rw, duration)

			// Track metrics if enabled
			if em.mwConfig.EnableMetrics {
				em.trackRequestMetrics(ctx, r, rw, duration)
			}
		})
	}
}

// EnhancedTracingMiddleware provides comprehensive distributed tracing
func (em *EnhancedMiddleware) EnhancedTracingMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !em.mwConfig.EnableTracing {
				next.ServeHTTP(w, r)
				return
			}

			ctx := r.Context()
			ctx, span := em.traceHelper.TraceHTTPRequest(ctx, r)
			defer span.End()

			// Wrap response writer to capture response details
			rw := &observability.NewResponseWriter(w)

			// Process request
			start := time.Now()
			next.ServeHTTP(rw, r)
			duration := time.Since(start)

			// Trace response
			em.traceHelper.TraceHTTPResponse(ctx, rw.statusCode, int64(rw.size), duration)

			// Add additional tracing events
			em.traceHelper.AddEvent(ctx, "http.request_processed", map[string]interface{}{
				"response_size":   rw.size,
				"response_status": rw.statusCode,
				"duration_ms":     duration.Milliseconds(),
			})
		})
	}
}

// CircuitBreakerMiddleware provides circuit breaker protection
func (em *EnhancedMiddleware) CircuitBreakerMiddleware(serviceName string) func(http.Handler) http.Handler {
	if !em.mwConfig.EnableCircuitBreaker {
		return func(next http.Handler) http.Handler {
			return next
		}
	}

	cbConfig := circuitbreaker.Config{
		MaxFailures:      5,
		ResetTimeout:     30 * time.Second,
		SuccessThreshold: 3,
		FailureThreshold: 2,
		RequestTimeout:   em.mwConfig.RequestTimeout,
		MonitorInterval:  1 * time.Minute,
		Name:             serviceName,
	}

	cb := em.cbRegistry.GetOrCreate(serviceName, cbConfig)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()

			err := cb.Execute(ctx, func(ctx context.Context) error {
				next.ServeHTTP(w, r)
				return nil
			})

			if err != nil {
				if err == circuitbreaker.ErrCircuitBreakerOpen {
					em.logger.WithContext(ctx).WithFields(logrus.Fields{
						"service": serviceName,
						"error":   err.Error(),
					}).Warn("Circuit breaker is open")

					render.Status(r, http.StatusServiceUnavailable)
					render.JSON(w, r, map[string]interface{}{
						"error": map[string]interface{}{
							"code":    "SERVICE_UNAVAILABLE",
							"message": "Service temporarily unavailable - circuit breaker open",
							"service": serviceName,
						},
						"meta": map[string]interface{}{
							"timestamp":  time.Now().UTC().Format(time.RFC3339),
							"request_id": getFromContext(ctx, "request_id"),
						},
					})
				} else {
					// Other errors (like timeout)
					em.logger.WithContext(ctx).WithError(err).WithFields(logrus.Fields{
						"service": serviceName,
					}).Error("Circuit breaker execution failed")

					render.Status(r, http.StatusGatewayTimeout)
					render.JSON(w, r, map[string]interface{}{
						"error": map[string]interface{}{
							"code":    "GATEWAY_TIMEOUT",
							"message": "Request timeout",
							"service": serviceName,
						},
						"meta": map[string]interface{}{
							"timestamp":  time.Now().UTC().Format(time.RFC3339),
							"request_id": getFromContext(ctx, "request_id"),
						},
					})
				}
			}
		})
	}
}

// SecurityMiddleware enhances security headers and validation
func (em *EnhancedMiddleware) SecurityMiddleware() func(http.Handler) http.Handler {
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

			// HSTS for HTTPS
			if r.TLS != nil {
				w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
			}

			// Content Security Policy
			csp := "default-src 'self'; " +
				"script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
				"style-src 'self' 'unsafe-inline'; " +
				"img-src 'self' data: https:; " +
				"font-src 'self' data:; " +
				"connect-src 'self'; " +
				"frame-ancestors 'none'; " +
				"base-uri 'self'; " +
				"form-action 'self'"
			w.Header().Set("Content-Security-Policy", csp)

			// Rate limiting headers (will be updated by rate limiting middleware)
			w.Header().Set("X-RateLimit-Limit", "1000")
			w.Header().Set("X-RateLimit-Remaining", "1000")
			w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(time.Hour).Unix(), 10))

			next.ServeHTTP(w, r)
		})
	}
}

// EnhancedCORSMiddleware provides comprehensive CORS handling
func (em *EnhancedMiddleware) EnhancedCORSMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			// Handle preflight requests
			if r.Method == http.MethodOptions {
				w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Accept,Authorization,Content-Type,X-CSRF-Token,X-Request-ID,X-Tenant-ID,X-Correlation-ID")
				w.Header().Set("Access-Control-Expose-Headers", "X-Total-Count,X-RateLimit-Limit,X-RateLimit-Remaining,X-RateLimit-Reset,X-Request-ID")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Max-Age", "300")

				// Only allow explicitly configured origins — no wildcard fallback
				if em.isOriginAllowed(origin) {
					w.Header().Set("Access-Control-Allow-Origin", origin)
				}

				w.WriteHeader(http.StatusNoContent)
				return
			}

			// Set CORS headers for regular requests
			if em.isOriginAllowed(origin) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
			}

			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Expose-Headers", "X-Total-Count,X-RateLimit-Limit,X-RateLimit-Remaining,X-RateLimit-Reset,X-Request-ID")

			next.ServeHTTP(w, r)
		})
	}
}

// CompressionMiddleware provides gzip compression with enhanced features
func (em *EnhancedMiddleware) CompressionMiddleware() func(http.Handler) http.Handler {
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

			// Don't compress certain content types
			contentType := r.Header.Get("Content-Type")
			if em.shouldSkipCompression(contentType) {
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

// TimeoutMiddleware provides configurable request timeout
func (em *EnhancedMiddleware) TimeoutMiddleware(timeout time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if timeout <= 0 {
				next.ServeHTTP(w, r)
				return
			}

			ctx, cancel := context.WithTimeout(r.Context(), timeout)
			defer cancel()

			r = r.WithContext(ctx)
			next.ServeHTTP(w, r)
		})
	}
}

// MetricsMiddleware provides comprehensive metrics collection
func (em *EnhancedMiddleware) MetricsMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !em.mwConfig.EnableMetrics {
				next.ServeHTTP(w, r)
				return
			}

			start := time.Now()
			rw := &observability.NewResponseWriter(w)

			next.ServeHTTP(rw, r)

			duration := time.Since(start)
			em.trackRequestMetrics(r.Context(), r, rw, duration)
		})
	}
}

// Helper methods

func (em *EnhancedMiddleware) logRequest(ctx context.Context, req *http.Request) {
	entry := em.logger.WithContext(ctx).WithFields(logrus.Fields{
		"event":      "http.request",
		"method":     req.Method,
		"path":       req.URL.Path,
		"query":      req.URL.RawQuery,
		"host":       req.Host,
		"scheme":     req.URL.Scheme,
		"protocol":   req.Proto,
		"remote":     req.RemoteAddr,
		"size":       req.ContentLength,
		"user_agent": req.UserAgent(),
	})

	// Add headers (sanitized)
	headers := make(map[string]string)
	for name, values := range req.Header {
		if em.sensitive[strings.ToLower(name)] {
			headers[name] = "***REDACTED***"
		} else {
			headers[name] = strings.Join(values, ", ")
		}
	}
	entry = entry.WithField("headers", headers)

	// Add body if enabled
	if em.mwConfig.EnableBodyLogging && req.Body != nil && req.ContentLength > 0 {
		if body := em.readBody(req.Body); body != "" {
			entry = entry.WithField("body", body)
		}
	}

	entry.Info("HTTP request received")
}

func (em *EnhancedMiddleware) logResponse(ctx context.Context, req *http.Request, resp *observability.ResponseWriter, duration time.Duration) {
	entry := em.logger.WithContext(ctx).WithFields(logrus.Fields{
		"event":       "http.response",
		"method":      req.Method,
		"path":        req.URL.Path,
		"status":      resp.statusCode,
		"size":        resp.size,
		"duration":    duration.Milliseconds(),
		"duration_ns": duration.Nanoseconds(),
	})

	// Log based on status code
	switch {
	case resp.statusCode >= 500:
		entry.Error("HTTP response - server error")
	case resp.statusCode >= 400:
		entry.Warn("HTTP response - client error")
	case resp.statusCode >= 300:
		entry.Info("HTTP response - redirect")
	default:
		entry.Info("HTTP response - success")
	}
}

func (em *EnhancedMiddleware) trackRequestMetrics(ctx context.Context, req *http.Request, resp *observability.ResponseWriter, duration time.Duration) {
	// Add metrics to trace
	em.traceHelper.SetAttributes(ctx, map[string]interface{}{
		"http.method":        req.Method,
		"http.path":          req.URL.Path,
		"http.status_code":   resp.statusCode,
		"http.duration_ms":   duration.Milliseconds(),
		"http.response_size": resp.size,
	})

	// Log slow requests
	if duration > 5*time.Second {
		em.logger.WithContext(ctx).WithFields(logrus.Fields{
			"method":   req.Method,
			"path":     req.URL.Path,
			"duration": duration.Milliseconds(),
		}).Warn("Slow request detected")
	}
}

func (em *EnhancedMiddleware) readBody(body io.ReadCloser) string {
	if body == nil {
		return ""
	}

	buf, err := io.ReadAll(io.LimitReader(body, int64(em.mwConfig.MaxBodySize)))
	if err != nil {
		return fmt.Sprintf("Error reading body: %v", err)
	}

	// Recreate the reader
	body.Close()
	body = io.NopCloser(bytes.NewReader(buf))

	bodyStr := string(buf)
	if len(bodyStr) > em.mwConfig.MaxBodySize {
		bodyStr = bodyStr[:em.mwConfig.MaxBodySize] + "... (truncated)"
	}

	return bodyStr
}

func (em *EnhancedMiddleware) isOriginAllowed(origin string) bool {
	if origin == "" {
		return false
	}

	// Check against allowed origins from config — reject wildcard entries
	for _, allowedOrigin := range em.config.CORS.AllowedOrigins {
		if allowedOrigin == origin {
			return true
		}
	}

	return false
}

func (em *EnhancedMiddleware) shouldSkipCompression(contentType string) bool {
	skipTypes := []string{
		"image/", "video/", "audio/",
		"application/zip", "application/gzip",
		"application/pdf", "application/octet-stream",
	}

	for _, skipType := range skipTypes {
		if strings.HasPrefix(contentType, skipType) {
			return true
		}
	}

	return false
}

func (em *EnhancedMiddleware) isPublicPath(path string) bool {
	for publicPath := range em.publicPaths {
		if strings.HasPrefix(path, publicPath) {
			return true
		}
	}
	return false
}

func getFromContext(ctx context.Context, key string) string {
	if val := ctx.Value(key); val != nil {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}

// gzipResponseWriter wraps ResponseWriter to provide gzip compression
type gzipResponseWriter struct {
	http.ResponseWriter
	gzipWriter *gzip.Writer
}

func (grw *gzipResponseWriter) Write(b []byte) (int, error) {
	return grw.gzipWriter.Write(b)
}

// headerCarrier implements propagation.TextMapCarrier for HTTP headers
type headerCarrier struct {
	headers http.Header
}

func (c *headerCarrier) Get(key string) string {
	return c.headers.Get(key)
}

func (c *headerCarrier) Set(key, value string) {
	c.headers.Set(key, value)
}

func (c *headerCarrier) Keys() []string {
	keys := make([]string, 0, len(c.headers))
	for k := range c.headers {
		keys = append(keys, k)
	}
	return keys
}

// Convenience functions for creating middleware chains

// CreateMiddlewareChain creates a complete middleware chain
func (em *EnhancedMiddleware) CreateMiddlewareChain() []func(http.Handler) http.Handler {
	var middlewares []func(http.Handler) http.Handler

	// Core middleware
	middlewares = append(middlewares, middleware.RequestID)
	middlewares = append(middlewares, middleware.RealIP)
	middlewares = append(middlewares, middleware.Recoverer)
	middlewares = append(middlewares, em.TimeoutMiddleware(em.mwConfig.RequestTimeout))

	// Enhanced middleware
	middlewares = append(middlewares, em.RequestIDMiddleware())
	middlewares = append(middlewares, em.CorrelationMiddleware())
	middlewares = append(middlewares, em.EnhancedTracingMiddleware())
	middlewares = append(middlewares, em.EnhancedLoggingMiddleware())
	middlewares = append(middlewares, em.SecurityMiddleware())
	middlewares = append(middlewares, em.EnhancedCORSMiddleware())
	middlewares = append(middlewares, em.CompressionMiddleware())
	middlewares = append(middlewares, em.MetricsMiddleware())

	return middlewares
}
