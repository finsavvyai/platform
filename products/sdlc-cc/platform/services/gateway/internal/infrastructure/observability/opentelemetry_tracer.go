//go:build ignore

package observability

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"runtime"
	"strings"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	"go.opentelemetry.io/otel/exporters/zipkin"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"go.opentelemetry.io/otel/trace"
)

// TracingConfig holds configuration for OpenTelemetry tracing
type TracingConfig struct {
	Enabled            bool          `yaml:"enabled"`
	ServiceName        string        `yaml:"service_name"`
	ServiceVersion     string        `yaml:"service_version"`
	Environment        string        `yaml:"environment"`
	SamplingRate       float64       `yaml:"sampling_rate"`
	BatchSize          int           `yaml:"batch_size"`
	BatchTimeout       time.Duration `yaml:"batch_timeout"`
	ExportTimeout      time.Duration `yaml:"export_timeout"`
	MaxExportBatchSize int           `yaml:"max_export_batch_size"`

	// Exporter configuration
	ExporterType string `yaml:"exporter_type"` // jaeger, zipkin, otlp, stdout

	// Jaeger configuration
	JaegerEndpoint string `yaml:"jaeger_endpoint"`
	JaegerUsername string `yaml:"jaeger_username"`
	JaegerPassword string `yaml:"jaeger_password"`

	// Zipkin configuration
	ZipkinEndpoint string `yaml:"zipkin_endpoint"`

	// OTLP configuration
	OTLPEndpoint string            `yaml:"otlp_endpoint"`
	OTLPHeaders  map[string]string `yaml:"otlp_headers"`
	OTLPInsecure bool              `yaml:"otlp_insecure"`

	// Resource attributes
	ResourceAttributes map[string]string `yaml:"resource_attributes"`

	// Additional settings
	DisableAutoInstrumentation bool `yaml:"disable_auto_instrumentation"`
}

// TracerProvider wraps the OpenTelemetry TracerProvider
type TracerProvider struct {
	provider   *sdktrace.TracerProvider
	config     TracingConfig
	shutdownFn func(context.Context) error
}

// NewTracerProvider creates a new OpenTelemetry tracer provider
func NewTracerProvider(config TracingConfig) (*TracerProvider, error) {
	if !config.Enabled {
		return &TracerProvider{
			provider:   nil,
			config:     config,
			shutdownFn: func(ctx context.Context) error { return nil },
		}, nil
	}

	// Set defaults
	if config.ServiceName == "" {
		config.ServiceName = "sdlc-gateway"
	}
	if config.ServiceVersion == "" {
		config.ServiceVersion = "1.0.0"
	}
	if config.Environment == "" {
		config.Environment = "development"
	}
	if config.SamplingRate == 0 {
		config.SamplingRate = 1.0 // Sample all traces in development
	}
	if config.BatchTimeout == 0 {
		config.BatchTimeout = 5 * time.Second
	}
	if config.ExportTimeout == 0 {
		config.ExportTimeout = 30 * time.Second
	}

	// Create resource
	res, err := newResource(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Create exporter
	exporter, err := createExporter(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create exporter: %w", err)
	}

	// Create batch span processor
	batchSpanProcessor := sdktrace.NewBatchSpanProcessor(
		exporter,
		sdktrace.WithBatchTimeout(config.BatchTimeout),
		sdktrace.WithExportTimeout(config.ExportTimeout),
	)

	// Create sampler
	sampler := sdktrace.ParentBased(sdktrace.TraceIDRatioBased(config.SamplingRate))

	// Create tracer provider
	provider := sdktrace.NewTracerProvider(
		sdktrace.WithSampler(sampler),
		sdktrace.WithResource(res),
		sdktrace.WithSpanProcessor(batchSpanProcessor),
	)

	// Set global tracer provider
	otel.SetTracerProvider(provider)

	// Set global propagator
	otel.SetTextMapPropagator(
		propagation.NewCompositeTextMapPropagator(
			propagation.TraceContext{},
			propagation.Baggage{},
		),
	)

	return &TracerProvider{
		provider: provider,
		config:   config,
		shutdownFn: func(ctx context.Context) error {
			return provider.Shutdown(ctx)
		},
	}, nil
}

// newResource creates a new OpenTelemetry resource
func newResource(config TracingConfig) (*resource.Resource, error) {
	// Create base attributes
	attrs := []attribute.KeyValue{
		semconv.ServiceNameKey.String(config.ServiceName),
		semconv.ServiceVersionKey.String(config.ServiceVersion),
		semconv.DeploymentEnvironmentKey.String(config.Environment),
	}

	// Add custom resource attributes
	for k, v := range config.ResourceAttributes {
		attrs = append(attrs, attribute.String(k, v))
	}

	// Add runtime attributes
	attrs = append(attrs,
		attribute.String("runtime.name", "go"),
		attribute.String("runtime.version", runtime.Version()),
		attribute.String("runtime.os", runtime.GOOS),
		attribute.String("runtime.arch", runtime.GOARCH),
		attribute.String("hostname", getHostname()),
	)

	return resource.NewWithAttributes(
		semconv.SchemaURL,
		attrs...,
	), nil
}

// createExporter creates the appropriate trace exporter
func createExporter(config TracingConfig) (sdktrace.SpanExporter, error) {
	switch config.ExporterType {
	case "jaeger":
		return createJaegerExporter(config)
	case "zipkin":
		return createZipkinExporter(config)
	case "otlp":
		return createOTLPExporter(config)
	case "stdout":
		return createStdoutExporter(config)
	default:
		return createStdoutExporter(config)
	}
}

// createJaegerExporter creates a Jaeger exporter
func createJaegerExporter(config TracingConfig) (sdktrace.SpanExporter, error) {
	return jaeger.New(jaeger.WithCollectorEndpoint(
		jaeger.WithEndpoint(config.JaegerEndpoint),
		jaeger.WithUsername(config.JaegerUsername),
		jaeger.WithPassword(config.JaegerPassword),
	))
}

// createZipkinExporter creates a Zipkin exporter
func createZipkinExporter(config TracingConfig) (sdktrace.SpanExporter, error) {
	return zipkin.New(config.ZipkinEndpoint)
}

// createOTLPExporter creates an OTLP exporter
func createOTLPExporter(config TracingConfig) (sdktrace.SpanExporter, error) {
	opts := []otlptracehttp.Option{
		otlptracehttp.WithEndpoint(config.OTLPEndpoint),
	}

	// Add headers
	if len(config.OTLPHeaders) > 0 {
		opts = append(opts, otlptracehttp.WithHeaders(config.OTLPHeaders))
	}

	if config.OTLPInsecure {
		opts = append(opts, otlptracehttp.WithInsecure())
	}

	return otlptracehttp.New(context.Background(), opts...)
}

// createStdoutExporter creates a stdout exporter
func createStdoutExporter(config TracingConfig) (sdktrace.SpanExporter, error) {
	return stdouttrace.New(
		stdouttrace.WithPrettyPrint(),
	)
}

// GetTracer returns a tracer for the specified component
func (tp *TracerProvider) GetTracer(component string) trace.Tracer {
	if tp.provider == nil {
		return otel.GetTracerProvider().Tracer(component)
	}
	return tp.provider.Tracer(
		component,
		trace.WithInstrumentationVersion(tp.config.ServiceVersion),
		trace.WithSchemaURL(semconv.SchemaURL),
	)
}

// Shutdown shuts down the tracer provider
func (tp *TracerProvider) Shutdown(ctx context.Context) error {
	return tp.shutdownFn(ctx)
}

// StartSpan starts a new span
func (tp *TracerProvider) StartSpan(
	ctx context.Context,
	name string,
	opts ...trace.SpanStartOption,
) (context.Context, trace.Span) {
	return tp.GetTracer("gateway").Start(ctx, name, opts...)
}

// SpanHelper provides helper methods for working with spans
type SpanHelper struct {
	tracer trace.Tracer
}

// NewSpanHelper creates a new span helper
func NewSpanHelper(tp *TracerProvider, component string) *SpanHelper {
	return &SpanHelper{
		tracer: tp.GetTracer(component),
	}
}

// WithSpan executes a function within a span
func (sh *SpanHelper) WithSpan(ctx context.Context, name string, fn func(context.Context) error, opts ...trace.SpanStartOption) error {
	ctx, span := sh.tracer.Start(ctx, name, opts...)
	defer span.End()

	if err := fn(ctx); err != nil {
		span.SetAttributes(
			attribute.String("error", err.Error()),
			attribute.Bool("error", true),
		)
		span.RecordError(err)
		return err
	}

	return nil
}

// WithSpanError executes a function within a span and returns an error - use when the function returns a value
func (sh *SpanHelper) WithSpanError(ctx context.Context, name string, fn func(context.Context) (interface{}, error), opts ...trace.SpanStartOption) (interface{}, error) {
	ctx, span := sh.tracer.Start(ctx, name, opts...)
	defer span.End()

	value, err := fn(ctx)
	if err != nil {
		span.SetAttributes(
			attribute.String("error", err.Error()),
			attribute.Bool("error", true),
		)
		span.RecordError(err)
		return value, err
	}

	return value, nil
}

// AddSpanAttributes adds attributes to the current span
func AddSpanAttributes(ctx context.Context, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)
	if span != nil && span.IsRecording() {
		span.SetAttributes(attrs...)
	}
}

// AddSpanEvent adds an event to the current span
func AddSpanEvent(ctx context.Context, name string, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)
	if span != nil && span.IsRecording() {
		span.AddEvent(name, trace.WithAttributes(attrs...))
	}
}

// SetSpanError sets error information on the current span
func SetSpanError(ctx context.Context, err error) {
	span := trace.SpanFromContext(ctx)
	if span != nil && span.IsRecording() && err != nil {
		span.SetAttributes(
			attribute.String("error", err.Error()),
			attribute.Bool("error", true),
		)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
	}
}

// SetSpanStatus sets the status on the current span
func SetSpanStatus(ctx context.Context, code codes.Code, message string) {
	span := trace.SpanFromContext(ctx)
	if span != nil && span.IsRecording() {
		span.SetStatus(code, message)
	}
}

// Common span attributes
var (
	// HTTP attributes
	HTTPMethod     = attribute.Key("http.method")
	HTTPURL        = attribute.Key("http.url")
	HTTPStatusCode = attribute.Key("http.status_code")
	HTTPUserAgent  = attribute.Key("http.user_agent")
	HTTPTarget     = attribute.Key("http.target")
	HTTPScheme     = attribute.Key("http.scheme")
	HTTPHost       = attribute.Key("http.host")
	HTTPFlavor     = attribute.Key("http.flavor")
	HTTPClientIP   = attribute.Key("http.client_ip")

	// Database attributes
	DBSystem    = attribute.Key("db.system")
	DBName      = attribute.Key("db.name")
	DBStatement = attribute.Key("db.statement")
	DBOperation = attribute.Key("db.operation")

	// RPC attributes
	RPCSystem  = attribute.Key("rpc.system")
	RPCService = attribute.Key("rpc.service")
	RPCMethod  = attribute.Key("rpc.method")

	// Message attributes
	MessagingSystem          = attribute.Key("messaging.system")
	MessagingDestination     = attribute.Key("messaging.destination")
	MessagingDestinationKind = attribute.Key("messaging.destination_kind")

	// Application attributes
	AppComponent  = attribute.Key("app.component")
	AppOperation  = attribute.Key("app.operation")
	TenantID      = attribute.Key("tenant.id")
	UserID        = attribute.Key("user.id")
	RequestID     = attribute.Key("request.id")
	CorrelationID = attribute.Key("correlation.id")
)

// TraceMiddleware returns HTTP middleware for tracing
func (tp *TracerProvider) TraceMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// Extract trace context from headers
		ctx = otel.GetTextMapPropagator().Extract(ctx, propagation.HeaderCarrier(r.Header))

		// Start span
		operationName := fmt.Sprintf("%s %s", r.Method, r.URL.Path)
		ctx, span := tp.StartSpan(ctx, operationName,
			trace.WithAttributes(
				HTTPMethod.String(r.Method),
				HTTPURL.String(r.URL.String()),
				HTTPTarget.String(r.URL.Path),
				HTTPScheme.String(r.URL.Scheme),
				HTTPHost.String(r.Host),
				HTTPUserAgent.String(r.UserAgent()),
				HTTPClientIP.String(getClientIP(r)),
				AppComponent.String("http-server"),
			),
			trace.WithSpanKind(trace.SpanKindServer),
		)
		defer span.End()

		// Wrap response writer
		wrapped := &responseWriterTracing{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}

		// Process request
		next.ServeHTTP(wrapped, r.WithContext(ctx))

		// Add status code
		span.SetAttributes(
			HTTPStatusCode.Int(wrapped.statusCode),
		)

		// Set span status based on status code
		if wrapped.statusCode >= 400 {
			span.SetStatus(codes.Error, fmt.Sprintf("HTTP %d", wrapped.statusCode))
		} else {
			span.SetStatus(codes.Ok, "Success")
		}
	})
}

// responseWriterTracing wraps http.ResponseWriter to capture status code
type responseWriterTracing struct {
	http.ResponseWriter
	statusCode int
}

func (r *responseWriterTracing) WriteHeader(statusCode int) {
	r.statusCode = statusCode
	r.ResponseWriter.WriteHeader(statusCode)
}

// Helper functions

func getHostname() string {
	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = "unknown"
	}
	return hostname
}

func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Take the first IP
		if idx := strings.Index(xff, ","); idx > 0 {
			xff = xff[:idx]
		}
		return strings.TrimSpace(xff)
	}

	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}

	// Use RemoteAddr
	if idx := strings.LastIndex(r.RemoteAddr, ":"); idx > 0 {
		return r.RemoteAddr[:idx]
	}

	return r.RemoteAddr
}
