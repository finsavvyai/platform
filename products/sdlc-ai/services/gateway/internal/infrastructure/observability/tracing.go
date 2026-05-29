//go:build ignore

package observability

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	"go.opentelemetry.io/otel/exporters/zipkin"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	"go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"go.opentelemetry.io/otel/trace"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/config"
)

// TraceExporter represents different tracing backends
type TraceExporter string

const (
	ExporterJaeger TraceExporter = "jaeger"
	ExporterZipkin TraceExporter = "zipkin"
	ExporterOTLP   TraceExporter = "otlp"
	ExporterStdout TraceExporter = "stdout"
)

// TraceConfig holds the tracing configuration
type TraceConfig struct {
	ServiceName    string            `yaml:"service_name"`
	ServiceVersion string            `yaml:"service_version"`
	Environment    string            `yaml:"environment"`
	InstanceID     string            `yaml:"instance_id"`
	Exporter       TraceExporter     `yaml:"exporter"`
	JaegerURL      string            `yaml:"jaeger_url"`
	ZipkinURL      string            `yaml:"zipkin_url"`
	OTLPEndpoint   string            `yaml:"otlp_endpoint"`
	SampleRate     float64           `yaml:"sample_rate"`
	BatchSize      int               `yaml:"batch_size"`
	ExportTimeout  time.Duration     `yaml:"export_timeout"`
	Headers        map[string]string `yaml:"headers"`
}

// TracerProvider wraps the OpenTelemetry tracer provider with additional functionality
type TracerProvider struct {
	provider     *trace.TracerProvider
	config       TraceConfig
	logger       *logrus.Entry
	shutdownFunc func(ctx context.Context) error
}

// NewTracerProvider creates a new tracer provider with the given configuration
func NewTracerProvider(config TraceConfig) (*TracerProvider, error) {
	logger := logrus.WithFields(logrus.Fields{
		"component":   "observability",
		"service":     config.ServiceName,
		"exporter":    string(config.Exporter),
		"sample_rate": config.SampleRate,
	})

	// Create resource
	res, err := resource.New(context.Background(),
		resource.WithAttributes(
			semconv.ServiceNameKey.String(config.ServiceName),
			semconv.ServiceVersionKey.String(config.ServiceVersion),
			semconv.ServiceInstanceIDKey.String(config.InstanceID),
			semconv.DeploymentEnvironmentKey.String(config.Environment),
			attribute.String("service.instance.id", config.InstanceID),
			attribute.String("service.namespace", "sdlc-platform"),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Create trace exporter
	exporter, err := createTraceExporter(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create trace exporter: %w", err)
	}

	// Create batch span processor options
	batchOptions := []trace.BatchSpanProcessorOption{
		trace.WithBatchTimeout(config.ExportTimeout),
		trace.WithMaxExportBatchSize(config.BatchSize),
		trace.WithMaxQueueSize(config.BatchSize * 4),
	}

	// Create tracer provider
	provider := trace.NewTracerProvider(
		trace.WithBatcher(exporter, batchOptions...),
		trace.WithResource(res),
		trace.WithSampler(trace.TraceIDRatioBased(config.SampleRate)),
	)

	// Set global tracer provider and propagator
	otel.SetTracerProvider(provider)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
		propagation.B3{},
	))

	logger.Info("Tracer provider initialized successfully")

	return &TracerProvider{
		provider:     provider,
		config:       config,
		logger:       logger,
		shutdownFunc: provider.Shutdown,
	}, nil
}

// createTraceExporter creates the appropriate trace exporter based on configuration
func createTraceExporter(config TraceConfig) (trace.SpanExporter, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	switch config.Exporter {
	case ExporterJaeger:
		return jaeger.New(jaeger.WithCollectorEndpoint(
			jaeger.WithEndpoint(config.JaegerURL),
			jaeger.WithUsernamePassword("", ""), // Add auth if needed
		))
	case ExporterZipkin:
		return zipkin.New(config.ZipkinURL)
	case ExporterOTLP:
		headers := make(map[string]string)
		for k, v := range config.Headers {
			headers[k] = v
		}
		return otlptracehttp.New(ctx,
			otlptracehttp.WithEndpoint(config.OTLPEndpoint),
			otlptracehttp.WithHeaders(headers),
		)
	case ExporterStdout:
		return stdouttrace.New()
	default:
		return stdouttrace.New()
	}
}

// Shutdown shuts down the tracer provider
func (tp *TracerProvider) Shutdown(ctx context.Context) error {
	tp.logger.Info("Shutting down tracer provider")
	return tp.shutdownFunc(ctx)
}

// GetTracer returns a tracer for the given instrument
func (tp *TracerProvider) GetTracer(instrument string) trace.Tracer {
	return tp.provider.Tracer(instrument)
}

// TraceHelper provides helper functions for tracing
type TraceHelper struct {
	tracer    trace.Tracer
	service   string
	component string
	logger    *logrus.Entry
}

// NewTraceHelper creates a new trace helper
func NewTraceHelper(tp *TracerProvider, component string) *TraceHelper {
	return &TraceHelper{
		tracer:    tp.GetTracer(component),
		service:   tp.config.ServiceName,
		component: component,
		logger: logrus.WithFields(logrus.Fields{
			"service":   tp.config.ServiceName,
			"component": component,
		}),
	}
}

// StartSpan starts a new span with the given name and options
func (th *TraceHelper) StartSpan(ctx context.Context, name string, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	// Add default attributes
	defaultAttrs := []attribute.KeyValue{
		attribute.String("service.name", th.service),
		attribute.String("component", th.component),
	}

	// Merge with provided options
	spanOpts := make([]trace.SpanStartOption, 0, len(opts)+1)
	spanOpts = append(spanOpts, trace.WithAttributes(defaultAttrs...))
	spanOpts = append(spanOpts, opts...)

	return th.tracer.Start(ctx, name, spanOpts...)
}

// AddEvent adds an event to the current span
func (th *TraceHelper) AddEvent(ctx context.Context, eventName string, attributes map[string]interface{}) {
	span := trace.SpanFromContext(ctx)
	if !span.IsRecording() {
		return
	}

	attrs := make([]attribute.KeyValue, 0, len(attributes))
	for k, v := range attributes {
		attrs = append(attrs, attribute.String(k, fmt.Sprintf("%v", v)))
	}

	span.AddEvent(eventName, trace.WithAttributes(attrs...))
}

// SetAttributes sets attributes on the current span
func (th *TraceHelper) SetAttributes(ctx context.Context, attributes map[string]interface{}) {
	span := trace.SpanFromContext(ctx)
	if !span.IsRecording() {
		return
	}

	attrs := make([]attribute.KeyValue, 0, len(attributes))
	for k, v := range attributes {
		attrs = append(attrs, attribute.String(k, fmt.Sprintf("%v", v)))
	}

	span.SetAttributes(attrs...)
}

// SetError sets an error on the current span
func (th *TraceHelper) SetError(ctx context.Context, err error) {
	if err == nil {
		return
	}

	span := trace.SpanFromContext(ctx)
	if !span.IsRecording() {
		return
	}

	span.RecordError(err)
	span.SetAttributes(
		attribute.String("error.type", fmt.Sprintf("%T", err)),
		attribute.String("error.message", err.Error()),
		attribute.Bool("error.occurred", true),
	)

	th.logger.WithError(err).Debug("Error recorded in trace")
}

// TraceHTTPRequest traces an HTTP request
func (th *TraceHelper) TraceHTTPRequest(ctx context.Context, req *http.Request) (context.Context, trace.Span) {
	ctx, span := th.StartSpan(ctx, fmt.Sprintf("%s %s", req.Method, req.URL.Path),
		trace.WithAttributes(
			attribute.String("http.method", req.Method),
			attribute.String("http.url", req.URL.String()),
			attribute.String("http.host", req.Host),
			attribute.String("http.scheme", "http"),
			attribute.String("http.user_agent", req.UserAgent()),
			attribute.String("http.remote_addr", req.RemoteAddr),
			attribute.String("http.request_id", GetRequestID(req)),
		),
	)

	// Add request headers as attributes (for debugging)
	if th.logger.Logger.IsLevelEnabled(logrus.DebugLevel) {
		for name, values := range req.Header {
			for _, value := range values {
				span.SetAttributes(attribute.String("http.request.header."+name, value))
			}
		}
	}

	return ctx, span
}

// TraceHTTPResponse traces an HTTP response
func (th *TraceHelper) TraceHTTPResponse(ctx context.Context, statusCode int, contentLength int64, duration time.Duration) {
	span := trace.SpanFromContext(ctx)
	if !span.IsRecording() {
		return
	}

	span.SetAttributes(
		attribute.Int("http.status_code", statusCode),
		attribute.Int64("http.response_content_length", contentLength),
		attribute.Int64("http.duration_ms", duration.Milliseconds()),
	)

	// Mark span as error if status code indicates error
	if statusCode >= 400 {
		span.SetAttributes(attribute.Bool("error", true))
		if statusCode >= 500 {
			span.SetAttributes(
				attribute.String("error.type", "http_server_error"),
				attribute.String("error.message", fmt.Sprintf("HTTP %d", statusCode)),
			)
		} else {
			span.SetAttributes(
				attribute.String("error.type", "http_client_error"),
				attribute.String("error.message", fmt.Sprintf("HTTP %d", statusCode)),
			)
		}
	}

	// Add specific events based on status code
	eventName := "http.response"
	switch {
	case statusCode >= 500:
		eventName = "http.server_error"
	case statusCode >= 400:
		eventName = "http.client_error"
	case statusCode >= 300:
		eventName = "http.redirect"
	case statusCode >= 200:
		eventName = "http.success"
	}

	span.AddEvent(eventName, trace.WithAttributes(
		attribute.Int("http.status_code", statusCode),
		attribute.Int64("http.duration_ms", duration.Milliseconds()),
	))
}

// TraceDatabaseOperation traces a database operation
func (th *TraceHelper) TraceDatabaseOperation(ctx context.Context, operation, table string) (context.Context, trace.Span) {
	return th.StartSpan(ctx, fmt.Sprintf("db.%s.%s", operation, table),
		trace.WithAttributes(
			attribute.String("db.operation", operation),
			attribute.String("db.table", table),
			attribute.String("db.system", "postgresql"),
		),
	)
}

// TraceExternalServiceCall traces an external service call
func (th *TraceHelper) TraceExternalServiceCall(ctx context.Context, service, endpoint string) (context.Context, trace.Span) {
	return th.StartSpan(ctx, fmt.Sprintf("external.%s.%s", service, endpoint),
		trace.WithAttributes(
			attribute.String("external.service", service),
			attribute.String("external.endpoint", endpoint),
		),
	)
}

// TracePolicyEvaluation traces a policy evaluation
func (th *TraceHelper) TracePolicyEvaluation(ctx context.Context, policyName string) (context.Context, trace.Span) {
	return th.StartSpan(ctx, fmt.Sprintf("policy.evaluate.%s", policyName),
		trace.WithAttributes(
			attribute.String("policy.name", policyName),
			attribute.String("policy.engine", "opa"),
		),
	)
}

// CorrelationContext holds correlation information
type CorrelationContext struct {
	RequestID     string
	TraceID       string
	SpanID        string
	UserID        string
	TenantID      string
	SessionID     string
	CorrelationID string
}

// GetCorrelationContext extracts correlation information from the context
func GetCorrelationContext(ctx context.Context) CorrelationContext {
	span := trace.SpanFromContext(ctx)
	if !span.IsRecording() {
		return CorrelationContext{}
	}

	spanContext := span.SpanContext()
	return CorrelationContext{
		TraceID: spanContext.TraceID().String(),
		SpanID:  spanContext.SpanID().String(),
	}
}

// GetRequestID extracts or generates a request ID from the HTTP request
func GetRequestID(req *http.Request) string {
	requestID := req.Header.Get("X-Request-ID")
	if requestID == "" {
		requestID = req.Header.Get("X-Correlation-ID")
	}
	if requestID == "" {
		requestID = uuid.New().String()
	}
	return requestID
}

// SetRequestHeaders sets correlation headers on an HTTP request
func SetRequestHeaders(req *http.Request, ctx context.Context) {
	corrCtx := GetCorrelationContext(ctx)

	if corrCtx.TraceID != "" {
		req.Header.Set("X-Trace-ID", corrCtx.TraceID)
	}
	if corrCtx.SpanID != "" {
		req.Header.Set("X-Span-ID", corrCtx.SpanID)
	}

	// Propagate trace context using OpenTelemetry propagator
	propagator := otel.GetTextMapPropagator()
	propagator.Inject(ctx, &headerCarrier{req.Header})
}

// headerCarrier implements the propagation.TextMapCarrier interface for HTTP headers
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

// Global tracer helper instances
var (
	globalTracerProvider *TracerProvider
	globalTraceHelpers   = make(map[string]*TraceHelper)
)

// InitializeGlobalTracing initializes the global tracing system
func InitializeGlobalTracing(cfg *config.Config) (*TracerProvider, error) {
	traceConfig := TraceConfig{
		ServiceName:    "gateway",
		ServiceVersion: cfg.Version,
		Environment:    cfg.Environment,
		InstanceID:     cfg.InstanceID,
		Exporter:       TraceExporter(cfg.Tracing.Exporter),
		JaegerURL:      cfg.Tracing.JaegerEndpoint,
		OTLPEndpoint:   cfg.Tracing.OTLPEndpoint,
		SampleRate:     cfg.Tracing.SampleRate,
		BatchSize:      512,
		ExportTimeout:  5 * time.Second,
		Headers:        make(map[string]string),
	}

	tp, err := NewTracerProvider(traceConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize tracer provider: %w", err)
	}

	globalTracerProvider = tp
	return tp, nil
}

// GetGlobalTraceHelper gets or creates a global trace helper for a component
func GetGlobalTraceHelper(component string) *TraceHelper {
	if globalTracerProvider == nil {
		// Fallback to basic tracer if global not initialized
		return &TraceHelper{
			tracer:    otel.Tracer(component),
			service:   "gateway",
			component: component,
			logger: logrus.WithFields(logrus.Fields{
				"service":   "gateway",
				"component": component,
			}),
		}
	}

	if helper, exists := globalTraceHelpers[component]; exists {
		return helper
	}

	helper := NewTraceHelper(globalTracerProvider, component)
	globalTraceHelpers[component] = helper
	return helper
}

// ShutdownGlobalTracing shuts down the global tracing system
func ShutdownGlobalTracing(ctx context.Context) error {
	if globalTracerProvider != nil {
		return globalTracerProvider.Shutdown(ctx)
	}
	return nil
}

// Convenience functions using global trace helper

func StartSpan(ctx context.Context, component, name string, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	helper := GetGlobalTraceHelper(component)
	return helper.StartSpan(ctx, name, opts...)
}

func AddEvent(ctx context.Context, component, eventName string, attributes map[string]interface{}) {
	helper := GetGlobalTraceHelper(component)
	helper.AddEvent(ctx, eventName, attributes)
}

func SetAttributes(ctx context.Context, component string, attributes map[string]interface{}) {
	helper := GetGlobalTraceHelper(component)
	helper.SetAttributes(ctx, attributes)
}

func SetError(ctx context.Context, component string, err error) {
	helper := GetGlobalTraceHelper(component)
	helper.SetError(ctx, err)
}
