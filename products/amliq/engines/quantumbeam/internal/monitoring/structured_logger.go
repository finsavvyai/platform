//go:build legacy_migrated
// +build legacy_migrated

package monitoring

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// StructuredLogger provides structured JSON logging with correlation IDs
type StructuredLogger struct {
	logger       *log.Logger
	config       LoggingConfig
	fields       map[string]interface{}
	mu           sync.RWMutex
	context      context.Context
	correlationID string
}

// LoggingConfig holds logging configuration
type LoggingConfig struct {
	Level            LogLevel      `json:"level"`
	Format           LogFormat     `json:"format"`
	Output           LogOutput     `json:"output"`
	File             string        `json:"file"`
	MaxSize          int64         `json:"max_size"`
	MaxBackups       int           `json:"max_backups"`
	MaxAge           time.Duration `json:"max_age"`
	Compress         bool          `json:"compress"`
	IncludeTimestamp bool          `json:"include_timestamp"`
	IncludeCaller    bool          `json:"include_caller"`
	IncludeStack     bool          `json:"include_stack"`
	StructuredFields []string      `json:"structured_fields"`
	ServiceName      string        `json:"service_name"`
	Environment      string        `json:"environment"`
	Version          string        `json:"version"`
}

// LogLevel represents logging levels
type LogLevel int

const (
	TraceLevel LogLevel = iota
	DebugLevel
	InfoLevel
	WarnLevel
	ErrorLevel
	FatalLevel
	PanicLevel
)

func (l LogLevel) String() string {
	switch l {
	case TraceLevel:
		return "TRACE"
	case DebugLevel:
		return "DEBUG"
	case InfoLevel:
		return "INFO"
	case WarnLevel:
		return "WARN"
	case ErrorLevel:
		return "ERROR"
	case FatalLevel:
		return "FATAL"
	case PanicLevel:
		return "PANIC"
	default:
		return "UNKNOWN"
	}
}

// LogFormat represents log formats
type LogFormat string

const (
	LogFormatJSON    LogFormat = "json"
	LogFormatText    LogFormat = "text"
	LogFormatConsole LogFormat = "console"
)

// LogOutput represents log outputs
type LogOutput string

const (
	LogOutputStdout LogOutput = "stdout"
	LogOutputStderr LogOutput = "stderr"
	LogOutputFile   LogOutput = "file"
)

// LogEntry represents a structured log entry
type LogEntry struct {
	Timestamp     time.Time              `json:"timestamp"`
	Level         string                 `json:"level"`
	Message       string                 `json:"message"`
	Service       string                 `json:"service"`
	Environment   string                 `json:"environment"`
	Version       string                 `json:"version"`
	CorrelationID string                 `json:"correlation_id,omitempty"`
	RequestID     string                 `json:"request_id,omitempty"`
	UserID        string                 `json:"user_id,omitempty"`
	SessionID     string                 `json:"session_id,omitempty"`
	TraceID       string                 `json:"trace_id,omitempty"`
	SpanID        string                 `json:"span_id,omitempty"`
	Component     string                 `json:"component,omitempty"`
	Function      string                 `json:"function,omitempty"`
	File          string                 `json:"file,omitempty"`
	Line          int                    `json:"line,omitempty"`
	Error         string                 `json:"error,omitempty"`
	Stack         string                 `json:"stack,omitempty"`
	Duration      time.Duration          `json:"duration,omitempty"`
	Fields        map[string]interface{} `json:"fields,omitempty"`
	Metrics       map[string]interface{} `json:"metrics,omitempty"`
	Host          string                 `json:"host,omitempty"`
	PID           int                    `json:"pid,omitempty"`
	GoroutineID   uint64                 `json:"goroutine_id,omitempty"`
}

// LoggingContext provides context for logging
type LoggingContext struct {
	CorrelationID string
	RequestID     string
	UserID        string
	SessionID     string
	TraceID       string
	SpanID        string
	Component     string
	Fields        map[string]interface{}
}

// NewStructuredLogger creates a new structured logger
func NewStructuredLogger(config LoggingConfig) *StructuredLogger {
	logger := log.New(os.Stdout, "", 0)

	sl := &StructuredLogger{
		logger:  logger,
		config:  config,
		fields:  make(map[string]interface{}),
		context: context.Background(),
	}

	// Generate correlation ID
	sl.correlationID = sl.generateCorrelationID()

	return sl
}

// WithContext adds context to the logger
func (sl *StructuredLogger) WithContext(ctx context.Context) *StructuredLogger {
	sl.mu.Lock()
	defer sl.mu.Unlock()

	newLogger := *sl
	newLogger.context = ctx

	// Extract values from context
	if reqID := ctx.Value("request_id"); reqID != nil {
		newLogger.fields["request_id"] = reqID.(string)
	}
	if userID := ctx.Value("user_id"); userID != nil {
		newLogger.fields["user_id"] = userID.(string)
	}
	if sessionID := ctx.Value("session_id"); sessionID != nil {
		newLogger.fields["session_id"] = sessionID.(string)
	}
	if traceID := ctx.Value("trace_id"); traceID != nil {
		newLogger.fields["trace_id"] = traceID.(string)
	}
	if spanID := ctx.Value("span_id"); spanID != nil {
		newLogger.fields["span_id"] = spanID.(string)
	}

	return &newLogger
}

// WithFields adds fields to the logger
func (sl *StructuredLogger) WithFields(fields map[string]interface{}) *StructuredLogger {
	sl.mu.Lock()
	defer sl.mu.Unlock()

	newLogger := *sl
	newLogger.fields = make(map[string]interface{})

	// Copy existing fields
	for k, v := range sl.fields {
		newLogger.fields[k] = v
	}

	// Add new fields
	for k, v := range fields {
		newLogger.fields[k] = v
	}

	return &newLogger
}

// WithField adds a single field to the logger
func (sl *StructuredLogger) WithField(key string, value interface{}) *StructuredLogger {
	return sl.WithFields(map[string]interface{}{key: value})
}

// WithCorrelationID sets the correlation ID
func (sl *StructuredLogger) WithCorrelationID(correlationID string) *StructuredLogger {
	sl.mu.Lock()
	defer sl.mu.Unlock()

	newLogger := *sl
	newLogger.correlationID = correlationID
	newLogger.fields["correlation_id"] = correlationID

	return &newLogger
}

// WithComponent sets the component name
func (sl *StructuredLogger) WithComponent(component string) *StructuredLogger {
	return sl.WithField("component", component)
}

// WithDuration adds duration information
func (sl *StructuredLogger) WithDuration(duration time.Duration) *StructuredLogger {
	return sl.WithField("duration", duration)
}

// WithError adds error information
func (sl *StructuredLogger) WithError(err error) *StructuredLogger {
	fields := map[string]interface{}{
		"error": err.Error(),
	}

	if sl.config.IncludeStack {
		fields["stack"] = sl.getStackTrace()
	}

	return sl.WithFields(fields)
}

// Logging methods

// Trace logs a trace message
func (sl *StructuredLogger) Trace(message string, args ...interface{}) {
	sl.log(TraceLevel, message, args...)
}

// Debug logs a debug message
func (sl *StructuredLogger) Debug(message string, args ...interface{}) {
	sl.log(DebugLevel, message, args...)
}

// Info logs an info message
func (sl *StructuredLogger) Info(message string, args ...interface{}) {
	sl.log(InfoLevel, message, args...)
}

// Warn logs a warning message
func (sl *StructuredLogger) Warn(message string, args ...interface{}) {
	sl.log(WarnLevel, message, args...)
}

// Error logs an error message
func (sl *StructuredLogger) Error(message string, args ...interface{}) {
	sl.log(ErrorLevel, message, args...)
}

// Fatal logs a fatal message and exits
func (sl *StructuredLogger) Fatal(message string, args ...interface{}) {
	sl.log(FatalLevel, message, args...)
	os.Exit(1)
}

// Panic logs a panic message and panics
func (sl *StructuredLogger) Panic(message string, args ...interface{}) {
	sl.log(PanicLevel, message, args...)
	panic(fmt.Sprintf(message, args...))
}

// log is the core logging method
func (sl *StructuredLogger) log(level LogLevel, message string, args ...interface{}) {
	// Check if we should log at this level
	if level < sl.config.Level {
		return
	}

	// Create log entry
	entry := LogEntry{
		Timestamp:     time.Now().UTC(),
		Level:         level.String(),
		Message:       fmt.Sprintf(message, args...),
		Service:       sl.config.ServiceName,
		Environment:   sl.config.Environment,
		Version:       sl.config.Version,
		CorrelationID: sl.correlationID,
		Fields:        make(map[string]interface{}),
		Metrics:       make(map[string]interface{}),
		Host:          sl.getHostname(),
		PID:           os.Getpid(),
		GoroutineID:   sl.getGoroutineID(),
	}

	// Add caller information if enabled
	if sl.config.IncludeCaller {
		pc, file, line, ok := runtime.Caller(2)
		if ok {
			entry.Function = runtime.FuncForPC(pc).Name()
			entry.File = file
			entry.Line = line
		}
	}

	// Add fields from the logger
	sl.mu.RLock()
	for k, v := range sl.fields {
		if k == "error" {
			entry.Error = fmt.Sprintf("%v", v)
		} else if k == "duration" {
			if duration, ok := v.(time.Duration); ok {
				entry.Duration = duration
			}
		} else if strings.HasPrefix(k, "metric_") {
			entry.Metrics[strings.TrimPrefix(k, "metric_")] = v
		} else {
			entry.Fields[k] = v
		}
	}
	sl.mu.RUnlock()

	// Format and output the log entry
	var output string
	switch sl.config.Format {
	case LogFormatJSON:
		output = sl.formatJSON(entry)
	case LogFormatConsole:
		output = sl.formatConsole(entry)
	default: // LogFormatText
		output = sl.formatText(entry)
	}

	// Write the log entry
	sl.logger.Print(output)

	// Exit or panic for fatal/panic levels
	if level == FatalLevel {
		os.Exit(1)
	} else if level == PanicLevel {
		panic(message)
	}
}

// formatJSON formats the log entry as JSON
func (sl *StructuredLogger) formatJSON(entry LogEntry) string {
	data, err := json.Marshal(entry)
	if err != nil {
		// Fallback to simple format if JSON marshaling fails
		return fmt.Sprintf(`{"timestamp":"%s","level":"ERROR","message":"Failed to marshal log entry: %v","original":"%s"}`,
			entry.Timestamp.Format(time.RFC3339Nano), err, entry.Message)
	}
	return string(data)
}

// formatConsole formats the log entry for console output
func (sl *StructuredLogger) formatConsole(entry LogEntry) string {
	timestamp := entry.Timestamp.Format("2006-01-02 15:04:05")
	level := sl.colorizeLevel(entry.Level)

	output := fmt.Sprintf("%s %s [%s] %s",
		timestamp, level, entry.Service, entry.Message)

	// Add correlation ID if present
	if entry.CorrelationID != "" {
		output += fmt.Sprintf " (cid: %s)", entry.CorrelationID[:8])
	}

	// Add component if present
	if entry.Component != "" {
		output += fmt.Sprintf " [%s]", entry.Component)
	}

	// Add duration if present
	if entry.Duration > 0 {
		output += fmt.Sprintf " (%v)", entry.Duration)
	}

	// Add error if present
	if entry.Error != "" {
		output += fmt.Sprintf " | ERROR: %s", entry.Error
	}

	return output
}

// formatText formats the log entry as plain text
func (sl *StructuredLogger) formatText(entry LogEntry) string {
	timestamp := entry.Timestamp.Format(time.RFC3339Nano)

	output := fmt.Sprintf("%s [%s] %s [%s]",
		timestamp, entry.Level, entry.Service, entry.Message)

	// Add correlation ID if present
	if entry.CorrelationID != "" {
		output += fmt.Sprintf " cid=%s", entry.CorrelationID
	}

	// Add component if present
	if entry.Component != "" {
		output += fmt.Sprintf " component=%s", entry.Component
	}

	// Add duration if present
	if entry.Duration > 0 {
		output += fmt.Sprintf " duration=%v", entry.Duration)
	}

	// Add fields
	for k, v := range entry.Fields {
		output += fmt.Sprintf " %s=%v", k, v)
	}

	// Add error if present
	if entry.Error != "" {
		output += fmt.Sprintf " error=%s", entry.Error)
	}

	return output
}

// colorizeLevel adds color to log levels for console output
func (sl *StructuredLogger) colorizeLevel(level string) string {
	colors := map[string]string{
		"TRACE": "\033[36m", // Cyan
		"DEBUG": "\033[37m", // White
		"INFO":  "\033[32m", // Green
		"WARN":  "\033[33m", // Yellow
		"ERROR": "\033[31m", // Red
		"FATAL": "\033[35m", // Magenta
		"PANIC": "\033[35m", // Magenta
	}

	if color, exists := colors[level]; exists {
		return fmt.Sprintf("%s%-5s\033[0m", color, level)
	}
	return fmt.Sprintf("%-5s", level)
}

// Helper methods

// generateCorrelationID generates a new correlation ID
func (sl *StructuredLogger) generateCorrelationID() string {
	return uuid.New().String()
}

// getHostname returns the hostname
func (sl *StructuredLogger) getHostname() string {
	if hostname, err := os.Hostname(); err == nil {
		return hostname
	}
	return "unknown"
}

// getGoroutineID returns the current goroutine ID
func (sl *StructuredLogger) getGoroutineID() uint64 {
	b := make([]byte, 64)
	b = b[:runtime.Stack(b, false)]
	b = bytes.TrimPrefix(b, []byte("goroutine "))
	b = b[:bytes.IndexByte(b, ' ')]
	n, _ := strconv.ParseUint(string(b), 10, 64)
	return n
}

// getStackTrace returns the current stack trace
func (sl *StructuredLogger) getStackTrace() string {
	buf := make([]byte, 1024)
	for {
		n := runtime.Stack(buf, false)
		if n < len(buf) {
			return string(buf[:n])
		}
		buf = make([]byte, 2*len(buf))
	}
}

// Business logging methods

// LogAPIRequest logs an API request
func (sl *StructuredLogger) LogAPIRequest(method, path, userAgent, remoteAddr string, statusCode int, duration time.Duration, requestID string) {
	sl.WithFields(map[string]interface{}{
		"request_id":   requestID,
		"method":       method,
		"path":         path,
		"user_agent":   userAgent,
		"remote_addr":  remoteAddr,
		"status_code":  statusCode,
		"metric_request_count": 1,
		"metric_request_duration_ms": duration.Milliseconds(),
	}).Info("API request processed")
}

// LogTransaction logs a transaction processing event
func (sl *StructuredLogger) LogTransaction(transactionID, customerID string, amount float64, fraudScore float64, isFraud bool, processor string, duration time.Duration) {
	sl.WithFields(map[string]interface{}{
		"transaction_id": transactionID,
		"customer_id":    customerID,
		"amount":         amount,
		"fraud_score":    fraudScore,
		"is_fraud":       isFraud,
		"processor":      processor,
		"metric_transactions_total": 1,
		"metric_transaction_amount": amount,
		"metric_fraud_score": fraudScore,
	}).WithDuration(duration).Info("Transaction processed")
}

// LogQuantumProcessing logs quantum processing events
func (sl *StructuredLogger) LogQuantumProcessing(algorithm, backend string, qubits int, success bool, duration time.Duration, circuitDepth int) {
	sl.WithFields(map[string]interface{}{
		"algorithm":      algorithm,
		"backend":        backend,
		"qubits":         qubits,
		"success":        success,
		"circuit_depth":  circuitDepth,
		"metric_quantum_processing_total": 1,
		"metric_quantum_processing_duration_ms": duration.Milliseconds(),
		"metric_quantum_circuit_depth": circuitDepth,
	}).WithDuration(duration).Info("Quantum processing completed")
}

// LogError logs an error with context
func (sl *StructuredLogger) LogError(err error, operation string, context map[string]interface{}) {
	fields := map[string]interface{}{
		"operation": operation,
		"metric_errors_total": 1,
	}

	// Add context fields
	for k, v := range context {
		fields[k] = v
	}

	sl.WithFields(fields).WithError(err).Error("Operation failed")
}

// LogPerformance logs performance metrics
func (sl *StructuredLogger) LogPerformance(operation string, duration time.Duration, metadata map[string]interface{}) {
	fields := map[string]interface{}{
		"operation": operation,
		"metric_operation_duration_ms": duration.Milliseconds(),
	}

	// Add metadata fields
	for k, v := range metadata {
		fields[k] = v
	}

	sl.WithFields(fields).WithDuration(duration).Info("Performance metric")
}

// LogSecurityEvent logs security events
func (sl *StructuredLogger) LogSecurityEvent(eventType, description string, severity string, details map[string]interface{}) {
	fields := map[string]interface{}{
		"event_type":    eventType,
		"description":   description,
		"severity":      severity,
		"metric_security_events_total": 1,
	}

	// Add detail fields
	for k, v := range details {
		fields[k] = v
	}

	sl.WithFields(fields).Warn("Security event detected")
}

// LogBusinessMetric logs business metrics
func (sl *StructuredLogger) LogBusinessMetric(metricName string, value float64, unit string, dimensions map[string]string) {
	fields := map[string]interface{}{
		"metric_name": metricName,
		"value":       value,
		"unit":        unit,
		"metric_business_metric": 1,
	}

	// Add dimension fields
	for k, v := range dimensions {
		fields[k] = v
	}

	sl.WithFields(fields).Info("Business metric")
}

// ParseLogLevel parses a string into LogLevel
func ParseLogLevel(level string) LogLevel {
	switch strings.ToUpper(level) {
	case "TRACE":
		return TraceLevel
	case "DEBUG":
		return DebugLevel
	case "INFO", "INFORMATION":
		return InfoLevel
	case "WARN", "WARNING":
		return WarnLevel
	case "ERROR":
		return ErrorLevel
	case "FATAL":
		return FatalLevel
	case "PANIC":
		return PanicLevel
	default:
		return InfoLevel
	}
}

// ParseLogFormat parses a string into LogFormat
func ParseLogFormat(format string) LogFormat {
	switch strings.ToLower(format) {
	case "json":
		return LogFormatJSON
	case "console":
		return LogFormatConsole
	case "text":
		return LogFormatText
	default:
		return LogFormatJSON
	}
}

// ParseLogOutput parses a string into LogOutput
func ParseLogOutput(output string) LogOutput {
	switch strings.ToLower(output) {
	case "stdout":
		return LogOutputStdout
	case "stderr":
		return LogOutputStderr
	case "file":
		return LogOutputFile
	default:
		return LogOutputStdout
	}
}