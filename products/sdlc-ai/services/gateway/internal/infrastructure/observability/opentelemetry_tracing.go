//go:build ignore

package observability

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
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
	SampleRate         float64       `yaml:"sample_rate"`
	Exporters          []string      `yaml:"exporters"`
	ExportTimeout      time.Duration `yaml:"export_timeout"`
	BatchSize          int           `yaml:"batch_size"`
	MaxExportBatchSize int           `yaml:"max_export_batch_size"`
	QueueSize          int           `yaml:"queue_size"`
	ShutdownTimeout    time.Duration `yaml:"shutdown_timeout"`

	// Jaeger configuration
	Jaeger JaegerConfig `yaml:"jaeger"`

	// Zipkin configuration
	Zipkin ZipkinConfig `yaml:"zipkin"`

	// OTLP configuration
	OTLP OTLPConfig `yaml:"otlp"`

	// Custom attributes
	Attributes map[string]string `yaml:"attributes"`
}

// JaegerConfig holds Jaeger-specific configuration
type JaegerConfig struct {
	Endpoint string `yaml:"endpoint"`
	Agent    string `yaml:"agent"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
}

// ZipkinConfig holds Zipkin-specific configuration
type ZipkinConfig struct {
	Endpoint string `yaml:"endpoint"`
}

// OTLPConfig holds OTLP-specific configuration
type OTLPConfig struct {
	Endpoint string            `yaml:"endpoint"`
	Headers  map[string]string `yaml:"headers"`
	Insecure bool              `yaml:"insecure"`
	TLS      TLSConfig         `yaml:"tls"`
}

// TLSConfig holds TLS configuration for OTLP
type TLSConfig struct {
	Enabled            bool   `yaml:"enabled"`
	InsecureSkipVerify bool   `yaml:"insecure_skip_verify"`
	CertFile           string `yaml:"cert_file"`
	KeyFile            string `yaml:"key_file"`
	CAFile             string `yaml:"ca_file"`
}

// TracerProvider wraps the OpenTelemetry tracer provider
type TracerProvider struct {
	provider trace.TracerProvider
	tracer   trace.Tracer
	config   TracingConfig
	shutdown func(context.Context) error
}

// NewTracerProvider creates a new tracer provider with the given configuration
func NewTracerProvider(config TracingConfig) (*TracerProvider, error) {
	if !config.Enabled {
		return &TracerProvider{
			provider: trace.NewNoopTracerProvider(),
			tracer:   trace.NewNoopTracer(),
			config:   config,
		}, nil
	}

	// Set default values
	if config.ServiceName == "" {
		config.ServiceName = "sdlc-gateway"
	}
	if config.ServiceVersion == "" {
		config.ServiceVersion = "1.0.0"
	}
	if config.SampleRate == 0 {
		config.SampleRate = 1.0
	}
	if config.ExportTimeout == 0 {
		config.ExportTimeout = 30 * time.Second
	}
	if config.BatchSize == 0 {
		config.BatchSize = 512
	}
	if config.MaxExportBatchSize == 0 {
		config.MaxExportBatchSize = 512
	}
	if config.QueueSize == 0 {
		config.QueueSize = 2048
	}
	if config.ShutdownTimeout == 0 {
		config.ShutdownTimeout = 5 * time.Second
	}

	// Create resource with service information
	res, err := resource.New(context.Background(),
		resource.WithAttributes(
			semconv.ServiceNameKey.String(config.ServiceName),
			semconv.ServiceVersionKey.String(config.ServiceVersion),
			semconv.DeploymentEnvironmentKey.String(config.Environment),
		),
		resource.WithProcessPID(),
		resource.WithProcessExecutableName(),
		resource.WithProcessExecutablePath(),
		resource.WithProcessCommandArgs(),
		resource.WithProcessOwner(),
		resource.WithProcessRuntimeName(),
		resource.WithProcessRuntimeVersion(),
		resource.WithProcessRuntimeDescription(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Add custom attributes
	for k, v := range config.Attributes {
		res = resource.NewWithAttributes(
			res.SchemaURL(),
			append(res.Attributes(), attribute.String(k, v))...,
		)
	}

	// Create trace exporter options
	traceExporterOpts := []sdktrace.TracerProviderOption{
		sdktrace.WithBatcher(nil, sdktrace.WithBatchTimeout(config.ExportTimeout)),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.TraceIDRatioBased(config.SampleRate)),
	}

	// Initialize exporters based on configuration
	var exporters []sdktrace.SpanExporter
	for _, exporterName := range config.Exporters {
		var exporter sdktrace.SpanExporter
		var err error

		switch strings.ToLower(exporterName) {
		case "jaeger":
			exporter, err = createJaegerExporter(config)
		case "zipkin":
			exporter, err = createZipkinExporter(config)
		case "otlp":
			exporter, err = createOTLPExporter(config)
		default:
			return nil, fmt.Errorf("unsupported exporter: %s", exporterName)
		}

		if err != nil {
			return nil, fmt.Errorf("failed to create %s exporter: %w", exporterName, err)
		}

		exporters = append(exporters, exporter)
	}

	// Create batch span processor with all exporters
	if len(exporters) > 0 {
		bsp := sdktrace.NewBatchSpanProcessor(
			sdktrace.NewSpanExporter(exporters...),
			sdktrace.WithBatchTimeout(config.ExportTimeout),
			sdktrace.WithMaxExportBatchSize(config.MaxExportBatchSize),
			sdktrace.WithMaxQueueSize(config.QueueSize),
		)
		traceExporterOpts = append(traceExporterOpts, sdktrace.WithSpanProcessor(bsp))
	}

	// Create tracer provider
	provider := sdktrace.NewTracerProvider(traceExporterOpts...)

	// Set global tracer provider
	otel.SetTracerProvider(provider)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
		propagation.MDC{},
	))

	// Get tracer
	tracer := provider.Tracer(config.ServiceName,
		trace.WithInstrumentationVersion(config.ServiceVersion),
		trace.WithSchemaURL(semconv.SchemaURL),
	)

	return &TracerProvider{
		provider: provider,
		tracer:   tracer,
		config:   config,
		shutdown: provider.Shutdown,
	}, nil
}

// createJaegerExporter creates a Jaeger exporter
func createJaegerExporter(config TracingConfig) (sdktrace.SpanExporter, error) {
	if config.Jaeger.Endpoint != "" {
		// Use collector endpoint
		return jaeger.New(jaeger.WithCollectorEndpoint(
			jaeger.WithEndpoint(config.Jaeger.Endpoint),
			jaeger.WithUsername(config.Jaeger.User),
			jaeger.WithPassword(config.Jaeger.Password),
		))
	}

	// Use agent endpoint
	return jaeger.New(jaeger.WithAgentEndpoint(
		jaeger.WithAgentHost(config.Jaeger.Agent),
	))
}

// createZipkinExporter creates a Zipkin exporter
func createZipkinExporter(config TracingConfig) (sdktrace.SpanExporter, error) {
	return zipkin.New(config.Zipkin.Endpoint)
}

// createOTLPExporter creates an OTLP exporter
func createOTLPExporter(config TracingConfig) (sdktrace.SpanExporter, error) {
	opts := []otlptracehttp.Option{
		otlptracehttp.WithEndpoint(config.OTLP.Endpoint),
		otlptracehttp.WithTimeout(config.ExportTimeout),
		otlptracehttp.WithHeaders(config.OTLP.Headers),
		otlptracehttp.WithInsecure(config.OTLP.Insecure),
	}

	// Add TLS configuration if enabled
	if config.OTLP.TLS.Enabled {
		// TLS configuration would be added here
		// This is a simplified version
		opts = append(opts, otlptracehttp.WithInsecure(false))
	}

	return otlptracehttp.New(context.Background(), opts...)
}

// GetTracer returns the OpenTelemetry tracer
func (tp *TracerProvider) GetTracer() trace.Tracer {
	return tp.tracer
}

// StartSpan starts a new span
func (tp *TracerProvider) StartSpan(ctx context.Context, name string, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	return tp.tracer.Start(ctx, name, opts...)
}

// Shutdown shuts down the tracer provider
func (tp *TracerProvider) Shutdown(ctx context.Context) error {
	if tp.shutdown != nil {
		return tp.shutdown(ctx)
	}
	return nil
}

// TracingMiddleware provides HTTP middleware for tracing
func (tp *TracerProvider) TracingMiddleware(operationName string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !tp.config.Enabled {
				next.ServeHTTP(w, r)
				return
			}

			// Extract trace context from incoming request
			ctx := otel.GetTextMapPropagator().Extract(r.Context(), propagation.HeaderCarrier(r.Header))

			// Create span attributes
			attrs := []trace.SpanStartOption{
				trace.WithAttributes(
					semconv.HTTPMethodKey.String(r.Method),
					semconv.HTTPURLKey.String(r.URL.String()),
					semconv.HTTPHostKey.String(r.Host),
					semconv.HTTPUserAgentKey.String(r.UserAgent()),
					semconv.HTTPSchemeKey.String(r.URL.Scheme),
					semconv.HTTPTargetKey.String(r.URL.Path),
					semconv.HTTPRemoteAddrKey.String(r.RemoteAddr),
					attribute.String("http.proto", r.Proto),
				),
			}

			// Add custom headers as attributes
			if headers := r.Header.Get("X-Request-ID"); headers != "" {
				attrs = append(attrs, trace.WithAttributes(attribute.String("http.request_id", headers)))
			}
			if headers := r.Header.Get("X-Tenant-ID"); headers != "" {
				attrs = append(attrs, trace.WithAttributes(attribute.String("http.tenant_id", headers)))
			}
			if headers := r.Header.Get("X-User-ID"); headers != "" {
				attrs = append(attrs, trace.WithAttributes(attribute.String("http.user_id", headers)))
			}

			// Start span
			ctx, span := tp.StartSpan(ctx, operationName, attrs...)
			defer span.End()

			// Wrap response writer to capture status code
			wrapped := &tracingResponseWriter{
				ResponseWriter: w,
				statusCode:     200,
			}

			// Add span to request context
			r = r.WithContext(ctx)

			// Process request
			next.ServeHTTP(wrapped, r)

			// Set span attributes based on response
			span.SetAttributes(
				semconv.HTTPStatusCodeKey.Int(wrapped.statusCode),
			)

			// Set span status based on status code
			if wrapped.statusCode >= 400 && wrapped.statusCode < 500 {
				span.SetStatus(codes.Error, "Client error")
			} else if wrapped.statusCode >= 500 {
				span.SetStatus(codes.Error, "Server error")
			} else {
				span.SetStatus(codes.Ok, "Success")
			}

			// Add additional attributes
			span.SetAttributes(
				attribute.Int("http.response_size", wrapped.responseSize),
				attribute.String("component", tp.config.ServiceName),
				attribute.String("environment", tp.config.Environment),
			)
		})
	}
}

// tracingResponseWriter wraps http.ResponseWriter to capture status code and response size
type tracingResponseWriter struct {
	http.ResponseWriter
	statusCode   int
	responseSize int
}

func (w *tracingResponseWriter) WriteHeader(statusCode int) {
	w.statusCode = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *tracingResponseWriter) Write(b []byte) (int, error) {
	n, err := w.ResponseWriter.Write(b)
	w.responseSize += n
	return n, err
}

// Helper functions for creating spans with common attributes

func (tp *TracerProvider) StartDatabaseSpan(ctx context.Context, operation, table string) (context.Context, trace.Span) {
	return tp.StartSpan(ctx, fmt.Sprintf("database.%s", operation),
		trace.WithAttributes(
			semconv.DBSystemKey.String("postgresql"),
			semconv.DBOperationKey.String(operation),
			semconv.DBSQLTableKey.String(table),
			attribute.String("component", "database"),
		),
	)
}

func (tp *TracerProvider) StartCacheSpan(ctx context.Context, operation, cacheType string) (context.Context, trace.Span) {
	return tp.StartSpan(ctx, fmt.Sprintf("cache.%s", operation),
		trace.WithAttributes(
			attribute.String("cache.type", cacheType),
			attribute.String("cache.operation", operation),
			attribute.String("component", "cache"),
		),
	)
}

func (tp *TracerProvider) StartExternalSpan(ctx context.Context, service, operation string) (context.Context, trace.Span) {
	return tp.StartSpan(ctx, fmt.Sprintf("external.%s.%s", service, operation),
		trace.WithAttributes(
			semconv.PeerServiceKey.String(service),
			attribute.String("external.operation", operation),
			attribute.String("component", "external"),
		),
	)
}

func (tp *TracerProvider) StartLLMSpan(ctx context.Context, provider, model, operation string) (context.Context, trace.Span) {
	return tp.StartSpan(ctx, fmt.Sprintf("llm.%s.%s", provider, operation),
		trace.WithAttributes(
			attribute.String("llm.provider", provider),
			attribute.String("llm.model", model),
			attribute.String("llm.operation", operation),
			attribute.String("component", "llm"),
		),
	)
}

func (tp *TracerProvider) StartVectorSearchSpan(ctx context.Context, searchType string) (context.Context, trace.Span) {
	return tp.StartSpan(ctx, fmt.Sprintf("vector_search.%s", searchType),
		trace.WithAttributes(
			attribute.String("search.type", searchType),
			attribute.String("component", "vector_search"),
		),
	)
}

func (tp *TracerProvider) AddSpanEvent(span trace.Span, name string, attrs ...attribute.KeyValue) {
	span.AddEvent(name, trace.WithAttributes(attrs...))
}

func (tp *TracerProvider) SetSpanError(span trace.Span, err error) {
	if span != nil && err != nil {
		span.SetStatus(codes.Error, err.Error())
		span.SetAttributes(
			attribute.String("error.type", fmt.Sprintf("%T", err)),
			attribute.String("error.message", err.Error()),
		)
	}
}

// GetTraceID returns the trace ID from the context
func GetTraceID(ctx context.Context) string {
	span := trace.SpanFromContext(ctx)
	if span == nil {
		return ""
	}
	return span.SpanContext().TraceID().String()
}

// GetSpanID returns the span ID from the context
func GetSpanID(ctx context.Context) string {
	span := trace.SpanFromContext(ctx)
	if span == nil {
		return ""
	}
	return span.SpanContext().SpanID().String()
}

// AddSpanBaggage adds baggage to the context
func AddSpanBaggage(ctx context.Context, key, value string) context.Context {
	return baggage.ContextWithBaggage(ctx, baggage.New(key, value))
}

// GetSpanBaggage retrieves baggage from the context
func GetSpanBaggage(ctx context.Context, key string) string {
	bag := baggage.FromContext(ctx)
	member := bag.Member(key)
	if member.HasValue() {
		return member.Value()
	}
	return ""
}

// Global tracer provider instance
var globalTracerProvider *TracerProvider

// InitializeGlobalTracer initializes the global tracer provider
func InitializeGlobalTracer(config TracingConfig) error {
	tp, err := NewTracerProvider(config)
	if err != nil {
		return err
	}
	globalTracerProvider = tp
	return nil
}

// GetGlobalTracer returns the global tracer provider
func GetGlobalTracer() *TracerProvider {
	return globalTracerProvider
}

// GetGlobalTracer returns the global tracer
func GetGlobalTracer() trace.Tracer {
	if globalTracerProvider != nil {
		return globalTracerProvider.GetTracer()
	}
	return trace.NewNoopTracer()
}
