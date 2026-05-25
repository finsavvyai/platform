package logging

import (
	"fmt"
	"io"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"gopkg.in/natefinch/lumberjack.v2"
)

// LogLevel represents the logging level
type LogLevel string

const (
	TraceLevel LogLevel = "trace"
	DebugLevel LogLevel = "debug"
	InfoLevel  LogLevel = "info"
	WarnLevel  LogLevel = "warn"
	ErrorLevel LogLevel = "error"
	FatalLevel LogLevel = "fatal"
	PanicLevel LogLevel = "panic"
)

// LogFormat represents the log format
type LogFormat string

const (
	JSONFormat LogFormat = "json"
	TextFormat LogFormat = "text"
)

// LoggerConfig contains configuration for the logger
type LoggerConfig struct {
	Level         LogLevel     `json:"level"`
	Format        LogFormat    `json:"format"`
	Output        string       `json:"output"`
	MaxSize       int          `json:"max_size"` // MB
	MaxBackups    int          `json:"max_backups"`
	MaxAge        int          `json:"max_age"` // days
	Compress      bool         `json:"compress"`
	ServiceName   string       `json:"service_name"`
	Version       string       `json:"version"`
	Environment   string       `json:"environment"`
	EnableConsole bool         `json:"enable_console"`
	EnableFile    bool         `json:"enable_file"`
	EnableCaller  bool         `json:"enable_caller"`
	EnableStack   bool         `json:"enable_stack"`
	ReportCaller  bool         `json:"report_caller"`
	Hooks         []HookConfig `json:"hooks"`
}

// HookConfig contains configuration for logging hooks
type HookConfig struct {
	Type    string                 `json:"type"`
	Enabled bool                   `json:"enabled"`
	Config  map[string]interface{} `json:"config"`
}

// StructuredLogger provides structured logging capabilities
type StructuredLogger struct {
	logger  *logrus.Logger
	config  LoggerConfig
	hooks   []logrus.Hook
	context map[string]interface{}
	mu      sync.RWMutex
}

// LogEntry represents a structured log entry
type LogEntry struct {
	Timestamp time.Time              `json:"timestamp"`
	Level     string                 `json:"level"`
	Message   string                 `json:"message"`
	Service   string                 `json:"service"`
	Version   string                 `json:"version"`
	TraceID   string                 `json:"trace_id,omitempty"`
	SpanID    string                 `json:"span_id,omitempty"`
	Caller    string                 `json:"caller,omitempty"`
	Function  string                 `json:"function,omitempty"`
	Fields    map[string]interface{} `json:"fields,omitempty"`
	Error     *ErrorInfo             `json:"error,omitempty"`
}

// ErrorInfo contains error details for logging
type ErrorInfo struct {
	Type       string `json:"type"`
	Message    string `json:"message"`
	StackTrace string `json:"stack_trace,omitempty"`
	Cause      string `json:"cause,omitempty"`
}

// TraceContext contains tracing information
type TraceContext struct {
	TraceID string
	SpanID  string
	Sampled bool
}

// NewStructuredLogger creates a new structured logger
func NewStructuredLogger(config LoggerConfig) (*StructuredLogger, error) {
	// Set default values
	if config.Level == "" {
		config.Level = InfoLevel
	}
	if config.Format == "" {
		config.Format = JSONFormat
	}
	if config.ServiceName == "" {
		config.ServiceName = "quantumbeam-api"
	}
	if config.Version == "" {
		config.Version = "1.0.0"
	}
	if config.Environment == "" {
		config.Environment = "development"
	}

	logger := logrus.New()
	sl := &StructuredLogger{
		logger:  logger,
		config:  config,
		hooks:   make([]logrus.Hook, 0),
		context: make(map[string]interface{}),
	}

	// Configure log level
	level, err := logrus.ParseLevel(string(config.Level))
	if err != nil {
		return nil, fmt.Errorf("invalid log level: %w", err)
	}
	logger.SetLevel(level)

	// Configure formatter
	switch config.Format {
	case JSONFormat:
		logger.SetFormatter(&logrus.JSONFormatter{
			TimestampFormat: time.RFC3339Nano,
			FieldMap: logrus.FieldMap{
				logrus.FieldKeyTime:  "timestamp",
				logrus.FieldKeyLevel: "level",
				logrus.FieldKeyMsg:   "message",
				logrus.FieldKeyFunc:  "function",
				logrus.FieldKeyFile:  "file",
			},
		})
	case TextFormat:
		logger.SetFormatter(&logrus.TextFormatter{
			FullTimestamp:   true,
			TimestampFormat: time.RFC3339Nano,
		})
	}

	// Configure output
	if err := sl.configureOutput(); err != nil {
		return nil, fmt.Errorf("failed to configure output: %w", err)
	}

	// Configure caller reporting
	logger.SetReportCaller(config.ReportCaller || config.EnableCaller)

	// Add default fields
	sl.addDefaultFields()

	// Initialize hooks
	if err := sl.initializeHooks(); err != nil {
		return nil, fmt.Errorf("failed to initialize hooks: %w", err)
	}

	return sl, nil
}

// configureOutput configures the logger output
func (sl *StructuredLogger) configureOutput() error {
	var writers []io.Writer

	// Console output
	if sl.config.EnableConsole {
		writers = append(writers, os.Stdout)
	}

	// File output
	if sl.config.EnableFile && sl.config.Output != "" {
		fileWriter := &lumberjack.Logger{
			Filename:   sl.config.Output,
			MaxSize:    sl.config.MaxSize,
			MaxBackups: sl.config.MaxBackups,
			MaxAge:     sl.config.MaxAge,
			Compress:   sl.config.Compress,
		}
		writers = append(writers, fileWriter)
	}

	if len(writers) == 0 {
		return fmt.Errorf("no output configured")
	}

	if len(writers) == 1 {
		sl.logger.SetOutput(writers[0])
	} else {
		sl.logger.SetOutput(io.MultiWriter(writers...))
	}

	return nil
}

// addDefaultFields adds default fields to all log entries
func (sl *StructuredLogger) addDefaultFields() {
	sl.logger.WithFields(logrus.Fields{
		"service":     sl.config.ServiceName,
		"version":     sl.config.Version,
		"environment": sl.config.Environment,
		"hostname":    sl.getHostname(),
	})
}

// initializeHooks initializes logging hooks
func (sl *StructuredLogger) initializeHooks() error {
	for _, hookConfig := range sl.config.Hooks {
		if !hookConfig.Enabled {
			continue
		}

		switch hookConfig.Type {
		case "elasticsearch":
			hook, err := NewElasticsearchHook(hookConfig.Config)
			if err != nil {
				return fmt.Errorf("failed to create elasticsearch hook: %w", err)
			}
			sl.logger.AddHook(hook)
		case "slack":
			hook, err := NewSlackHook(hookConfig.Config)
			if err != nil {
				return fmt.Errorf("failed to create slack hook: %w", err)
			}
			sl.logger.AddHook(hook)
		case "webhook":
			hook, err := NewWebhookHook(hookConfig.Config)
			if err != nil {
				return fmt.Errorf("failed to create webhook hook: %w", err)
			}
			sl.logger.AddHook(hook)
		}
	}

	return nil
}

// getHostname returns the current hostname
func (sl *StructuredLogger) getHostname() string {
	hostname, err := os.Hostname()
	if err != nil {
		hostname = "unknown"
	}
	return hostname
}

// WithContext adds context fields to the logger
func (sl *StructuredLogger) WithContext(fields map[string]interface{}) *StructuredLogger {
	sl.mu.Lock()
	defer sl.mu.Unlock()

	// Create a new logger with additional context
	newLogger := sl.logger.WithFields(fields)

	// Copy existing context
	newContext := make(map[string]interface{})
	for k, v := range sl.context {
		newContext[k] = v
	}

	newSL := &StructuredLogger{
		logger:  newLogger.Logger,
		config:  sl.config,
		hooks:   sl.hooks,
		context: newContext,
	}

	// Merge new context
	for k, v := range fields {
		newSL.context[k] = v
	}

	return newSL
}

// WithTraceContext adds trace context to the logger
func (sl *StructuredLogger) WithTraceContext(traceCtx TraceContext) *StructuredLogger {
	fields := map[string]interface{}{
		"trace_id": traceCtx.TraceID,
		"span_id":  traceCtx.SpanID,
		"sampled":  traceCtx.Sampled,
	}
	return sl.WithContext(fields)
}

// Trace logs a trace message
func (sl *StructuredLogger) Trace(args ...interface{}) {
	sl.logger.Trace(args...)
}

// Tracef logs a formatted trace message
func (sl *StructuredLogger) Tracef(format string, args ...interface{}) {
	sl.logger.Tracef(format, args...)
}

// Debug logs a debug message
func (sl *StructuredLogger) Debug(args ...interface{}) {
	sl.logger.Debug(args...)
}

// Debugf logs a formatted debug message
func (sl *StructuredLogger) Debugf(format string, args ...interface{}) {
	sl.logger.Debugf(format, args...)
}

// Info logs an info message
func (sl *StructuredLogger) Info(args ...interface{}) {
	sl.logger.Info(args...)
}

// Infof logs a formatted info message
func (sl *StructuredLogger) Infof(format string, args ...interface{}) {
	sl.logger.Infof(format, args...)
}

// Warn logs a warning message
func (sl *StructuredLogger) Warn(args ...interface{}) {
	sl.logger.Warn(args...)
}

// Warnf logs a formatted warning message
func (sl *StructuredLogger) Warnf(format string, args ...interface{}) {
	sl.logger.Warnf(format, args...)
}

// Error logs an error message
func (sl *StructuredLogger) Error(args ...interface{}) {
	sl.logger.Error(args...)
}

// Errorf logs a formatted error message
func (sl *StructuredLogger) Errorf(format string, args ...interface{}) {
	sl.logger.Errorf(format, args...)
}

// Fatal logs a fatal message and exits
func (sl *StructuredLogger) Fatal(args ...interface{}) {
	sl.logger.Fatal(args...)
}

// Fatalf logs a formatted fatal message and exits
func (sl *StructuredLogger) Fatalf(format string, args ...interface{}) {
	sl.logger.Fatalf(format, args...)
}

// Panic logs a panic message and panics
func (sl *StructuredLogger) Panic(args ...interface{}) {
	sl.logger.Panic(args...)
}

// Panicf logs a formatted panic message and panics
func (sl *StructuredLogger) Panicf(format string, args ...interface{}) {
	sl.logger.Panicf(format, args...)
}

// WithField adds a single field to the logger
func (sl *StructuredLogger) WithField(key string, value interface{}) *StructuredLogger {
	return sl.WithContext(map[string]interface{}{key: value})
}

// WithFields adds multiple fields to the logger
func (sl *StructuredLogger) WithFields(fields logrus.Fields) *StructuredLogger {
	contextFields := make(map[string]interface{})
	for k, v := range fields {
		contextFields[k] = v
	}
	return sl.WithContext(contextFields)
}

// WithError adds an error field to the logger
func (sl *StructuredLogger) WithError(err error) *StructuredLogger {
	if err == nil {
		return sl
	}

	fields := map[string]interface{}{
		"error": map[string]interface{}{
			"type":        fmt.Sprintf("%T", err),
			"message":     err.Error(),
			"stack_trace": sl.getStackTrace(),
		},
	}

	return sl.WithContext(fields)
}

// LogRequest logs an HTTP request
func (sl *StructuredLogger) LogRequest(c *gin.Context, duration time.Duration) {
	fields := logrus.Fields{
		"method":     c.Request.Method,
		"path":       c.Request.URL.Path,
		"query":      c.Request.URL.RawQuery,
		"status":     c.Writer.Status(),
		"duration":   duration.String(),
		"client_ip":  c.ClientIP(),
		"user_agent": c.Request.UserAgent(),
		"request_id": c.GetHeader("X-Request-ID"),
	}

	// Add request size if available
	if c.Request.ContentLength > 0 {
		fields["request_size"] = c.Request.ContentLength
	}

	// Add response size if available
	if c.Writer.Size() > 0 {
		fields["response_size"] = c.Writer.Size()
	}

	// Add trace headers if present
	if traceID := c.GetHeader("X-Trace-ID"); traceID != "" {
		fields["trace_id"] = traceID
	}
	if spanID := c.GetHeader("X-Span-ID"); spanID != "" {
		fields["span_id"] = spanID
	}

	sl.WithFields(fields).Info("HTTP request completed")
}

// LogBusinessEvent logs a business event
func (sl *StructuredLogger) LogBusinessEvent(eventType string, data map[string]interface{}) {
	fields := make(map[string]interface{})
	for k, v := range data {
		fields[k] = v
	}
	fields["event_type"] = eventType
	fields["timestamp"] = time.Now()

	sl.WithFields(fields).Info("Business event")
}

// LogSecurityEvent logs a security event
func (sl *StructuredLogger) LogSecurityEvent(eventType, description string, details map[string]interface{}) {
	fields := make(map[string]interface{})
	for k, v := range details {
		fields[k] = v
	}
	fields["security_event_type"] = eventType
	fields["description"] = description
	fields["severity"] = "high"
	fields["timestamp"] = time.Now()

	sl.WithFields(fields).Warn("Security event detected")
}

// LogPerformanceMetric logs a performance metric
func (sl *StructuredLogger) LogPerformanceMetric(metricName string, value float64, unit string, tags map[string]string) {
	fields := map[string]interface{}{
		"metric_name": metricName,
		"value":       value,
		"unit":        unit,
		"timestamp":   time.Now(),
	}

	for k, v := range tags {
		fields["tag_"+k] = v
	}

	sl.WithFields(fields).Info("Performance metric")
}

// LogError logs an error with context
func (sl *StructuredLogger) LogError(err error, context map[string]interface{}) {
	fields := make(map[string]interface{})
	for k, v := range context {
		fields[k] = v
	}

	sl.WithError(err).WithFields(fields).Error("Error occurred")
}

// getStackTrace returns the current stack trace
func (sl *StructuredLogger) getStackTrace() string {
	if !sl.config.EnableStack {
		return ""
	}

	buf := make([]byte, 1024)
	for {
		n := runtime.Stack(buf, false)
		if n < len(buf) {
			return string(buf[:n])
		}
		buf = make([]byte, 2*len(buf))
	}
}

// GetLogrusLogger returns the underlying logrus logger
func (sl *StructuredLogger) GetLogrusLogger() *logrus.Logger {
	return sl.logger
}

// GetConfig returns the current configuration
func (sl *StructuredLogger) GetConfig() LoggerConfig {
	return sl.config
}

// UpdateLevel updates the logging level
func (sl *StructuredLogger) UpdateLevel(level LogLevel) error {
	sl.config.Level = level
	logLevel, err := logrus.ParseLevel(string(level))
	if err != nil {
		return fmt.Errorf("invalid log level: %w", err)
	}
	sl.logger.SetLevel(logLevel)
	return nil
}

// Flush flushes any buffered logs
func (sl *StructuredLogger) Flush() error {
	// For most loggers, this is a no-op
	// Implement specific flushing logic if needed
	return nil
}

// Close closes the logger and releases resources
func (sl *StructuredLogger) Close() error {
	return sl.Flush()
}

// GinMiddleware returns a Gin middleware for structured logging
func (sl *StructuredLogger) GinMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		// Process request
		c.Next()

		// Skip logging for health checks to reduce noise
		if strings.HasPrefix(path, "/health") || strings.HasPrefix(path, "/metrics") {
			return
		}

		// Calculate duration
		duration := time.Since(start)

		// Create logger with request context
		requestLogger := sl.WithFields(logrus.Fields{
			"method":        c.Request.Method,
			"path":          path,
			"query":         raw,
			"status":        c.Writer.Status(),
			"latency":       duration,
			"client_ip":     c.ClientIP(),
			"user_agent":    c.Request.UserAgent(),
			"request_id":    c.GetHeader("X-Request-ID"),
			"request_size":  c.Request.ContentLength,
			"response_size": c.Writer.Size(),
		})

		// Add trace context if available
		if traceID := c.GetHeader("X-Trace-ID"); traceID != "" {
			requestLogger = requestLogger.WithField("trace_id", traceID)
		}
		if spanID := c.GetHeader("X-Span-ID"); spanID != "" {
			requestLogger = requestLogger.WithField("span_id", spanID)
		}

		// Log based on status code
		if c.Writer.Status() >= 500 {
			if len(c.Errors) > 0 {
				requestLogger.WithError(c.Errors.Last()).Error("Request failed with server error")
			} else {
				requestLogger.Error("Request failed with server error")
			}
		} else if c.Writer.Status() >= 400 {
			if len(c.Errors) > 0 {
				requestLogger.WithError(c.Errors.Last()).Warn("Request failed with client error")
			} else {
				requestLogger.Warn("Request failed with client error")
			}
		} else {
			requestLogger.Info("Request completed successfully")
		}
	}
}

// DefaultLogger returns a default structured logger instance
func DefaultLogger() (*StructuredLogger, error) {
	config := LoggerConfig{
		Level:         InfoLevel,
		Format:        JSONFormat,
		Output:        "logs/quantumbeam.log",
		MaxSize:       100,
		MaxBackups:    5,
		MaxAge:        30,
		Compress:      true,
		ServiceName:   "quantumbeam-api",
		Version:       "1.0.0",
		Environment:   "production",
		EnableConsole: true,
		EnableFile:    true,
		EnableCaller:  true,
		EnableStack:   false,
		ReportCaller:  true,
	}

	return NewStructuredLogger(config)
}

// DevelopmentLogger returns a development-friendly logger
func DevelopmentLogger() (*StructuredLogger, error) {
	config := LoggerConfig{
		Level:         DebugLevel,
		Format:        TextFormat,
		ServiceName:   "quantumbeam-api",
		Version:       "1.0.0",
		Environment:   "development",
		EnableConsole: true,
		EnableFile:    false,
		EnableCaller:  true,
		EnableStack:   true,
		ReportCaller:  true,
	}

	return NewStructuredLogger(config)
}

// ProductionLogger returns a production-optimized logger
func ProductionLogger(outputPath string) (*StructuredLogger, error) {
	config := LoggerConfig{
		Level:         InfoLevel,
		Format:        JSONFormat,
		Output:        outputPath,
		MaxSize:       500,
		MaxBackups:    10,
		MaxAge:        90,
		Compress:      true,
		ServiceName:   "quantumbeam-api",
		Version:       "1.0.0",
		Environment:   "production",
		EnableConsole: false,
		EnableFile:    true,
		EnableCaller:  false,
		EnableStack:   false,
		ReportCaller:  false,
	}

	return NewStructuredLogger(config)
}

// Mock implementations for hooks to satisfy compiler
func NewElasticsearchHook(config map[string]interface{}) (logrus.Hook, error) {
	return nil, nil // Return nil hook - effectively no-op or valid if interface allows
}

func NewSlackHook(config map[string]interface{}) (logrus.Hook, error) {
	return nil, nil
}

func NewWebhookHook(config map[string]interface{}) (logrus.Hook, error) {
	return nil, nil
}
