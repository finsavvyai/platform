package logging

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"runtime"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"gopkg.in/natefinch/lumberjack.v2"
)

// LogLevel represents the severity level of a log entry
type LogLevel string

const (
	LevelTrace LogLevel = "trace"
	LevelDebug LogLevel = "debug"
	LevelInfo  LogLevel = "info"
	LevelWarn  LogLevel = "warn"
	LevelError LogLevel = "error"
	LevelFatal LogLevel = "fatal"
	LevelPanic LogLevel = "panic"
)

// LogEntry represents a structured log entry
type LogEntry struct {
	Timestamp    time.Time              `json:"timestamp"`
	Level        LogLevel               `json:"level"`
	Message      string                 `json:"message"`
	CorrelationID string                `json:"correlation_id,omitempty"`
	UserID       string                 `json:"user_id,omitempty"`
	RequestID    string                 `json:"request_id,omitempty"`
	SessionID    string                 `json:"session_id,omitempty"`
	Service      string                 `json:"service"`
	Version      string                 `json:"version"`
	Environment  string                 `json:"environment"`
	Component    string                 `json:"component,omitempty"`
	Function     string                 `json:"function,omitempty"`
	File         string                 `json:"file,omitempty"`
	Line         int                    `json:"line,omitempty"`
	Duration     *time.Duration         `json:"duration,omitempty"`
	Error        *ErrorInfo             `json:"error,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
	Audit        *AuditInfo             `json:"audit,omitempty"`
	Security     *SecurityInfo          `json:"security,omitempty"`
	Performance  *PerformanceInfo       `json:"performance,omitempty"`
	Business     *BusinessInfo          `json:"business,omitempty"`
}

// ErrorInfo contains error-related information
type ErrorInfo struct {
	Type       string `json:"type"`
	Message    string `json:"message"`
	StackTrace string `json:"stack_trace,omitempty"`
	Cause      string `json:"cause,omitempty"`
	Retryable  bool   `json:"retryable"`
}

// AuditInfo contains audit trail information
type AuditInfo struct {
	Action        string                 `json:"action"`
	Resource      string                 `json:"resource"`
	ResourceID    string                 `json:"resource_id,omitempty"`
	UserID        string                 `json:"user_id"`
	IPAddress     string                 `json:"ip_address,omitempty"`
	UserAgent     string                 `json:"user_agent,omitempty"`
	Success       bool                   `json:"success"`
	Changes       map[string]interface{} `json:"changes,omitempty"`
	OldValues     map[string]interface{} `json:"old_values,omitempty"`
	NewValues     map[string]interface{} `json:"new_values,omitempty"`
	Compliance    []string               `json:"compliance,omitempty"`
	RetentionDays int                    `json:"retention_days"`
}

// SecurityInfo contains security-related information
type SecurityInfo struct {
	EventType      string                 `json:"event_type"`
	ThreatLevel    string                 `json:"threat_level"`
	SourceIP       string                 `json:"source_ip"`
	UserID         string                 `json:"user_id,omitempty"`
	Resource       string                 `json:"resource"`
	Action         string                 `json:"action"`
	Result         string                 `json:"result"`
	RiskScore      float64                `json:"risk_score,omitempty"`
	MitreTechnique string                 `json:"mitre_technique,omitempty"`
	Details        map[string]interface{} `json:"details,omitempty"`
}

// PerformanceInfo contains performance-related information
type PerformanceInfo struct {
	Operation     string                 `json:"operation"`
	Duration      time.Duration          `json:"duration"`
	Throughput    float64                `json:"throughput,omitempty"`
	Latency       *time.Duration         `json:"latency,omitempty"`
	QueueSize     int                    `json:"queue_size,omitempty"`
	MemoryUsage   int64                  `json:"memory_usage,omitempty"`
	CPUUsage      float64                `json:"cpu_usage,omitempty"`
	Metrics       map[string]interface{} `json:"metrics,omitempty"`
}

// BusinessInfo contains business-related information
type BusinessInfo struct {
	EventType      string                 `json:"event_type"`
	TransactionID  string                 `json:"transaction_id,omitempty"`
	UserID         string                 `json:"user_id,omitempty"`
	Plan           string                 `json:"plan,omitempty"`
	Amount         float64                `json:"amount,omitempty"`
	Currency       string                 `json:"currency,omitempty"`
	Product        string                 `json:"product,omitempty"`
	Region         string                 `json:"region,omitempty"`
	Success        bool                   `json:"success"`
	Details        map[string]interface{} `json:"details,omitempty"`
}

// Config holds logger configuration
type Config struct {
	Service     string `json:"service"`
	Version     string `json:"version"`
	Environment string `json:"environment"`
	Level       LogLevel `json:"level"`
	Format      string `json:"format"` // "json" or "text"
	Output      string `json:"output"` // "stdout", "stderr", or file path
	MaxSize     int    `json:"max_size"`     // MB
	MaxBackups  int    `json:"max_backups"`
	MaxAge      int    `json:"max_age"`      // days
	Compress    bool   `json:"compress"`
	EnableAudit bool   `json:"enable_audit"`
}

// Logger represents a structured logger
type Logger struct {
	config *Config
	logrus *logrus.Logger
}

// contextKey is used for context values
type contextKey string

const (
	// Context keys for correlation tracking
	CorrelationIDKey contextKey = "correlation_id"
	UserIDKey        contextKey = "user_id"
	RequestIDKey     contextKey = "request_id"
	SessionIDKey     contextKey = "session_id"
	TraceIDKey       contextKey = "trace_id"
	SpanIDKey        contextKey = "span_id"
)

// NewLogger creates a new structured logger
func NewLogger(config *Config) *Logger {
	if config == nil {
		config = &Config{
			Service:     "quantumbeam-api",
			Version:     "1.0.0",
			Environment: "development",
			Level:       LevelInfo,
			Format:      "json",
			Output:      "stdout",
			MaxSize:     100,
			MaxBackups:  10,
			MaxAge:      30,
			Compress:    true,
			EnableAudit: true,
		}
	}

	logger := logrus.New()

	// Set log level
	level, err := logrus.ParseLevel(string(config.Level))
	if err != nil {
		level = logrus.InfoLevel
	}
	logger.SetLevel(level)

	// Set formatter
	if config.Format == "json" {
		logger.SetFormatter(&logrus.JSONFormatter{
			TimestampFormat: time.RFC3339,
			FieldMap: logrus.FieldMap{
				logrus.FieldKeyTime:  "timestamp",
				logrus.FieldKeyLevel: "level",
				logrus.FieldKeyMsg:   "message",
			},
		})
	} else {
		logger.SetFormatter(&logrus.TextFormatter{
			TimestampFormat: time.RFC3339,
			FullTimestamp:   true,
		})
	}

	// Set output
	if config.Output == "stdout" {
		logger.SetOutput(os.Stdout)
	} else if config.Output == "stderr" {
		logger.SetOutput(os.Stderr)
	} else {
		// Use lumberjack for log rotation
		logger.SetOutput(&lumberjack.Logger{
			Filename:   config.Output,
			MaxSize:    config.MaxSize,
			MaxBackups: config.MaxBackups,
			MaxAge:     config.MaxAge,
			Compress:   config.Compress,
		})
	}

	return &Logger{
		config: config,
		logrus: logger,
	}
}

// createLogEntry creates a base log entry with common fields
func (l *Logger) createLogEntry(level LogLevel, message string) *LogEntry {
	entry := &LogEntry{
		Timestamp:   time.Now().UTC(),
		Level:       level,
		Message:     message,
		Service:     l.config.Service,
		Version:     l.config.Version,
		Environment: l.config.Environment,
		Metadata:    make(map[string]interface{}),
	}

	// Add caller information
	if pc, file, line, ok := runtime.Caller(3); ok {
		fn := runtime.FuncForPC(pc)
		entry.Function = fn.Name()
		entry.File = file
		entry.Line = line
	}

	return entry
}

// log writes the log entry
func (l *Logger) log(entry *LogEntry) {
	// Convert to logrus fields
	fields := logrus.Fields{
		"service":     entry.Service,
		"version":     entry.Version,
		"environment": entry.Environment,
	}

	if entry.CorrelationID != "" {
		fields["correlation_id"] = entry.CorrelationID
	}
	if entry.UserID != "" {
		fields["user_id"] = entry.UserID
	}
	if entry.RequestID != "" {
		fields["request_id"] = entry.RequestID
	}
	if entry.SessionID != "" {
		fields["session_id"] = entry.SessionID
	}
	if entry.Component != "" {
		fields["component"] = entry.Component
	}
	if entry.Function != "" {
		fields["function"] = entry.Function
	}
	if entry.File != "" {
		fields["file"] = entry.File
	}
	if entry.Line > 0 {
		fields["line"] = entry.Line
	}
	if entry.Duration != nil {
		fields["duration"] = entry.Duration.String()
	}
	if entry.Error != nil {
		fields["error"] = entry.Error
	}
	if entry.Audit != nil {
		fields["audit"] = entry.Audit
	}
	if entry.Security != nil {
		fields["security"] = entry.Security
	}
	if entry.Performance != nil {
		fields["performance"] = entry.Performance
	}
	if entry.Business != nil {
		fields["business"] = entry.Business
	}

	// Add metadata
	for k, v := range entry.Metadata {
		fields[k] = v
	}

	// Log with appropriate level
	switch entry.Level {
	case LevelTrace:
		l.logrus.WithFields(fields).Trace(message)
	case LevelDebug:
		l.logrus.WithFields(fields).Debug(message)
	case LevelInfo:
		l.logrus.WithFields(fields).Info(message)
	case LevelWarn:
		l.logrus.WithFields(fields).Warn(message)
	case LevelError:
		l.logrus.WithFields(fields).Error(message)
	case LevelFatal:
		l.logrus.WithFields(fields).Fatal(message)
	case LevelPanic:
		l.logrus.WithFields(fields).Panic(message)
	}
}

// WithContext extracts context information and creates a logger with it
func (l *Logger) WithContext(ctx context.Context) *Logger {
	newLogger := &Logger{
		config: l.config,
		logrus: l.logrus,
	}

	return newLogger
}

// enrichFromContext enriches log entry with context information
func (l *Logger) enrichFromContext(ctx context.Context, entry *LogEntry) {
	if ctx == nil {
		return
	}

	if correlationID, ok := ctx.Value(CorrelationIDKey).(string); ok {
		entry.CorrelationID = correlationID
	}
	if userID, ok := ctx.Value(UserIDKey).(string); ok {
		entry.UserID = userID
	}
	if requestID, ok := ctx.Value(RequestIDKey).(string); ok {
		entry.RequestID = requestID
	}
	if sessionID, ok := ctx.Value(SessionIDKey).(string); ok {
		entry.SessionID = sessionID
	}
}

// Trace logs a trace level message
func (l *Logger) Trace(ctx context.Context, message string, metadata ...map[string]interface{}) {
	entry := l.createLogEntry(LevelTrace, message)
	l.enrichFromContext(ctx, entry)

	for _, m := range metadata {
		for k, v := range m {
			entry.Metadata[k] = v
		}
	}

	l.log(entry)
}

// Debug logs a debug level message
func (l *Logger) Debug(ctx context.Context, message string, metadata ...map[string]interface{}) {
	entry := l.createLogEntry(LevelDebug, message)
	l.enrichFromContext(ctx, entry)

	for _, m := range metadata {
		for k, v := range m {
			entry.Metadata[k] = v
		}
	}

	l.log(entry)
}

// Info logs an info level message
func (l *Logger) Info(ctx context.Context, message string, metadata ...map[string]interface{}) {
	entry := l.createLogEntry(LevelInfo, message)
	l.enrichFromContext(ctx, entry)

	for _, m := range metadata {
		for k, v := range m {
			entry.Metadata[k] = v
		}
	}

	l.log(entry)
}

// Warn logs a warning level message
func (l *Logger) Warn(ctx context.Context, message string, metadata ...map[string]interface{}) {
	entry := l.createLogEntry(LevelWarn, message)
	l.enrichFromContext(ctx, entry)

	for _, m := range metadata {
		for k, v := range m {
			entry.Metadata[k] = v
		}
	}

	l.log(entry)
}

// Error logs an error level message
func (l *Logger) Error(ctx context.Context, message string, err error, metadata ...map[string]interface{}) {
	entry := l.createLogEntry(LevelError, message)
	l.enrichFromContext(ctx, entry)

	if err != nil {
		entry.Error = &ErrorInfo{
			Type:       fmt.Sprintf("%T", err),
			Message:    err.Error(),
			StackTrace: getStackTrace(),
			Retryable:  isRetryableError(err),
		}
	}

	for _, m := range metadata {
		for k, v := range m {
			entry.Metadata[k] = v
		}
	}

	l.log(entry)
}

// Fatal logs a fatal level message and exits
func (l *Logger) Fatal(ctx context.Context, message string, err error, metadata ...map[string]interface{}) {
	entry := l.createLogEntry(LevelFatal, message)
	l.enrichFromContext(ctx, entry)

	if err != nil {
		entry.Error = &ErrorInfo{
			Type:       fmt.Sprintf("%T", err),
			Message:    err.Error(),
			StackTrace: getStackTrace(),
			Retryable:  false,
		}
	}

	for _, m := range metadata {
		for k, v := range m {
			entry.Metadata[k] = v
		}
	}

	l.log(entry)
	os.Exit(1)
}

// Audit logs an audit event
func (l *Logger) Audit(ctx context.Context, action, resource, resourceID, userID string, success bool, changes map[string]interface{}) {
	if !l.config.EnableAudit {
		return
	}

	entry := l.createLogEntry(LevelInfo, fmt.Sprintf("Audit: %s %s", action, resource))
	l.enrichFromContext(ctx, entry)

	entry.Audit = &AuditInfo{
		Action:        action,
		Resource:      resource,
		ResourceID:    resourceID,
		UserID:        userID,
		Success:       success,
		Changes:       changes,
		Compliance:    []string{"SOX", "GDPR", "PCI-DSS"},
		RetentionDays: 2555, // 7 years for compliance
	}

	l.log(entry)
}

// Security logs a security event
func (l *Logger) Security(ctx context.Context, eventType, threatLevel, sourceIP, userID, resource, action, result string, riskScore float64, details map[string]interface{}) {
	entry := l.createLogEntry(LevelWarn, fmt.Sprintf("Security: %s", eventType))
	l.enrichFromContext(ctx, entry)

	entry.Security = &SecurityInfo{
		EventType:   eventType,
		ThreatLevel: threatLevel,
		SourceIP:    sourceIP,
		UserID:      userID,
		Resource:    resource,
		Action:      action,
		Result:      result,
		RiskScore:   riskScore,
		Details:     details,
	}

	l.log(entry)
}

// Performance logs a performance event
func (l *Logger) Performance(ctx context.Context, operation string, duration time.Duration, metrics map[string]interface{}) {
	entry := l.createLogEntry(LevelInfo, fmt.Sprintf("Performance: %s", operation))
	l.enrichFromContext(ctx, entry)

	entry.Performance = &PerformanceInfo{
		Operation: operation,
		Duration:  duration,
		Metrics:   metrics,
	}

	l.log(entry)
}

// Business logs a business event
func (l *Logger) Business(ctx context.Context, eventType, transactionID, userID, plan string, amount float64, currency, product string, success bool, details map[string]interface{}) {
	entry := l.createLogEntry(LevelInfo, fmt.Sprintf("Business: %s", eventType))
	l.enrichFromContext(ctx, entry)

	entry.Business = &BusinessInfo{
		EventType:     eventType,
		TransactionID: transactionID,
		UserID:        userID,
		Plan:          plan,
		Amount:        amount,
		Currency:      currency,
		Product:       product,
		Success:       success,
		Details:       details,
	}

	l.log(entry)
}

// WithDuration adds duration information to the next log entry
func (l *Logger) WithDuration(duration time.Duration) *Logger {
	// This would typically be implemented using a context-based approach
	// For simplicity, returning the same logger
	return l
}

// Helper functions

func getStackTrace() string {
	buf := make([]byte, 1024)
	for {
		n := runtime.Stack(buf, false)
		if n < len(buf) {
			return string(buf[:n])
		}
		buf = make([]byte, 2*len(buf))
	}
}

func isRetryableError(err error) bool {
	// Implement logic to determine if an error is retryable
	// This is a placeholder implementation
	return false
}

// Context helper functions

// WithCorrelationID adds correlation ID to context
func WithCorrelationID(ctx context.Context, correlationID string) context.Context {
	return context.WithValue(ctx, CorrelationIDKey, correlationID)
}

// WithUserID adds user ID to context
func WithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, UserIDKey, userID)
}

// WithRequestID adds request ID to context
func WithRequestID(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, RequestIDKey, requestID)
}

// WithSessionID adds session ID to context
func WithSessionID(ctx context.Context, sessionID string) context.Context {
	return context.WithValue(ctx, SessionIDKey, sessionID)
}

// GenerateCorrelationID generates a new correlation ID
func GenerateCorrelationID() string {
	return uuid.New().String()
}

// GenerateRequestID generates a new request ID
func GenerateRequestID() string {
	return uuid.New().String()
}