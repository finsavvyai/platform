//go:build legacy_migrated
// +build legacy_migrated

package monitoring

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"runtime"
	"time"

	"github.com/google/uuid"
	"log/slog"
)

// LogLevel represents the severity level of a log entry
type LogLevel string

const (
	LevelDebug LogLevel = "DEBUG"
	LevelInfo  LogLevel = "INFO"
	LevelWarn  LogLevel = "WARN"
	LevelError LogLevel = "ERROR"
	LevelFatal LogLevel = "FATAL"
)

// LogEntry represents a structured log entry
type LogEntry struct {
	Timestamp    time.Time              `json:"timestamp"`
	Level        LogLevel               `json:"level"`
	Message      string                 `json:"message"`
	CorrelationID string                `json:"correlation_id,omitempty"`
	UserID       string                 `json:"user_id,omitempty"`
	RequestID    string                 `json:"request_id,omitempty"`
	Service      string                 `json:"service"`
	Component    string                 `json:"component,omitempty"`
	Function     string                 `json:"function,omitempty"`
	Duration     time.Duration          `json:"duration,omitempty"`
	Error        string                 `json:"error,omitempty"`
	ErrorCode    string                 `json:"error_code,omitempty"`
	StackTrace   string                 `json:"stack_trace,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
	AuditEvent   bool                   `json:"audit_event"`
	Sensitive    bool                   `json:"sensitive"`
}

// LoggingConfig holds configuration for the logging service
type LoggingConfig struct {
	ServiceName    string
	Environment    string // development, staging, production
	LogLevel       LogLevel
	EnableConsole  bool
	EnableJSON     bool
	LogFile        string
	EnableAuditLog bool
	AuditLogFile   string
	EnableCorrelationIDs bool
}

// LoggingService provides structured logging with correlation IDs and audit trails
type LoggingService struct {
	config      LoggingConfig
	logger      *slog.Logger
	auditLogger *slog.Logger
}

// NewLoggingService creates a new logging service with the given configuration
func NewLoggingService(config LoggingConfig) (*LoggingService, error) {
	// Set default values
	if config.ServiceName == "" {
		config.ServiceName = "quantumbeam-api"
	}
	if config.Environment == "" {
		config.Environment = "development"
	}
	if config.LogLevel == "" {
		config.LogLevel = LevelInfo
	}

	// Create logging options
	opts := &slog.HandlerOptions{
		Level: levelFromSlogLevel(string(config.LogLevel)),
	}

	var handler slog.Handler

	// Determine handler based on configuration
	if config.EnableJSON || config.Environment == "production" {
		// JSON handler for production
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		// Text handler for development
		handler = slog.NewTextHandler(os.Stdout, opts)
	}

	// Create main logger
	logger := slog.New(handler)

	var auditLogger *slog.Logger
	if config.EnableAuditLog {
		auditHandler := slog.NewJSONHandler(getAuditLogFile(config.AuditLogFile), opts)
		auditLogger = slog.New(auditHandler)
	}

	return &LoggingService{
		config:      config,
		logger:      logger,
		auditLogger: auditLogger,
	}, nil
}

// levelFromSlogLevel converts string level to slog.Level
func levelFromSlogLevel(level string) slog.Level {
	switch level {
	case "DEBUG":
		return slog.LevelDebug
	case "INFO":
		return slog.LevelInfo
	case "WARN":
		return slog.LevelWarn
	case "ERROR":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// getAuditLogFile returns a file handle for the audit log
func getAuditLogFile(filename string) *os.File {
	if filename == "" {
		filename = "logs/audit.log"
	}

	// Ensure directory exists
	if err := os.MkdirAll("logs", 0755); err != nil {
		fmt.Printf("Failed to create logs directory: %v\n", err)
		return os.Stdout
	}

	file, err := os.OpenFile(filename, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		fmt.Printf("Failed to open audit log file: %v\n", err)
		return os.Stdout
	}

	return file
}

// createLogEntry creates a new log entry with common fields
func (ls *LoggingService) createLogEntry(level LogLevel, message string, metadata ...map[string]interface{}) *LogEntry {
	entry := &LogEntry{
		Timestamp:  time.Now().UTC(),
		Level:      level,
		Message:    message,
		Service:    ls.config.ServiceName,
		AuditEvent: false,
		Sensitive:  false,
	}

	// Add metadata if provided
	if len(metadata) > 0 {
		if entry.Metadata == nil {
			entry.Metadata = make(map[string]interface{})
		}
		for k, v := range metadata[0] {
			entry.Metadata[k] = v
		}
	}

	// Add runtime information
	if entry.Metadata == nil {
		entry.Metadata = make(map[string]interface{})
	}
	entry.Metadata["runtime_version"] = runtime.Version()
	entry.Metadata["go_os"] = runtime.GOOS
	entry.Metadata["go_arch"] = runtime.GOARCH

	return entry
}

// addCallerInfo adds caller information to the log entry
func (ls *LoggingService) addCallerInfo(entry *LogEntry, skip int) {
	pc, file, line, ok := runtime.Caller(skip + 1)
	if !ok {
		return
	}

	// Get function name
	fn := runtime.FuncForPC(pc)
	if fn != nil {
		entry.Function = fn.Name()
	}

	// Add file and line info to metadata
	if entry.Metadata == nil {
		entry.Metadata = make(map[string]interface{})
	}
	entry.Metadata["file"] = file
	entry.Metadata["line"] = line
}

// log logs the entry using the appropriate logger
func (ls *LoggingService) log(entry *LogEntry) {
	// Prepare slog attributes
	attrs := []slog.Attr{
		slog.String("service", entry.Service),
		slog.Time("timestamp", entry.Timestamp),
	}

	if entry.CorrelationID != "" {
		attrs = append(attrs, slog.String("correlation_id", entry.CorrelationID))
	}

	if entry.UserID != "" {
		attrs = append(attrs, slog.String("user_id", entry.UserID))
	}

	if entry.RequestID != "" {
		attrs = append(attrs, slog.String("request_id", entry.RequestID))
	}

	if entry.Component != "" {
		attrs = append(attrs, slog.String("component", entry.Component))
	}

	if entry.Function != "" {
		attrs = append(attrs, slog.String("function", entry.Function))
	}

	if entry.Duration != 0 {
		attrs = append(attrs, slog.Duration("duration", entry.Duration))
	}

	if entry.Error != "" {
		attrs = append(attrs, slog.String("error", entry.Error))
	}

	if entry.ErrorCode != "" {
		attrs = append(attrs, slog.String("error_code", entry.ErrorCode))
	}

	if entry.StackTrace != "" {
		attrs = append(attrs, slog.String("stack_trace", entry.StackTrace))
	}

	// Add metadata
	for k, v := range entry.Metadata {
		attrs = append(attrs, slog.Any(k, v))
	}

	// Determine slog level
	var level slog.Level
	switch entry.Level {
	case LevelDebug:
		level = slog.LevelDebug
	case LevelInfo:
		level = slog.LevelInfo
	case LevelWarn:
		level = slog.LevelWarn
	case LevelError:
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}

	// Log to appropriate logger
	if entry.AuditEvent && ls.auditLogger != nil {
		ls.auditLogger.LogAttrs(context.Background(), level, entry.Message, attrs...)
	} else {
		ls.logger.LogAttrs(context.Background(), level, entry.Message, attrs...)
	}
}

// Debug logs a debug message
func (ls *LoggingService) Debug(message string, metadata ...map[string]interface{}) {
	entry := ls.createLogEntry(LevelDebug, message, metadata...)
	ls.addCallerInfo(entry, 1)
	ls.log(entry)
}

// Info logs an info message
func (ls *LoggingService) Info(message string, metadata ...map[string]interface{}) {
	entry := ls.createLogEntry(LevelInfo, message, metadata...)
	ls.addCallerInfo(entry, 1)
	ls.log(entry)
}

// Warn logs a warning message
func (ls *LoggingService) Warn(message string, metadata ...map[string]interface{}) {
	entry := ls.createLogEntry(LevelWarn, message, metadata...)
	ls.addCallerInfo(entry, 1)
	ls.log(entry)
}

// Error logs an error message
func (ls *LoggingService) Error(message string, err error, metadata ...map[string]interface{}) {
	entry := ls.createLogEntry(LevelError, message, metadata...)
	ls.addCallerInfo(entry, 1)

	if err != nil {
		entry.Error = err.Error()
		// Add stack trace for errors in development
		if ls.config.Environment == "development" {
			entry.StackTrace = getStackTrace()
		}
	}

	ls.log(entry)
}

// Fatal logs a fatal message and exits
func (ls *LoggingService) Fatal(message string, err error, metadata ...map[string]interface{}) {
	entry := ls.createLogEntry(LevelFatal, message, metadata...)
	ls.addCallerInfo(entry, 1)

	if err != nil {
		entry.Error = err.Error()
		entry.StackTrace = getStackTrace()
	}

	ls.log(entry)
	os.Exit(1)
}

// WithCorrelationID creates a new logging context with correlation ID
func (ls *LoggingService) WithCorrelationID(correlationID string) *LoggingContext {
	return &LoggingContext{
		service:        ls,
		correlationID:  correlationID,
		metadata:       make(map[string]interface{}),
	}
}

// WithRequest creates a new logging context for a request
func (ls *LoggingService) WithRequest(requestID, userID string) *LoggingContext {
	return &LoggingContext{
		service:     ls,
		requestID:   requestID,
		userID:      userID,
		metadata:    make(map[string]interface{}),
	}
}

// Audit logs an audit event
func (ls *LoggingService) Audit(message string, userID string, metadata ...map[string]interface{}) {
	entry := ls.createLogEntry(LevelInfo, message, metadata...)
	entry.AuditEvent = true
	entry.UserID = userID

	// Add audit-specific metadata
	if entry.Metadata == nil {
		entry.Metadata = make(map[string]interface{})
	}
	entry.Metadata["audit_event"] = true
	entry.Metadata["timestamp"] = time.Now().UTC()

	ls.log(entry)
}

// LoggingContext provides contextual logging with pre-populated fields
type LoggingContext struct {
	service       *LoggingService
	correlationID string
	requestID     string
	userID        string
	component     string
	metadata      map[string]interface{}
}

// WithMetadata adds metadata to the logging context
func (lc *LoggingContext) WithMetadata(metadata map[string]interface{}) *LoggingContext {
	for k, v := range metadata {
		lc.metadata[k] = v
	}
	return lc
}

// WithComponent sets the component for the logging context
func (lc *LoggingContext) WithComponent(component string) *LoggingContext {
	lc.component = component
	return lc
}

// Debug logs a debug message with context
func (lc *LoggingContext) Debug(message string, additionalMetadata ...map[string]interface{}) {
	lc.logWithContext(LevelDebug, message, additionalMetadata...)
}

// Info logs an info message with context
func (lc *LoggingContext) Info(message string, additionalMetadata ...map[string]interface{}) {
	lc.logWithContext(LevelInfo, message, additionalMetadata...)
}

// Warn logs a warning message with context
func (lc *LoggingContext) Warn(message string, additionalMetadata ...map[string]interface{}) {
	lc.logWithContext(LevelWarn, message, additionalMetadata...)
}

// Error logs an error message with context
func (lc *LoggingContext) Error(message string, err error, additionalMetadata ...map[string]interface{}) {
	lc.logWithContext(LevelError, message, additionalMetadata..., "error", err.Error())
}

// Audit logs an audit event with context
func (lc *LoggingContext) Audit(message string, additionalMetadata ...map[string]interface{}) {
	entry := lc.service.createLogEntry(LevelInfo, message, additionalMetadata...)
	entry.AuditEvent = true
	entry.CorrelationID = lc.correlationID
	entry.RequestID = lc.requestID
	entry.UserID = lc.userID
	entry.Component = lc.component

	// Merge context metadata
	if entry.Metadata == nil {
		entry.Metadata = make(map[string]interface{})
	}
	for k, v := range lc.metadata {
		entry.Metadata[k] = v
	}
	entry.Metadata["audit_event"] = true

	lc.service.log(entry)
}

// logWithContext logs a message with the context fields
func (lc *LoggingContext) logWithContext(level LogLevel, message string, additionalMetadata ...map[string]interface{}) {
	entry := lc.service.createLogEntry(level, message, additionalMetadata...)
	entry.CorrelationID = lc.correlationID
	entry.RequestID = lc.requestID
	entry.UserID = lc.userID
	entry.Component = lc.component

	// Merge context metadata
	if entry.Metadata == nil {
		entry.Metadata = make(map[string]interface{})
	}
	for k, v := range lc.metadata {
		entry.Metadata[k] = v
	}

	lc.service.addCallerInfo(entry, 1)
	lc.service.log(entry)
}

// getStackTrace returns the current stack trace as a string
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

// GenerateCorrelationID generates a new correlation ID
func GenerateCorrelationID() string {
	return uuid.New().String()
}

// LoggerMiddleware returns middleware that adds correlation IDs to requests
func (ls *LoggingService) LoggerMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Generate or extract correlation ID
			correlationID := r.Header.Get("X-Correlation-ID")
			if correlationID == "" {
				correlationID = GenerateCorrelationID()
			}

			// Add correlation ID to response headers
			w.Header().Set("X-Correlation-ID", correlationID)

			// Create logging context for this request
			logger := ls.WithCorrelationID(correlationID).WithRequest(
				r.Header.Get("X-Request-ID"),
				r.Header.Get("X-User-ID"),
			).WithComponent("http_server")

			// Log request start
			logger.Info("Request started", map[string]interface{}{
				"method": r.Method,
				"path":   r.URL.Path,
				"query":  r.URL.RawQuery,
				"remote": r.RemoteAddr,
				"user_agent": r.UserAgent(),
			})

			// Continue processing
			next.ServeHTTP(w, r)
		})
	}
}