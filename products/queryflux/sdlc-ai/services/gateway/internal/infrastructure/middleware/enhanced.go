//go:build ignore

package middleware

import (
	"bufio"
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"regexp"
	"runtime/debug"
	"strings"
	"time"

	"github.com/go-chi/render"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/circuitbreaker"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/observability"
)

// EnhancedMiddlewareConfig holds configuration for enhanced middleware
type EnhancedMiddlewareConfig struct {
	EnableRequestLogging    bool     `yaml:"enable_request_logging"`
	EnableResponseLogging   bool     `yaml:"enable_response_logging"`
	EnablePayloadLogging    bool     `yaml:"enable_payload_logging"`
	MaxPayloadSize          int      `yaml:"max_payload_size"`
	EnableCircuitBreaker    bool     `yaml:"enable_circuit_breaker"`
	EnableAdvancedRateLimit bool     `yaml:"enable_advanced_rate_limit"`
	EnableRequestTimeout    bool     `yaml:"enable_request_timeout"`
	EnableCompression       bool     `yaml:"enable_compression"`
	EnableSecurityHeaders   bool     `yaml:"enable_security_headers"`
	EnableMetrics           bool     `yaml:"enable_metrics"`
	LogSensitiveData        bool     `yaml:"log_sensitive_data"`
	SensitivePatterns       []string `yaml:"sensitive_patterns"`
}

// DefaultEnhancedMiddlewareConfig returns default configuration
func DefaultEnhancedMiddlewareConfig() EnhancedMiddlewareConfig {
	return EnhancedMiddlewareConfig{
		EnableRequestLogging:    true,
		EnableResponseLogging:   true,
		EnablePayloadLogging:    false,       // Disabled by default for security
		MaxPayloadSize:          1024 * 1024, // 1MB
		EnableCircuitBreaker:    true,
		EnableAdvancedRateLimit: true,
		EnableRequestTimeout:    true,
		EnableCompression:       true,
		EnableSecurityHeaders:   true,
		EnableMetrics:           true,
		LogSensitiveData:        false,
		SensitivePatterns: []string{
			`(?i)password`,
			`(?i)token`,
			`(?i)secret`,
			`(?i)key`,
			`(?i)auth`,
			`(?i)credential`,
			`(?i)bearer`,
		},
	}
}

// EnhancedRequestLogger provides enhanced request logging with correlation
type EnhancedRequestLogger struct {
	config EnhancedMiddlewareConfig
	logger *logrus.Entry
	tracer *observability.TraceHelper
}

// NewEnhancedRequestLogger creates a new enhanced request logger
func NewEnhancedRequestLogger(config EnhancedMiddlewareConfig) *EnhancedRequestLogger {
	return &EnhancedRequestLogger{
		config: config,
		logger: logrus.WithFields(logrus.Fields{
			"component": "enhanced_middleware",
		}),
		tracer: observability.GetGlobalTraceHelper("enhanced_middleware"),
	}
}

// EnhancedLoggingMiddleware creates enhanced logging middleware with correlation and tracing
func (erl *EnhancedRequestLogger) EnhancedLoggingMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Extract or generate correlation ID
			correlationID := observability.GetRequestID(r)
			if correlationID == "" {
				correlationID = uuid.New().String()
			}

			// Start span for request processing
			ctx, span := erl.tracer.TraceHTTPRequest(r.Context(), r)
			defer span.End()

			// Add correlation context to span
			erl.tracer.SetAttributes(ctx, map[string]interface{}{
				"correlation.id": correlationID,
				"request.id":     correlationID,
			})

			// Update request context
			r = r.WithContext(ctx)

			// Create enhanced response writer wrapper
			wrapped := &enhancedResponseWriter{
				ResponseWriter: w,
				request:        r,
				startTime:      start,
				correlationID:  correlationID,
				logger:         erl.logger.WithField("correlation_id", correlationID),
				tracer:         erl.tracer,
				config:         erl.config,
			}

			// Log request details
			erl.logRequest(r, correlationID, ctx)

			// Process request
			next.ServeHTTP(wrapped, r)

			// Log response details
			wrapped.logResponse()
		})
	}
}

// logRequest logs incoming request details
func (erl *EnhancedRequestLogger) logRequest(r *http.Request, correlationID string, ctx context.Context) {
	fields := logrus.Fields{
		"correlation_id": correlationID,
		"event":          "request_started",
		"method":         r.Method,
		"path":           r.URL.Path,
		"query":          r.URL.RawQuery,
		"remote_addr":    r.RemoteAddr,
		"user_agent":     r.UserAgent(),
		"host":           r.Host,
		"proto":          r.Proto,
		"content_length": r.ContentLength,
		"content_type":   r.Header.Get("Content-Type"),
		"accept":         r.Header.Get("Accept"),
		"request_id":     correlationID,
	}

	// Add trace information
	corrCtx := observability.GetCorrelationContext(ctx)
	if corrCtx.TraceID != "" {
		fields["trace_id"] = corrCtx.TraceID
		fields["span_id"] = corrCtx.SpanID
	}

	// Add authentication information if available
	if userID := r.Context().Value("user_id"); userID != nil {
		fields["user_id"] = userID
	}
	if tenantID := r.Context().Value("tenant_id"); tenantID != nil {
		fields["tenant_id"] = tenantID
	}

	// Log payload if enabled and not too large
	if erl.config.EnablePayloadLogging && r.Body != nil && r.ContentLength > 0 && r.ContentLength <= int64(erl.config.MaxPayloadSize) {
		body, _ := io.ReadAll(r.Body)
		r.Body = io.NopCloser(bytes.NewBuffer(body))

		payload := string(body)
		if !erl.config.LogSensitiveData && erl.containsSensitiveData(payload) {
			fields["payload"] = "[REDACTED_SENSITIVE_DATA]"
		} else {
			fields["payload"] = payload
		}
	}

	erl.logger.WithFields(fields).Info("Incoming request")
}

// containsSensitiveData checks if the payload contains sensitive information
func (erl *EnhancedRequestLogger) containsSensitiveData(payload string) bool {
	for _, pattern := range erl.config.SensitivePatterns {
		matched, _ := regexp.MatchString(pattern, payload)
		if matched {
			return true
		}
	}
	return false
}

// enhancedResponseWriter wraps http.ResponseWriter to capture response details
type enhancedResponseWriter struct {
	http.ResponseWriter
	request       *http.Request
	startTime     time.Time
	correlationID string
	logger        *logrus.Entry
	tracer        *observability.TraceHelper
	config        EnhancedMiddlewareConfig

	statusCode    int
	contentLength int
	written       bool
	buffer        *bytes.Buffer
	gzipWriter    *gzip.Writer
}

// WriteHeader captures the status code and writes headers
func (erw *enhancedResponseWriter) WriteHeader(code int) {
	if !erw.written {
		erw.statusCode = code
		erw.written = true
	}
	erw.ResponseWriter.WriteHeader(code)
}

// Write captures the response content and writes it
func (erw *enhancedResponseWriter) Write(b []byte) (int, error) {
	if !erw.written {
		erw.statusCode = http.StatusOK
		erw.written = true
	}

	n, err := erw.ResponseWriter.Write(b)
	erw.contentLength += n

	// Buffer response for logging if enabled
	if erw.config.EnableResponseLogging {
		if erw.buffer == nil {
			erw.buffer = &bytes.Buffer{}
		}
		erw.buffer.Write(b)
	}

	return n, err
}

// Hijack implements http.Hijacker if the underlying ResponseWriter supports it
func (erw *enhancedResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if hijacker, ok := erw.ResponseWriter.(http.Hijacker); ok {
		return hijacker.Hijack()
	}
	return nil, nil, fmt.Errorf("underlying ResponseWriter does not implement http.Hijacker")
}

// Flush implements http.Flusher if the underlying ResponseWriter supports it
func (erw *enhancedResponseWriter) Flush() {
	if flusher, ok := erw.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

// logResponse logs response details
func (erw *enhancedResponseWriter) logResponse() {
	duration := time.Since(erw.startTime)

	fields := logrus.Fields{
		"correlation_id": erw.correlationID,
		"event":          "request_completed",
		"status_code":    erw.statusCode,
		"duration_ms":    duration.Milliseconds(),
		"content_length": erw.contentLength,
		"request_method": erw.request.Method,
		"request_path":   erw.request.URL.Path,
		"request_query":  erw.request.URL.RawQuery,
		"remote_addr":    erw.request.RemoteAddr,
		"user_agent":     erw.request.UserAgent(),
	}

	// Add response headers
	if erw.config.EnableMetrics {
		fields["response_content_type"] = erw.Header().Get("Content-Type")
		fields["response_cache_control"] = erw.Header().Get("Cache-Control")
	}

	// Log response payload if enabled
	if erw.config.EnablePayloadLogging && erw.buffer != nil && erw.contentLength <= erw.config.MaxPayloadSize {
		payload := erw.buffer.String()
		if !erw.config.LogSensitiveData && erw.containsSensitiveData(payload) {
			fields["response_payload"] = "[REDACTED_SENSITIVE_DATA]"
		} else {
			fields["response_payload"] = payload
		}
	}

	// Trace the response
	erw.tracer.TraceHTTPResponse(erw.request.Context(), erw.statusCode, int64(erw.contentLength), duration)

	// Log with appropriate level
	logEntry := erw.logger.WithFields(fields)
	if erw.statusCode >= 500 {
		logEntry.Error("Request completed with server error")
	} else if erw.statusCode >= 400 {
		logEntry.Warn("Request completed with client error")
	} else {
		logEntry.Info("Request completed successfully")
	}
}

// containsSensitiveData checks if the response contains sensitive information
func (erw *enhancedResponseWriter) containsSensitiveData(payload string) bool {
	for _, pattern := range erw.config.SensitivePatterns {
		matched, _ := regexp.MatchString(pattern, payload)
		if matched {
			return true
		}
	}
	return false
}

// CircuitBreakerMiddleware creates a circuit breaker middleware
func CircuitBreakerMiddleware(name string, config circuitbreaker.Config) func(http.Handler) http.Handler {
	cb := circuitbreaker.New(config)
	cb.SetStateChangeCallback(func(oldState, newState circuitbreaker.State) {
		logrus.WithFields(logrus.Fields{
			"circuit_breaker": name,
			"old_state":       oldState.String(),
			"new_state":       newState.String(),
		}).Info("Circuit breaker state changed")
	})

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			err := cb.Execute(r.Context(), func(ctx context.Context) error {
				// Create a response writer wrapper
				wrapped := &circuitBreakerResponseWriter{
					ResponseWriter: w,
					statusCode:     http.StatusOK,
				}

				// Execute the next handler
				next.ServeHTTP(wrapped, r)

				// Return error if status code indicates failure
				if wrapped.statusCode >= 500 {
					return fmt.Errorf("server error: %d", wrapped.statusCode)
				}

				return nil
			})

			if err != nil {
				if err == circuitbreaker.ErrCircuitBreakerOpen {
					render.Status(r, http.StatusServiceUnavailable)
					render.JSON(w, r, map[string]interface{}{
						"error": map[string]interface{}{
							"code":    "SERVICE_UNAVAILABLE",
							"message": "Service temporarily unavailable - circuit breaker is open",
						},
						"meta": map[string]interface{}{
							"timestamp":       time.Now().UTC().Format(time.RFC3339),
							"circuit_breaker": name,
						},
					})
				} else {
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
			}
		})
	}
}

// circuitBreakerResponseWriter wraps ResponseWriter to capture status codes for circuit breaker
type circuitBreakerResponseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (cbw *circuitBreakerResponseWriter) WriteHeader(code int) {
	cbw.statusCode = code
	cbw.ResponseWriter.WriteHeader(code)
}

// AdvancedRecoveryMiddleware provides enhanced recovery with panic details
func AdvancedRecoveryMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					// Get stack trace
					stack := debug.Stack()

					// Get correlation ID
					correlationID := observability.GetRequestID(r)

					// Log detailed panic information
					logFields := logrus.Fields{
						"correlation_id": correlationID,
						"error":          err,
						"stack":          string(stack),
						"method":         r.Method,
						"path":           r.URL.Path,
						"query":          r.URL.RawQuery,
						"remote_addr":    r.RemoteAddr,
						"user_agent":     r.UserAgent(),
						"host":           r.Host,
						"headers":        erl.sanitizeHeaders(r.Header),
						"timestamp":      time.Now().UTC(),
					}

					// Add authentication info if available
					if userID := r.Context().Value("user_id"); userID != nil {
						logFields["user_id"] = userID
					}
					if tenantID := r.Context().Value("tenant_id"); tenantID != nil {
						logFields["tenant_id"] = tenantID
					}

					logrus.WithFields(logFields).Error("Request panic recovered")

					// Add error to trace
					observability.SetError(r.Context(), "enhanced_middleware", fmt.Errorf("panic: %v", err))

					// Return error response
					render.Status(r, http.StatusInternalServerError)
					render.JSON(w, r, map[string]interface{}{
						"error": map[string]interface{}{
							"code":    "INTERNAL_SERVER_ERROR",
							"message": "Internal server error",
						},
						"meta": map[string]interface{}{
							"timestamp":      time.Now().UTC().Format(time.RFC3339),
							"correlation_id": correlationID,
						},
					})
				}
			}()

			next.ServeHTTP(w, r)
		})
	}
}

// sanitizeHeaders removes sensitive information from headers for logging
func sanitizeHeaders(headers http.Header) map[string]string {
	sanitized := make(map[string]string)
	sensitive := []string{"authorization", "cookie", "x-api-key", "x-auth-token"}

	for name, values := range headers {
		lowerName := strings.ToLower(name)
		isSensitive := false
		for _, sensitiveHeader := range sensitive {
			if lowerName == sensitiveHeader {
				isSensitive = true
				break
			}
		}

		if isSensitive {
			sanitized[name] = "[REDACTED]"
		} else {
			sanitized[name] = strings.Join(values, ", ")
		}
	}

	return sanitized
}

// ProxyMiddleware handles reverse proxy functionality
func ProxyMiddleware(target *url.URL) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Create proxy director
			director := func(req *http.Request) {
				req.URL.Scheme = target.Scheme
				req.URL.Host = target.Host
				req.URL.Path = target.Path + req.URL.Path
				req.Host = target.Host

				// Clear hop-by-hop headers
				for _, header := range []string{
					"Connection", "Keep-Alive", "Proxy-Authenticate",
					"Proxy-Authorization", "Te", "Trailers", "Transfer-Encoding",
					"Upgrade",
				} {
					req.Header.Del(header)
				}

				// Set correlation headers
				correlationID := observability.GetRequestID(req)
				req.Header.Set("X-Request-ID", correlationID)
				req.Header.Set("X-Forwarded-For", req.RemoteAddr)
				req.Header.Set("X-Forwarded-Proto", "http")
				if req.TLS != nil {
					req.Header.Set("X-Forwarded-Proto", "https")
				}
			}

			// Create and configure proxy
			proxy := &httputil.ReverseProxy{Director: director}

			// Set error handler
			proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
				logrus.WithError(err).WithFields(logrus.Fields{
					"method":      r.Method,
					"path":        r.URL.Path,
					"target_host": target.Host,
				}).Error("Proxy request failed")

				render.Status(r, http.StatusBadGateway)
				render.JSON(w, r, map[string]interface{}{
					"error": map[string]interface{}{
						"code":    "BAD_GATEWAY",
						"message": "Proxy request failed",
					},
					"meta": map[string]interface{}{
						"timestamp": time.Now().UTC().Format(time.RFC3339),
					},
				})
			}

			proxy.ServeHTTP(w, r)
		})
	}
}

// RequestIDMiddleware ensures every request has a unique ID
func RequestIDMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			requestID := observability.GetRequestID(r)
			if requestID == "" {
				requestID = uuid.New().String()
			}

			// Set request ID in response header
			w.Header().Set("X-Request-ID", requestID)

			// Add to context
			ctx := context.WithValue(r.Context(), "request_id", requestID)
			r = r.WithContext(ctx)

			next.ServeHTTP(w, r)
		})
	}
}

// ContentSecurityMiddleware adds content security validation
func ContentSecurityMiddleware(allowedTypes []string, maxSize int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip for non-POST/PUT requests
			if r.Method != "POST" && r.Method != "PUT" && r.Method != "PATCH" {
				next.ServeHTTP(w, r)
				return
			}

			// Check content length
			if r.ContentLength > maxSize {
				render.Status(r, http.StatusRequestEntityTooLarge)
				render.JSON(w, r, map[string]interface{}{
					"error": map[string]interface{}{
						"code":    "PAYLOAD_TOO_LARGE",
						"message": "Request entity too large",
					},
					"meta": map[string]interface{}{
						"timestamp": time.Now().UTC().Format(time.RFC3339),
						"max_size":  maxSize,
					},
				})
				return
			}

			// Check content type
			contentType := r.Header.Get("Content-Type")
			if contentType != "" {
				allowed := false
				for _, allowedType := range allowedTypes {
					if strings.Contains(contentType, allowedType) {
						allowed = true
						break
					}
				}

				if !allowed {
					render.Status(r, http.StatusUnsupportedMediaType)
					render.JSON(w, r, map[string]interface{}{
						"error": map[string]interface{}{
							"code":    "UNSUPPORTED_MEDIA_TYPE",
							"message": "Unsupported media type",
						},
						"meta": map[string]interface{}{
							"timestamp":     time.Now().UTC().Format(time.RFC3339),
							"content_type":  contentType,
							"allowed_types": allowedTypes,
						},
					})
					return
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}
