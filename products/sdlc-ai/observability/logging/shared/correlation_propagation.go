package shared

import (
	"context"
	"fmt"
	"io"
	"net/http"

	"github.com/google/uuid"
)

// Context keys for correlation data
type contextKey string

const (
	CorrelationIDKey contextKey = "correlation_id"
	TraceIDKey       contextKey = "trace_id"
	SpanIDKey        contextKey = "span_id"
	UserIDKey        contextKey = "user_id"
	TenantIDKey      contextKey = "tenant_id"
	RequestIDKey     contextKey = "request_id"
	SessionIDKey     contextKey = "session_id"

	// HTTP headers for correlation data
	HeaderCorrelationID = "X-Correlation-ID"
	HeaderTraceID       = "X-Trace-ID"
	HeaderSpanID        = "X-Span-ID"
	HeaderUserID        = "X-User-ID"
	HeaderTenantID      = "X-Tenant-ID"
	HeaderRequestID     = "X-Request-ID"
	HeaderSessionID     = "X-Session-ID"
)

// CorrelationData holds all correlation information
type CorrelationData struct {
	CorrelationID string
	TraceID       string
	SpanID        string
	UserID        string
	TenantID      string
	RequestID     string
	SessionID     string
}

// GetCorrelationData extracts all correlation data from context
func GetCorrelationData(ctx context.Context) *CorrelationData {
	return &CorrelationData{
		CorrelationID: GetStringFromContext(ctx, CorrelationIDKey),
		TraceID:       GetStringFromContext(ctx, TraceIDKey),
		SpanID:        GetStringFromContext(ctx, SpanIDKey),
		UserID:        GetStringFromContext(ctx, UserIDKey),
		TenantID:      GetStringFromContext(ctx, TenantIDKey),
		RequestID:     GetStringFromContext(ctx, RequestIDKey),
		SessionID:     GetStringFromContext(ctx, SessionIDKey),
	}
}

// SetCorrelationData sets all correlation data in context
func SetCorrelationData(ctx context.Context, data *CorrelationData) context.Context {
	ctx = context.WithValue(ctx, CorrelationIDKey, data.CorrelationID)
	ctx = context.WithValue(ctx, TraceIDKey, data.TraceID)
	ctx = context.WithValue(ctx, SpanIDKey, data.SpanID)
	ctx = context.WithValue(ctx, UserIDKey, data.UserID)
	ctx = context.WithValue(ctx, TenantIDKey, data.TenantID)
	ctx = context.WithValue(ctx, RequestIDKey, data.RequestID)
	ctx = context.WithValue(ctx, SessionIDKey, data.SessionID)
	return ctx
}

// ExtractFromHTTP extracts correlation data from HTTP headers
func ExtractFromHTTP(r *http.Request) *CorrelationData {
	data := &CorrelationData{}

	if correlationID := r.Header.Get(HeaderCorrelationID); correlationID != "" {
		data.CorrelationID = correlationID
	} else {
		data.CorrelationID = uuid.New().String()
	}

	data.TraceID = r.Header.Get(HeaderTraceID)
	data.SpanID = r.Header.Get(HeaderSpanID)
	data.UserID = r.Header.Get(HeaderUserID)
	data.TenantID = r.Header.Get(HeaderTenantID)
	data.RequestID = r.Header.Get(HeaderRequestID)
	data.SessionID = r.Header.Get(HeaderSessionID)

	return data
}

// InjectIntoHTTP injects correlation data into HTTP headers
func InjectIntoHTTP(data *CorrelationData, header http.Header) {
	if data.CorrelationID != "" {
		header.Set(HeaderCorrelationID, data.CorrelationID)
	}
	if data.TraceID != "" {
		header.Set(HeaderTraceID, data.TraceID)
	}
	if data.SpanID != "" {
		header.Set(HeaderSpanID, data.SpanID)
	}
	if data.UserID != "" {
		header.Set(HeaderUserID, data.UserID)
	}
	if data.TenantID != "" {
		header.Set(HeaderTenantID, data.TenantID)
	}
	if data.RequestID != "" {
		header.Set(HeaderRequestID, data.RequestID)
	}
	if data.SessionID != "" {
		header.Set(HeaderSessionID, data.SessionID)
	}
}

// HTTPMiddleware provides correlation propagation middleware
func HTTPMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract correlation data from request
		data := ExtractFromHTTP(r)

		// Set correlation data in context
		ctx := SetCorrelationData(r.Context(), data)
		r = r.WithContext(ctx)

		// Inject correlation data into response headers
		InjectIntoHTTP(data, w.Header())

		// Call next handler
		next.ServeHTTP(w, r)
	})
}

// HTTPClient wraps an HTTP client to propagate correlation data
type HTTPClient struct {
	Client *http.Client
}

// NewHTTPClient creates a new HTTP client with correlation propagation
func NewHTTPClient(client *http.Client) *HTTPClient {
	if client == nil {
		client = http.DefaultClient
	}
	return &HTTPClient{Client: client}
}

// Do executes an HTTP request with correlation propagation
func (c *HTTPClient) Do(req *http.Request) (*http.Response, error) {
	// Extract correlation data from context
	data := GetCorrelationData(req.Context())

	// Inject correlation data into request headers
	InjectIntoHTTP(data, req.Header)

	return c.Client.Do(req)
}

// Get wraps an HTTP GET request with correlation propagation
func (c *HTTPClient) Get(url string) (*http.Response, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	return c.Do(req)
}

// Post wraps an HTTP POST request with correlation propagation
func (c *HTTPClient) Post(url, contentType string, body interface{}) (*http.Response, error) {
	return c.doRequest("POST", url, contentType, body)
}

// Put wraps an HTTP PUT request with correlation propagation
func (c *HTTPClient) Put(url, contentType string, body interface{}) (*http.Response, error) {
	return c.doRequest("PUT", url, contentType, body)
}

// Delete wraps an HTTP DELETE request with correlation propagation
func (c *HTTPClient) Delete(url string) (*http.Response, error) {
	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return nil, err
	}
	return c.Do(req)
}

func (c *HTTPClient) doRequest(method, url, contentType string, body interface{}) (*http.Response, error) {
	var req *http.Request
	var err error

	if body != nil {
		// This would need proper encoding based on content type
		// For simplicity, we'll assume it's already properly encoded
		if bodyReader, ok := body.(io.Reader); ok {
			req, err = http.NewRequest(method, url, bodyReader)
		} else {
			return nil, fmt.Errorf("body must be an io.Reader")
		}
	} else {
		req, err = http.NewRequest(method, url, nil)
	}

	if err != nil {
		return nil, err
	}

	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}

	return c.Do(req)
}

// Helper functions for context operations
func GetStringFromContext(ctx context.Context, key contextKey) string {
	if value, ok := ctx.Value(key).(string); ok {
		return value
	}
	return ""
}

func WithCorrelationID(ctx context.Context, correlationID string) context.Context {
	if correlationID == "" {
		correlationID = uuid.New().String()
	}
	return context.WithValue(ctx, CorrelationIDKey, correlationID)
}

func WithTraceData(ctx context.Context, traceID, spanID string) context.Context {
	ctx = context.WithValue(ctx, TraceIDKey, traceID)
	ctx = context.WithValue(ctx, SpanIDKey, spanID)
	return ctx
}

func WithUserData(ctx context.Context, userID, tenantID string) context.Context {
	ctx = context.WithValue(ctx, UserIDKey, userID)
	ctx = context.WithValue(ctx, TenantIDKey, tenantID)
	return ctx
}

func WithRequestData(ctx context.Context, requestID, sessionID string) context.Context {
	ctx = context.WithValue(ctx, RequestIDKey, requestID)
	if sessionID != "" {
		ctx = context.WithValue(ctx, SessionIDKey, sessionID)
	}
	return ctx
}
