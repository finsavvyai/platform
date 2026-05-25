//go:build ignore

package observability

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel/trace"
)

// StructuredLogger provides enhanced structured logging capabilities
type StructuredLogger struct {
	logger    *logrus.Logger
	component string
	version   string
	sanitizer *LogSanitizer
	extractor *FieldExtractor
	formatter *EnhancedJSONFormatter
}

// LogEntry represents a structured log entry
type LogEntry struct {
	Timestamp     time.Time              `json:"timestamp"`
	Level         string                 `json:"level"`
	Message       string                 `json:"message"`
	Component     string                 `json:"component"`
	Version       string                 `json:"version,omitempty"`
	TraceID       string                 `json:"trace_id,omitempty"`
	SpanID        string                 `json:"span_id,omitempty"`
	RequestID     string                 `json:"request_id,omitempty"`
	UserID        string                 `json:"user_id,omitempty"`
	TenantID      string                 `json:"tenant_id,omitempty"`
	CorrelationID string                 `json:"correlation_id,omitempty"`
	ServiceName   string                 `json:"service_name"`
	Environment   string                 `json:"environment"`
	Function      string                 `json:"function,omitempty"`
	File          string                 `json:"file,omitempty"`
	Line          int                    `json:"line,omitempty"`
	Duration      string                 `json:"duration,omitempty"`
	Error         *ErrorInfo             `json:"error,omitempty"`
	HTTP          *HTTPInfo              `json:"http,omitempty"`
	Metrics       map[string]interface{} `json:"metrics,omitempty"`
	Tags          []string               `json:"tags,omitempty"`
	Fields        map[string]interface{} `json:"fields,omitempty"`
}

// ErrorInfo contains error details for logging
type ErrorInfo struct {
	Type       string `json:"type"`
	Message    string `json:"message"`
	StackTrace string `json:"stack_trace,omitempty"`
	Code       string `json:"code,omitempty"`
	Retryable  bool   `json:"retryable,omitempty"`
}

// HTTPInfo contains HTTP request/response information
type HTTPInfo struct {
	Method       string            `json:"method"`
	URL          string            `json:"url"`
	StatusCode   int               `json:"status_code"`
	Host         string            `json:"host"`
	UserAgent    string            `json:"user_agent"`
	RemoteAddr   string            `json:"remote_addr"`
	Protocol     string            `json:"protocol"`
	Headers      map[string]string `json:"headers,omitempty"`
	BodySize     int64             `json:"body_size,omitempty"`
	ResponseTime string            `json:"response_time,omitempty"`
	RequestID    string            `json:"request_id,omitempty"`
}

// FieldExtractor extracts structured fields from various sources
type FieldExtractor struct {
	includeCaller     bool
	includeStackTrace bool
	customFields      map[string]interface{}
}

// LogSanitizer sanitizes sensitive information in logs
type LogSanitizer struct {
	sensitiveFields  []string
	sensitiveHeaders []string
	replacements     map[string]string
}

// EnhancedJSONFormatter provides enhanced JSON formatting
type EnhancedJSONFormatter struct {
	PrettyPrint    bool
	DisableColors  bool
	DisableQuote   bool
	EscapeHTML     bool
	TimestampField string
	LevelField     string
	MessageField   string
}

// NewStructuredLogger creates a new structured logger
func NewStructuredLogger(component, version string, config LoggingConfig) *StructuredLogger {
	logger := logrus.New()

	// Set up the enhanced formatter
	formatter := &EnhancedJSONFormatter{
		TimestampField: "timestamp",
		LevelField:     "level",
		MessageField:   "message",
		EscapeHTML:     true,
	}
	logger.SetFormatter(formatter)

	// Set log level
	level, _ := logrus.ParseLevel(string(config.Level))
	logger.SetLevel(level)

	// Set output
	if config.Output == "file" && config.File != "" {
		// Set up file output with rotation
		logger.SetOutput(&io.Writer{})
	} else {
		logger.SetOutput(os.Stdout)
	}

	return &StructuredLogger{
		logger:    logger,
		component: component,
		version:   version,
		sanitizer: NewLogSanitizer(config),
		extractor: NewFieldExtractor(config),
		formatter: formatter,
	}
}

// WithContext adds context information to the log entry
func (l *StructuredLogger) WithContext(ctx context.Context) *logrus.Entry {
	fields := logrus.Fields{
		"component": l.component,
		"version":   l.version,
	}

	// Add OpenTelemetry trace information
	if span := trace.SpanFromContext(ctx); span != nil {
		spanContext := span.SpanContext()
		if spanContext.HasTraceID() {
			fields["trace_id"] = spanContext.TraceID().String()
		}
		if spanContext.HasSpanID() {
			fields["span_id"] = spanContext.SpanID().String()
		}
	}

	// Add request ID from context
	if requestID := ctx.Value("request_id"); requestID != nil {
		fields["request_id"] = requestID
	}

	// Add user ID from context
	if userID := ctx.Value("user_id"); userID != nil {
		fields["user_id"] = userID
	}

	// Add tenant ID from context
	if tenantID := ctx.Value("tenant_id"); tenantID != nil {
		fields["tenant_id"] = tenantID
	}

	// Add correlation ID
	if correlationID := ctx.Value("correlation_id"); correlationID != nil {
		fields["correlation_id"] = correlationID
	} else {
		// Generate correlation ID if not present
		fields["correlation_id"] = uuid.New().String()
	}

	// Add custom fields
	for k, v := range l.extractor.customFields {
		fields[k] = v
	}

	return l.logger.WithFields(fields)
}

// WithError adds error information to the log entry
func (l *StructuredLogger) WithError(err error) *logrus.Entry {
	if err == nil {
		return l.logger.WithField("error", nil)
	}

	errorInfo := &ErrorInfo{
		Type:    fmt.Sprintf("%T", err),
		Message: err.Error(),
		Code:    extractErrorCode(err),
	}

	// Add stack trace if enabled
	if l.extractor.includeStackTrace {
		errorInfo.StackTrace = extractStackTrace(err)
	}

	// Check if error is retryable
	errorInfo.Retryable = isRetryableError(err)

	return l.logger.WithField("error", errorInfo)
}

// WithHTTPRequest adds HTTP request information to the log entry
func (l *StructuredLogger) WithHTTPRequest(r *http.Request) *logrus.Entry {
	if r == nil {
		return l.logger.WithField("http", nil)
	}

	httpInfo := &HTTPInfo{
		Method:     r.Method,
		URL:        l.sanitizer.SanitizeURL(r.URL.String()),
		Host:       r.Host,
		UserAgent:  r.UserAgent(),
		RemoteAddr: r.RemoteAddr,
		Protocol:   r.Proto,
		RequestID:  r.Header.Get("X-Request-ID"),
	}

	// Add sanitized headers
	if len(r.Header) > 0 {
		httpInfo.Headers = make(map[string]string)
		for k, v := range r.Header {
			if !l.isSensitiveHeader(k) {
				httpInfo.Headers[k] = strings.Join(v, ", ")
			}
		}
	}

	return l.logger.WithField("http", httpInfo)
}

// WithHTTPResponse adds HTTP response information to the log entry
func (l *StructuredLogger) WithHTTPResponse(resp *http.Response, duration time.Duration) *logrus.Entry {
	if resp == nil {
		return l.logger.WithField("http", nil)
	}

	httpInfo := &HTTPInfo{
		StatusCode:   resp.StatusCode,
		Host:         resp.Request.Host,
		Protocol:     resp.Request.Proto,
		ResponseTime: duration.String(),
	}

	// Get body size
	if resp.ContentLength > 0 {
		httpInfo.BodySize = resp.ContentLength
	}

	return l.logger.WithField("http", httpInfo)
}

// WithMetrics adds metrics to the log entry
func (l *StructuredLogger) WithMetrics(metrics map[string]interface{}) *logrus.Entry {
	return l.logger.WithField("metrics", metrics)
}

// WithTags adds tags to the log entry
func (l *StructuredLogger) WithTags(tags ...string) *logrus.Entry {
	return l.logger.WithField("tags", tags)
}

// WithFields adds custom fields to the log entry
func (l *StructuredLogger) WithFields(fields map[string]interface{}) *logrus.Entry {
	// Sanitize sensitive fields
	sanitized := make(map[string]interface{})
	for k, v := range fields {
		if !l.isSensitiveField(k) {
			sanitized[k] = v
		} else {
			sanitized[k] = "***REDACTED***"
		}
	}
	return l.logger.WithFields(sanitized)
}

// Log methods with enhanced functionality

func (l *StructuredLogger) Trace(args ...interface{}) {
	l.logger.Trace(args...)
}

func (l *StructuredLogger) Debug(args ...interface{}) {
	l.logger.Debug(args...)
}

func (l *StructuredLogger) Info(args ...interface{}) {
	l.logger.Info(args...)
}

func (l *StructuredLogger) Warn(args ...interface{}) {
	l.logger.Warn(args...)
}

func (l *StructuredLogger) Error(args ...interface{}) {
	l.logger.Error(args...)
}

func (l *StructuredLogger) Fatal(args ...interface{}) {
	l.logger.Fatal(args...)
}

func (l *StructuredLogger) Panic(args ...interface{}) {
	l.logger.Panic(args...)
}

// Formatted log methods
func (l *StructuredLogger) Tracef(format string, args ...interface{}) {
	l.logger.Tracef(format, args...)
}

func (l *StructuredLogger) Debugf(format string, args ...interface{}) {
	l.logger.Debugf(format, args...)
}

func (l *StructuredLogger) Infof(format string, args ...interface{}) {
	l.logger.Infof(format, args...)
}

func (l *StructuredLogger) Warnf(format string, args ...interface{}) {
	l.logger.Warnf(format, args...)
}

func (l *StructuredLogger) Errorf(format string, args ...interface{}) {
	l.logger.Errorf(format, args...)
}

func (l *StructuredLogger) Fatalf(format string, args ...interface{}) {
	l.logger.Fatalf(format, args...)
}

func (l *StructuredLogger) Panicf(format string, args ...interface{}) {
	l.logger.Panicf(format, args...)
}

// Request logging middleware
func (l *StructuredLogger) LogRequest(r *http.Request) {
	entry := l.WithContext(r.Context()).
		WithHTTPRequest(r).
		WithFields(map[string]interface{}{
			"event": "request_start",
		})

	entry.Info("Incoming request")
}

func (l *StructuredLogger) LogResponse(r *http.Request, resp *http.Response, duration time.Duration) {
	entry := l.WithContext(r.Context()).
		WithHTTPRequest(r).
		WithHTTPResponse(resp, duration).
		WithFields(map[string]interface{}{
			"event": "request_complete",
		})

	level := logrus.InfoLevel
	if resp.StatusCode >= 500 {
		level = logrus.ErrorLevel
	} else if resp.StatusCode >= 400 {
		level = logrus.WarnLevel
	}

	entry.Log(level, "Request completed")
}

// Helper methods

func (l *StructuredLogger) isSensitiveField(field string) bool {
	for _, sensitive := range l.sanitizer.sensitiveFields {
		if strings.Contains(strings.ToLower(field), strings.ToLower(sensitive)) {
			return true
		}
	}
	return false
}

func (l *StructuredLogger) isSensitiveHeader(header string) bool {
	for _, sensitive := range l.sanitizer.sensitiveHeaders {
		if strings.EqualFold(header, sensitive) {
			return true
		}
	}
	return false
}

// NewLogSanitizer creates a new log sanitizer
func NewLogSanitizer(config LoggingConfig) *LogSanitizer {
	sensitiveFields := []string{
		"password", "token", "secret", "key", "auth", "credential",
		"ssn", "social_security", "credit_card", "cc_number",
		"api_key", "private_key", "access_token", "refresh_token",
	}

	sensitiveHeaders := []string{
		"Authorization", "X-API-Key", "Cookie", "Set-Cookie",
		"X-Auth-Token", "X-Session-ID", "X-CSRF-Token",
	}

	if len(config.SanitizeFields) > 0 {
		sensitiveFields = append(sensitiveFields, config.SanitizeFields...)
	}

	return &LogSanitizer{
		sensitiveFields:  sensitiveFields,
		sensitiveHeaders: sensitiveHeaders,
		replacements:     make(map[string]string),
	}
}

// SanitizeURL sanitizes sensitive information in URLs
func (s *LogSanitizer) SanitizeURL(url string) string {
	// Remove query parameters that might contain sensitive data
	if idx := strings.Index(url, "?"); idx > 0 {
		url = url[:idx]
	}
	return url
}

// NewFieldExtractor creates a new field extractor
func NewFieldExtractor(config LoggingConfig) *FieldExtractor {
	return &FieldExtractor{
		includeCaller:     true,
		includeStackTrace: config.Level == LogLevelDebug || config.Level == LogLevelTrace,
		customFields:      config.Fields,
	}
}

// ExtractErrorCode extracts error code from error
func extractErrorCode(err error) string {
	type errorCoder interface {
		ErrorCode() string
	}

	if coder, ok := err.(errorCoder); ok {
		return coder.ErrorCode()
	}
	return ""
}

// ExtractStackTrace extracts stack trace from error
func extractStackTrace(err error) string {
	buf := &bytes.Buffer{}
	buf.Write([]byte(err.Error()))
	buf.Write([]byte("\n"))

	// Get stack trace
	for i := 2; ; i++ {
		pc, file, line, ok := runtime.Caller(i)
		if !ok {
			break
		}

		fn := runtime.FuncForPC(pc)
		if fn == nil {
			continue
		}

		buf.WriteString(fmt.Sprintf("  %s:%d %s\n", file, line, fn.Name()))
	}

	return buf.String()
}

// IsRetryableError checks if an error is retryable
func isRetryableError(err error) bool {
	// Check for common retryable error types
	errStr := strings.ToLower(err.Error())

	retryableErrors := []string{
		"connection refused",
		"connection reset",
		"timeout",
		"temporary failure",
		"service unavailable",
		"rate limit",
		"too many requests",
	}

	for _, retryable := range retryableErrors {
		if strings.Contains(errStr, retryable) {
			return true
		}
	}

	return false
}

// MarshalJSON implements custom JSON marshaling for LogEntry
func (e *LogEntry) MarshalJSON() ([]byte, error) {
	// Create a copy to avoid modifying the original
	entry := *e

	// Remove empty fields
	if entry.Error == nil {
		entry.Error = nil
	}
	if entry.HTTP == nil {
		entry.HTTP = nil
	}
	if len(entry.Metrics) == 0 {
		entry.Metrics = nil
	}
	if len(entry.Tags) == 0 {
		entry.Tags = nil
	}
	if len(entry.Fields) == 0 {
		entry.Fields = nil
	}

	return json.Marshal(entry)
}

// Format implements logrus.Formatter interface
func (f *EnhancedJSONFormatter) Format(entry *logrus.Entry) ([]byte, error) {
	data := make(logrus.Fields)

	// Convert all fields to the expected format
	for k, v := range entry.Data {
		switch k {
		case f.TimestampField:
			if ts, ok := v.(time.Time); ok {
				data["timestamp"] = ts.UTC().Format(time.RFC3339Nano)
			}
		case f.LevelField:
			if level, ok := v.(logrus.Level); ok {
				data["level"] = level.String()
			}
		case f.MessageField:
			data["message"] = fmt.Sprint(v)
		default:
			data[k] = v
		}
	}

	// Ensure required fields are present
	if _, ok := data["timestamp"]; !ok {
		data["timestamp"] = entry.Time.UTC().Format(time.RFC3339Nano)
	}
	if _, ok := data["level"]; !ok {
		data["level"] = entry.Level.String()
	}
	if _, ok := data["message"]; !ok {
		data["message"] = entry.Message
	}

	// Marshal to JSON
	var buf []byte
	if f.PrettyPrint {
		buf, _ = json.MarshalIndent(data, "", "  ")
	} else {
		buf, _ = json.Marshal(data)
	}

	// Add newline
	buf = append(buf, '\n')

	return buf, nil
}
