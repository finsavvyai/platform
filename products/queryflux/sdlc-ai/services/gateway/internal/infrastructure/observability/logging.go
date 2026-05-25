package observability

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"runtime"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel/trace"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/config"
)

// LogLevel represents different logging levels
type LogLevel string

const (
	LogLevelTrace LogLevel = "trace"
	LogLevelDebug LogLevel = "debug"
	LogLevelInfo  LogLevel = "info"
	LogLevelWarn  LogLevel = "warn"
	LogLevelError LogLevel = "error"
	LogLevelFatal LogLevel = "fatal"
	LogLevelPanic LogLevel = "panic"
)

// LogFormat represents different log formats
type LogFormat string

const (
	LogFormatJSON LogFormat = "json"
	LogFormatText LogFormat = "text"
)

// LoggingConfig holds the logging configuration
type LoggingConfig struct {
	Level                 LogLevel          `yaml:"level"`
	Format                LogFormat         `yaml:"format"`
	Output                string            `yaml:"output"`
	File                  string            `yaml:"file"`
	MaxSize               int               `yaml:"max_size"`
	MaxAge                int               `yaml:"max_age"`
	MaxBackups            int               `yaml:"max_backups"`
	Compress              bool              `yaml:"compress"`
	EnableRequestLogging  bool              `yaml:"enable_request_logging"`
	EnableResponseLogging bool              `yaml:"enable_response_logging"`
	EnableBodyLogging     bool              `yaml:"enable_body_logging"`
	MaxBodySize           int               `yaml:"max_body_size"`
	SanitizeHeaders       bool              `yaml:"sanitize_headers"`
	SanitizeFields        []string          `yaml:"sanitize_fields"`
	Fields                map[string]string `yaml:"fields"`
}

// Logger wraps the logrus logger with additional functionality
type Logger struct {
	logger    *logrus.Logger
	config    LoggingConfig
	component string
}

// NewLogger creates a new logger with the given configuration
func NewLogger(config LoggingConfig, component string) *Logger {
	logger := logrus.New()

	// Set log level
	level, err := logrus.ParseLevel(string(config.Level))
	if err != nil {
		level = logrus.InfoLevel
	}
	logger.SetLevel(level)

	// Set formatter
	var formatter logrus.Formatter
	switch config.Format {
	case LogFormatJSON:
		formatter = &logrus.JSONFormatter{
			TimestampFormat: time.RFC3339Nano,
			FieldMap: logrus.FieldMap{
				logrus.FieldKeyTime:  "timestamp",
				logrus.FieldKeyLevel: "level",
				logrus.FieldKeyMsg:   "message",
				logrus.FieldKeyFunc:  "function",
				logrus.FieldKeyFile:  "file",
			},
		}
	default:
		formatter = &logrus.TextFormatter{
			FullTimestamp:   true,
			TimestampFormat: time.RFC3339Nano,
		}
	}
	logger.SetFormatter(formatter)

	// Set output
	switch config.Output {
	case "file":
		if config.File != "" {
			// TODO: Implement file output with rotation
			logger.SetOutput(&bytes.Buffer{}) // Temporary
		}
	default:
		logger.SetOutput(logrus.StandardLogger().Out)
	}

	return &Logger{
		logger:    logger,
		config:    config,
		component: component,
	}
}

// WithContext creates a logger entry with context fields
func (l *Logger) WithContext(ctx context.Context) *logrus.Entry {
	entry := l.logger.WithField("component", l.component)

	// Add trace context
	if span := trace.SpanFromContext(ctx); span.IsRecording() {
		spanContext := span.SpanContext()
		entry = entry.WithFields(logrus.Fields{
			"trace_id": spanContext.TraceID().String(),
			"span_id":  spanContext.SpanID().String(),
		})
	}

	// Add correlation context
	if corrCtx := GetCorrelationContext(ctx); corrCtx.RequestID != "" {
		entry = entry.WithFields(logrus.Fields{
			"request_id":     corrCtx.RequestID,
			"correlation_id": corrCtx.CorrelationID,
			"user_id":        corrCtx.UserID,
			"tenant_id":      corrCtx.TenantID,
			"session_id":     corrCtx.SessionID,
		})
	}

	// Add custom fields
	for k, v := range l.config.Fields {
		entry = entry.WithField(k, v)
	}

	return entry
}

// WithFields creates a logger entry with additional fields
func (l *Logger) WithFields(fields logrus.Fields) *logrus.Entry {
	return l.logger.WithFields(fields).WithField("component", l.component)
}

// WithField creates a logger entry with an additional field
func (l *Logger) WithField(key string, value interface{}) *logrus.Entry {
	return l.logger.WithField(key, value).WithField("component", l.component)
}

// Trace logs a trace message
func (l *Logger) Trace(args ...interface{}) {
	l.logger.WithField("component", l.component).Trace(args...)
}

// Tracef logs a trace message with formatting
func (l *Logger) Tracef(format string, args ...interface{}) {
	l.logger.WithField("component", l.component).Tracef(format, args...)
}

// Debug logs a debug message
func (l *Logger) Debug(args ...interface{}) {
	l.logger.WithField("component", l.component).Debug(args...)
}

// Debugf logs a debug message with formatting
func (l *Logger) Debugf(format string, args ...interface{}) {
	l.logger.WithField("component", l.component).Debugf(format, args...)
}

// Info logs an info message
func (l *Logger) Info(args ...interface{}) {
	l.logger.WithField("component", l.component).Info(args...)
}

// Infof logs an info message with formatting
func (l *Logger) Infof(format string, args ...interface{}) {
	l.logger.WithField("component", l.component).Infof(format, args...)
}

// Warn logs a warning message
func (l *Logger) Warn(args ...interface{}) {
	l.logger.WithField("component", l.component).Warn(args...)
}

// Warnf logs a warning message with formatting
func (l *Logger) Warnf(format string, args ...interface{}) {
	l.logger.WithField("component", l.component).Warnf(format, args...)
}

// Error logs an error message
func (l *Logger) Error(args ...interface{}) {
	l.logger.WithField("component", l.component).Error(args...)
}

// Errorf logs an error message with formatting
func (l *Logger) Errorf(format string, args ...interface{}) {
	l.logger.WithField("component", l.component).Errorf(format, args...)
}

// Fatal logs a fatal message and exits
func (l *Logger) Fatal(args ...interface{}) {
	l.logger.WithField("component", l.component).Fatal(args...)
}

// Fatalf logs a fatal message with formatting and exits
func (l *Logger) Fatalf(format string, args ...interface{}) {
	l.logger.WithField("component", l.component).Fatalf(format, args...)
}

// Panic logs a panic message and panics
func (l *Logger) Panic(args ...interface{}) {
	l.logger.WithField("component", l.component).Panic(args...)
}

// Panicf logs a panic message with formatting and panics
func (l *Logger) Panicf(format string, args ...interface{}) {
	l.logger.WithField("component", l.component).Panicf(format, args...)
}

// RequestLogger handles HTTP request/response logging
type RequestLogger struct {
	logger      *Logger
	enableBody  bool
	maxBodySize int
	sanitize    bool
	sensitive   map[string]bool
}

// NewRequestLogger creates a new request logger
func NewRequestLogger(logger *Logger) *RequestLogger {
	sensitive := make(map[string]bool)
	sensitiveHeaders := []string{
		"authorization", "cookie", "set-cookie",
		"x-api-key", "x-auth-token", "x-session-token",
		"password", "secret", "token",
	}

	for _, header := range sensitiveHeaders {
		sensitive[strings.ToLower(header)] = true
	}

	return &RequestLogger{
		logger:      logger,
		enableBody:  logger.config.EnableBodyLogging,
		maxBodySize: logger.config.MaxBodySize,
		sanitize:    logger.config.SanitizeHeaders,
		sensitive:   sensitive,
	}
}

// LogRequest logs an HTTP request
func (rl *RequestLogger) LogRequest(ctx context.Context, req *http.Request) {
	if !rl.logger.config.EnableRequestLogging {
		return
	}

	entry := rl.logger.WithContext(ctx).WithFields(logrus.Fields{
		"event":    "http.request",
		"method":   req.Method,
		"path":     req.URL.Path,
		"query":    req.URL.RawQuery,
		"host":     req.Host,
		"scheme":   req.URL.Scheme,
		"protocol": req.Proto,
		"remote":   req.RemoteAddr,
		"size":     req.ContentLength,
	})

	// Add headers
	headers := make(map[string]string)
	for name, values := range req.Header {
		if rl.sanitize && rl.sensitive[strings.ToLower(name)] {
			headers[name] = "***REDACTED***"
		} else {
			headers[name] = strings.Join(values, ", ")
		}
	}
	entry = entry.WithField("headers", headers)

	// Add body if enabled and present
	if rl.enableBody && req.Body != nil && req.ContentLength > 0 {
		if body := rl.readBody(req.Body); body != "" {
			entry = entry.WithField("body", body)
		}
	}

	entry.Info("HTTP request received")
}

// LogResponse logs an HTTP response
func (rl *RequestLogger) LogResponse(ctx context.Context, req *http.Request, resp *ResponseWriter, duration time.Duration) {
	if !rl.logger.config.EnableResponseLogging {
		return
	}

	entry := rl.logger.WithContext(ctx).WithFields(logrus.Fields{
		"event":       "http.response",
		"method":      req.Method,
		"path":        req.URL.Path,
		"status":      resp.statusCode,
		"size":        resp.size,
		"duration":    duration.Milliseconds(),
		"duration_ns": duration.Nanoseconds(),
	})

	// Add response headers
	headers := make(map[string]string)
	for name, values := range resp.Header() {
		if rl.sanitize && rl.sensitive[strings.ToLower(name)] {
			headers[name] = "***REDACTED***"
		} else {
			headers[name] = strings.Join(values, ", ")
		}
	}
	entry = entry.WithField("headers", headers)

	// Log based on status code
	switch {
	case resp.statusCode >= 500:
		entry.Error("HTTP response - server error")
	case resp.statusCode >= 400:
		entry.Warn("HTTP response - client error")
	case resp.statusCode >= 300:
		entry.Info("HTTP response - redirect")
	default:
		entry.Info("HTTP response - success")
	}
}

// readBody reads and returns the request body, truncating if necessary
func (rl *RequestLogger) readBody(body io.ReadCloser) string {
	if body == nil {
		return ""
	}

	// Read body
	buf, err := io.ReadAll(io.LimitReader(body, int64(rl.maxBodySize)))
	if err != nil {
		return fmt.Sprintf("Error reading body: %v", err)
	}

	// Create a new reader with the same content
	body.Close()
	body = io.NopCloser(bytes.NewReader(buf))

	// Convert to string and truncate if necessary
	bodyStr := string(buf)
	if len(bodyStr) > rl.maxBodySize {
		bodyStr = bodyStr[:rl.maxBodySize] + "... (truncated)"
	}

	// Try to format as JSON if possible
	if strings.Contains(bodyStr, "{") {
		var prettyJSON bytes.Buffer
		if err := json.Indent(&prettyJSON, buf, "", "  "); err == nil {
			return prettyJSON.String()
		}
	}

	return bodyStr
}

// ResponseWriter wraps http.ResponseWriter to capture status and size
type ResponseWriter struct {
	http.ResponseWriter
	statusCode int
	size       int
}

// NewResponseWriter creates a new response writer wrapper
func NewResponseWriter(w http.ResponseWriter) *ResponseWriter {
	return &ResponseWriter{
		ResponseWriter: w,
		statusCode:     http.StatusOK,
	}
}

// WriteHeader captures the status code
func (rw *ResponseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// Write captures the response size
func (rw *ResponseWriter) Write(b []byte) (int, error) {
	n, err := rw.ResponseWriter.Write(b)
	rw.size += n
	return n, err
}

// PerformanceLogger tracks performance metrics
type PerformanceLogger struct {
	logger *Logger
}

// NewPerformanceLogger creates a new performance logger
func NewPerformanceLogger(logger *Logger) *PerformanceLogger {
	return &PerformanceLogger{logger: logger}
}

// LogFunctionCall logs the duration of a function call
func (pl *PerformanceLogger) LogFunctionCall(ctx context.Context, functionName string, start time.Time, args ...interface{}) {
	duration := time.Since(start)

	entry := pl.logger.WithContext(ctx).WithFields(logrus.Fields{
		"event":       "function.call",
		"function":    functionName,
		"duration":    duration.Milliseconds(),
		"duration_ns": duration.Nanoseconds(),
		"args":        fmt.Sprintf("%v", args),
	})

	if duration > time.Second {
		entry.Warn("Slow function call")
	} else {
		entry.Debug("Function call completed")
	}
}

// LogGoroutineInfo logs goroutine information
func (pl *PerformanceLogger) LogGoroutineInfo(ctx context.Context) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	entry := pl.logger.WithContext(ctx).WithFields(logrus.Fields{
		"event":        "system.metrics",
		"goroutines":   runtime.NumGoroutine(),
		"memory_alloc": m.Alloc,
		"memory_sys":   m.Sys,
		"num_gc":       m.NumGC,
	})

	entry.Info("System metrics")
}

// LogSystemInfo logs system information
func (pl *PerformanceLogger) LogSystemInfo(ctx context.Context) {
	entry := pl.logger.WithContext(ctx).WithFields(logrus.Fields{
		"event":      "system.info",
		"go_version": runtime.Version(),
		"go_os":      runtime.GOOS,
		"go_arch":    runtime.GOARCH,
		"num_cpu":    runtime.NumCPU(),
	})

	entry.Info("System information")
}

// SecurityLogger handles security-related logging
type SecurityLogger struct {
	logger *Logger
}

// NewSecurityLogger creates a new security logger
func NewSecurityLogger(logger *Logger) *SecurityLogger {
	return &SecurityLogger{logger: logger}
}

// LogAuthEvent logs authentication events
func (sl *SecurityLogger) LogAuthEvent(ctx context.Context, eventType, userID, clientID string, success bool, reason string) {
	entry := sl.logger.WithContext(ctx).WithFields(logrus.Fields{
		"event":     "auth.event",
		"type":      eventType,
		"user_id":   userID,
		"client_id": clientID,
		"success":   success,
		"reason":    reason,
	})

	if success {
		entry.Info("Authentication successful")
	} else {
		entry.Warn("Authentication failed")
	}
}

// LogAuthzEvent logs authorization events
func (sl *SecurityLogger) LogAuthzEvent(ctx context.Context, resource, action, userID, decision string) {
	entry := sl.logger.WithContext(ctx).WithFields(logrus.Fields{
		"event":    "authz.event",
		"resource": resource,
		"action":   action,
		"user_id":  userID,
		"decision": decision,
	})

	if decision == "allow" {
		entry.Info("Authorization granted")
	} else {
		entry.Warn("Authorization denied")
	}
}

// LogSecurityEvent logs generic security events
func (sl *SecurityLogger) LogSecurityEvent(ctx context.Context, eventType, severity, description string, details map[string]interface{}) {
	entry := sl.logger.WithContext(ctx).WithFields(logrus.Fields{
		"event":       "security.event",
		"type":        eventType,
		"severity":    severity,
		"description": description,
	})

	for k, v := range details {
		entry = entry.WithField(k, v)
	}

	switch severity {
	case "critical", "high":
		entry.Error("Security event")
	case "medium":
		entry.Warn("Security event")
	default:
		entry.Info("Security event")
	}
}

// Global logger instances
var (
	globalLogger      *Logger
	globalLoggers     = make(map[string]*Logger)
	requestLogger     *RequestLogger
	performanceLogger *PerformanceLogger
	securityLogger    *SecurityLogger
)

// InitializeGlobalLogging initializes the global logging system
func InitializeGlobalLogging(cfg *config.Config) error {
	loggingConfig := LoggingConfig{
		Level:                 LogLevel(cfg.Logging.Level),
		Format:                LogFormat(cfg.Logging.Format),
		Output:                cfg.Logging.Output,
		File:                  cfg.Logging.File,
		MaxSize:               cfg.Logging.MaxSize,
		MaxAge:                cfg.Logging.MaxAge,
		MaxBackups:            cfg.Logging.MaxBackups,
		Compress:              cfg.Logging.Compress,
		EnableRequestLogging:  true,
		EnableResponseLogging: true,
		EnableBodyLogging:     false,     // Disabled by default for security
		MaxBodySize:           1024 * 64, // 64KB
		SanitizeHeaders:       true,
		SanitizeFields: []string{
			"password", "secret", "token", "key",
			"authorization", "cookie", "session",
		},
		Fields: map[string]string{
			"service":     "gateway",
			"version":     cfg.Version,
			"environment": cfg.Environment,
			"instance_id": cfg.InstanceID,
		},
	}

	globalLogger = NewLogger(loggingConfig, "gateway")
	requestLogger = NewRequestLogger(globalLogger)
	performanceLogger = NewPerformanceLogger(globalLogger)
	securityLogger = NewSecurityLogger(globalLogger)

	globalLogger.Info("Global logging system initialized")

	return nil
}

// GetGlobalLogger returns the global logger
func GetGlobalLogger() *Logger {
	if globalLogger == nil {
		// Fallback to basic logger if global not initialized
		return NewLogger(LoggingConfig{
			Level:  LogLevelInfo,
			Format: LogFormatJSON,
		}, "fallback")
	}
	return globalLogger
}

// GetGlobalLoggerForComponent returns a global logger for a specific component
func GetGlobalLoggerForComponent(component string) *Logger {
	if globalLogger == nil {
		return NewLogger(LoggingConfig{
			Level:  LogLevelInfo,
			Format: LogFormatJSON,
		}, component)
	}

	if logger, exists := globalLoggers[component]; exists {
		return logger
	}

	logger := &Logger{
		logger:    globalLogger.logger,
		config:    globalLogger.config,
		component: component,
	}
	globalLoggers[component] = logger
	return logger
}

// GetRequestLogger returns the global request logger
func GetRequestLogger() *RequestLogger {
	if requestLogger == nil {
		return NewRequestLogger(GetGlobalLogger())
	}
	return requestLogger
}

// GetPerformanceLogger returns the global performance logger
func GetPerformanceLogger() *PerformanceLogger {
	if performanceLogger == nil {
		return NewPerformanceLogger(GetGlobalLogger())
	}
	return performanceLogger
}

// GetSecurityLogger returns the global security logger
func GetSecurityLogger() *SecurityLogger {
	if securityLogger == nil {
		return NewSecurityLogger(GetGlobalLogger())
	}
	return securityLogger
}

// Convenience functions using global logger

func LogRequest(ctx context.Context, req *http.Request) {
	GetRequestLogger().LogRequest(ctx, req)
}

func LogResponse(ctx context.Context, req *http.Request, resp *ResponseWriter, duration time.Duration) {
	GetRequestLogger().LogResponse(ctx, req, resp, duration)
}

func LogAuthEvent(ctx context.Context, eventType, userID, clientID string, success bool, reason string) {
	GetSecurityLogger().LogAuthEvent(ctx, eventType, userID, clientID, success, reason)
}

func LogAuthzEvent(ctx context.Context, resource, action, userID, decision string) {
	GetSecurityLogger().LogAuthzEvent(ctx, resource, action, userID, decision)
}

func LogSecurityEvent(ctx context.Context, eventType, severity, description string, details map[string]interface{}) {
	GetSecurityLogger().LogSecurityEvent(ctx, eventType, severity, description, details)
}
