package monitoring

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	"go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	oteltrace "go.opentelemetry.io/otel/trace"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/config"
)

// InitTracing initializes OpenTelemetry tracing
func InitTracing(cfg *config.Config) (*trace.TracerProvider, error) {
	ctx := context.Background()

	// Create resource
	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceNameKey.String("gateway"),
			semconv.ServiceVersionKey.String(cfg.Version),
			semconv.ServiceInstanceIDKey.String(cfg.InstanceID),
			semconv.DeploymentEnvironmentKey.String(cfg.Environment),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Create trace exporter
	var exporter trace.SpanExporter
	switch cfg.Tracing.Exporter {
	case "jaeger":
		exporter, err = jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(cfg.Tracing.JaegerEndpoint)))
	case "otlp":
		exporter, err = otlptracehttp.New(ctx, otlptracehttp.WithEndpoint(cfg.Tracing.OTLPEndpoint))
	case "stdout":
		exporter, err = stdouttrace.New()
	default:
		exporter, err = stdouttrace.New()
	}

	if err != nil {
		return nil, fmt.Errorf("failed to create trace exporter: %w", err)
	}

	// Create trace provider
	tracerProvider := trace.NewTracerProvider(
		trace.WithBatcher(exporter),
		trace.WithResource(res),
		trace.WithSampler(trace.TraceIDRatioBased(cfg.Tracing.SampleRate)),
	)

	// Register as global tracer provider
	otel.SetTracerProvider(tracerProvider)

	// Set global propagator
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	return tracerProvider, nil
}

// InitMetrics initializes Prometheus metrics
func InitMetrics(cfg *config.Config) error {
	// TODO: Implement Prometheus metrics initialization
	return nil
}

// Custom trace events for the gateway
const (
	// Authentication events
	EventAuthSuccess      = "auth.success"
	EventAuthFailure      = "auth.failure"
	EventTokenExpired     = "auth.token_expired" // #nosec G101 -- span event name, not a credential
	EventTokenRefresh     = "auth.token_refresh" // #nosec G101 -- span event name, not a credential
	EventPermissionDenied = "auth.permission_denied"

	// Request events
	EventRequestStart    = "request.start"
	EventRequestComplete = "request.complete"
	EventRequestError    = "request.error"
	EventRequestTimeout  = "request.timeout"

	// Policy events
	EventPolicyEvaluated = "policy.evaluated"
	EventPolicyDenied    = "policy.denied"
	EventPolicyError     = "policy.error"

	// Rate limiting events
	EventRateLimitExceeded = "ratelimit.exceeded"
	EventRateLimitReset    = "ratelimit.reset"

	// Circuit breaker events
	EventCircuitOpen     = "circuitbreaker.open"
	EventCircuitClosed   = "circuitbreaker.closed"
	EventCircuitHalfOpen = "circuitbreaker.half_open"

	// Database events
	EventDBConnect    = "database.connect"
	EventDBDisconnect = "database.disconnect"
	EventDBQuery      = "database.query"
	EventDBError      = "database.error"
	EventDBSlowQuery  = "database.slow_query"

	// External service events
	EventExternalCall    = "external.call"
	EventExternalSuccess = "external.success"
	EventExternalError   = "external.error"
	EventExternalTimeout = "external.timeout"
)

// TraceHelper provides helper functions for tracing
type TraceHelper struct {
	tracerName string
}

// NewTraceHelper creates a new trace helper
func NewTraceHelper(serviceName string) *TraceHelper {
	return &TraceHelper{
		tracerName: serviceName,
	}
}

// StartSpan starts a new span with the given name
func (th *TraceHelper) StartSpan(ctx context.Context, name string) (context.Context, oteltrace.Span) {
	return otel.Tracer(th.tracerName).Start(ctx, name)
}

// AddEvent adds an event to the current span
func (th *TraceHelper) AddEvent(ctx context.Context, eventName string, attributes map[string]interface{}) {
	span := oteltrace.SpanFromContext(ctx)
	if span.IsRecording() {
		attrs := make([]attribute.KeyValue, 0, len(attributes))
		for k, v := range attributes {
			attrs = append(attrs, attribute.String(k, fmt.Sprintf("%v", v)))
		}
		span.AddEvent(eventName, oteltrace.WithAttributes(attrs...))
	}
}

// SetAttributes sets attributes on the current span
func (th *TraceHelper) SetAttributes(ctx context.Context, attributes map[string]interface{}) {
	span := oteltrace.SpanFromContext(ctx)
	if span.IsRecording() {
		attrs := make([]attribute.KeyValue, 0, len(attributes))
		for k, v := range attributes {
			attrs = append(attrs, attribute.String(k, fmt.Sprintf("%v", v)))
		}
		span.SetAttributes(attrs...)
	}
}

// SetError sets an error on the current span
func (th *TraceHelper) SetError(ctx context.Context, err error) {
	span := oteltrace.SpanFromContext(ctx)
	if span.IsRecording() {
		span.RecordError(err)
		span.SetAttributes(attribute.String("error.type", fmt.Sprintf("%T", err)))
		span.SetAttributes(attribute.String("error.message", err.Error()))
	}
}

// RecordMetrics records custom metrics
func (th *TraceHelper) RecordMetrics(ctx context.Context, metrics map[string]float64) {
	span := oteltrace.SpanFromContext(ctx)
	if span.IsRecording() {
		for name, value := range metrics {
			span.SetAttributes(attribute.Float64(name, value))
		}
	}
}

// Global trace helper instance
var GlobalTraceHelper = NewTraceHelper("gateway")

// Convenience functions using the global trace helper

func StartSpan(ctx context.Context, name string) (context.Context, oteltrace.Span) {
	return GlobalTraceHelper.StartSpan(ctx, name)
}

func AddEvent(ctx context.Context, eventName string, attributes map[string]interface{}) {
	GlobalTraceHelper.AddEvent(ctx, eventName, attributes)
}

func SetAttributes(ctx context.Context, attributes map[string]interface{}) {
	GlobalTraceHelper.SetAttributes(ctx, attributes)
}

func SetError(ctx context.Context, err error) {
	GlobalTraceHelper.SetError(ctx, err)
}

func RecordMetrics(ctx context.Context, metrics map[string]float64) {
	GlobalTraceHelper.RecordMetrics(ctx, metrics)
}

// Performance monitoring helpers

// MeasureDuration measures the duration of a function execution
func MeasureDuration(ctx context.Context, operationName string) func() {
	start := time.Now()
	return func() {
		duration := time.Since(start)
		AddEvent(ctx, "operation.completed", map[string]interface{}{
			"operation":   operationName,
			"duration_ms": duration.Milliseconds(),
		})
	}
}

// TrackRequest tracks HTTP request metrics
func TrackRequest(ctx context.Context, method, path string, statusCode int, duration time.Duration) {
	SetAttributes(ctx, map[string]interface{}{
		"http.method":      method,
		"http.path":        path,
		"http.status_code": statusCode,
		"http.duration_ms": duration.Milliseconds(),
	})

	// Add specific events based on status code
	if statusCode >= 500 {
		AddEvent(ctx, EventRequestError, map[string]interface{}{
			"status_code": statusCode,
			"duration_ms": duration.Milliseconds(),
		})
	} else if statusCode >= 400 {
		AddEvent(ctx, EventRequestError, map[string]interface{}{
			"status_code": statusCode,
			"duration_ms": duration.Milliseconds(),
		})
	} else {
		AddEvent(ctx, EventRequestComplete, map[string]interface{}{
			"status_code": statusCode,
			"duration_ms": duration.Milliseconds(),
		})
	}
}

// TrackDatabaseOperation tracks database operation metrics
func TrackDatabaseOperation(ctx context.Context, operation string, table string, duration time.Duration, err error) {
	attributes := map[string]interface{}{
		"db.operation":   operation,
		"db.table":       table,
		"db.duration_ms": duration.Milliseconds(),
	}

	SetAttributes(ctx, attributes)

	if err != nil {
		SetError(ctx, err)
		AddEvent(ctx, EventDBError, attributes)
	} else if duration > time.Second*5 {
		AddEvent(ctx, EventDBSlowQuery, attributes)
	} else {
		AddEvent(ctx, EventDBQuery, attributes)
	}
}

// TrackExternalCall tracks external service call metrics
func TrackExternalCall(ctx context.Context, service string, endpoint string, duration time.Duration, err error) {
	attributes := map[string]interface{}{
		"external.service":     service,
		"external.endpoint":    endpoint,
		"external.duration_ms": duration.Milliseconds(),
	}

	SetAttributes(ctx, attributes)

	if err != nil {
		SetError(ctx, err)
		AddEvent(ctx, EventExternalError, attributes)
	} else {
		AddEvent(ctx, EventExternalSuccess, attributes)
	}
}

// TrackPolicyEvaluation tracks policy evaluation metrics
func TrackPolicyEvaluation(ctx context.Context, policyName string, decision string, duration time.Duration, err error) {
	attributes := map[string]interface{}{
		"policy.name":        policyName,
		"policy.decision":    decision,
		"policy.duration_ms": duration.Milliseconds(),
	}

	SetAttributes(ctx, attributes)

	if err != nil {
		SetError(ctx, err)
		AddEvent(ctx, EventPolicyError, attributes)
	} else if decision == "deny" {
		AddEvent(ctx, EventPolicyDenied, attributes)
	} else {
		AddEvent(ctx, EventPolicyEvaluated, attributes)
	}
}
