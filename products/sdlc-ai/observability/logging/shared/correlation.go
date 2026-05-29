package shared

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
)

// Correlation headers for HTTP requests
const (
	HeaderCorrelationID = "X-Correlation-ID"
	HeaderTraceID       = "X-Trace-ID"
	HeaderSpanID        = "X-Span-ID"
	HeaderUserID        = "X-User-ID"
	HeaderTenantID      = "X-Tenant-ID"
	HeaderRequestID     = "X-Request-ID"
	HeaderSessionID     = "X-Session-ID"
)

// CorrelationContext holds all correlation data
type CorrelationContext struct {
	CorrelationID string
	TraceID       string
	SpanID        string
	UserID        string
	TenantID      string
	RequestID     string
	SessionID     string
}

// Context keys for correlation data
type contextKey string

const (
	CorrelationContextKey contextKey = "correlation_context"
)

// ExtractCorrelationFromRequest extracts correlation data from HTTP headers
func ExtractCorrelationFromRequest(r *http.Request) *CorrelationContext {
	ctx := &CorrelationContext{}

	// Extract correlation ID
	if correlationID := r.Header.Get(HeaderCorrelationID); correlationID != "" {
		ctx.CorrelationID = correlationID
	} else {
		ctx.CorrelationID = uuid.New().String()
	}

	// Extract trace data
	ctx.TraceID = r.Header.Get(HeaderTraceID)
	ctx.SpanID = r.Header.Get(HeaderSpanID)

	// Extract user data
	ctx.UserID = r.Header.Get(HeaderUserID)
	ctx.TenantID = r.Header.Get(HeaderTenantID)

	// Extract request data
	ctx.RequestID = r.Header.Get(HeaderRequestID)
	ctx.SessionID = r.Header.Get(HeaderSessionID)

	// Generate request ID if not present
	if ctx.RequestID == "" {
		ctx.RequestID = uuid.New().String()
	}

	return ctx
}

// InjectCorrelationToRequest injects correlation data into HTTP headers
func InjectCorrelationToRequest(ctx context.Context, r *http.Request) {
	corrCtx := GetCorrelationContext(ctx)
	if corrCtx == nil {
		return
	}

	if corrCtx.CorrelationID != "" {
		r.Header.Set(HeaderCorrelationID, corrCtx.CorrelationID)
	}
	if corrCtx.TraceID != "" {
		r.Header.Set(HeaderTraceID, corrCtx.TraceID)
	}
	if corrCtx.SpanID != "" {
		r.Header.Set(HeaderSpanID, corrCtx.SpanID)
	}
	if corrCtx.UserID != "" {
		r.Header.Set(HeaderUserID, corrCtx.UserID)
	}
	if corrCtx.TenantID != "" {
		r.Header.Set(HeaderTenantID, corrCtx.TenantID)
	}
	if corrCtx.RequestID != "" {
		r.Header.Set(HeaderRequestID, corrCtx.RequestID)
	}
	if corrCtx.SessionID != "" {
		r.Header.Set(HeaderSessionID, corrCtx.SessionID)
	}
}

// WithCorrelationContext adds correlation context to the Go context
func WithCorrelationContext(ctx context.Context, corrCtx *CorrelationContext) context.Context {
	return context.WithValue(ctx, CorrelationContextKey, corrCtx)
}

// GetCorrelationContext retrieves correlation context from Go context
func GetCorrelationContext(ctx context.Context) *CorrelationContext {
	if ctx == nil {
		return nil
	}
	if corrCtx, ok := ctx.Value(CorrelationContextKey).(*CorrelationContext); ok {
		return corrCtx
	}
	return nil
}

// GetCorrelationID retrieves correlation ID from context
func GetCorrelationID(ctx context.Context) string {
	if corrCtx := GetCorrelationContext(ctx); corrCtx != nil {
		return corrCtx.CorrelationID
	}
	return ""
}

// GetTraceID retrieves trace ID from context
func GetTraceID(ctx context.Context) string {
	if corrCtx := GetCorrelationContext(ctx); corrCtx != nil {
		return corrCtx.TraceID
	}
	return ""
}

// GetSpanID retrieves span ID from context
func GetSpanID(ctx context.Context) string {
	if corrCtx := GetCorrelationContext(ctx); corrCtx != nil {
		return corrCtx.SpanID
	}
	return ""
}

// GetUserID retrieves user ID from context
func GetUserID(ctx context.Context) string {
	if corrCtx := GetCorrelationContext(ctx); corrCtx != nil {
		return corrCtx.UserID
	}
	return ""
}

// GetTenantID retrieves tenant ID from context
func GetTenantID(ctx context.Context) string {
	if corrCtx := GetCorrelationContext(ctx); corrCtx != nil {
		return corrCtx.TenantID
	}
	return ""
}

// GetRequestID retrieves request ID from context
func GetRequestID(ctx context.Context) string {
	if corrCtx := GetCorrelationContext(ctx); corrCtx != nil {
		return corrCtx.RequestID
	}
	return ""
}

// GetSessionID retrieves session ID from context
func GetSessionID(ctx context.Context) string {
	if corrCtx := GetCorrelationContext(ctx); corrCtx != nil {
		return corrCtx.SessionID
	}
	return ""
}

// CorrelationMiddleware is HTTP middleware for correlation ID propagation
type CorrelationMiddleware struct {
	serviceName string
	version     string
}

// NewCorrelationMiddleware creates a new correlation middleware
func NewCorrelationMiddleware(serviceName, version string) *CorrelationMiddleware {
	return &CorrelationMiddleware{
		serviceName: serviceName,
		version:     version,
	}
}

// ServeHTTP implements the http.Handler interface
func (m *CorrelationMiddleware) ServeHTTP(w http.ResponseWriter, r *http.Request, next http.HandlerFunc) {
	// Extract correlation context from request
	corrCtx := ExtractCorrelationFromRequest(r)

	// Add service information to correlation context
	// You can extend this with additional service-specific data

	// Inject correlation context into Go context
	ctx := WithCorrelationContext(r.Context(), corrCtx)
	r = r.WithContext(ctx)

	// Inject correlation headers into response
	w.Header().Set(HeaderCorrelationID, corrCtx.CorrelationID)
	w.Header().Set(HeaderRequestID, corrCtx.RequestID)
	if corrCtx.TraceID != "" {
		w.Header().Set(HeaderTraceID, corrCtx.TraceID)
	}
	if corrCtx.SpanID != "" {
		w.Header().Set(HeaderSpanID, corrCtx.SpanID)
	}

	// Call next handler
	next(w, r)
}

// CorrelationHTTPClient wraps an HTTP client to propagate correlation data
type CorrelationHTTPClient struct {
	client *http.Client
}

// NewCorrelationHTTPClient creates a new HTTP client with correlation propagation
func NewCorrelationHTTPClient(client *http.Client) *CorrelationHTTPClient {
	if client == nil {
		client = http.DefaultClient
	}
	return &CorrelationHTTPClient{client: client}
}

// Do performs an HTTP request with correlation headers
func (c *CorrelationHTTPClient) Do(ctx context.Context, req *http.Request) (*http.Response, error) {
	// Inject correlation headers into request
	InjectCorrelationToRequest(ctx, req)

	return c.client.Do(req.WithContext(ctx))
}

// Get performs an HTTP GET request with correlation headers
func (c *CorrelationHTTPClient) Get(ctx context.Context, url string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	return c.Do(ctx, req)
}

// Post performs an HTTP POST request with correlation headers
func (c *CorrelationHTTPClient) Post(ctx context.Context, url string, contentType string, body interface{}) (*http.Response, error) {
	// This is a simplified implementation
	// In a real implementation, you would properly handle the body
	req, err := http.NewRequestWithContext(ctx, "POST", url, nil)
	if err != nil {
		return nil, err
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	return c.Do(ctx, req)
}

// NewCorrelationContext creates a new correlation context with generated IDs
func NewCorrelationContext() *CorrelationContext {
	return &CorrelationContext{
		CorrelationID: uuid.New().String(),
		RequestID:     uuid.New().String(),
	}
}

// WithNewSpan creates a new span ID within the same trace
func WithNewSpan(ctx context.Context) context.Context {
	corrCtx := GetCorrelationContext(ctx)
	if corrCtx == nil {
		corrCtx = NewCorrelationContext()
	} else {
		// Create a copy and generate new span ID
		newCtx := *corrCtx
		corrCtx = &newCtx
		corrCtx.SpanID = uuid.New().String()
	}

	return WithCorrelationContext(ctx, corrCtx)
}

// IsValidCorrelationID checks if a correlation ID is valid
func IsValidCorrelationID(id string) bool {
	if id == "" {
		return false
	}
	// Check if it's a valid UUID format
	_, err := uuid.Parse(id)
	return err == nil
}

// SanitizeHeaderValue sanitizes HTTP header values for correlation
func SanitizeHeaderValue(value string) string {
	// Remove newlines and other potentially problematic characters
	value = strings.ReplaceAll(value, "\n", "")
	value = strings.ReplaceAll(value, "\r", "")
	value = strings.ReplaceAll(value, "\t", "")

	// Trim whitespace
	return strings.TrimSpace(value)
}
