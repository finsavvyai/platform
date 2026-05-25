package monitoring

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewLoggingService(t *testing.T) {
	config := LoggingConfig{
		ServiceName:          "test-service",
		Environment:          "test",
		LogLevel:             LevelInfo,
		EnableConsole:        true,
		EnableJSON:           false,
		EnableAuditLog:       true,
		EnableCorrelationIDs: true,
	}

	service, err := NewLoggingService(config)
	require.NoError(t, err)
	assert.NotNil(t, service)
	assert.Equal(t, config.ServiceName, service.config.ServiceName)
	assert.Equal(t, config.Environment, service.config.Environment)
	assert.NotNil(t, service.logger)
	assert.NotNil(t, service.auditLogger)
}

func TestNewLoggingService_DefaultValues(t *testing.T) {
	config := LoggingConfig{} // Empty config

	service, err := NewLoggingService(config)
	require.NoError(t, err)
	assert.Equal(t, "quantumbeam-api", service.config.ServiceName)
	assert.Equal(t, "development", service.config.Environment)
	assert.Equal(t, LevelInfo, service.config.LogLevel)
}

func TestLoggingService_LogLevels(t *testing.T) {
	// Capture log output
	var buf bytes.Buffer
	handler := slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})
	logger := slog.New(handler)

	config := LoggingConfig{
		ServiceName: "test",
		Environment: "test",
		LogLevel:    LevelDebug,
	}

	service, err := NewLoggingService(config)
	require.NoError(t, err)
	service.logger = logger

	// Test different log levels
	service.Debug("Debug message", map[string]interface{}{"key": "debug"})
	service.Info("Info message", map[string]interface{}{"key": "info"})
	service.Warn("Warning message", map[string]interface{}{"key": "warn"})
	service.Error("Error message", assert.AnError, map[string]interface{}{"key": "error"})

	// Parse JSON log output
	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	assert.Len(t, lines, 4)

	// Verify each log entry
	for i, line := range lines {
		var entry map[string]interface{}
		err := json.Unmarshal([]byte(line), &entry)
		require.NoError(t, err)

		assert.Equal(t, "test", entry["service"])
		assert.NotNil(t, entry["time"])
		assert.NotNil(t, entry["level"])

		switch i {
		case 0: // Debug
			assert.Equal(t, "Debug message", entry["msg"])
			assert.Equal(t, "debug", entry["key"])
		case 1: // Info
			assert.Equal(t, "Info message", entry["msg"])
			assert.Equal(t, "info", entry["key"])
		case 2: // Warn
			assert.Equal(t, "Warning message", entry["msg"])
			assert.Equal(t, "warn", entry["key"])
		case 3: // Error
			assert.Equal(t, "Error message", entry["msg"])
			assert.Equal(t, "error", entry["key"])
			assert.Contains(t, entry["error"], "assert.AnError general error for testing")
		}
	}
}

func TestLoggingService_CorrelationIDs(t *testing.T) {
	var buf bytes.Buffer
	handler := slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})
	logger := slog.New(handler)

	config := LoggingConfig{
		ServiceName: "test",
		Environment: "test",
	}

	service, err := NewLoggingService(config)
	require.NoError(t, err)
	service.logger = logger

	// Test with correlation ID
	correlationID := "test-correlation-id"
	ctx := service.WithCorrelationID(correlationID)

	ctx.Info("Test message with correlation ID")

	// Parse log output
	var entry map[string]interface{}
	err = json.Unmarshal(buf.Bytes(), &entry)
	require.NoError(t, err)

	assert.Equal(t, correlationID, entry["correlation_id"])
	assert.Equal(t, "Test message with correlation ID", entry["msg"])
}

func TestLoggingService_WithRequest(t *testing.T) {
	var buf bytes.Buffer
	handler := slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})
	logger := slog.New(handler)

	config := LoggingConfig{
		ServiceName: "test",
		Environment: "test",
	}

	service, err := NewLoggingService(config)
	require.NoError(t, err)
	service.logger = logger

	// Test with request context
	requestID := "req-123"
	userID := "user-456"
	ctx := service.WithRequest(requestID, userID)

	ctx.Info("Test message with request context")

	// Parse log output
	var entry map[string]interface{}
	err = json.Unmarshal(buf.Bytes(), &entry)
	require.NoError(t, err)

	assert.Equal(t, requestID, entry["request_id"])
	assert.Equal(t, userID, entry["user_id"])
	assert.Equal(t, "Test message with request context", entry["msg"])
}

func TestLoggingContext_WithMetadata(t *testing.T) {
	var buf bytes.Buffer
	handler := slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})
	logger := slog.New(handler)

	config := LoggingConfig{
		ServiceName: "test",
		Environment: "test",
	}

	service, err := NewLoggingService(config)
	require.NoError(t, err)
	service.logger = logger

	// Test context chaining
	ctx := service.WithCorrelationID("test-id").
		WithComponent("test-component").
		WithMetadata(map[string]interface{}{
			"custom_field": "custom_value",
			"number":       42,
		})

	ctx.Info("Test message with enhanced context")

	// Parse log output
	var entry map[string]interface{}
	err = json.Unmarshal(buf.Bytes(), &entry)
	require.NoError(t, err)

	assert.Equal(t, "test-id", entry["correlation_id"])
	assert.Equal(t, "test-component", entry["component"])
	assert.Equal(t, "custom_value", entry["custom_field"])
	assert.Equal(float64(42), entry["number"])
	assert.Equal(t, "Test message with enhanced context", entry["msg"])
}

func TestLoggingService_AuditLogging(t *testing.T) {
	var auditBuf bytes.Buffer
	var mainBuf bytes.Buffer

	auditHandler := slog.NewJSONHandler(&auditBuf, &slog.HandlerOptions{Level: slog.LevelDebug})
	mainHandler := slog.NewJSONHandler(&mainBuf, &slog.HandlerOptions{Level: slog.LevelDebug})

	config := LoggingConfig{
		ServiceName:    "test",
		Environment:    "test",
		EnableAuditLog: true,
	}

	service, err := NewLoggingService(config)
	require.NoError(t, err)
	service.logger = slog.New(mainHandler)
	service.auditLogger = slog.New(auditHandler)

	// Test audit logging
	userID := "test-user"
	service.Audit("User performed sensitive action", userID, map[string]interface{}{
		"action":   "data_export",
		"resource": "financial_records",
	})

	// Verify audit log was created
	var auditEntry map[string]interface{}
	err = json.Unmarshal(auditBuf.Bytes(), &auditEntry)
	require.NoError(t, err)

	assert.Equal(t, userID, auditEntry["user_id"])
	assert.Equal(t, "User performed sensitive action", auditEntry["msg"])
	assert.Equal(t, true, auditEntry["audit_event"])
	assert.Equal(t, "data_export", auditEntry["action"])
	assert.Equal(t, "financial_records", auditEntry["resource"])

	// Verify audit was not logged to main logger
	assert.Equal(t, 0, mainBuf.Len())
}

func TestLoggingContext_AuditLogging(t *testing.T) {
	var auditBuf bytes.Buffer
	auditHandler := slog.NewJSONHandler(&auditBuf, &slog.HandlerOptions{Level: slog.LevelDebug})

	config := LoggingConfig{
		ServiceName:    "test",
		Environment:    "test",
		EnableAuditLog: true,
	}

	service, err := NewLoggingService(config)
	require.NoError(t, err)
	service.auditLogger = slog.New(auditHandler)

	// Test audit logging with context
	ctx := service.WithCorrelationID("audit-123").WithComponent("billing")
	ctx.Audit("Billing action performed", map[string]interface{}{
		"action": "invoice_generated",
		"amount": 99.99,
	})

	// Parse audit log output
	var auditEntry map[string]interface{}
	err = json.Unmarshal(auditBuf.Bytes(), &auditEntry)
	require.NoError(t, err)

	assert.Equal(t, "audit-123", auditEntry["correlation_id"])
	assert.Equal(t, "billing", auditEntry["component"])
	assert.Equal(t, "Billing action performed", auditEntry["msg"])
	assert.Equal(t, true, auditEntry["audit_event"])
	assert.Equal(t, "invoice_generated", auditEntry["action"])
	assert.Equal(t, 99.99, auditEntry["amount"])
}

func TestLoggingService_ErrorHandling(t *testing.T) {
	var buf bytes.Buffer
	handler := slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})
	logger := slog.New(handler)

	config := LoggingConfig{
		ServiceName: "test",
		Environment: "development", // Should include stack traces
	}

	service, err := NewLoggingService(config)
	require.NoError(t, err)
	service.logger = logger

	// Test error logging with stack trace
	testErr := &testError{message: "test error"}
	service.Error("An error occurred", testErr, map[string]interface{}{
		"context": "error_handling_test",
	})

	// Parse log output
	var entry map[string]interface{}
	err = json.Unmarshal(buf.Bytes(), &entry)
	require.NoError(t, err)

	assert.Equal(t, "An error occurred", entry["msg"])
	assert.Equal(t, "test error", entry["error"])
	assert.Equal(t, "error_handling_test", entry["context"])
	assert.NotEmpty(t, entry["stack_trace"]) // Stack trace should be present in development
}

func TestLoggingService_JSONFormat(t *testing.T) {
	var buf bytes.Buffer
	handler := slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})

	config := LoggingConfig{
		ServiceName: "test-service",
		Environment: "production",
		EnableJSON:  true,
	}

	service, err := NewLoggingService(config)
	require.NoError(t, err)
	service.logger = handler

	service.Info("Production log message", map[string]interface{}{
		"user_id": 12345,
		"action":  "api_call",
	})

	// Parse JSON output
	var entry map[string]interface{}
	err = json.Unmarshal(buf.Bytes(), &entry)
	require.NoError(t, err)

	assert.Equal(t, "test-service", entry["service"])
	assert.Equal(t, "Production log message", entry["msg"])
	assert.Equal(float64(12345), entry["user_id"])
	assert.Equal(t, "api_call", entry["action"])
	assert.NotNil(t, entry["time"])
	assert.Equal(t, "INFO", entry["level"])
}

func TestGenerateCorrelationID(t *testing.T) {
	id1 := GenerateCorrelationID()
	id2 := GenerateCorrelationID()

	assert.NotEmpty(t, id1)
	assert.NotEmpty(t, id2)
	assert.NotEqual(t, id1, id2)
	assert.Len(t, id1, 36) // UUID length
	assert.Len(t, id2, 36)
}

func TestLoggingService_LoggerMiddleware(t *testing.T) {
	config := LoggingConfig{
		ServiceName: "test",
		Environment: "test",
	}

	service, err := NewLoggingService(config)
	require.NoError(t, err)

	// Create test handler
	var buf bytes.Buffer
	handler := slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})
	service.logger = handler

	// Create middleware
	middleware := service.LoggerMiddleware()

	// Create test handler that writes response
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Wrap with middleware
	wrappedHandler := middleware(testHandler)

	// Create test request
	req := httptest.NewRequest("GET", "/test/path?query=value", nil)
	req.Header.Set("User-Agent", "test-agent")
	req.Header.Set("X-Request-ID", "req-123")
	req.Header.Set("X-User-ID", "user-456")

	// Create response recorder
	rr := httptest.NewRecorder()

	// Serve request
	wrappedHandler.ServeHTTP(rr, req)

	// Verify response
	assert.Equal(t, http.StatusOK, rr.Code)
	assert.Equal(t, "OK", rr.Body.String())
	assert.Equal(t, "req-123", rr.Header().Get("X-Request-ID"))
	assert.NotEmpty(t, rr.Header().Get("X-Correlation-ID"))

	// Parse log output
	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	assert.GreaterOrEqual(t, len(lines), 1)

	// Find the request start log
	var requestLog map[string]interface{}
	for _, line := range lines {
		var entry map[string]interface{}
		err := json.Unmarshal([]byte(line), &entry)
		require.NoError(t, err)

		if entry["msg"] == "Request started" {
			requestLog = entry
			break
		}
	}

	assert.NotNil(t, requestLog)
	assert.Equal(t, "GET", requestLog["method"])
	assert.Equal(t, "/test/path", requestLog["path"])
	assert.Equal(t, "query=value", requestLog["query"])
	assert.Equal(t, "req-123", requestLog["request_id"])
	assert.Equal(t, "user-456", requestLog["user_id"])
	assert.Equal(t, "test-agent", requestLog["user_agent"])
}

func TestLoggingContext_ErrorMethods(t *testing.T) {
	var buf bytes.Buffer
	handler := slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})
	logger := slog.New(handler)

	config := LoggingConfig{
		ServiceName: "test",
		Environment: "test",
	}

	service, err := NewLoggingService(config)
	require.NoError(t, err)
	service.logger = logger

	ctx := service.WithCorrelationID("test-error").WithComponent("error_test")

	// Test error in context
	ctx.Error("Context error occurred", &testError{message: "context error"}, map[string]interface{}{
		"error_code": "CTX_ERR",
	})

	// Parse log output
	var entry map[string]interface{}
	err = json.Unmarshal(buf.Bytes(), &entry)
	require.NoError(t, err)

	assert.Equal(t, "Context error occurred", entry["msg"])
	assert.Equal(t, "context error", entry["error"])
	assert.Equal(t, "CTX_ERR", entry["error_code"])
	assert.Equal(t, "test-error", entry["correlation_id"])
	assert.Equal(t, "error_test", entry["component"])
}

func TestLoggingService_MultipleLoggers(t *testing.T) {
	// Test that both main and audit loggers work independently
	var mainBuf, auditBuf bytes.Buffer

	mainHandler := slog.NewJSONHandler(&mainBuf, &slog.HandlerOptions{Level: slog.LevelDebug})
	auditHandler := slog.NewJSONHandler(&auditBuf, &slog.HandlerOptions{Level: slog.LevelDebug})

	config := LoggingConfig{
		ServiceName:    "test",
		Environment:    "test",
		EnableAuditLog: true,
	}

	service, err := NewLoggingService(config)
	require.NoError(t, err)
	service.logger = slog.New(mainHandler)
	service.auditLogger = slog.New(auditHandler)

	// Regular logging
	service.Info("Regular log message")

	// Audit logging
	service.Audit("Audit log message", "user-123")

	// Verify both logs have content
	assert.Greater(t, mainBuf.Len(), 0)
	assert.Greater(t, auditBuf.Len(), 0)

	// Parse both logs
	var mainEntry, auditEntry map[string]interface{}
	err = json.Unmarshal(mainBuf.Bytes(), &mainEntry)
	require.NoError(t, err)
	err = json.Unmarshal(auditBuf.Bytes(), &auditEntry)
	require.NoError(t, err)

	assert.Equal(t, "Regular log message", mainEntry["msg"])
	assert.Equal(t, "Audit log message", auditEntry["msg"])
	assert.Equal(t, "user-123", auditEntry["user_id"])
	assert.Equal(t, true, auditEntry["audit_event"])
}

// Test error type for testing
type testError struct {
	message string
}

func (e *testError) Error() string {
	return e.message
}

// Benchmark tests
func BenchmarkLoggingService_InfoLog(b *testing.B) {
	var buf bytes.Buffer
	handler := slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelInfo})
	logger := slog.New(handler)

	config := LoggingConfig{ServiceName: "bench"}
	service, _ := NewLoggingService(config)
	service.logger = logger

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		service.Info("Benchmark log message", map[string]interface{}{
			"iteration": i,
			"data":      "test data",
		})
	}
}

func BenchmarkLoggingContext_InfoLog(b *testing.B) {
	var buf bytes.Buffer
	handler := slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelInfo})
	logger := slog.New(handler)

	config := LoggingConfig{ServiceName: "bench"}
	service, _ := NewLoggingService(config)
	service.logger = logger

	ctx := service.WithCorrelationID("bench-id").WithComponent("benchmark")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx.Info("Benchmark context log message", map[string]interface{}{
			"iteration": i,
		})
	}
}
