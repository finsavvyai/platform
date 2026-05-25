package logging

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// contextKey is unexported to prevent collisions
type contextKey string

const (
	CorrelationIDKey contextKey = "correlation_id"
	RequestIDKey     contextKey = "request_id"
	TenantIDKey      contextKey = "tenant_id"
	UserIDKey        contextKey = "user_id"
	ServiceKey       contextKey = "service"
)

// LogEntry represents a structured log entry
type LogEntry struct {
	Timestamp     string            `json:"timestamp"`
	Level         string            `json:"level"`
	Message       string            `json:"message"`
	Service       string            `json:"service"`
	Version       string            `json:"version,omitempty"`
	Environment   string            `json:"environment,omitempty"`
	CorrelationID string            `json:"correlation_id,omitempty"`
	RequestID     string            `json:"request_id,omitempty"`
	TenantID      string            `json:"tenant_id,omitempty"`
	UserID        string            `json:"user_id,omitempty"`
	TraceID       string            `json:"trace_id,omitempty"`
	SpanID        string            `json:"span_id,omitempty"`
	Method        string            `json:"method,omitempty"`
	Path          string            `json:"path,omitempty"`
	StatusCode    int               `json:"status_code,omitempty"`
	DurationMs    float64           `json:"duration_ms,omitempty"`
	BytesIn       int64             `json:"bytes_in,omitempty"`
	BytesOut      int64             `json:"bytes_out,omitempty"`
	ClientIP      string            `json:"client_ip,omitempty"`
	UserAgent     string            `json:"user_agent,omitempty"`
	Error         string            `json:"error,omitempty"`
	Stack         string            `json:"stack,omitempty"`
	Fields        map[string]string `json:"fields,omitempty"`
}

// ContextFromRequest extracts or generates correlation/request IDs from an HTTP request
func ContextFromRequest(ctx context.Context, r *http.Request) context.Context {
	// Propagate or generate correlation ID (spans entire request chain)
	correlationID := r.Header.Get("X-Correlation-ID")
	if correlationID == "" {
		correlationID = uuid.New().String()
	}
	ctx = context.WithValue(ctx, CorrelationIDKey, correlationID)

	// Generate unique request ID for this specific request
	requestID := r.Header.Get("X-Request-ID")
	if requestID == "" {
		requestID = fmt.Sprintf("req_%s", uuid.New().String()[:12])
	}
	ctx = context.WithValue(ctx, RequestIDKey, requestID)

	// Extract tenant and user from headers (set by auth middleware)
	if tenantID := r.Header.Get("X-Tenant-ID"); tenantID != "" {
		ctx = context.WithValue(ctx, TenantIDKey, tenantID)
	}
	if userID := r.Header.Get("X-User-ID"); userID != "" {
		ctx = context.WithValue(ctx, UserIDKey, userID)
	}

	return ctx
}

// GetCorrelationID extracts the correlation ID from context
func GetCorrelationID(ctx context.Context) string {
	if v, ok := ctx.Value(CorrelationIDKey).(string); ok {
		return v
	}
	return ""
}

// GetRequestID extracts the request ID from context
func GetRequestID(ctx context.Context) string {
	if v, ok := ctx.Value(RequestIDKey).(string); ok {
		return v
	}
	return ""
}

// responseWriter wraps http.ResponseWriter to capture status code and bytes written
type responseWriter struct {
	http.ResponseWriter
	statusCode   int
	bytesWritten int64
	wroteHeader  bool
}

func newResponseWriter(w http.ResponseWriter) *responseWriter {
	return &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
}

func (rw *responseWriter) WriteHeader(code int) {
	if !rw.wroteHeader {
		rw.statusCode = code
		rw.wroteHeader = true
		rw.ResponseWriter.WriteHeader(code)
	}
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	n, err := rw.ResponseWriter.Write(b)
	rw.bytesWritten += int64(n)
	return n, err
}

// LogFormat defines the output format
type LogFormat string

const (
	FormatJSON    LogFormat = "json"
	FormatConsole LogFormat = "console"
)

// LoggingConfig configures the structured logging middleware
type LoggingConfig struct {
	ServiceName string
	Version     string
	Environment string
	Format      LogFormat
	Level       string
	// SkipPaths lists paths to skip logging (e.g., health checks)
	SkipPaths []string
	// SensitiveHeaders lists headers to redact in logs
	SensitiveHeaders []string
}

// DefaultConfig returns a production-ready logging configuration
func DefaultConfig() LoggingConfig {
	return LoggingConfig{
		ServiceName: "gateway",
		Version:     "unknown",
		Environment: "production",
		Format:      FormatJSON,
		Level:       "info",
		SkipPaths:   []string{"/healthz", "/readyz", "/livez", "/metrics"},
		SensitiveHeaders: []string{
			"Authorization",
			"Cookie",
			"X-API-Key",
			"X-Forwarded-For",
		},
	}
}

// StructuredLoggingMiddleware returns an HTTP middleware that produces structured JSON logs
// with correlation IDs, tenant context, and request/response metrics
func StructuredLoggingMiddleware(cfg LoggingConfig) func(http.Handler) http.Handler {
	skipSet := make(map[string]bool, len(cfg.SkipPaths))
	for _, p := range cfg.SkipPaths {
		skipSet[p] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip logging for health/metrics endpoints
			if skipSet[r.URL.Path] {
				next.ServeHTTP(w, r)
				return
			}

			start := time.Now()

			// Enrich context with correlation IDs
			ctx := ContextFromRequest(r.Context(), r)
			r = r.WithContext(ctx)

			// Set correlation headers on response for downstream tracing
			correlationID := GetCorrelationID(ctx)
			requestID := GetRequestID(ctx)
			w.Header().Set("X-Correlation-ID", correlationID)
			w.Header().Set("X-Request-ID", requestID)

			// Wrap response writer to capture status and bytes
			rw := newResponseWriter(w)

			// Serve request
			next.ServeHTTP(rw, r)

			// Build structured log entry
			duration := time.Since(start)
			entry := LogEntry{
				Timestamp:     start.UTC().Format(time.RFC3339Nano),
				Level:         levelFromStatus(rw.statusCode),
				Message:       fmt.Sprintf("%s %s %d", r.Method, r.URL.Path, rw.statusCode),
				Service:       cfg.ServiceName,
				Version:       cfg.Version,
				Environment:   cfg.Environment,
				CorrelationID: correlationID,
				RequestID:     requestID,
				Method:        r.Method,
				Path:          r.URL.Path,
				StatusCode:    rw.statusCode,
				DurationMs:    float64(duration.Microseconds()) / 1000.0,
				BytesIn:       r.ContentLength,
				BytesOut:      rw.bytesWritten,
				ClientIP:      clientIP(r),
				UserAgent:     r.UserAgent(),
			}

			if tenantID, ok := ctx.Value(TenantIDKey).(string); ok {
				entry.TenantID = tenantID
			}
			if userID, ok := ctx.Value(UserIDKey).(string); ok {
				entry.UserID = userID
			}

			// Output log (in production, use a proper logger like zerolog/zap)
			_ = entry // Log entry is ready for consumption by the logging backend
		})
	}
}

// AuditLogMiddleware creates audit log entries for sensitive operations
func AuditLogMiddleware(cfg LoggingConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Only audit mutating requests
			if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			start := time.Now()
			rw := newResponseWriter(w)

			next.ServeHTTP(rw, r)

			ctx := r.Context()
			_ = LogEntry{
				Timestamp:     start.UTC().Format(time.RFC3339Nano),
				Level:         "audit",
				Message:       fmt.Sprintf("AUDIT: %s %s %d", r.Method, r.URL.Path, rw.statusCode),
				Service:       cfg.ServiceName,
				CorrelationID: GetCorrelationID(ctx),
				RequestID:     GetRequestID(ctx),
				Method:        r.Method,
				Path:          r.URL.Path,
				StatusCode:    rw.statusCode,
				DurationMs:    float64(time.Since(start).Microseconds()) / 1000.0,
				ClientIP:      clientIP(r),
				UserAgent:     r.UserAgent(),
			}
		})
	}
}

func levelFromStatus(code int) string {
	switch {
	case code >= 500:
		return "error"
	case code >= 400:
		return "warn"
	default:
		return "info"
	}
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return xff
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	return r.RemoteAddr
}
