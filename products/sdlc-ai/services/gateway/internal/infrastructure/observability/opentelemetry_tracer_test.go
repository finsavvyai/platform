package observability

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

func TestNewTracerProvider(t *testing.T) {
	config := TracingConfig{
		Enabled:        true,
		ServiceName:    "test-service",
		ServiceVersion: "1.0.0",
		Environment:    "test",
		ExporterType:   "stdout",
		SamplingRate:   1.0,
	}

	tp, err := NewTracerProvider(config)
	require.NoError(t, err)
	assert.NotNil(t, tp)
	assert.Equal(t, "test-service", tp.config.ServiceName)
	assert.Equal(t, "1.0.0", tp.config.ServiceVersion)
	assert.Equal(t, "test", tp.config.Environment)
}

func TestNewTracerProviderDisabled(t *testing.T) {
	config := TracingConfig{
		Enabled: false,
	}

	tp, err := NewTracerProvider(config)
	require.NoError(t, err)
	assert.NotNil(t, tp)
	assert.Equal(t, false, tp.config.Enabled)
}

func TestNewTracerProviderDefaults(t *testing.T) {
	config := TracingConfig{
		Enabled:     true,
		ServiceName: "test",
	}

	tp, err := NewTracerProvider(config)
	require.NoError(t, err)
	assert.Equal(t, "test", tp.config.ServiceName)
	assert.Equal(t, "1.0.0", tp.config.ServiceVersion)
	assert.Equal(t, "development", tp.config.Environment)
	assert.Equal(t, 1.0, tp.config.SamplingRate)
	assert.Equal(t, 512, tp.config.BatchSize)
	assert.Equal(t, 5*time.Second, tp.config.BatchTimeout)
}

func TestTracerProviderGetTracer(t *testing.T) {
	config := TracingConfig{
		Enabled:      true,
		ServiceName:  "test-service",
		ExporterType: "stdout",
	}

	tp, err := NewTracerProvider(config)
	require.NoError(t, err)

	tracer := tp.GetTracer("test-component")
	assert.NotNil(t, tracer)
}

func TestTracerProviderStartSpan(t *testing.T) {
	config := TracingConfig{
		Enabled:      true,
		ServiceName:  "test-service",
		ExporterType: "stdout",
	}

	tp, err := NewTracerProvider(config)
	require.NoError(t, err)

	ctx, span := tp.StartSpan(context.Background(), "test-span")
	assert.NotNil(t, ctx)
	assert.NotNil(t, span)
	assert.True(t, span.IsRecording())

	span.End()
	assert.False(t, span.IsRecording())
}

func TestTracerProviderShutdown(t *testing.T) {
	config := TracingConfig{
		Enabled:      true,
		ServiceName:  "test-service",
		ExporterType: "stdout",
	}

	tp, err := NewTracerProvider(config)
	require.NoError(t, err)

	ctx := context.Background()
	err = tp.Shutdown(ctx)
	require.NoError(t, err)
}

func TestNewSpanHelper(t *testing.T) {
	config := TracingConfig{
		Enabled:      true,
		ServiceName:  "test-service",
		ExporterType: "stdout",
	}

	tp, err := NewTracerProvider(config)
	require.NoError(t, err)

	helper := NewSpanHelper(tp, "test-component")
	assert.NotNil(t, helper)
	assert.NotNil(t, helper.tracer)
}

func TestSpanHelperWithSpan(t *testing.T) {
	config := TracingConfig{
		Enabled:      true,
		ServiceName:  "test-service",
		ExporterType: "stdout",
	}

	tp, err := NewTracerProvider(config)
	require.NoError(t, err)

	helper := NewSpanHelper(tp, "test-component")

	err = helper.WithSpan(context.Background(), "test-operation", func(ctx context.Context) error {
		span := trace.SpanFromContext(ctx)
		assert.True(t, span.IsRecording())
		return nil
	})

	require.NoError(t, err)
}

func TestSpanHelperWithSpanError(t *testing.T) {
	config := TracingConfig{
		Enabled:      true,
		ServiceName:  "test-service",
		ExporterType: "stdout",
	}

	tp, err := NewTracerProvider(config)
	require.NoError(t, err)

	helper := NewSpanHelper(tp, "test-component")
	testErr := &TestError{Message: "test error"}

	err = helper.WithSpan(context.Background(), "test-operation", func(ctx context.Context) error {
		span := trace.SpanFromContext(ctx)
		assert.True(t, span.IsRecording())
		return testErr
	})

	assert.Error(t, err)
	assert.Equal(t, testErr, err)
}

func TestSpanHelperWithSpanValue(t *testing.T) {
	config := TracingConfig{
		Enabled:      true,
		ServiceName:  "test-service",
		ExporterType: "stdout",
	}

	tp, err := NewTracerProvider(config)
	require.NoError(t, err)

	helper := NewSpanHelper(tp, "test-component")

	result, err := helper.WithSpanValue(context.Background(), "test-operation", func(ctx context.Context) (string, error) {
		span := trace.SpanFromContext(ctx)
		assert.True(t, span.IsRecording())
		return "test-result", nil
	})

	require.NoError(t, err)
	assert.Equal(t, "test-result", result)
}

func TestTracerProviderTraceMiddleware(t *testing.T) {
	config := TracingConfig{
		Enabled:      true,
		ServiceName:  "test-service",
		ExporterType: "stdout",
	}

	tp, err := NewTracerProvider(config)
	require.NoError(t, err)

	// Create a test handler
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		span := trace.SpanFromContext(r.Context())
		assert.NotNil(t, span)
		assert.True(t, span.IsRecording())
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Wrap with tracing middleware
	tracedHandler := tp.TraceMiddleware(handler)

	// Create test request
	req := httptest.NewRequest("GET", "http://example.com/test", nil)
	req.Header.Set("User-Agent", "test-agent")
	req.Header.Set("X-Forwarded-For", "192.168.1.1")

	// Create response recorder
	rr := httptest.NewRecorder()

	// Serve request
	tracedHandler.ServeHTTP(rr, req)

	// Verify response
	assert.Equal(t, http.StatusOK, rr.Code)
	assert.Equal(t, "OK", rr.Body.String())
}

func TestTracerProviderTraceMiddlewareWithHeaders(t *testing.T) {
	config := TracingConfig{
		Enabled:      true,
		ServiceName:  "test-service",
		ExporterType: "stdout",
	}

	tp, err := NewTracerProvider(config)
	require.NoError(t, err)

	// Create a test handler that checks for trace context
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		span := trace.SpanFromContext(r.Context())
		assert.NotNil(t, span)

		// Check if span context is valid
		spanContext := span.SpanContext()
		assert.True(t, spanContext.IsValid())
		assert.True(t, spanContext.HasTraceID())
		assert.True(t, spanContext.HasSpanID())

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Wrap with tracing middleware
	tracedHandler := tp.TraceMiddleware(handler)

	// Create test request with trace headers
	req := httptest.NewRequest("GET", "http://example.com/test", nil)
	req.Header.Set("traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")
	req.Header.Set("User-Agent", "test-agent")

	// Create response recorder
	rr := httptest.NewRecorder()

	// Serve request
	tracedHandler.ServeHTTP(rr, req)

	// Verify response
	assert.Equal(t, http.StatusOK, rr.Code)
}

func TestResponseWriterTracing(t *testing.T) {
	// Create response writer
	rr := httptest.NewRecorder()
	rw := &responseWriterTracing{
		ResponseWriter: rr,
		statusCode:     http.StatusOK,
	}

	// Test WriteHeader
	rw.WriteHeader(http.StatusNotFound)
	assert.Equal(t, http.StatusNotFound, rw.statusCode)

	// Test Write
	n, err := rw.Write([]byte("test response"))
	require.NoError(t, err)
	assert.Equal(t, 12, n)

	// Verify response
	assert.Equal(t, http.StatusNotFound, rr.Code)
	assert.Equal(t, "test response", rr.Body.String())
}

func TestAddSpanAttributes(t *testing.T) {
	config := TracingConfig{
		Enabled:      true,
		ServiceName:  "test-service",
		ExporterType: "stdout",
	}

	tp, err := NewTracerProvider(config)
	require.NoError(t, err)

	ctx, span := tp.StartSpan(context.Background(), "test-span")
	defer span.End()

	// Add attributes
	AddSpanAttributes(ctx,
		attribute.String("test.string", "value"),
		attribute.Int("test.int", 42),
		attribute.Bool("test.bool", true),
	)

	// Attributes are added to the span
	assert.True(t, span.IsRecording())
}

func TestAddSpanEvent(t *testing.T) {
	config := TracingConfig{
		Enabled:      true,
		ServiceName:  "test-service",
		ExporterType: "stdout",
	}

	tp, err := NewTracerProvider(config)
	require.NoError(t, err)

	ctx, span := tp.StartSpan(context.Background(), "test-span")
	defer span.End()

	// Add event
	AddSpanEvent(ctx, "test-event",
		attribute.String("event.string", "value"),
		attribute.Int("event.int", 42),
	)

	// Event is added to the span
	assert.True(t, span.IsRecording())
}

func TestSetSpanError(t *testing.T) {
	config := TracingConfig{
		Enabled:      true,
		ServiceName:  "test-service",
		ExporterType: "stdout",
	}

	tp, err := NewTracerProvider(config)
	require.NoError(t, err)

	ctx, span := tp.StartSpan(context.Background(), "test-span")
	defer span.End()

	// Set error
	testErr := &TestError{Message: "test error"}
	SetSpanError(ctx, testErr)

	// Error is set on the span
	assert.True(t, span.IsRecording())
}

func TestSetSpanStatus(t *testing.T) {
	config := TracingConfig{
		Enabled:      true,
		ServiceName:  "test-service",
		ExporterType: "stdout",
	}

	tp, err := NewTracerProvider(config)
	require.NoError(t, err)

	ctx, span := tp.StartSpan(context.Background(), "test-span")
	defer span.End()

	// Set status
	SetSpanStatus(ctx, trace.StatusCodeOK, "success")

	assert.True(t, span.IsRecording())

	// Set error status
	SetSpanStatus(ctx, trace.StatusCodeError, "error occurred")

	assert.True(t, span.IsRecording())
}

func TestCreateExporters(t *testing.T) {
	testCases := []struct {
		name      string
		exporter  string
		expectErr bool
	}{
		{
			name:      "stdout exporter",
			exporter:  "stdout",
			expectErr: false,
		},
		{
			name:      "jaeger exporter - invalid endpoint",
			exporter:  "jaeger",
			expectErr: true,
		},
		{
			name:      "zipkin exporter - invalid endpoint",
			exporter:  "zipkin",
			expectErr: true,
		},
		{
			name:      "otlp exporter - invalid endpoint",
			exporter:  "otlp",
			expectErr: true,
		},
		{
			name:      "unknown exporter defaults to stdout",
			exporter:  "unknown",
			expectErr: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			config := TracingConfig{
				Enabled:      true,
				ServiceName:  "test-service",
				ExporterType: tc.exporter,
			}

			if tc.exporter == "jaeger" {
				config.JaegerEndpoint = "http://invalid:1234"
			} else if tc.exporter == "zipkin" {
				config.ZipkinEndpoint = "http://invalid:1234"
			} else if tc.exporter == "otlp" {
				config.OTLPEndpoint = "invalid:1234"
			}

			tp, err := NewTracerProvider(config)
			if tc.expectErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, tp)
			}
		})
	}
}

func TestGetHostname(t *testing.T) {
	hostname := getHostname()
	assert.NotEmpty(t, hostname)
}

func TestGetClientIP(t *testing.T) {
	testCases := []struct {
		name       string
		headers    map[string]string
		remoteAddr string
		expected   string
	}{
		{
			name: "X-Forwarded-For header",
			headers: map[string]string{
				"X-Forwarded-For": "192.168.1.1, 10.0.0.1",
			},
			remoteAddr: "127.0.0.1:12345",
			expected:   "192.168.1.1",
		},
		{
			name: "X-Real-IP header",
			headers: map[string]string{
				"X-Real-IP": "192.168.1.2",
			},
			remoteAddr: "127.0.0.1:12345",
			expected:   "192.168.1.2",
		},
		{
			name:       "Remote address only",
			headers:    map[string]string{},
			remoteAddr: "192.168.1.3:12345",
			expected:   "192.168.1.3",
		},
		{
			name:       "Remote address without port",
			headers:    map[string]string{},
			remoteAddr: "192.168.1.4",
			expected:   "192.168.1.4",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "http://example.com", nil)
			req.RemoteAddr = tc.remoteAddr

			for k, v := range tc.headers {
				req.Header.Set(k, v)
			}

			ip := getClientIP(req)
			assert.Equal(t, tc.expected, ip)
		})
	}
}

func TestSpanAttributes(t *testing.T) {
	// Test that predefined attributes are correct
	assert.Equal(t, attribute.Key("http.method"), HTTPMethod)
	assert.Equal(t, attribute.Key("http.url"), HTTPURL)
	assert.Equal(t, attribute.Key("http.status_code"), HTTPStatusCode)
	assert.Equal(t, attribute.Key("http.user_agent"), HTTPUserAgent)
	assert.Equal(t, attribute.Key("http.target"), HTTPTarget)
	assert.Equal(t, attribute.Key("http.scheme"), HTTPScheme)
	assert.Equal(t, attribute.Key("http.host"), HTTPHost)
	assert.Equal(t, attribute.Key("http.flavor"), HTTPFlavor)
	assert.Equal(t, attribute.Key("http.client_ip"), HTTPClientIP)

	assert.Equal(t, attribute.Key("db.system"), DBSystem)
	assert.Equal(t, attribute.Key("db.name"), DBName)
	assert.Equal(t, attribute.Key("db.statement"), DBStatement)
	assert.Equal(t, attribute.Key("db.operation"), DBOperation)

	assert.Equal(t, attribute.Key("rpc.system"), RPCSystem)
	assert.Equal(t, attribute.Key("rpc.service"), RPCService)
	assert.Equal(t, attribute.Key("rpc.method"), RPCMethod)

	assert.Equal(t, attribute.Key("messaging.system"), MessagingSystem)
	assert.Equal(t, attribute.Key("messaging.destination"), MessagingDestination)
	assert.Equal(t, attribute.Key("messaging.destination_kind"), MessagingDestinationKind)

	assert.Equal(t, attribute.Key("app.component"), AppComponent)
	assert.Equal(t, attribute.Key("app.operation"), AppOperation)
	assert.Equal(t, attribute.Key("tenant.id"), TenantID)
	assert.Equal(t, attribute.Key("user.id"), UserID)
	assert.Equal(t, attribute.Key("request.id"), RequestID)
	assert.Equal(t, attribute.Key("correlation.id"), CorrelationID)
}

// Test helpers

type TestError struct {
	Message string
}

func (e *TestError) Error() string {
	return e.Message
}

// Benchmark tests

func BenchmarkTracerProviderStartSpan(b *testing.B) {
	config := TracingConfig{
		Enabled:      true,
		ServiceName:  "test-service",
		ExporterType: "stdout",
	}

	tp, _ := NewTracerProvider(config)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx, span := tp.StartSpan(context.Background(), "test-span")
		span.End()
		_ = ctx
	}
}

func BenchmarkSpanHelperWithSpan(b *testing.B) {
	config := TracingConfig{
		Enabled:      true,
		ServiceName:  "test-service",
		ExporterType: "stdout",
	}

	tp, _ := NewTracerProvider(config)
	helper := NewSpanHelper(tp, "test-component")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = helper.WithSpan(context.Background(), "test-operation", func(ctx context.Context) error {
			return nil
		})
	}
}

func BenchmarkAddSpanAttributes(b *testing.B) {
	config := TracingConfig{
		Enabled:      true,
		ServiceName:  "test-service",
		ExporterType: "stdout",
	}

	tp, _ := NewTracerProvider(config)
	ctx, span := tp.StartSpan(context.Background(), "test-span")
	defer span.End()

	attrs := []attribute.KeyValue{
		attribute.String("test.string", "value"),
		attribute.Int("test.int", 42),
		attribute.Bool("test.bool", true),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		AddSpanAttributes(ctx, attrs...)
	}
}
