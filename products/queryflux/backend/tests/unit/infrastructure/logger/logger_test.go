package logger

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"go.uber.org/zap"

	"github.com/queryflux/backend/internal/infrastructure/logger"
)

func TestDefaultConfig(t *testing.T) {
	config := logger.DefaultConfig()

	if config.Level != "info" {
		t.Errorf("Expected default level 'info', got '%s'", config.Level)
	}

	if config.Format != "json" {
		t.Errorf("Expected default format 'json', got '%s'", config.Format)
	}

	if config.Output != "stdout" {
		t.Errorf("Expected default output 'stdout', got '%s'", config.Output)
	}

	if config.Development != false {
		t.Errorf("Expected default development false, got %v", config.Development)
	}

	if config.Rotation == nil {
		t.Error("Expected rotation config to be set")
	} else {
		if config.Rotation.MaxSize != 100 {
			t.Errorf("Expected default max size 100, got %d", config.Rotation.MaxSize)
		}
		if config.Rotation.MaxAge != 30 {
			t.Errorf("Expected default max age 30, got %d", config.Rotation.MaxAge)
		}
		if config.Rotation.MaxBackups != 10 {
			t.Errorf("Expected default max backups 10, got %d", config.Rotation.MaxBackups)
		}
		if !config.Rotation.Compress {
			t.Error("Expected compression to be enabled")
		}
	}
}

func TestNewLoggerWithDefaults(t *testing.T) {
	log, err := logger.New(nil)
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	if log == nil {
		t.Fatal("Logger is nil")
	}

	if log.GetLevel() != "info" {
		t.Errorf("Expected level 'info', got '%s'", log.GetLevel())
	}

	// Test basic logging
	log.Info("Test message")
}

func TestNewLoggerWithConfig(t *testing.T) {
	config := &logger.Config{
		Level:       "debug",
		Format:      "console",
		Output:      "stdout",
		Development: true,
		Rotation: &logger.RotationConfig{
			MaxSize:    50,
			MaxAge:     7,
			MaxBackups: 5,
			Compress:   false,
			LocalTime:  true,
		},
	}

	log, err := logger.New(config)
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	if log.GetLevel() != "debug" {
		t.Errorf("Expected level 'debug', got '%s'", log.GetLevel())
	}
}

func TestNewDevelopmentLogger(t *testing.T) {
	log, err := logger.NewDevelopment()
	if err != nil {
		t.Fatalf("Failed to create development logger: %v", err)
	}

	if log.GetLevel() != "debug" {
		t.Errorf("Expected debug level for development logger, got '%s'", log.GetLevel())
	}
}

func TestNewProductionLogger(t *testing.T) {
	log, err := logger.NewProduction()
	if err != nil {
		t.Fatalf("Failed to create production logger: %v", err)
	}

	if log.GetLevel() != "info" {
		t.Errorf("Expected info level for production logger, got '%s'", log.GetLevel())
	}
}

func TestLoggerWithFileOutput(t *testing.T) {
	tempDir := t.TempDir()
	logFile := filepath.Join(tempDir, "test.log")

	config := &logger.Config{
		Level:  "debug",
		Format: "json",
		Output: logFile,
		Rotation: &logger.RotationConfig{
			MaxSize:    1, // 1MB
			MaxAge:     1,
			MaxBackups: 2,
			Compress:   false,
		},
	}

	log, err := logger.New(config)
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Write a test message
	log.Info("Test log message")

	// Sync to ensure file is written
	err = log.Sync()
	if err != nil {
		t.Errorf("Failed to sync logger: %v", err)
	}

	// Check if file was created
	if _, err := os.Stat(logFile); os.IsNotExist(err) {
		t.Error("Log file was not created")
	}
}

func TestLoggerWithRotation(t *testing.T) {
	tempDir := t.TempDir()
	logFile := filepath.Join(tempDir, "rotation-test.log")

	config := &logger.Config{
		Level:  "info",
		Format: "json",
		Output: logFile,
		Rotation: &logger.RotationConfig{
			MaxSize:    1, // 1MB - small for testing
			MaxAge:     1,
			MaxBackups: 2,
			Compress:   true,
		},
	}

	log, err := logger.New(config)
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Write a large amount of data to trigger rotation
	message := strings.Repeat("This is a test log message that should help trigger log rotation when enough data is written. ", 1000)

	for i := 0; i < 100; i++ {
		log.Info(message, zap.Int("iteration", i))
	}

	// Sync to ensure data is written
	err = log.Sync()
	if err != nil {
		t.Errorf("Failed to sync logger: %v", err)
	}

	// Give some time for rotation to occur
	time.Sleep(100 * time.Millisecond)

	// Check if original file exists
	if _, err := os.Stat(logFile); os.IsNotExist(err) {
		t.Error("Original log file was not created")
	}
}

func TestLoggerWithContextMethods(t *testing.T) {
	config := &logger.Config{
		Level:  "debug",
		Format: "json",
		Output: "stdout",
	}

	log, err := logger.New(config)
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Test WithRequestID
	reqLogger := log.WithRequestID("test-req-123")
	if reqLogger == nil {
		t.Error("WithRequestID returned nil")
	}

	// Test WithUserID
	userLogger := log.WithUserID("test-user-456")
	if userLogger == nil {
		t.Error("WithUserID returned nil")
	}

	// Test WithComponent
	compLogger := log.WithComponent("test-component")
	if compLogger == nil {
		t.Error("WithComponent returned nil")
	}

	// Test WithFields
	fieldLogger := log.WithFields(map[string]interface{}{
		"key1": "value1",
		"key2": 42,
	})
	if fieldLogger == nil {
		t.Error("WithFields returned nil")
	}

	// Test chaining context methods
	chainedLogger := log.WithRequestID("req-123").WithUserID("user-456").WithComponent("test")
	if chainedLogger == nil {
		t.Error("Chained context methods returned nil")
	}
}

func TestLoggerSetLevel(t *testing.T) {
	log, err := logger.New(nil)
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	// Test setting valid levels
	levels := []string{"debug", "info", "warn", "error", "fatal", "panic"}
	for _, level := range levels {
		err := log.SetLevel(level)
		if err != nil {
			t.Errorf("Failed to set level '%s': %v", level, err)
		}
		if log.GetLevel() != level {
			t.Errorf("Expected level '%s', got '%s'", level, log.GetLevel())
		}
	}

	// Test setting invalid level
	err = log.SetLevel("invalid")
	if err == nil {
		t.Error("Expected error when setting invalid log level")
	}
}

func TestLoggerStructuredLoggingMethods(t *testing.T) {
	// Create a logger for testing
	config := &logger.Config{
		Level:  "debug",
		Format: "json",
		Output: "stdout",
	}

	testLogger, err := logger.New(config)
	if err != nil {
		t.Fatalf("Failed to create test logger: %v", err)
	}

	// Test LogRequest
	testLogger.LogRequest("GET", "/api/test", "127.0.0.1", "test-agent", 200, 100*time.Millisecond, "req-123", "user-456")
	testLogger.LogRequest("POST", "/api/error", "127.0.0.1", "test-agent", 500, 50*time.Millisecond, "req-124")

	// Test LogPanic
	testLogger.LogPanic("test panic", []byte("stack trace"), "req-125", "GET", "/panic")

	// Test LogDatabaseOperation
	testLogger.LogDatabaseOperation("SELECT", "users", 10*time.Millisecond, true, nil, "req-126", "user-456")
	testLogger.LogDatabaseOperation("INSERT", "logs", 5*time.Millisecond, false, fmt.Errorf("connection failed"), "req-127")

	// Test LogAuthenticationEvent
	testLogger.LogAuthenticationEvent("login", "user-456", "127.0.0.1", true, nil, "req-128")
	testLogger.LogAuthenticationEvent("login", "", "127.0.0.1", false, fmt.Errorf("invalid credentials"), "req-129")

	// Test LogSystemMetrics
	metrics := map[string]interface{}{
		"cpu_usage":    45.2,
		"memory_usage": 1024,
		"disk_usage":   2048,
	}
	testLogger.LogSystemMetrics(metrics)

	// Test LogAlert
	testLogger.LogAlert("warning", "High memory usage", map[string]string{"threshold": "80%", "current": "85%"}, "req-130")
	testLogger.LogAlert("critical", "Database connection lost", map[string]string{"database": "primary"}, "req-131")

	// Test LogBusinessEvent
	businessData := map[string]interface{}{
		"action":    "query_executed",
		"table":     "users",
		"row_count": 10,
		"duration":  150 * time.Millisecond,
	}
	testLogger.LogBusinessEvent("query_completed", "user-456", businessData, "req-132")

	// Test AuditLog
	testLogger.AuditLog("DELETE", "connection:123", "user-456", true, map[string]string{"target": "prod-db"}, "req-133")
	testLogger.AuditLog("CREATE", "user:789", "user-456", false, map[string]string{"error": "permission denied"}, "req-134")
}

func TestGlobalLogger(t *testing.T) {
	// Test InitGlobal and GetGlobal
	config := &logger.Config{
		Level:  "warn",
		Format: "json",
		Output: "stdout",
	}

	err := logger.InitGlobal(config)
	if err != nil {
		t.Fatalf("Failed to initialize global logger: %v", err)
	}

	globalLogger := logger.GetGlobal()
	if globalLogger == nil {
		t.Fatal("Global logger is nil")
	}

	if globalLogger.GetLevel() != "warn" {
		t.Errorf("Expected global logger level 'warn', got '%s'", globalLogger.GetLevel())
	}

	// Test global convenience functions
	// These should not panic
	logger.Debug("Debug message")
	logger.Info("Info message")
	logger.Warn("Warning message")
	logger.Error("Error message")
}

func TestLoggerSync(t *testing.T) {
	log, err := logger.New(nil)
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}

	err = log.Sync()
	if err != nil {
		// Some sync methods return errors, but they should not be fatal
		t.Logf("Sync returned error (this may be expected): %v", err)
	}
}

func TestLoggerNilConfig(t *testing.T) {
	log, err := logger.New(nil)
	if err != nil {
		t.Fatalf("Failed to create logger with nil config: %v", err)
	}

	if log == nil {
		t.Fatal("Logger should not be nil with nil config")
	}
}

func TestLoggerInvalidOutputPath(t *testing.T) {
	// Test with an invalid output path (read-only directory)
	config := &logger.Config{
		Level:  "info",
		Format: "json",
		Output: "/invalid/path/test.log",
	}

	log, err := logger.New(config)
	// The logger might still be created but will fail when writing
	// We just verify it doesn't panic on creation
	if err != nil {
		t.Logf("Expected error with invalid path: %v", err)
	}

	if log != nil {
		// Try to write a message - this should handle the error gracefully
		log.Info("Test message")
	}
}

// Benchmark logging performance
func BenchmarkLoggerInfo(b *testing.B) {
	log, err := logger.New(nil)
	if err != nil {
		b.Fatalf("Failed to create logger: %v", err)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		log.Info("Benchmark message", zap.Int("iteration", i))
	}
}

func BenchmarkLoggerWithContext(b *testing.B) {
	log, err := logger.New(nil)
	if err != nil {
		b.Fatalf("Failed to create logger: %v", err)
	}

	contextLogger := log.WithRequestID("bench-req").WithUserID("bench-user")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		contextLogger.Info("Benchmark message", zap.Int("iteration", i))
	}
}

func BenchmarkLogRequest(b *testing.B) {
	log, err := logger.New(nil)
	if err != nil {
		b.Fatalf("Failed to create logger: %v", err)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		log.LogRequest("GET", "/api/test", "127.0.0.1", "benchmark", 200, 100*time.Millisecond, "req-123", "user-456")
	}
}
