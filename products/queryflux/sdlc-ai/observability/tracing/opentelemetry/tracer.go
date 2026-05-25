package opentelemetry

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
	"go.opentelemetry.io/otel/trace"
)

// TracerConfig holds configuration for OpenTelemetry tracing
type TracerConfig struct {
	ServiceName        string            `json:"service_name" yaml:"service_name"`
	ServiceVersion     string            `json:"service_version" yaml:"service_version"`
	Environment        string            `json:"environment" yaml:"environment"`
	Enabled            bool              `json:"enabled" yaml:"enabled"`
	SamplingRate       float64           `json:"sampling_rate" yaml:"sampling_rate"`
	Exporters          []string          `json:"exporters" yaml:"exporters"`
	JaegerEndpoint     string            `json:"jaeger_endpoint" yaml:"jaeger_endpoint"`
	OTLPEndpoint       string            `json:"otlp_endpoint" yaml:"otlp_endpoint"`
	ResourceAttributes map[string]string `json:"resource_attributes" yaml:"resource_attributes"`
	BatchSize          int               `json:"batch_size" yaml:"batch_size"`
	Timeout            time.Duration     `json:"timeout" yaml:"timeout"`
}

// DefaultTracerConfig returns default tracer configuration
func DefaultTracerConfig() *TracerConfig {
	return &TracerConfig{
		ServiceName:    "sdlc-platform",
		ServiceVersion: "1.0.0",
		Environment:    "development",
		Enabled:        true,
		SamplingRate:   1.0, // Sample all traces in development
		Exporters:      []string{"jaeger"},
		JaegerEndpoint: "http://localhost:14268/api/traces",
		OTLPEndpoint:   "http://localhost:4318",
		ResourceAttributes: map[string]string{
			"deployment.environment": "development",
			"service.namespace":      "sdlc",
		},
		BatchSize: 512,
		Timeout:   5 * time.Second,
	}
}

// TracerManager manages OpenTelemetry tracing setup
type TracerManager struct {
	config     *TracerConfig
	tracer     trace.Tracer
	provider   *sdktrace.TracerProvider
	shutdownFn func(context.Context) error
}

// NewTracerManager creates a new tracer manager
func NewTracerManager(config *TracerConfig) (*TracerManager, error) {
	if config == nil {
		config = DefaultTracerConfig()
	}

	if !config.Enabled {
		return &TracerManager{
			config: config,
			tracer: trace.NewNoOpTracerProvider().Tracer(config.ServiceName),
		}, nil
	}

	// Create resource
	res, err := createResource(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Create exporters
	exporters, err := createExporters(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create exporters: %w", err)
	}

	// Create span processors
	var processors []sdktrace.SpanProcessor
	for _, exporter := range exporters {
		processor := sdktrace.NewBatchSpanProcessor(
			exporter,
			sdktrace.WithBatchTimeout(config.Timeout),
			sdktrace.WithMaxExportBatchSize(config.BatchSize),
		)
		processors = append(processors, processor)
	}

	// Create sampler
	sampler := sdktrace.TraceIDRatioBased(config.SamplingRate)

	// Create tracer provider
	provider := sdktrace.NewTracerProvider(
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sampler),
		sdktrace.WithSpanProcessor(processors...),
	)

	// Set global tracer provider
	otel.SetTracerProvider(provider)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	tracer := provider.Tracer(config.ServiceName, trace.WithInstrumentationVersion(config.ServiceVersion))

	return &TracerManager{
		config:     config,
		tracer:     tracer,
		provider:   provider,
		shutdownFn: provider.Shutdown,
	}, nil
}

// createResource creates the OpenTelemetry resource
func createResource(config *TracerConfig) (*resource.Resource, error) {
	attrs := []attribute.KeyValue{
		semconv.ServiceNameKey.String(config.ServiceName),
		semconv.ServiceVersionKey.String(config.ServiceVersion),
	}

	// Add custom resource attributes
	for key, value := range config.ResourceAttributes {
		attrs = append(attrs, attribute.String(key, value))
	}

	// Add environment-specific attributes
	if config.Environment != "" {
		attrs = append(attrs, semconv.DeploymentEnvironmentKey.String(config.Environment))
	}

	return resource.NewWithAttributes(attrs...), nil
}

// createExporters creates trace exporters based on configuration
func createExporters(config *TracerConfig) ([]sdktrace.SpanExporter, error) {
	var exporters []sdktrace.SpanExporter

	for _, exporterType := range config.Exporters {
		switch exporterType {
		case "jaeger":
			if config.JaegerEndpoint != "" {
				jaegerExporter, err := jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(config.JaegerEndpoint)))
				if err != nil {
					return nil, fmt.Errorf("failed to create Jaeger exporter: %w", err)
				}
				exporters = append(exporters, jaegerExporter)
			}
		case "otlp":
			if config.OTLPEndpoint != "" {
				ctx, cancel := context.WithTimeout(context.Background(), config.Timeout)
				defer cancel()

				otlpExporter, err := otlptracehttp.New(ctx,
					otlptracehttp.WithEndpoint(config.OTLPEndpoint),
					otlptracehttp.WithInsecure(),
				)
				if err != nil {
					return nil, fmt.Errorf("failed to create OTLP exporter: %w", err)
				}
				exporters = append(exporters, otlpExporter)
			}
		default:
			return nil, fmt.Errorf("unsupported exporter type: %s", exporterType)
		}
	}

	if len(exporters) == 0 {
		return nil, fmt.Errorf("no valid exporters configured")
	}

	return exporters, nil
}

// GetTracer returns the tracer instance
func (tm *TracerManager) GetTracer() trace.Tracer {
	return tm.tracer
}

// StartSpan starts a new span
func (tm *TracerManager) StartSpan(ctx context.Context, name string, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	return tm.tracer.Start(ctx, name, opts...)
}

// StartSpanWithAttributes starts a new span with attributes
func (tm *TracerManager) StartSpanWithAttributes(
	ctx context.Context,
	name string,
	attributes []attribute.KeyValue,
	opts ...trace.SpanStartOption,
) (context.Context, trace.Span) {
	opts = append(opts, trace.WithAttributes(attributes...))
	return tm.tracer.Start(ctx, name, opts...)
}

// RecordError records an error on the active span
func (tm *TracerManager) RecordError(ctx context.Context, err error, attributes ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)
	if span.IsRecording() {
		span.RecordError(err, trace.WithAttributes(attributes...))
		span.SetAttributes(
			semconv.ExceptionTypeKey.String(fmt.Sprintf("%T", err)),
			semconv.ExceptionMessageKey.String(err.Error()),
		)
	}
}

// SetAttributes sets attributes on the active span
func (tm *TracerManager) SetAttributes(ctx context.Context, attributes ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)
	if span.IsRecording() {
		span.SetAttributes(attributes...)
	}
}

// AddEvent adds an event to the active span
func (tm *TracerManager) AddEvent(ctx context.Context, name string, attributes ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)
	if span.IsRecording() {
		span.AddEvent(name, trace.WithAttributes(attributes...))
	}
}

// SetStatus sets the status on the active span
func (tm *TracerManager) SetStatus(ctx context.Context, code codes.Code, description string) {
	span := trace.SpanFromContext(ctx)
	if span.IsRecording() {
		span.SetStatus(code, description)
	}
}

// GetTraceID returns the trace ID from context
func (tm *TracerManager) GetTraceID(ctx context.Context) string {
	span := trace.SpanFromContext(ctx)
	if span.SpanContext().IsValid() {
		return span.SpanContext().TraceID().String()
	}
	return ""
}

// GetSpanID returns the span ID from context
func (tm *TracerManager) GetSpanID(ctx context.Context) string {
	span := trace.SpanFromContext(ctx)
	if span.SpanContext().IsValid() {
		return span.SpanContext().SpanID().String()
	}
	return ""
}

// Shutdown shuts down the tracer provider
func (tm *TracerManager) Shutdown(ctx context.Context) error {
	if tm.shutdownFn != nil {
		return tm.shutdownFn(ctx)
	}
	return nil
}

// SpanHelper provides helper functions for common tracing patterns
type SpanHelper struct {
	tracerManager *TracerManager
}

// NewSpanHelper creates a new span helper
func NewSpanHelper(tracerManager *TracerManager) *SpanHelper {
	return &SpanHelper{
		tracerManager: tracerManager,
	}
}

// WithSpan creates a span around a function
func (sh *SpanHelper) WithSpan(
	ctx context.Context,
	spanName string,
	fn func(context.Context) error,
	attributes ...attribute.KeyValue,
) error {
	ctx, span := sh.tracerManager.StartSpanWithAttributes(ctx, spanName, attributes...)
	defer span.End()

	err := fn(ctx)
	if err != nil {
		sh.tracerManager.RecordError(ctx, err)
		span.SetStatus(codes.Error, err.Error())
	} else {
		span.SetStatus(codes.Ok, "Operation completed successfully")
	}

	return err
}

// WithSpanResult creates a span around a function that returns a result
func WithSpanResult[T any](
	ctx context.Context,
	tracerManager *TracerManager,
	spanName string,
	fn func(context.Context) (T, error),
	attributes ...attribute.KeyValue,
) (T, error) {
	var result T
	ctx, span := tracerManager.StartSpanWithAttributes(ctx, spanName, attributes...)
	defer span.End()

	result, err := fn(ctx)
	if err != nil {
		tracerManager.RecordError(ctx, err)
		span.SetStatus(codes.Error, err.Error())
	} else {
		span.SetStatus(codes.Ok, "Operation completed successfully")
	}

	return result, err
}

// WithSpanAsync creates a span around an async function
func WithSpanAsync(
	ctx context.Context,
	tracerManager *TracerManager,
	spanName string,
	fn func(context.Context) <-chan error,
	attributes ...attribute.KeyValue,
) <-chan error {
	resultChan := make(chan error, 1)

	go func() {
		defer close(resultChan)

		ctx, span := tracerManager.StartSpanWithAttributes(ctx, spanName, attributes...)
		defer span.End()

		errChan := fn(ctx)
		select {
		case err := <-errChan:
			if err != nil {
				tracerManager.RecordError(ctx, err)
				span.SetStatus(codes.Error, err.Error())
				resultChan <- err
			} else {
				span.SetStatus(codes.Ok, "Operation completed successfully")
				resultChan <- nil
			}
		case <-ctx.Done():
			tracerManager.RecordError(ctx, ctx.Err())
			span.SetStatus(codes.Error, ctx.Err().Error())
			resultChan <- ctx.Err()
		}
	}()

	return resultChan
}

// BusinessTraceHelper provides tracing helpers for business operations
type BusinessTraceHelper struct {
	tracerManager *TracerManager
}

// NewBusinessTraceHelper creates a new business trace helper
func NewBusinessTraceHelper(tracerManager *TracerManager) *BusinessTraceHelper {
	return &BusinessTraceHelper{
		tracerManager: tracerManager,
	}
}

// TraceHTTPRequest traces an HTTP request
func (bth *BusinessTraceHelper) TraceHTTPRequest(
	ctx context.Context,
	method, url string,
	fn func(context.Context) error,
) error {
	attributes := []attribute.KeyValue{
		semconv.HTTPMethodKey.String(method),
		semconv.HTTPURLKey.String(url),
		semconv.HTTPSchemeKey.String("https"),
	}

	return NewSpanHelper(bth.tracerManager).WithSpan(
		ctx,
		fmt.Sprintf("HTTP %s %s", method, url),
		fn,
		attributes...,
	)
}

// TraceDatabaseOperation traces a database operation
func (bth *BusinessTraceHelper) TraceDatabaseOperation(
	ctx context.Context,
	operation, table string,
	fn func(context.Context) error,
) error {
	attributes := []attribute.KeyValue{
		semconv.DBSystemKey.String("postgresql"),
		semconv.DBOperationKey.String(operation),
		semconv.DBSQLTableKey.String(table),
	}

	return NewSpanHelper(bth.tracerManager).WithSpan(
		ctx,
		fmt.Sprintf("DB %s %s", operation, table),
		fn,
		attributes...,
	)
}

// TraceRAGOperation traces a RAG (Retrieval-Augmented Generation) operation
func (bth *BusinessTraceHelper) TraceRAGOperation(
	ctx context.Context,
	queryType string,
	fn func(context.Context) error,
) error {
	attributes := []attribute.KeyValue{
		attribute.String("rag.operation_type", queryType),
		attribute.String("service.name", "rag-service"),
	}

	return NewSpanHelper(bth.tracerManager).WithSpan(
		ctx,
		fmt.Sprintf("RAG %s", queryType),
		fn,
		attributes...,
	)
}

// TraceVectorSearch traces a vector search operation
func (bth *BusinessTraceHelper) TraceVectorSearch(
	ctx context.Context,
	indexName string,
	fn func(context.Context) error,
) error {
	attributes := []attribute.KeyValue{
		attribute.String("vector.index_name", indexName),
		attribute.String("service.name", "vector-service"),
	}

	return NewSpanHelper(bth.tracerManager).WithSpan(
		ctx,
		fmt.Sprintf("Vector Search %s", indexName),
		fn,
		attributes...,
	)
}

// TraceDocumentProcessing traces a document processing operation
func (bth *BusinessTraceHelper) TraceDocumentProcessing(
	ctx context.Context,
	documentType, operation string,
	fn func(context.Context) error,
) error {
	attributes := []attribute.KeyValue{
		attribute.String("document.type", documentType),
		attribute.String("document.operation", operation),
		attribute.String("service.name", "document-service"),
	}

	return NewSpanHelper(bth.tracerManager).WithSpan(
		ctx,
		fmt.Sprintf("Document %s %s", operation, documentType),
		fn,
		attributes...,
	)
}

// TraceAuthentication traces an authentication operation
func (bth *BusinessTraceHelper) TraceAuthentication(
	ctx context.Context,
	authType string,
	fn func(context.Context) error,
) error {
	attributes := []attribute.KeyValue{
		attribute.String("auth.type", authType),
		attribute.String("service.name", "auth-service"),
	}

	return NewSpanHelper(bth.tracerManager).WithSpan(
		ctx,
		fmt.Sprintf("Auth %s", authType),
		fn,
		attributes...,
	)
}

// Global tracer manager instance
var globalTracerManager *TracerManager

// InitGlobalTracer initializes the global tracer manager
func InitGlobalTracer(config *TracerConfig) error {
	var err error
	globalTracerManager, err = NewTracerManager(config)
	return err
}

// GetGlobalTracer returns the global tracer manager
func GetGlobalTracer() *TracerManager {
	if globalTracerManager == nil {
		globalTracerManager, _ = NewTracerManager(DefaultTracerConfig())
	}
	return globalTracerManager
}

// GenerateTraceID generates a random trace ID for testing
func GenerateTraceID() string {
	return fmt.Sprintf("%016x%016x", rand.Uint64(), rand.Uint64())
}
