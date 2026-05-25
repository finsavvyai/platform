package logging

import (
	"fmt"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var logger *zap.Logger

// Config holds logging configuration
type Config struct {
	Level       string // debug, info, warn, error
	Format      string // json, console
	Environment string // development, production
}

// Init initializes the global logger
func Init(cfg Config) error {
	var config zap.Config

	if cfg.Environment == "production" {
		config = zap.NewProductionConfig()
		config.EncoderConfig.TimeKey = "timestamp"
		config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	} else {
		config = zap.NewDevelopmentConfig()
		config.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	}

	// Set log level
	switch cfg.Level {
	case "debug":
		config.Level = zap.NewAtomicLevelAt(zap.DebugLevel)
	case "info":
		config.Level = zap.NewAtomicLevelAt(zap.InfoLevel)
	case "warn":
		config.Level = zap.NewAtomicLevelAt(zap.WarnLevel)
	case "error":
		config.Level = zap.NewAtomicLevelAt(zap.ErrorLevel)
	default:
		config.Level = zap.NewAtomicLevelAt(zap.InfoLevel)
	}

	// Set output format
	if cfg.Format == "json" {
		config.Encoding = "json"
	} else {
		config.Encoding = "console"
	}

	var err error
	logger, err = config.Build(
		zap.AddCallerSkip(1),
		zap.AddStacktrace(zap.ErrorLevel),
	)
	if err != nil {
		return err
	}

	return nil
}

// Logger returns the global logger
func Logger() *zap.Logger {
	if logger == nil {
		// Fallback to default production logger
		logger, _ = zap.NewProduction()
	}
	return logger
}

// Sync flushes any buffered log entries
func Sync() {
	if logger != nil {
		_ = logger.Sync()
	}
}

// Helper functions for common log operations

func Debug(msg string, fields ...zap.Field) {
	Logger().Debug(msg, fields...)
}

func Info(msg string, fields ...zap.Field) {
	Logger().Info(msg, fields...)
}

func Warn(msg string, fields ...zap.Field) {
	Logger().Warn(msg, fields...)
}

func Error(msg string, fields ...zap.Field) {
	Logger().Error(msg, fields...)
}

func Fatal(msg string, fields ...zap.Field) {
	Logger().Fatal(msg, fields...)
	os.Exit(1)
}

// WithRequestID creates a logger with request ID context
func WithRequestID(requestID string) *zap.Logger {
	return Logger().With(zap.String("request_id", requestID))
}

// GinLogger returns a Gin middleware that logs requests using zap
func GinLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		// Get or generate request ID
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = generateRequestID()
		}
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)

		// Process request
		c.Next()

		// Log after request completes
		latency := time.Since(start)
		statusCode := c.Writer.Status()
		clientIP := c.ClientIP()
		method := c.Request.Method
		userAgent := c.Request.UserAgent()
		errorMsg := c.Errors.ByType(gin.ErrorTypePrivate).String()

		fields := []zap.Field{
			zap.String("request_id", requestID),
			zap.String("method", method),
			zap.String("path", path),
			zap.String("query", query),
			zap.Int("status", statusCode),
			zap.Duration("latency", latency),
			zap.String("client_ip", clientIP),
			zap.String("user_agent", userAgent),
			zap.Int("body_size", c.Writer.Size()),
		}

		// Add user ID if available
		if userID, exists := c.Get("user_id"); exists {
			fields = append(fields, zap.Any("user_id", userID))
		}

		// Add error if present
		if errorMsg != "" {
			fields = append(fields, zap.String("error", errorMsg))
		}

		// Log based on status code
		switch {
		case statusCode >= 500:
			Error("Server error", fields...)
		case statusCode >= 400:
			Warn("Client error", fields...)
		default:
			Info("Request completed", fields...)
		}
	}
}

// GinRecovery returns a Gin middleware that recovers from panics and logs them
func GinRecovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				requestID, _ := c.Get("request_id")
				Error("Panic recovered",
					zap.Any("error", err),
					zap.String("request_id", requestID.(string)),
					zap.String("path", c.Request.URL.Path),
					zap.String("method", c.Request.Method),
				)
				c.AbortWithStatus(500)
			}
		}()
		c.Next()
	}
}

// generateRequestID generates a unique request ID
func generateRequestID() string {
	return fmt.Sprintf("%x", time.Now().UnixNano()^int64(os.Getpid())<<32)
}
