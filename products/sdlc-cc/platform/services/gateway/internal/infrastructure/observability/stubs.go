//go:build ignore

package observability

import (
	"context"

	"github.com/sirupsen/logrus"
)

// TraceHelper provides tracing utilities
type TraceHelper struct {
	serviceName string
}

// TracerProvider manages trace providers
type TracerProvider struct {
	serviceName string
}

// Shutdown gracefully shuts down the tracer provider
func (tp *TracerProvider) Shutdown(ctx context.Context) error {
	return nil
}

// TraceHelper methods needed by middleware/proxy

// SetAttributes sets span attributes
func (th *TraceHelper) SetAttributes(ctx context.Context, attrs map[string]interface{}) {
	// No-op stub
}

// TraceHTTPRequest starts a span for an HTTP request
func (th *TraceHelper) TraceHTTPRequest(ctx context.Context, r interface{}) (context.Context, error) {
	return ctx, nil
}

// TraceHTTPResponse records HTTP response details on the span
func (th *TraceHelper) TraceHTTPResponse(ctx context.Context, statusCode int, size int64, duration int) {
	// No-op stub
}

// AddEvent adds an event to the current span
func (th *TraceHelper) AddEvent(ctx context.Context, name string, attrs map[string]interface{}) {
	// No-op stub
}

// NewTraceHelper creates a new TraceHelper
func NewTraceHelper(tp *TracerProvider, serviceName string) *TraceHelper {
	return &TraceHelper{serviceName: serviceName}
}

// --- Global initialization stubs ---

var globalTraceHelper *TraceHelper

// InitializeGlobalLogging sets up global logging (stub)
func InitializeGlobalLogging(cfg interface{}) error {
	return nil
}

// GetGlobalLogger returns the global logger
func GetGlobalLogger() *logrus.Logger {
	logger := logrus.New()
	logger.SetFormatter(&logrus.JSONFormatter{})
	return logger
}

// InitializeGlobalTracing sets up global tracing (stub)
func InitializeGlobalTracing(cfg interface{}) (*TracerProvider, error) {
	return &TracerProvider{serviceName: "gateway"}, nil
}

// GetGlobalTraceHelper returns a trace helper for the given service
func GetGlobalTraceHelper(serviceName string) *TraceHelper {
	if globalTraceHelper == nil {
		globalTraceHelper = &TraceHelper{serviceName: serviceName}
	}
	return globalTraceHelper
}

// --- Context helpers ---

type contextKey string

const (
	correlationContextKey contextKey = "correlation_context"
	requestIDKey          contextKey = "request_id"
)

// SetAttributes sets trace attributes (stub - no-op)
func SetAttributes(ctx context.Context, category string, attrs map[string]interface{}) {
	// No-op stub
}

// SetError records an error on the current span (stub - no-op)
func SetError(ctx context.Context, component string, err error) {
	// No-op stub
}

// SetRequestHeaders enriches request with tracing headers (stub - no-op)
func SetRequestHeaders(r interface{}, ctx context.Context) {
	// No-op stub
}
