package logger

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

// Logger wraps zap logger with additional functionality
type Logger struct {
	*zap.Logger
	level string
}

// Config holds logger configuration
type Config struct {
	Level       string `json:"level"`
	Format      string `json:"format"` // "json" or "console"
	Output      string `json:"output"` // "stdout", "stderr", or file path
	Development bool   `json:"development"`

	// Log rotation configuration
	Rotation *RotationConfig `json:"rotation,omitempty"`
}

// RotationConfig holds log rotation configuration
type RotationConfig struct {
	MaxSize    int  `json:"max_size"`    // Max megabytes before rotation
	MaxAge     int  `json:"max_age"`     // Max days to retain old logs
	MaxBackups int  `json:"max_backups"` // Max number of old log files to retain
	Compress   bool `json:"compress"`    // Compress rotated log files
	LocalTime  bool `json:"local_time"`  // Use local time for file timestamps
}

// DefaultConfig returns default logger configuration
func DefaultConfig() *Config {
	return &Config{
		Level:       "info",
		Format:      "json",
		Output:      "stdout",
		Development: false,
		Rotation: &RotationConfig{
			MaxSize:    100, // 100MB
			MaxAge:     30,  // 30 days
			MaxBackups: 10,  // 10 backup files
			Compress:   true,
			LocalTime:  false,
		},
	}
}

// New creates a new logger with the given configuration
func New(cfg *Config) (*Logger, error) {
	if cfg == nil {
		cfg = DefaultConfig()
	}

	// Parse log level
	level, err := parseLogLevel(cfg.Level)
	if err != nil {
		return nil, err
	}

	// Create encoder config
	encoderConfig := getEncoderConfig(cfg.Development)

	// Create encoder
	var encoder zapcore.Encoder
	if cfg.Format == "console" {
		encoder = zapcore.NewConsoleEncoder(encoderConfig)
	} else {
		encoder = zapcore.NewJSONEncoder(encoderConfig)
	}

	// Create write syncer
	writeSyncer, err := getWriteSyncer(cfg.Output, cfg.Rotation)
	if err != nil {
		return nil, err
	}

	// Create core
	core := zapcore.NewCore(encoder, writeSyncer, level)

	// Create options
	var options []zap.Option
	if cfg.Development {
		options = append(options, zap.Development())
	}

	// Add caller information
	options = append(options, zap.AddCaller(), zap.AddStacktrace(zapcore.ErrorLevel))

	// Create logger
	zapLogger := zap.New(core, options...)

	return &Logger{
		Logger: zapLogger,
		level:  cfg.Level,
	}, nil
}

// NewDevelopment creates a development logger
func NewDevelopment() (*Logger, error) {
	cfg := &Config{
		Level:       "debug",
		Format:      "console",
		Output:      "stdout",
		Development: true,
	}
	return New(cfg)
}

// NewProduction creates a production logger
func NewProduction() (*Logger, error) {
	cfg := &Config{
		Level:       "info",
		Format:      "json",
		Output:      "stdout",
		Development: false,
	}
	return New(cfg)
}

// parseLogLevel converts string log level to zapcore.Level
func parseLogLevel(level string) (zapcore.Level, error) {
	switch strings.ToLower(level) {
	case "debug":
		return zapcore.DebugLevel, nil
	case "info":
		return zapcore.InfoLevel, nil
	case "warn", "warning":
		return zapcore.WarnLevel, nil
	case "error":
		return zapcore.ErrorLevel, nil
	case "fatal":
		return zapcore.FatalLevel, nil
	case "panic":
		return zapcore.PanicLevel, nil
	default:
		return zapcore.InfoLevel, fmt.Errorf("unknown log level: %s", level)
	}
}

// getEncoderConfig returns the encoder configuration
func getEncoderConfig(development bool) zapcore.EncoderConfig {
	if development {
		return zapcore.EncoderConfig{
			TimeKey:        "timestamp",
			LevelKey:       "level",
			NameKey:        "logger",
			CallerKey:      "caller",
			MessageKey:     "message",
			StacktraceKey:  "stacktrace",
			LineEnding:     zapcore.DefaultLineEnding,
			EncodeLevel:    zapcore.CapitalColorLevelEncoder,
			EncodeTime:     zapcore.ISO8601TimeEncoder,
			EncodeDuration: zapcore.StringDurationEncoder,
			EncodeCaller:   zapcore.ShortCallerEncoder,
		}
	}

	return zapcore.EncoderConfig{
		TimeKey:        "timestamp",
		LevelKey:       "level",
		NameKey:        "logger",
		CallerKey:      "caller",
		FunctionKey:    "function",
		MessageKey:     "message",
		StacktraceKey:  "stacktrace",
		LineEnding:     zapcore.DefaultLineEnding,
		EncodeLevel:    zapcore.LowercaseLevelEncoder,
		EncodeTime:     zapcore.EpochTimeEncoder,
		EncodeDuration: zapcore.SecondsDurationEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
	}
}

// getWriteSyncer creates a write syncer based on output configuration
func getWriteSyncer(output string, rotation *RotationConfig) (zapcore.WriteSyncer, error) {
	switch output {
	case "stdout", "":
		return os.Stdout, nil
	case "stderr":
		return os.Stderr, nil
	default:
		// Assume it's a file path
		if rotation != nil {
			// Create directory if it doesn't exist
			dir := filepath.Dir(output)
			if err := os.MkdirAll(dir, 0755); err != nil {
				return nil, fmt.Errorf("failed to create log directory: %w", err)
			}

			// Use lumberjack for log rotation
			lj := &lumberjack.Logger{
				Filename:   output,
				MaxSize:    rotation.MaxSize,
				MaxAge:     rotation.MaxAge,
				MaxBackups: rotation.MaxBackups,
				Compress:   rotation.Compress,
				LocalTime:  rotation.LocalTime,
			}
			return zapcore.AddSync(lj), nil
		} else {
			// No rotation - simple file writer
			if err := os.MkdirAll(filepath.Dir(output), 0755); err != nil {
				return nil, fmt.Errorf("failed to create log directory: %w", err)
			}

			file, err := os.OpenFile(output, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
			if err != nil {
				return nil, err
			}
			return file, nil
		}
	}
}

// WithRequestID adds a request ID to the logger
func (l *Logger) WithRequestID(requestID string) *Logger {
	return &Logger{
		Logger: l.Logger.With(zap.String("request_id", requestID)),
		level:  l.level,
	}
}

// WithUserID adds a user ID to the logger
func (l *Logger) WithUserID(userID string) *Logger {
	return &Logger{
		Logger: l.Logger.With(zap.String("user_id", userID)),
		level:  l.level,
	}
}

// WithComponent adds a component name to the logger
func (l *Logger) WithComponent(component string) *Logger {
	return &Logger{
		Logger: l.Logger.With(zap.String("component", component)),
		level:  l.level,
	}
}

// WithFields adds multiple fields to the logger
func (l *Logger) WithFields(fields map[string]interface{}) *Logger {
	zapFields := make([]zap.Field, 0, len(fields))
	for key, value := range fields {
		zapFields = append(zapFields, zap.Any(key, value))
	}
	return &Logger{
		Logger: l.Logger.With(zapFields...),
		level:  l.level,
	}
}

// WithError adds an error field to the logger
func (l *Logger) WithError(err error) *Logger {
	return &Logger{
		Logger: l.Logger.With(zap.Error(err)),
		level:  l.level,
	}
}

// WithDuration adds a duration field to the logger
func (l *Logger) WithDuration(d time.Duration) *Logger {
	return &Logger{
		Logger: l.Logger.With(zap.Duration("duration", d)),
		level:  l.level,
	}
}

// Sync synchronizes the logger (flushes buffers)
func (l *Logger) Sync() error {
	return l.Logger.Sync()
}

// GetLevel returns the current log level as string
func (l *Logger) GetLevel() string {
	return l.level
}

// SetLevel changes the log level
func (l *Logger) SetLevel(level string) error {
	// Validate the level
	_, err := parseLogLevel(level)
	if err != nil {
		return fmt.Errorf("invalid log level '%s': %w", level, err)
	}

	// For this implementation, we only update the stored level
	// Zap doesn't support dynamic level decreases properly
	// In a real implementation, you would recreate the logger core
	l.level = level
	return nil
}

// LogRequest logs an HTTP request with structured fields
func (l *Logger) LogRequest(method, path, clientIP, userAgent string, statusCode int, duration time.Duration, requestID string, userID ...string) {
	fields := []zap.Field{
		zap.String("event_type", "http_request"),
		zap.String("method", method),
		zap.String("path", path),
		zap.String("client_ip", clientIP),
		zap.String("user_agent", userAgent),
		zap.Int("status_code", statusCode),
		zap.Duration("duration", duration),
		zap.String("request_id", requestID),
	}

	if len(userID) > 0 && userID[0] != "" {
		fields = append(fields, zap.String("user_id", userID[0]))
	}

	// Log based on status code
	switch {
	case statusCode >= 500:
		l.Error("HTTP request failed", fields...)
	case statusCode >= 400:
		l.Warn("HTTP request error", fields...)
	default:
		l.Info("HTTP request completed", fields...)
	}
}

// LogPanic logs a panic with stack trace
func (l *Logger) LogPanic(recovered interface{}, stack []byte, requestID, method, path string) {
	l.Error("Panic recovered",
		zap.Any("panic", recovered),
		zap.ByteString("stack", stack),
		zap.String("event_type", "panic"),
		zap.String("request_id", requestID),
		zap.String("method", method),
		zap.String("path", path),
	)
}

// LogDatabaseOperation logs database operations
func (l *Logger) LogDatabaseOperation(operation, table string, duration time.Duration, success bool, error error, requestID string, userID ...string) {
	fields := []zap.Field{
		zap.String("event_type", "database_operation"),
		zap.String("operation", operation),
		zap.String("table", table),
		zap.Duration("duration", duration),
		zap.Bool("success", success),
		zap.String("request_id", requestID),
	}

	if !success && error != nil {
		fields = append(fields, zap.Error(error))
	}

	if len(userID) > 0 && userID[0] != "" {
		fields = append(fields, zap.String("user_id", userID[0]))
	}

	if success {
		l.Info("Database operation completed", fields...)
	} else {
		l.Error("Database operation failed", fields...)
	}
}

// LogAuthenticationEvent logs authentication events
func (l *Logger) LogAuthenticationEvent(event, userID, clientIP string, success bool, error error, requestID string) {
	fields := []zap.Field{
		zap.String("event_type", "authentication"),
		zap.String("auth_event", event),
		zap.String("client_ip", clientIP),
		zap.Bool("success", success),
		zap.String("request_id", requestID),
	}

	if userID != "" {
		fields = append(fields, zap.String("user_id", userID))
	}

	if !success && error != nil {
		fields = append(fields, zap.Error(error))
	}

	if success {
		l.Info("Authentication event", fields...)
	} else {
		l.Warn("Authentication failed", fields...)
	}
}

// LogSystemMetrics logs system metrics
func (l *Logger) LogSystemMetrics(metrics map[string]interface{}) {
	fields := []zap.Field{
		zap.String("event_type", "system_metrics"),
	}

	for key, value := range metrics {
		fields = append(fields, zap.Any(key, value))
	}

	l.Info("System metrics", fields...)
}

// LogAlert logs alerts
func (l *Logger) LogAlert(severity, message string, details map[string]string, requestID string) {
	fields := []zap.Field{
		zap.String("event_type", "alert"),
		zap.String("severity", severity),
		zap.String("message", message),
		zap.String("request_id", requestID),
	}

	for key, value := range details {
		fields = append(fields, zap.String(key, value))
	}

	switch severity {
	case "critical":
		l.Error("Critical alert", fields...)
	case "warning":
		l.Warn("Warning alert", fields...)
	default:
		l.Info("Alert", fields...)
	}
}

// LogBusinessEvent logs business events
func (l *Logger) LogBusinessEvent(event string, userID string, data map[string]interface{}, requestID string) {
	fields := []zap.Field{
		zap.String("event_type", "business_event"),
		zap.String("business_event", event),
		zap.String("request_id", requestID),
	}

	if userID != "" {
		fields = append(fields, zap.String("user_id", userID))
	}

	for key, value := range data {
		fields = append(fields, zap.Any(key, value))
	}

	l.Info("Business event", fields...)
}

// AuditLog logs audit events
func (l *Logger) AuditLog(action, resource, userID string, success bool, details map[string]string, requestID string) {
	fields := []zap.Field{
		zap.String("event_type", "audit"),
		zap.String("action", action),
		zap.String("resource", resource),
		zap.String("user_id", userID),
		zap.Bool("success", success),
		zap.String("request_id", requestID),
	}

	for key, value := range details {
		fields = append(fields, zap.String(key, value))
	}

	if success {
		l.Info("Audit log", fields...)
	} else {
		l.Warn("Audit log - failed", fields...)
	}
}

// Global logger instance
var globalLogger *Logger

// InitGlobal initializes the global logger
func InitGlobal(cfg *Config) error {
	logger, err := New(cfg)
	if err != nil {
		return err
	}
	globalLogger = logger
	return nil
}

// GetGlobal returns the global logger
func GetGlobal() *Logger {
	if globalLogger == nil {
		// Fallback to default logger
		logger, _ := New(DefaultConfig())
		globalLogger = logger
	}
	return globalLogger
}

// Global convenience functions
func Debug(msg string, fields ...zap.Field) {
	GetGlobal().Debug(msg, fields...)
}

func Info(msg string, fields ...zap.Field) {
	GetGlobal().Info(msg, fields...)
}

func Warn(msg string, fields ...zap.Field) {
	GetGlobal().Warn(msg, fields...)
}

func Error(msg string, fields ...zap.Field) {
	GetGlobal().Error(msg, fields...)
}

func Fatal(msg string, fields ...zap.Field) {
	GetGlobal().Fatal(msg, fields...)
}

func Panic(msg string, fields ...zap.Field) {
	GetGlobal().Panic(msg, fields...)
}
