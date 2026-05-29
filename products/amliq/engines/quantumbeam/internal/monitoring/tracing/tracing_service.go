//go:build legacy_migrated
// +build legacy_migrated

package tracing

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/baggage"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/exporters/prometheus"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/instrumentation"
	"go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/metric/aggregator/histogram"
	controller "go.opentelemetry.io/otel/sdk/metric/controller/basic"
	processor "go.opentelemetry.io/otel/sdk/metric/processor/basic"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
	"go.opentelemetry.io/otel/trace"
)

// TracingConfig contains configuration for the tracing service
type TracingConfig struct {
	Enabled           bool              `json:"enabled"`
	ServiceName       string            `json:"service_name"`
	ServiceVersion    string            `json:"service_version"`
	Environment       string            `json:"environment"`
	Sampler           string            `json:"sampler"`
	SamplerRatio      float64           `json:"sampler_ratio"`
	JaegerEndpoint   string            `json:"jaeger_endpoint"`
	OTLPEndpoint     string            `json:"otlp_endpoint"`
	OTLPHeaders      map[string]string `json:"otlp_headers"`
	BatchTimeout     time.Duration     `json:"batch_timeout"`
	MaxBatchSize     int               `json:"max_batch_size"`
	ExportTimeout    time.Duration     `json:"export_timeout"`
	ResourceLabels   map[string]string `json:"resource_labels"`
	Propagators      []string          `json:"propagators"`
	MetricsEnabled   bool              `json:"metrics_enabled"`
	Debug            bool              `json:"debug"`
}

// TraceContext contains tracing information
type TraceContext struct {
	TraceID       string
	SpanID        string
	ParentSpanID   string
	IsSampled     bool
	Baggage       map[string]string
	CorrelationID string
	UserID        string
	SessionID     string
	RequestID     string
}

// SpanOptions contains options for creating spans
type SpanOptions struct {
	Name           string            `json:"name"`
	Attributes     map[string]string `json:"attributes"`
	Links          []Link           `json:"links"`
	Kind           trace.SpanKind    `json:"kind"`
	StartTime      time.Time        `json:"start_time"`
	EndTime        *time.Time       `json:"end_time,omitempty"`
	RootSpan       bool             `json:"root_span"`
	ForceSampling  bool             `json:"force_sampling"`
}

// Link represents a span link
type Link struct {
	TraceID    string            `json:"trace_id"`
	SpanID     string            `json:"span_id"`
	Attributes map[string]string `json:"attributes"`
}

// TracingService provides distributed tracing capabilities
type TracingService struct {
	config         TracingConfig
	tracerProvider *sdktrace.TracerProvider
	meterProvider  *controller.Controller
	propagators    propagation.TextMapPropagator
	customSpans   map[string]*CustomSpan
	mu             sync.RWMutex
	ctx            context.Context
	cancel         context.CancelFunc
}

// CustomSpan represents a custom span for business logic
type CustomSpan struct {
	ID           string                 `json:"id"`
	Name         string                 `json:"name"`
	TraceID      string                 `json:"trace_id"`
	SpanID       string                 `json:"span_id"`
	ParentSpanID string                 `json:"parent_span_id"`
	StartTime    time.Time              `json:"start_time"`
	EndTime      *time.Time             `json:"end_time,omitempty"`
	Duration     *time.Duration        `json:"duration,omitempty"`
	Status       string                 `json:"status"`
	Attributes   map[string]interface{} `json:"attributes"`
	Events       []SpanEvent            `json:"events"`
	Links        []Link                 `json:"links"`
	Tags         map[string]string      `json:"tags"`
	Resource     *Resource             `json:"resource"`
}

// SpanEvent represents an event within a span
type SpanEvent struct {
	Name      string                 `json:"name"`
	Timestamp time.Time              `json:"timestamp"`
	Attributes map[string]interface{} `json:"attributes"`
}

// Resource contains span resource information
type Resource struct {
	Service     string                 `json:"service"`
	Host        string                 `json:"host"`
	Environment string                 `json:"environment"`
	Version     string                 `json:"version"`
	Labels      map[string]interface{} `json:"labels"`
}

// NewTracingService creates a new tracing service
func NewTracingService(config TracingConfig) (*TracingService, error) {
	// Set default values
	if config.ServiceName == "" {
		config.ServiceName = "quantumbeam-api"
	}
	if config.ServiceVersion == "" {
		config.ServiceVersion = "1.0.0"
	}
	if config.Environment == "" {
		config.Environment = "production"
	}
	if config.Sampler == "" {
		config.Sampler = "parentbased_traceidratio"
	}
	if config.BatchTimeout == 0 {
		config.BatchTimeout = 5 * time.Second
	}
	if config.MaxBatchSize == 0 {
		config.MaxBatchSize = 512
	}
	if config.ExportTimeout == 0 {
		config.ExportTimeout = 30 * time.Second
	}

	ctx, cancel := context.WithCancel(context.Background())

	ts := &TracingService{
		config:       config,
		customSpans:  make(map[string]*CustomSpan),
		ctx:          ctx,
		cancel:       cancel,
	}

	// Initialize OpenTelemetry
	if err := ts.initializeOpenTelemetry(); err != nil {
		cancel()
		return nil, fmt.Errorf("failed to initialize OpenTelemetry: %w", err)
	}

	return ts, nil
}

// initializeOpenTelemetry initializes OpenTelemetry components
func (ts *TracingService) initializeOpenTelemetry() error {
	if !ts.config.Enabled {
		return nil
	}

	// Create resource with service information
	resources, err := ts.createResource()
	if err != nil {
		return fmt.Errorf("failed to create resource: %w", err)
	}

	// Create trace provider
	tracerProvider, err := ts.createTracerProvider(resources)
	if err != nil {
		return fmt.Errorf("failed to create tracer provider: %w", err)
	}
	ts.tracerProvider = tracerProvider

	// Create meter provider if metrics are enabled
	if ts.config.MetricsEnabled {
		meterProvider, err := ts.createMeterProvider(resources)
		if err != nil {
			return fmt.Errorf("failed to create meter provider: %w", err)
		}
		ts.meterProvider = meterProvider
	}

	// Set global propagator
	ts.propagators = ts.createPropagators()
	otel.SetTextMapPropagator(ts.propagators)

	return nil
}

// createResource creates OpenTelemetry resource attributes
func (ts *TracingService) createResource() (*resource.Resource, error) {
	// Default resource labels
	labels := map[string]string{
		"service.name":    ts.config.ServiceName,
		"service.version": ts.config.ServiceVersion,
		"environment":     ts.config.Environment,
		"host.name":       ts.getHostname(),
		"host.arch":       ts.getArchitecture(),
		"os.type":         ts.getOSType(),
	}

	// Merge custom resource labels
	for k, v := range ts.config.ResourceLabels {
		labels[k] = v
	}

	// Convert to attributes
	attrs := make([]attribute.KeyValue, 0, len(labels))
	for k, v := range labels {
		attrs = append(attrs, attribute.String(k, v))
	}

	return resource.NewWithAttributes(semconv.SchemaURL, attrs...), nil
}

// createTracerProvider creates the OpenTelemetry tracer provider
func (ts *TracingService) createTracerProvider(resources *resource.Resource) (*sdktrace.TracerProvider, error) {
	// Create sampler based on configuration
	var sampler sdktrace.Sampler
	switch ts.config.Sampler {
	case "always_on":
		sampler = sdktrace.AlwaysSample()
	case "always_off":
		sampler = sdktrace.NeverSample()
	case "traceidratio":
		if ts.config.SamplerRatio <= 0 || ts.config.SamplerRatio > 1 {
			ts.config.SamplerRatio = 0.1
		}
		sampler = sdktrace.TraceIDRatioBased(ts.config.SamplerRatio)
	case "parentbased_traceidratio":
		if ts.config.SamplerRatio <= 0 || ts.config.SamplerRatio > 1 {
			ts.config.SamplerRatio = 0.1
		}
		sampler = sdktrace.ParentBased(sdktrace.TraceIDRatioBased(ts.config.SamplerRatio))
	default:
		sampler = sdktrace.ParentBased(sdktrace.TraceIDRatioBased(0.1))
	}

	// Create span processors
	var spanProcessors []sdktrace.SpanProcessor

	// Create Jaeger exporter if configured
	if ts.config.JaegerEndpoint != "" {
		jaegerExporter, err := jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(ts.config.JaegerEndpoint)))
		if err != nil {
			return nil, fmt.Errorf("failed to create Jaeger exporter: %w", err)
		}

		batchSpanProcessor := sdktrace.NewBatchSpanProcessor(
			jaegerExporter,
			sdktrace.WithBatchTimeout(ts.config.BatchTimeout),
			sdktrace.WithMaxExportBatchSize(ts.config.MaxBatchSize),
			sdktrace.WithExportTimeout(ts.config.ExportTimeout),
		)
		spanProcessors = append(spanProcessors, batchSpanProcessor)
	}

	// Create OTLP exporter if configured
	if ts.config.OTLPEndpoint != "" {
		clientOpts := []otlptracehttp.Option{
			otlptracehttp.WithEndpoint(ts.config.OTLPEndpoint),
		}

		if len(ts.config.OTLPHeaders) > 0 {
			clientOpts = append(clientOpts, otlptracehttp.WithHeaders(ts.config.OTLPHeaders))
		}

		otlpExporter, err := otlptracehttp.New(clientOpts...)
		if err != nil {
			return nil, fmt.Errorf("failed to create OTLP exporter: %w", err)
		}

		batchSpanProcessor := sdktrace.NewBatchSpanProcessor(
			otlpExporter,
			sdktrace.WithBatchTimeout(ts.config.BatchTimeout),
			sdktrace.WithMaxExportBatchSize(ts.config.MaxBatchSize),
			sdktrace.WithExportTimeout(ts.config.ExportTimeout),
		)
		spanProcessors = append(spanProcessors, batchSpanProcessor)
	}

	// Always add console exporter for debugging
	if ts.config.Debug {
		consoleExporter := sdktrace.NewConsoleExporter()
		spanProcessors = append(spanProcessors, sdktrace.NewSimpleSpanProcessor(consoleExporter))
	}

	// Create tracer provider
	tracerProvider := sdktrace.NewTracerProvider(
		sdktrace.WithResource(resources),
		sdktrace.WithSampler(sampler),
		sdktrace.WithSpanProcessors(spanProcessors...),
	)

	return tracerProvider, nil
}

// createMeterProvider creates the OpenTelemetry meter provider
func (ts *TracingService) createMeterProvider(resources *resource.Resource) (*controller.Controller, error) {
	// Create OTLP metric exporter
	clientOpts := []otlpmetrichttp.Option{
		otlpmetrichttp.WithEndpoint(ts.config.OTLPEndpoint),
	}

	if len(ts.config.OTLPHeaders) > 0 {
		clientOpts = append(clientOpts, otlmetrichttp.WithHeaders(ts.config.OTLPHeaders))
	}

	otlpExporter, err := otlpmetrichttp.New(clientOpts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create OTLP metric exporter: %w", err)
	}

	// Create Prometheus exporter
	prometheusExporter, err := prometheus.New()
	if err != nil {
		return nil, fmt.Errorf("failed to create Prometheus exporter: %w", err)
	}

	// Create controller
	meterProvider := controller.New(
		processor.NewFactory(
			selector.NewWithHistogramDistribution(
				histogram.WithExplicitBoundaries([]float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10}),
			histogram.WithMaxSize(100),
			histogram.WithResetOnRecord(false),
			histogram.WithSum(true),
			histogram.WithCount(true),
			histogram.WithMinMax(true),
			histogram.WithRecordMinMax(true),
			histogram.WithNoBounds(false),
			histogram.WithZeroThreshold(true),
			histogram.WithErrorValue(math.NaN),
			histogram.WithDropReset(false),
			histogram.WithOutlierExclusion(0),
				...metric.WithMemory(true),
			),
		),
		controller.WithExporter(otlpExporter),
		controller.WithExporter(prometheusExporter),
		controller.WithCollectPeriod(15*time.Second),
		controller.WithResource(resources),
	)

	// Start the provider
	if err := meterProvider.Start(ts.ctx); err != nil {
		return nil, fmt.Errorf("failed to start meter provider: %w", err)
	}

	return meterProvider, nil
}

// createPropagators creates the text map propagators
func (ts *TracingService) createPropagators() propagation.TextMapPropagator {
	var propagators []propagation.TextMapPropagator

	// Always include trace context and baggage
	propagators = append(propagators, propagation.TraceContext{}, propagation.Baggage{})

	// Add additional propagators based on configuration
	for _, propagatorName := range ts.config.Propagators {
		switch propagatorName {
		case "b3":
			propagators = append(propagators, propagation.Baggage{})
		case "jaeger":
			propagators = append(propagators, propagation.TraceContext{})
		case "xray":
			propagators = append(propagators, propagation.TraceContext{})
		case "tracecontext":
			propagators = append(propagators, propagation.TraceContext{})
		}
	}

	return propagation.NewCompositeTextMapPropagator(propagators...)
}

// GetTracer returns an OpenTelemetry tracer
func (ts *TracingService) GetTracer() trace.Tracer {
	if ts.tracerProvider == nil {
		return trace.NewNoopTracerProvider().Tracer("default")
	}
	return ts.tracerProvider.Tracer(ts.config.ServiceName)
}

// GetMeter returns an OpenTelemetry meter
func (ts *TracingService) GetMeter() metric.Meter {
	if ts.meterProvider == nil {
		return metric.NewNoopMeterProvider().Meter("default")
	}
	return ts.meterProvider.Meter(ts.config.ServiceName)
}

// ExtractTraceContext extracts trace context from HTTP headers
func (ts *TracingService) ExtractTraceContext(headers http.Header) TraceContext {
	ctx := ts.propagators.Extract(context.Background(), propagation.HeaderCarrier(headers))
	spanCtx := trace.SpanContextFromContext(ctx)

	correlationID := headers.Get("X-Correlation-ID")
	userID := headers.Get("X-User-ID")
	sessionID := headers.Get("X-Session-ID")
	requestID := headers.Get("X-Request-ID")

	// Extract baggage
	bag := baggage.FromContext(ctx)
	baggageMap := make(map[string]string)
	for _, member := range bag.Members() {
		baggageMap[member.Key()] = member.Value()
	}

	return TraceContext{
		TraceID:       spanCtx.TraceID().String(),
		SpanID:        spanCtx.SpanID().String(),
		IsSampled:     spanCtx.IsSampled(),
		Baggage:       baggageMap,
		CorrelationID: correlationID,
		UserID:        userID,
		SessionID:     sessionID,
		RequestID:     requestID,
	}
}

// InjectTraceContext injects trace context into HTTP headers
func (ts *TracingService) InjectTraceContext(ctx context.Context, headers http.Header) {
	ts.propagators.Inject(ctx, propagation.HeaderCarrier(headers))

	// Add additional headers
	if span := trace.SpanFromContext(ctx); span != nil {
		spanCtx := span.SpanContext()
		headers.Set("X-Trace-ID", spanCtx.TraceID().String())
		headers.Set("X-Span-ID", spanCtx.SpanID().String())
		headers.Set("X-Sampled", strconv.FormatBool(spanCtx.IsSampled()))
	}
}

// StartSpan starts a new span
func (ts *TracingService) StartSpan(ctx context.Context, opts SpanOptions) (context.Context, trace.Span) {
	if !ts.config.Enabled {
		return ctx, trace.NewNoopTracerProvider().Tracer("default").StartSpan(opts.Name)
	}

	tracer := ts.GetTracer()

	spanOpts := []trace.SpanStartOption{
		trace.WithAttributes(ts.convertAttributes(opts.Attributes)),
		trace.WithLinks(ts.convertLinks(opts.Links)...),
		trace.WithTimestamp(opts.StartTime),
	}

	if opts.Kind != trace.SpanKindUnspecified {
		spanOpts = append(spanOpts, trace.WithSpanKind(opts.Kind))
	}

	if opts.ForceSampling {
		spanOpts = append(spanOpts, trace.WithRecordTimestamp())
	}

	return tracer.Start(ctx, opts.Name, spanOpts...)
}

// FinishSpan finishes a span
func (ts *TracingService) FinishSpan(span trace.Span, opts ...trace.SpanEndOption) {
	if ts.config.Enabled && span != nil {
		span.End(opts...)
	}
}

// CreateCustomSpan creates a custom business span
func (ts *TracingService) CreateCustomSpan(ctx context.Context, opts SpanOptions) *CustomSpan {
	spanCtx := trace.SpanContextFromContext(ctx)

	customSpan := &CustomSpan{
		ID:        generateSpanID(),
		Name:      opts.Name,
		TraceID:   spanCtx.TraceID().String(),
		SpanID:    generateSpanID(),
		StartTime: time.Now(),
		Status:    "running",
		Attributes: make(map[string]interface{}),
		Events:    make([]SpanEvent, 0),
		Links:     make([]Link, 0),
		Tags:      make(map[string]string),
	}

	// Set attributes
	for k, v := range opts.Attributes {
		customSpan.Attributes[k] = v
	}

	// Set resource
	customSpan.Resource = &Resource{
		Service:     ts.config.ServiceName,
		Host:        ts.getHostname(),
		Environment: ts.config.Environment,
		Version:     ts.config.ServiceVersion,
	}

	// Add to custom spans map
	ts.mu.Lock()
	ts.customSpans[customSpan.ID] = customSpan
	ts.mu.Unlock()

	return customSpan
}

// FinishCustomSpan finishes a custom span
func (ts *TracingService) FinishCustomSpan(spanID string, status string) {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	if span, exists := ts.customSpans[spanID]; exists {
		endTime := time.Now()
		span.EndTime = &endTime
		span.Status = status
		duration := endTime.Sub(span.StartTime)
		span.Duration = &duration

		// Remove from active spans
		delete(ts.customSpans, spanID)

		// Export span
		ts.exportCustomSpan(span)
	}
}

// exportCustomSpan exports a custom span to the tracing backend
func (ts *TracingService) exportCustomSpan(span *CustomSpan) {
	// In a real implementation, this would send the span to Jaeger, OTLP, etc.
	if ts.config.Debug {
		fmt.Printf("Exporting custom span: %s (trace: %s, duration: %v)\n",
			span.Name, span.TraceID, span.Duration)
	}
}

// AddSpanEvent adds an event to a custom span
func (ts *TracingService) AddSpanEvent(spanID string, eventName string, attributes map[string]interface{}) {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	if span, exists := ts.customSpans[spanID]; exists {
		event := SpanEvent{
			Name:      eventName,
			Timestamp: time.Now(),
			Attributes: attributes,
		}
		span.Events = append(span.Events, event)
	}
}

// GetTraceID returns the trace ID from context
func (ts *TracingService) GetTraceID(ctx context.Context) string {
	spanCtx := trace.SpanContextFromContext(ctx)
	return spanCtx.TraceID().String()
}

// GetSpanID returns the span ID from context
func (ts *TracingService) GetSpanID(ctx context.Context) string {
	spanCtx := trace.SpanContextFromContext(ctx)
	return spanCtx.SpanID().String()
}

// IsSampled returns whether the current span is sampled
func (ts *TracingService) IsSampled(ctx context.Context) bool {
	spanCtx := trace.SpanContextFromContext(ctx)
	return spanCtx.IsSampled()
}

// GinMiddleware returns a Gin middleware for distributed tracing
func (ts *TracingService) GinMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !ts.config.Enabled {
			c.Next()
			return
		}

		// Extract trace context from headers
		traceCtx := ts.ExtractTraceContext(c.Request.Header)

		// Create context with baggage
		bag, _ := baggage.New(context.Background())
		for k, v := range traceCtx.Baggage {
			bag, _ = bag.SetMember(k, v)
		}

		// Create span options
		opts := SpanOptions{
			Name:   fmt.Sprintf("%s %s", c.Request.Method, c.Request.URL.Path),
			Kind:   trace.SpanKindServer,
			Attributes: map[string]string{
				"http.method":       c.Request.Method,
				"http.url":          c.Request.URL.String(),
				"http.scheme":       c.Request.URL.Scheme,
				"http.host":         c.Request.Host,
				"http.user_agent":   c.Request.UserAgent(),
				"http.client_ip":     c.ClientIP(),
				"http.request_id":    traceCtx.RequestID,
				"http.correlation_id": traceCtx.CorrelationID,
				"service.name":      ts.config.ServiceName,
				"service.version":   ts.config.ServiceVersion,
				"environment":       ts.config.Environment,
			},
		}

		if traceCtx.UserID != "" {
			opts.Attributes["user.id"] = traceCtx.UserID
		}
		if traceCtx.SessionID != "" {
			opts.Attributes["session.id"] = traceCtx.SessionID
		}

		// Start span
		ctx := ts.propagators.Extract(c.Request.Context(), propagation.HeaderCarrier(c.Request.Header))
		ctx, span := ts.StartSpan(ctx, opts)

		// Set span in context
		c.Request = c.Request.WithContext(ctx)

		// Inject trace context into response headers
		defer func() {
			// Set tracing headers in response
			c.Header("X-Trace-ID", ts.GetTraceID(ctx))
			c.Header("X-Span-ID", ts.GetSpanID(ctx))
			c.Header("X-Sampled", strconv.FormatBool(ts.IsSampled(ctx)))

			// Add request/response attributes
			span.SetAttributes(
				attribute.String("http.status_code", strconv.Itoa(c.Writer.Status())),
				attribute.Int("http.response_size", c.Writer.Size()),
				attribute.String("http.route", c.FullPath()),
			)

			// Add timing information
			startTime := span.StartTime()
			duration := time.Since(startTime)
			span.SetAttributes(
				attribute.Float64("http.duration_ms", float64(duration.Milliseconds())),
			)

			// Add business context if available
			if userID := c.GetString("user_id"); userID != "" {
				span.SetAttributes(attribute.String("user.id", userID))
			}
			if correlationID := c.GetString("correlation_id"); correlationID != "" {
				span.SetAttributes(attribute.String("correlation.id", correlationID))
			}

			// Finish span
			ts.FinishSpan(span)
		}()

		c.Next()
	}
}

// GinTracingMiddleware returns a simplified Gin middleware for basic tracing
func (ts *TracingService) GinTracingMiddleware() gin.HandlerFunc {
	return ts.GinMiddleware()
}

// Shutdown gracefully shuts down the tracing service
func (ts *TracingService) Shutdown() error {
	if ts.cancel != nil {
		ts.cancel()
	}

	if ts.tracerProvider != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return ts.tracerProvider.Shutdown(ctx)
	}

	return nil
}

// HealthCheck performs a health check on the tracing service
func (ts *TracingService) HealthCheck() error {
	if !ts.config.Enabled {
		return nil
	}

	if ts.tracerProvider == nil {
		return fmt.Errorf("tracer provider not initialized")
	}

	return nil
}

// Helper functions
func generateSpanID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%016x", time.Now().UnixNano())
	}
	return fmt.Sprintf("%x", b)
}

func (ts *TracingService) getHostname() string {
	hostname, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return hostname
}

func (ts *TracingService) getArchitecture() string {
	return runtime.GOARCH
}

func (ts *TracingService) getOSType() string {
	return runtime.GOOS
}

func (ts *TracingService) convertAttributes(attrs map[string]string) []attribute.KeyValue {
	result := make([]attribute.KeyValue, 0, len(attrs))
	for k, v := range attrs {
		result = append(result, attribute.String(k, v))
	}
	return result
}

func (ts *TracingService) convertLinks(links []Link) []trace.Link {
	result := make([]trace.Link, 0, len(links))
	for _, link := range links {
		traceID, _ := trace.TraceIDFromHex(link.TraceID)
		spanID, _ := span.SpanIDFromHex(link.SpanID)

		result = append(result, trace.Link{
			SpanContext: trace.NewSpanContext(trace.SpanContextConfig{
				TraceID:    traceID,
				SpanID:     spanID,
				TraceFlags: trace.FlagsSampled,
			}),
			Attributes: ts.convertAttributes(link.Attributes),
		})
	}
	return result
}

// NewDefaultTracingService creates a tracing service with default configuration
func NewDefaultTracingService() (*TracingService, error) {
	config := TracingConfig{
		Enabled:         true,
		ServiceName:     "quantumbeam-api",
		ServiceVersion:  "1.0.0",
		Environment:     "production",
		Sampler:         "parentbased_traceidratio",
		SamplerRatio:    0.1,
		JaegerEndpoint:  os.Getenv("JAEGER_ENDPOINT"),
		OTLPEndpoint:    os.Getenv("OTLP_ENDPOINT"),
		BatchTimeout:    5 * time.Second,
		MaxBatchSize:    512,
		ExportTimeout:   30 * time.Second,
		MetricsEnabled:  true,
		Debug:           false,
		Propagators:     []string{"tracecontext", "baggage"},
		ResourceLabels: map[string]string{
			"team":           "backend",
			"component":      "api",
			"application":    "quantumbeam",
		},
	}

	return NewTracingService(config)
}

// NewDevelopmentTracingService creates a tracing service optimized for development
func NewDevelopmentTracingService() (*TracingService, error) {
	config := TracingConfig{
		Enabled:         true,
		ServiceName:     "quantumbeam-api",
		ServiceVersion:  "1.0.0-dev",
		Environment:     "development",
		Sampler:         "always_on",
		SamplerRatio:    1.0,
		OTLPEndpoint:    "http://localhost:4317",
		BatchTimeout:    2 * time.Second,
		MaxBatchSize:    128,
		ExportTimeout:   10 * time.Second,
		MetricsEnabled:  true,
		Debug:           true,
		Propagators:     []string{"tracecontext", "baggage", "jaeger"},
		ResourceLabels: map[string]string{
			"environment":    "development",
			"team":           "backend",
		},
	}

	return NewTracingService(config)
}