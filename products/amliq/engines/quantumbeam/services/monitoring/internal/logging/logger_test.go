package logging

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewLogger(t *testing.T) {
	config := &Config{
		Service:     "test-service",
		Version:     "1.0.0",
		Environment: "test",
		Level:       LevelInfo,
		Format:      "json",
		Output:      "stdout",
		EnableAudit: true,
	}

	logger := NewLogger(config)
	assert.NotNil(t, logger)
	assert.Equal(t, config, logger.config)
	assert.NotNil(t, logger.logrus)
}

func TestNewLoggerWithNilConfig(t *testing.T) {
	logger := NewLogger(nil)
	assert.NotNil(t, logger)
	assert.Equal(t, "quantumbeam-api", logger.config.Service)
	assert.Equal(t, LevelInfo, logger.config.Level)
}

func TestLoggerLevels(t *testing.T) {
	logger := NewLogger(&Config{
		Service:     "test",
		Version:     "1.0.0",
		Environment: "test",
		Level:       LevelDebug,
		Format:      "json",
		Output:      "stdout",
	})

	ctx := context.Background()

	// These should not panic
	logger.Trace(ctx, "trace message")
	logger.Debug(ctx, "debug message")
	logger.Info(ctx, "info message")
	logger.Warn(ctx, "warn message")
	logger.Error(ctx, "error message", nil)
}

func TestLoggerWithContext(t *testing.T) {
	logger := NewLogger(&Config{
		Service:     "test",
		Version:     "1.0.0",
		Environment: "test",
		Level:       LevelInfo,
		Format:      "json",
		Output:      "stdout",
	})

	// Add context values
	ctx := context.Background()
	ctx = WithCorrelationID(ctx, "corr-123")
	ctx = WithUserID(ctx, "user-456")
	ctx = WithRequestID(ctx, "req-789")

	// Test that context values are preserved
	loggerWithContext := logger.WithContext(ctx)
	assert.NotNil(t, loggerWithContext)
}

func TestContextEnrichment(t *testing.T) {
	logger := NewLogger(&Config{
		Service:     "test",
		Version:     "1.0.0",
		Environment: "test",
		Level:       LevelInfo,
		Format:      "json",
		Output:      "stdout",
	})

	ctx := context.Background()
	ctx = WithCorrelationID(ctx, "corr-123")
	ctx = WithUserID(ctx, "user-456")
	ctx = WithRequestID(ctx, "req-789")
	ctx = WithSessionID(ctx, "sess-000")

	// Create a log entry and check if context is enriched
	entry := logger.createLogEntry(LevelInfo, "test message")
	logger.enrichFromContext(ctx, entry)

	assert.Equal(t, "corr-123", entry.CorrelationID)
	assert.Equal(t, "user-456", entry.UserID)
	assert.Equal(t, "req-789", entry.RequestID)
	assert.Equal(t, "sess-000", entry.SessionID)
}

func TestAuditLogging(t *testing.T) {
	logger := NewLogger(&Config{
		Service:     "test",
		Version:     "1.0.0",
		Environment: "test",
		Level:       LevelInfo,
		Format:      "json",
		Output:      "stdout",
		EnableAudit: true,
	})

	ctx := context.Background()
	changes := map[string]interface{}{
		"status": "active",
		"plan":   "professional",
	}

	// Should not panic
	logger.Audit(ctx, "user_update", "user", "user-123", "admin-456", true, changes)

	// Test with disabled audit logging
	logger.config.EnableAudit = false
	logger.Audit(ctx, "user_update", "user", "user-123", "admin-456", true, changes)
}

func TestSecurityLogging(t *testing.T) {
	logger := NewLogger(&Config{
		Service:     "test",
		Version:     "1.0.0",
		Environment: "test",
		Level:       LevelInfo,
		Format:      "json",
		Output:      "stdout",
	})

	ctx := context.Background()
	details := map[string]interface{}{
		"failed_attempts": 5,
		"source_country": "US",
	}

	// Should not panic
	logger.Security(ctx, "login_failure", "high", "192.168.1.1", "user-123", "auth", "login", "failed", 0.8, details)
}

func TestPerformanceLogging(t *testing.T) {
	logger := NewLogger(&Config{
		Service:     "test",
		Version:     "1.0.0",
		Environment: "test",
		Level:       LevelInfo,
		Format:      "json",
		Output:      "stdout",
	})

	ctx := context.Background()
	duration := 150 * time.Millisecond
	metrics := map[string]interface{}{
		"throughput": 1000.0,
		"memory_mb":  256.0,
	}

	// Should not panic
	logger.Performance(ctx, "fraud_detection", duration, metrics)
}

func TestBusinessLogging(t *testing.T) {
	logger := NewLogger(&Config{
		Service:     "test",
		Version:     "1.0.0",
		Environment: "test",
		Level:       LevelInfo,
		Format:      "json",
		Output:      "stdout",
	})

	ctx := context.Background()
	details := map[string]interface{}{
		"payment_method": "credit_card",
		"merchant_id":    "merch-123",
	}

	// Should not panic
	logger.Business(ctx, "transaction_processed", "txn-123", "user-456", "professional", 250.00, "USD", "fraud_detection", true, details)
}

func TestErrorLogging(t *testing.T) {
	logger := NewLogger(&Config{
		Service:     "test",
		Version:     "1.0.0",
		Environment: "test",
		Level:       LevelInfo,
		Format:      "json",
		Output:      "stdout",
	})

	ctx := context.Background()
	testErr := &TestError{Message: "test error"}

	// Should not panic
	logger.Error(ctx, "something went wrong", testErr)
}

func TestLogEntryCreation(t *testing.T) {
	logger := NewLogger(&Config{
		Service:     "test",
		Version:     "1.0.0",
		Environment: "test",
		Level:       LevelInfo,
		Format:      "json",
		Output:      "stdout",
	})

	entry := logger.createLogEntry(LevelInfo, "test message")

	assert.Equal(t, LevelInfo, entry.Level)
	assert.Equal(t, "test message", entry.Message)
	assert.Equal(t, "test", entry.Service)
	assert.Equal(t, "1.0.0", entry.Version)
	assert.Equal(t, "test", entry.Environment)
	assert.NotNil(t, entry.Metadata)
	assert.False(t, entry.Timestamp.IsZero())
}

func TestLogEntryWithMetadata(t *testing.T) {
	logger := NewLogger(&Config{
		Service:     "test",
		Version:     "1.0.0",
		Environment: "test",
		Level:       LevelInfo,
		Format:      "json",
		Output:      "stdout",
	})

	ctx := context.Background()
	metadata1 := map[string]interface{}{
		"key1": "value1",
		"number": 42,
	}
	metadata2 := map[string]interface{}{
		"key2": "value2",
		"boolean": true,
	}

	// Should not panic
	logger.Info(ctx, "test message", metadata1, metadata2)
}

func TestContextHelpers(t *testing.T) {
	ctx := context.Background()

	// Test context helpers
	ctx = WithCorrelationID(ctx, "corr-123")
	assert.Equal(t, "corr-123", ctx.Value(CorrelationIDKey))

	ctx = WithUserID(ctx, "user-456")
	assert.Equal(t, "user-456", ctx.Value(UserIDKey))

	ctx = WithRequestID(ctx, "req-789")
	assert.Equal(t, "req-789", ctx.Value(RequestIDKey))

	ctx = WithSessionID(ctx, "sess-000")
	assert.Equal(t, "sess-000", ctx.Value(SessionIDKey))
}

func TestGenerateIDs(t *testing.T) {
	corrID := GenerateCorrelationID()
	assert.NotEmpty(t, corrID)
	assert.NotEqual(t, corrID, GenerateCorrelationID())

	reqID := GenerateRequestID()
	assert.NotEmpty(t, reqID)
	assert.NotEqual(t, reqID, GenerateRequestID())
}

func TestLogEntrySerialization(t *testing.T) {
	entry := &LogEntry{
		Timestamp:    time.Now().UTC(),
		Level:        LevelInfo,
		Message:      "test message",
		CorrelationID: "corr-123",
		UserID:       "user-456",
		RequestID:    "req-789",
		Service:      "test-service",
		Version:      "1.0.0",
		Environment:  "test",
		Component:    "test-component",
		Function:     "testFunction",
		File:         "test.go",
		Line:         123,
		Metadata: map[string]interface{}{
			"key1": "value1",
			"number": 42,
		},
	}

	// Test JSON serialization
	data, err := json.Marshal(entry)
	require.NoError(t, err)
	require.NotEmpty(t, data)

	// Test JSON deserialization
	var parsedEntry LogEntry
	err = json.Unmarshal(data, &parsedEntry)
	require.NoError(t, err)

	assert.Equal(t, entry.Level, parsedEntry.Level)
	assert.Equal(t, entry.Message, parsedEntry.Message)
	assert.Equal(t, entry.CorrelationID, parsedEntry.CorrelationID)
	assert.Equal(t, entry.UserID, parsedEntry.UserID)
	assert.Equal(t, entry.RequestID, parsedEntry.RequestID)
	assert.Equal(t, entry.Service, parsedEntry.Service)
	assert.Equal(t, entry.Version, parsedEntry.Version)
	assert.Equal(t, entry.Environment, parsedEntry.Environment)
}

func TestAuditInfoSerialization(t *testing.T) {
	auditInfo := &AuditInfo{
		Action:     "user_update",
		Resource:   "user",
		ResourceID: "user-123",
		UserID:     "admin-456",
		Success:    true,
		Changes: map[string]interface{}{
			"status": "active",
			"plan":   "professional",
		},
		Compliance:    []string{"SOX", "GDPR"},
		RetentionDays: 2555,
	}

	data, err := json.Marshal(auditInfo)
	require.NoError(t, err)

	var parsedAudit AuditInfo
	err = json.Unmarshal(data, &parsedAudit)
	require.NoError(t, err)

	assert.Equal(t, auditInfo.Action, parsedAudit.Action)
	assert.Equal(t, auditInfo.Resource, parsedAudit.Resource)
	assert.Equal(t, auditInfo.ResourceID, parsedAudit.ResourceID)
	assert.Equal(t, auditInfo.UserID, parsedAudit.UserID)
	assert.Equal(t, auditInfo.Success, parsedAudit.Success)
	assert.Equal(t, auditInfo.Compliance, parsedAudit.Compliance)
	assert.Equal(t, auditInfo.RetentionDays, parsedAudit.RetentionDays)
}

func TestSecurityInfoSerialization(t *testing.T) {
	securityInfo := &SecurityInfo{
		EventType:      "login_failure",
		ThreatLevel:    "high",
		SourceIP:       "192.168.1.1",
		UserID:         "user-123",
		Resource:       "auth",
		Action:         "login",
		Result:         "failed",
		RiskScore:      0.85,
		MitreTechnique: "T1110.001",
		Details: map[string]interface{}{
			"failed_attempts": 5,
			"source_country": "US",
		},
	}

	data, err := json.Marshal(securityInfo)
	require.NoError(t, err)

	var parsedSecurity SecurityInfo
	err = json.Unmarshal(data, &parsedSecurity)
	require.NoError(t, err)

	assert.Equal(t, securityInfo.EventType, parsedSecurity.EventType)
	assert.Equal(t, securityInfo.ThreatLevel, parsedSecurity.ThreatLevel)
	assert.Equal(t, securityInfo.SourceIP, parsedSecurity.SourceIP)
	assert.Equal(t, securityInfo.UserID, parsedSecurity.UserID)
	assert.Equal(t, securityInfo.Resource, parsedSecurity.Resource)
	assert.Equal(t, securityInfo.Action, parsedSecurity.Action)
	assert.Equal(t, securityInfo.Result, parsedSecurity.Result)
	assert.Equal(t, securityInfo.RiskScore, parsedSecurity.RiskScore)
	assert.Equal(t, securityInfo.MitreTechnique, parsedSecurity.MitreTechnique)
}

func TestPerformanceInfoSerialization(t *testing.T) {
	perfInfo := &PerformanceInfo{
		Operation:  "fraud_detection",
		Duration:   150 * time.Millisecond,
		Throughput: 1000.0,
		MemoryUsage: 256 * 1024 * 1024, // 256MB
		CPUUsage:   45.5,
		Metrics: map[string]interface{}{
			"cache_hit_rate": 0.95,
			"queue_size":     10,
		},
	}

	data, err := json.Marshal(perfInfo)
	require.NoError(t, err)

	var parsedPerf PerformanceInfo
	err = json.Unmarshal(data, &parsedPerf)
	require.NoError(t, err)

	assert.Equal(t, perfInfo.Operation, parsedPerf.Operation)
	assert.Equal(t, perfInfo.Duration, parsedPerf.Duration)
	assert.Equal(t, perfInfo.Throughput, parsedPerf.Throughput)
	assert.Equal(t, perfInfo.MemoryUsage, parsedPerf.MemoryUsage)
	assert.Equal(t, perfInfo.CPUUsage, parsedPerf.CPUUsage)
}

func TestBusinessInfoSerialization(t *testing.T) {
	businessInfo := &BusinessInfo{
		EventType:     "transaction_processed",
		TransactionID: "txn-123",
		UserID:        "user-456",
		Plan:          "professional",
		Amount:        250.00,
		Currency:      "USD",
		Product:       "fraud_detection",
		Region:        "us-east-1",
		Success:       true,
		Details: map[string]interface{}{
			"payment_method": "credit_card",
			"merchant_id":    "merch-123",
		},
	}

	data, err := json.Marshal(businessInfo)
	require.NoError(t, err)

	var parsedBusiness BusinessInfo
	err = json.Unmarshal(data, &parsedBusiness)
	require.NoError(t, err)

	assert.Equal(t, businessInfo.EventType, parsedBusiness.EventType)
	assert.Equal(t, businessInfo.TransactionID, parsedBusiness.TransactionID)
	assert.Equal(t, businessInfo.UserID, parsedBusiness.UserID)
	assert.Equal(t, businessInfo.Plan, parsedBusiness.Plan)
	assert.Equal(t, businessInfo.Amount, parsedBusiness.Amount)
	assert.Equal(t, businessInfo.Currency, parsedBusiness.Currency)
	assert.Equal(t, businessInfo.Product, parsedBusiness.Product)
	assert.Equal(t, businessInfo.Region, parsedBusiness.Region)
	assert.Equal(t, businessInfo.Success, parsedBusiness.Success)
}

func TestLogLevelParsing(t *testing.T) {
	tests := []struct {
		level    string
		expected logrus.Level
	}{
		{"trace", logrus.TraceLevel},
		{"debug", logrus.DebugLevel},
		{"info", logrus.InfoLevel},
		{"warn", logrus.WarnLevel},
		{"error", logrus.ErrorLevel},
		{"fatal", logrus.FatalLevel},
		{"panic", logrus.PanicLevel},
		{"invalid", logrus.InfoLevel}, // Should default to Info
	}

	for _, test := range tests {
		t.Run(test.level, func(t *testing.T) {
			logger := NewLogger(&Config{
				Service:     "test",
				Version:     "1.0.0",
				Environment: "test",
				Level:       LogLevel(test.level),
				Format:      "json",
				Output:      "stdout",
			})

			assert.Equal(t, test.expected, logger.logrus.GetLevel())
		})
	}
}

func TestLoggerNilContext(t *testing.T) {
	logger := NewLogger(&Config{
		Service:     "test",
		Version:     "1.0.0",
		Environment: "test",
		Level:       LevelInfo,
		Format:      "json",
		Output:      "stdout",
	})

	// Should not panic with nil context
	entry := logger.createLogEntry(LevelInfo, "test message")
	logger.enrichFromContext(nil, entry)

	assert.Empty(t, entry.CorrelationID)
	assert.Empty(t, entry.UserID)
	assert.Empty(t, entry.RequestID)
	assert.Empty(t, entry.SessionID)
}

// Test helper types
type TestError struct {
	Message string
}

func (e *TestError) Error() string {
	return e.Message
}