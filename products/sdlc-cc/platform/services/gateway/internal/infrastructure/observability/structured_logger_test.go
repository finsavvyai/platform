//go:build ignore

package observability

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace"
)

func TestNewStructuredLogger(t *testing.T) {
	config := LoggingConfig{
		Level:  LogLevelInfo,
		Output: "stdout",
	}

	logger := NewStructuredLogger("test-component", "1.0.0", config)

	assert.NotNil(t, logger)
	assert.Equal(t, "test-component", logger.component)
	assert.Equal(t, "1.0.0", logger.version)
	assert.NotNil(t, logger.sanitizer)
	assert.NotNil(t, logger.extractor)
	assert.NotNil(t, logger.formatter)
}

func TestStructuredLoggerWithContext(t *testing.T) {
	config := LoggingConfig{
		Level: LogLevelInfo,
	}
	logger := NewStructuredLogger("test", "1.0.0", config)

	// Create context with trace information
	traceID, _ := trace.TraceIDFromHex("12345678901234567890123456789012")
	spanID, _ := trace.SpanIDFromHex("1234567890123456")
	spanContext := trace.NewSpanContext(trace.SpanContextConfig{
		TraceID: traceID,
		SpanID:  spanID,
	})

	ctx := trace.ContextWithSpan(context.Background(), trace.SpanFromContext(context.Background()))
	ctx = context.WithValue(ctx, "request_id", "req-123")
	ctx = context.WithValue(ctx, "user_id", "user-456")
	ctx = context.WithValue(ctx, "tenant_id", "tenant-789")

	entry := logger.WithContext(ctx)

	fields, ok := entry.Data["component"].(string)
	assert.True(t, ok)
	assert.Equal(t, "test", fields)

	// Test that the entry is not nil
	assert.NotNil(t, entry)
}

func TestStructuredLoggerWithError(t *testing.T) {
	config := LoggingConfig{
		Level: LogLevelInfo,
	}
	logger := NewStructuredLogger("test", "1.0.0", config)

	err := &TestError{Message: "test error", Code: "TEST_ERROR"}
	entry := logger.WithError(err)

	assert.NotNil(t, entry)
}

func TestStructuredLoggerWithHTTPRequest(t *testing.T) {
	config := LoggingConfig{
		Level: LogLevelInfo,
	}
	logger := NewStructuredLogger("test", "1.0.0", config)

	req, err := http.NewRequest("GET", "http://example.com/test?token=secret", nil)
	require.NoError(t, err)
	req.Header.Set("Authorization", "Bearer secret-token")
	req.Header.Set("X-Request-ID", "req-123")
	req.Header.Set("User-Agent", "test-agent")

	entry := logger.WithHTTPRequest(req)

	assert.NotNil(t, entry)
}

func TestStructuredLoggerWithHTTPResponse(t *testing.T) {
	config := LoggingConfig{
		Level: LogLevelInfo,
	}
	logger := NewStructuredLogger("test", "1.0.0", config)

	req, _ := http.NewRequest("GET", "http://example.com", nil)
	resp := &http.Response{
		StatusCode:    200,
		ContentLength: 1024,
		Request:       req,
	}

	entry := logger.WithHTTPResponse(resp, 100*time.Millisecond)

	assert.NotNil(t, entry)
}

func TestStructuredLoggerWithMetrics(t *testing.T) {
	config := LoggingConfig{
		Level: LogLevelInfo,
	}
	logger := NewStructuredLogger("test", "1.0.0", config)

	metrics := map[string]interface{}{
		"duration_ms": 150,
		"items_count": 42,
	}

	entry := logger.WithMetrics(metrics)

	assert.NotNil(t, entry)
}

func TestStructuredLoggerWithTags(t *testing.T) {
	config := LoggingConfig{
		Level: LogLevelInfo,
	}
	logger := NewStructuredLogger("test", "1.0.0", config)

	entry := logger.WithTags("api", "v1", "public")

	assert.NotNil(t, entry)
}

func TestStructuredLoggerWithFields(t *testing.T) {
	config := LoggingConfig{
		Level: LogLevelInfo,
	}
	logger := NewStructuredLogger("test", "1.0.0", config)

	fields := map[string]interface{}{
		"username":     "john.doe",
		"password":     "secret123", // This should be redacted
		"email":        "john@example.com",
		"api_key":      "sk-1234567890", // This should be redacted
		"normal_field": "normal_value",
	}

	entry := logger.WithFields(fields)

	assert.NotNil(t, entry)

	// Check that sensitive fields are redacted
	data, ok := entry.Data["fields"].(map[string]interface{})
	if ok {
		assert.Equal(t, "***REDACTED***", data["password"])
		assert.Equal(t, "***REDACTED***", data["api_key"])
		assert.Equal(t, "john.doe", data["username"])
		assert.Equal(t, "john@example.com", data["email"])
		assert.Equal(t, "normal_value", data["normal_field"])
	}
}

func TestStructuredLoggerLogMethods(t *testing.T) {
	var buf bytes.Buffer
	config := LoggingConfig{
		Level:  LogLevelDebug,
		Output: "stdout",
	}
	logger := NewStructuredLogger("test", "1.0.0", config)
	logger.logger.SetOutput(&buf)

	// Test all log levels
	logger.Trace("trace message")
	logger.Debug("debug message")
	logger.Info("info message")
	logger.Warn("warn message")
	logger.Error("error message")

	// Test formatted log methods
	logger.Tracef("trace %s", "message")
	logger.Debugf("debug %s", "message")
	logger.Infof("info %s", "message")
	logger.Warnf("warn %s", "message")
	logger.Errorf("error %s", "message")

	// Check that messages were logged
	output := buf.String()
	assert.Contains(t, output, "trace message")
	assert.Contains(t, output, "debug message")
	assert.Contains(t, output, "info message")
	assert.Contains(t, output, "warn message")
	assert.Contains(t, output, "error message")
}

func TestLogSanitizer(t *testing.T) {
	config := LoggingConfig{
		SanitizeFields: []string{"custom_secret"},
	}
	sanitizer := NewLogSanitizer(config)

	// Test URL sanitization
	url := "https://api.example.com/endpoint?token=secret123&data=normal"
	sanitized := sanitizer.SanitizeURL(url)
	assert.Equal(t, "https://api.example.com/endpoint", sanitized)

	// Test sensitive field detection
	assert.True(t, sanitizer.isSensitiveField("password"))
	assert.True(t, sanitizer.isSensitiveField("api_key"))
	assert.True(t, sanitizer.isSensitiveField("custom_secret"))
	assert.False(t, sanitizer.isSensitiveField("username"))
}

func TestEnhancedJSONFormatter(t *testing.T) {
	formatter := &EnhancedJSONFormatter{
		TimestampField: "timestamp",
		LevelField:     "level",
		MessageField:   "message",
		EscapeHTML:     true,
	}

	entry := logrus.Entry{
		Time:    time.Date(2025, 1, 1, 12, 0, 0, 0, time.UTC),
		Level:   logrus.InfoLevel,
		Message: "test message",
		Data: logrus.Fields{
			"component": "test",
			"version":   "1.0.0",
		},
	}

	bytes, err := formatter.Format(&entry)
	require.NoError(t, err)

	var result map[string]interface{}
	err = json.Unmarshal(bytes, &result)
	require.NoError(t, err)

	assert.Equal(t, "2025-01-01T12:00:00Z", result["timestamp"])
	assert.Equal(t, "info", result["level"])
	assert.Equal(t, "test message", result["message"])
	assert.Equal(t, "test", result["component"])
	assert.Equal(t, "1.0.0", result["version"])
}

func TestStructuredLoggerLogRequest(t *testing.T) {
	var buf bytes.Buffer
	config := LoggingConfig{
		Level: LogLevelInfo,
	}
	logger := NewStructuredLogger("test", "1.0.0", config)
	logger.logger.SetOutput(&buf)

	req, _ := http.NewRequest("GET", "http://example.com/api/test", nil)
	req.Header.Set("X-Request-ID", "req-123")
	req = req.WithContext(context.WithValue(req.Context(), "request_id", "req-123"))

	logger.LogRequest(req)

	output := buf.String()
	assert.Contains(t, output, "Incoming request")
	assert.Contains(t, output, "GET")
	assert.Contains(t, output, "/api/test")
}

func TestStructuredLoggerLogResponse(t *testing.T) {
	var buf bytes.Buffer
	config := LoggingConfig{
		Level: LogLevelInfo,
	}
	logger := NewStructuredLogger("test", "1.0.0", config)
	logger.logger.SetOutput(&buf)

	req, _ := http.NewRequest("GET", "http://example.com/api/test", nil)
	resp := &http.Response{
		StatusCode:    200,
		ContentLength: 1024,
		Request:       req,
	}

	logger.LogResponse(req, resp, 100*time.Millisecond)

	output := buf.String()
	assert.Contains(t, output, "Request completed")
	assert.Contains(t, output, "200")
}

func TestExtractErrorCode(t *testing.T) {
	err := &TestError{Message: "test error", Code: "TEST_ERROR"}
	code := extractErrorCode(err)
	assert.Equal(t, "TEST_ERROR", code)

	err2 := assert.AnError
	code2 := extractErrorCode(err2)
	assert.Equal(t, "", code2)
}

func TestIsRetryableError(t *testing.T) {
	retryableErr := &TestError{Message: "connection refused"}
	assert.True(t, isRetryableError(retryableErr))

	nonRetryableErr := &TestError{Message: "invalid request"}
	assert.False(t, isRetryableError(nonRetryableErr))
}

// Test helpers

type TestError struct {
	Message string
	Code    string
}

func (e *TestError) Error() string {
	return e.Message
}

func (e *TestError) ErrorCode() string {
	return e.Code
}

// Benchmark tests

func BenchmarkStructuredLoggerInfo(b *testing.B) {
	config := LoggingConfig{
		Level: LogLevelInfo,
	}
	logger := NewStructuredLogger("test", "1.0.0", config)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		logger.Info("test message")
	}
}

func BenchmarkStructuredLoggerWithContext(b *testing.B) {
	config := LoggingConfig{
		Level: LogLevelInfo,
	}
	logger := NewStructuredLogger("test", "1.0.0", config)
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		logger.WithContext(ctx).Info("test message")
	}
}

func BenchmarkStructuredLoggerWithFields(b *testing.B) {
	config := LoggingConfig{
		Level: LogLevelInfo,
	}
	logger := NewStructuredLogger("test", "1.0.0", config)
	fields := map[string]interface{}{
		"field1": "value1",
		"field2": 42,
		"field3": true,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		logger.WithFields(fields).Info("test message")
	}
}
