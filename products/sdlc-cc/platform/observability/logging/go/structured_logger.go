package logging

import (
	"context"
	"fmt"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

// LogLevel represents the severity of a log entry
type LogLevel string

const (
	LevelDebug LogLevel = "debug"
	LevelInfo  LogLevel = "info"
	LevelWarn  LogLevel = "warn"
	LevelError LogLevel = "error"
	LevelFatal LogLevel = "fatal"
	LevelPanic LogLevel = "panic"
)

// LogEntry represents a structured log entry
type LogEntry struct {
	Timestamp     time.Time              `json:"timestamp"`
	Level         LogLevel               `json:"level"`
	Message       string                 `json:"message"`
	Service       string                 `json:"service"`
	Version       string                 `json:"version,omitempty"`
	TraceID       string                 `json:"trace_id,omitempty"`
	SpanID        string                 `json:"span_id,omitempty"`
	CorrelationID string                 `json:"correlation_id,omitempty"`
	UserID        string                 `json:"user_id,omitempty"`
	TenantID      string                 `json:"tenant_id,omitempty"`
	RequestID     string                 `json:"request_id,omitempty"`
	SessionID     string                 `json:"session_id,omitempty"`
	Source        string                 `json:"source,omitempty"`
	Function      string                 `json:"function,omitempty"`
	File          string                 `json:"file,omitempty"`
	Line          int                    `json:"line,omitempty"`
	Duration      time.Duration          `json:"duration,omitempty"`
	Error         *ErrorInfo             `json:"error,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	Tags          []string               `json:"tags,omitempty"`
}

// ErrorInfo contains detailed error information
type ErrorInfo struct {
	Type       string                 `json:"type"`
	Message    string                 `json:"message"`
	StackTrace string                 `json:"stack_trace,omitempty"`
	Cause      string                 `json:"cause,omitempty"`
	Details    map[string]interface{} `json:"details,omitempty"`
}

// LoggerConfig holds configuration for the structured logger
type LoggerConfig struct {
	Service       string   `json:"service" yaml:"service"`
	Version       string   `json:"version" yaml:"version"`
	Environment   string   `json:"environment" yaml:"environment"`
	Level         string   `json:"level" yaml:"level"`
	Format        string   `json:"format" yaml:"format"` // json, text
	Output        string   `json:"output" yaml:"output"` // stdout, stderr, file
	File          string   `json:"file" yaml:"file"`
	MaxSize       int      `json:"max_size" yaml:"max_size"` // MB
	MaxBackups    int      `json:"max_backups" yaml:"max_backups"`
	MaxAge        int      `json:"max_age" yaml:"max_age"` // days
	Compress      bool     `json:"compress" yaml:"compress"`
	EnableTracing bool     `json:"enable_tracing" yaml:"enable_tracing"`
	RedactFields  []string `json:"redact_fields" yaml:"redact_fields"`
}

// DefaultLoggerConfig returns default logger configuration
func DefaultLoggerConfig() *LoggerConfig {
	return &LoggerConfig{
		Service:       "sdlc-platform",
		Version:       "1.0.0",
		Environment:   "development",
		Level:         "info",
		Format:        "json",
		Output:        "stdout",
		MaxSize:       100,
		MaxBackups:    5,
		MaxAge:        30,
		Compress:      true,
		EnableTracing: true,
		RedactFields:  []string{"password", "token", "secret", "key", "auth", "credential"},
	}
}

// StructuredLogger implements structured logging with correlation support
type StructuredLogger struct {
	config   *LoggerConfig
	logger   *logrus.Logger
	redactor *FieldRedactor
}

// FieldRedactor handles sensitive data redaction
type FieldRedactor struct {
	fields map[string]bool
}

// NewFieldRedactor creates a new field redactor
func NewFieldRedactor(fields []string) *FieldRedactor {
	redactor := &FieldRedactor{
		fields: make(map[string]bool),
	}
	for _, field := range fields {
		redactor.fields[strings.ToLower(field)] = true
	}
	return redactor
}

// Redact recursively redacts sensitive fields from a map
func (r *FieldRedactor) Redact(data interface{}) interface{} {
	switch v := data.(type) {
	case map[string]interface{}:
		redacted := make(map[string]interface{})
		for key, value := range v {
			if r.isSensitive(key) {
				redacted[key] = "***REDACTED***"
			} else {
				redacted[key] = r.Redact(value)
			}
		}
		return redacted
	case []interface{}:
		redacted := make([]interface{}, len(v))
		for i, item := range v {
			redacted[i] = r.Redact(item)
		}
		return redacted
	default:
		return v
	}
}

func (r *FieldRedactor) isSensitive(field string) bool {
	lowerField := strings.ToLower(field)
	for sensitive := range r.fields {
		if strings.Contains(lowerField, sensitive) {
			return true
		}
	}
	return false
}

// NewStructuredLogger creates a new structured logger
func NewStructuredLogger(config *LoggerConfig) (*StructuredLogger, error) {
	if config == nil {
		config = DefaultLoggerConfig()
	}

	logger := logrus.New()

	// Set log level
	level, err := logrus.ParseLevel(config.Level)
	if err != nil {
		level = logrus.InfoLevel
	}
	logger.SetLevel(level)

	// Set formatter
	if config.Format == "json" {
		logger.SetFormatter(&logrus.JSONFormatter{
			TimestampFormat: time.RFC3339,
		})
	} else {
		logger.SetFormatter(&logrus.TextFormatter{
			FullTimestamp:   true,
			TimestampFormat: time.RFC3339,
		})
	}

	// Set output
	if config.Output == "file" && config.File != "" {
		file, err := os.OpenFile(config.File, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			return nil, fmt.Errorf("failed to open log file: %w", err)
		}
		logger.SetOutput(file)
	}

	return &StructuredLogger{
		config:   config,
		logger:   logger,
		redactor: NewFieldRedactor(config.RedactFields),
	}, nil
}

// Context keys for correlation data
type contextKey string

const (
	CorrelationIDKey contextKey = "correlation_id"
	TraceIDKey       contextKey = "trace_id"
	SpanIDKey        contextKey = "span_id"
	UserIDKey        contextKey = "user_id"
	TenantIDKey      contextKey = "tenant_id"
	RequestIDKey     contextKey = "request_id"
	SessionIDKey     contextKey = "session_id"
)

// WithCorrelationID adds correlation ID to context
func WithCorrelationID(ctx context.Context, correlationID string) context.Context {
	if correlationID == "" {
		correlationID = uuid.New().String()
	}
	return context.WithValue(ctx, CorrelationIDKey, correlationID)
}

// WithTraceData adds trace data to context
func WithTraceData(ctx context.Context, traceID, spanID string) context.Context {
	ctx = context.WithValue(ctx, TraceIDKey, traceID)
	ctx = context.WithValue(ctx, SpanIDKey, spanID)
	return ctx
}

// WithUserData adds user data to context
func WithUserData(ctx context.Context, userID, tenantID string) context.Context {
	ctx = context.WithValue(ctx, UserIDKey, userID)
	ctx = context.WithValue(ctx, TenantIDKey, tenantID)
	return ctx
}

// WithRequestData adds request data to context
func WithRequestData(ctx context.Context, requestID, sessionID string) context.Context {
	ctx = context.WithValue(ctx, RequestIDKey, requestID)
	if sessionID != "" {
		ctx = context.WithValue(ctx, SessionIDKey, sessionID)
	}
	return ctx
}

// GetCorrelationID retrieves correlation ID from context
func GetCorrelationID(ctx context.Context) string {
	if id, ok := ctx.Value(CorrelationIDKey).(string); ok {
		return id
	}
	return ""
}

// GetTraceID retrieves trace ID from context
func GetTraceID(ctx context.Context) string {
	if id, ok := ctx.Value(TraceIDKey).(string); ok {
		return id
	}
	return ""
}

// GetSpanID retrieves span ID from context
func GetSpanID(ctx context.Context) string {
	if id, ok := ctx.Value(SpanIDKey).(string); ok {
		return id
	}
	return ""
}

// GetUserID retrieves user ID from context
func GetUserID(ctx context.Context) string {
	if id, ok := ctx.Value(UserIDKey).(string); ok {
		return id
	}
	return ""
}

// GetTenantID retrieves tenant ID from context
func GetTenantID(ctx context.Context) string {
	if id, ok := ctx.Value(TenantIDKey).(string); ok {
		return id
	}
	return ""
}

// GetRequestID retrieves request ID from context
func GetRequestID(ctx context.Context) string {
	if id, ok := ctx.Value(RequestIDKey).(string); ok {
		return id
	}
	return ""
}

// GetSessionID retrieves session ID from context
func GetSessionID(ctx context.Context) string {
	if id, ok := ctx.Value(SessionIDKey).(string); ok {
		return id
	}
	return ""
}

// createLogEntry creates a log entry from context and parameters
func (sl *StructuredLogger) createLogEntry(ctx context.Context, level LogLevel, message string, fields map[string]interface{}) *LogEntry {
	entry := &LogEntry{
		Timestamp:     time.Now(),
		Level:         level,
		Message:       message,
		Service:       sl.config.Service,
		Version:       sl.config.Version,
		CorrelationID: GetCorrelationID(ctx),
		TraceID:       GetTraceID(ctx),
		SpanID:        GetSpanID(ctx),
		UserID:        GetUserID(ctx),
		TenantID:      GetTenantID(ctx),
		RequestID:     GetRequestID(ctx),
		SessionID:     GetSessionID(ctx),
		Metadata:      make(map[string]interface{}),
	}

	// Add caller information
	if pc, file, line, ok := runtime.Caller(2); ok {
		entry.Function = runtime.FuncForPC(pc).Name()
		entry.File = file
		entry.Line = line
	}

	// Process fields
	for key, value := range fields {
		switch key {
		case "duration":
			if duration, ok := value.(time.Duration); ok {
				entry.Duration = duration
			}
		case "error":
			if err, ok := value.(error); ok {
				entry.Error = &ErrorInfo{
					Type:    fmt.Sprintf("%T", err),
					Message: err.Error(),
				}
				// Add stack trace for errors
				buf := make([]byte, 4096)
				n := runtime.Stack(buf, false)
				entry.Error.StackTrace = string(buf[:n])
			}
		case "tags":
			if tags, ok := value.([]string); ok {
				entry.Tags = tags
			}
		default:
			entry.Metadata[key] = sl.redactor.Redact(value)
		}
	}

	return entry
}

// log logs the entry using the underlying logger
func (sl *StructuredLogger) log(entry *LogEntry) {
	// Convert to logrus fields
	fields := logrus.Fields{
		"service":        entry.Service,
		"correlation_id": entry.CorrelationID,
		"trace_id":       entry.TraceID,
		"span_id":        entry.SpanID,
		"user_id":        entry.UserID,
		"tenant_id":      entry.TenantID,
		"request_id":     entry.RequestID,
		"session_id":     entry.SessionID,
		"function":       entry.Function,
		"file":           entry.File,
		"line":           entry.Line,
	}

	if entry.Duration > 0 {
		fields["duration"] = entry.Duration.String()
	}

	if entry.Error != nil {
		fields["error"] = entry.Error
	}

	if len(entry.Metadata) > 0 {
		for k, v := range entry.Metadata {
			fields[k] = v
		}
	}

	if len(entry.Tags) > 0 {
		fields["tags"] = entry.Tags
	}

	// Log with appropriate level
	switch entry.Level {
	case LevelDebug:
		sl.logger.WithFields(fields).Debug(entry.Message)
	case LevelInfo:
		sl.logger.WithFields(fields).Info(entry.Message)
	case LevelWarn:
		sl.logger.WithFields(fields).Warn(entry.Message)
	case LevelError:
		sl.logger.WithFields(fields).Error(entry.Message)
	case LevelFatal:
		sl.logger.WithFields(fields).Fatal(entry.Message)
	case LevelPanic:
		sl.logger.WithFields(fields).Panic(entry.Message)
	}
}

// Debug logs a debug message
func (sl *StructuredLogger) Debug(ctx context.Context, message string, fields ...map[string]interface{}) {
	entry := sl.createLogEntry(ctx, LevelDebug, message, sl.mergeFields(fields...))
	sl.log(entry)
}

// Info logs an info message
func (sl *StructuredLogger) Info(ctx context.Context, message string, fields ...map[string]interface{}) {
	entry := sl.createLogEntry(ctx, LevelInfo, message, sl.mergeFields(fields...))
	sl.log(entry)
}

// Warn logs a warning message
func (sl *StructuredLogger) Warn(ctx context.Context, message string, fields ...map[string]interface{}) {
	entry := sl.createLogEntry(ctx, LevelWarn, message, sl.mergeFields(fields...))
	sl.log(entry)
}

// Error logs an error message
func (sl *StructuredLogger) Error(ctx context.Context, message string, fields ...map[string]interface{}) {
	entry := sl.createLogEntry(ctx, LevelError, message, sl.mergeFields(fields...))
	sl.log(entry)
}

// Fatal logs a fatal message and exits
func (sl *StructuredLogger) Fatal(ctx context.Context, message string, fields ...map[string]interface{}) {
	entry := sl.createLogEntry(ctx, LevelFatal, message, sl.mergeFields(fields...))
	sl.log(entry)
}

// Panic logs a panic message and panics
func (sl *StructuredLogger) Panic(ctx context.Context, message string, fields ...map[string]interface{}) {
	entry := sl.createLogEntry(ctx, LevelPanic, message, sl.mergeFields(fields...))
	sl.log(entry)
}

// mergeFields merges multiple field maps
func (sl *StructuredLogger) mergeFields(fields ...map[string]interface{}) map[string]interface{} {
	merged := make(map[string]interface{})
	for _, fieldMap := range fields {
		for k, v := range fieldMap {
			merged[k] = v
		}
	}
	return merged
}

// WithFields creates a logger with pre-configured fields
func (sl *StructuredLogger) WithFields(fields map[string]interface{}) *FieldLogger {
	return &FieldLogger{
		logger: sl,
		fields: fields,
	}
}

// FieldLogger wraps StructuredLogger with pre-configured fields
type FieldLogger struct {
	logger *StructuredLogger
	fields map[string]interface{}
}

// Debug logs a debug message with pre-configured fields
func (fl *FieldLogger) Debug(ctx context.Context, message string, fields ...map[string]interface{}) {
	allFields := fl.mergeFields(fields...)
	fl.logger.Debug(ctx, message, allFields)
}

// Info logs an info message with pre-configured fields
func (fl *FieldLogger) Info(ctx context.Context, message string, fields ...map[string]interface{}) {
	allFields := fl.mergeFields(fields...)
	fl.logger.Info(ctx, message, allFields)
}

// Warn logs a warning message with pre-configured fields
func (fl *FieldLogger) Warn(ctx context.Context, message string, fields ...map[string]interface{}) {
	allFields := fl.mergeFields(fields...)
	fl.logger.Warn(ctx, message, allFields)
}

// Error logs an error message with pre-configured fields
func (fl *FieldLogger) Error(ctx context.Context, message string, fields ...map[string]interface{}) {
	allFields := fl.mergeFields(fields...)
	fl.logger.Error(ctx, message, allFields)
}

// Fatal logs a fatal message with pre-configured fields
func (fl *FieldLogger) Fatal(ctx context.Context, message string, fields ...map[string]interface{}) {
	allFields := fl.mergeFields(fields...)
	fl.logger.Fatal(ctx, message, allFields)
}

// Panic logs a panic message with pre-configured fields
func (fl *FieldLogger) Panic(ctx context.Context, message string, fields ...map[string]interface{}) {
	allFields := fl.mergeFields(fields...)
	fl.logger.Panic(ctx, message, allFields)
}

func (fl *FieldLogger) mergeFields(fields ...map[string]interface{}) map[string]interface{} {
	merged := make(map[string]interface{})
	for k, v := range fl.fields {
		merged[k] = v
	}
	for _, fieldMap := range fields {
		for k, v := range fieldMap {
			merged[k] = v
		}
	}
	return merged
}
