package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

// Logger adds structured logging middleware
func Logger(logger *logrus.Logger) gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		logger.WithFields(logrus.Fields{
			"client_ip":   param.ClientIP,
			"method":      param.Method,
			"path":        param.Path,
			"status_code": param.StatusCode,
			"latency":     param.Latency,
			"user_agent":  param.Request.UserAgent(),
			"request_id":  param.Keys["request_id"],
		}).Info("Request processed")

		return ""
	})
}

// Recovery adds recovery middleware
func Recovery(logger *logrus.Logger) gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered interface{}) {
		logger.WithFields(logrus.Fields{
			"error":      recovered,
			"client_ip":  c.ClientIP(),
			"method":     c.Request.Method,
			"path":       c.Request.URL.Path,
			"request_id": c.GetString("request_id"),
		}).Error("Request recovered from panic")

		c.JSON(500, gin.H{
			"error":      "Internal server error",
			"request_id": c.GetString("request_id"),
		})
	})
}

// RequestID adds a unique request ID to each request
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}

		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)

		c.Next()
	}
}

// Tracing adds distributed tracing middleware
func Tracing() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract trace ID from headers or generate new one
		traceID := c.GetHeader("X-Trace-ID")
		if traceID == "" {
			traceID = uuid.New().String()
		}

		c.Set("trace_id", traceID)
		c.Header("X-Trace-ID", traceID)

		// Record start time
		start := time.Now()
		c.Set("start_time", start)

		c.Next()

		// Calculate duration
		duration := time.Since(start)
		c.Set("duration", duration)
	}
}

// Metrics adds metrics collection middleware
func Metrics() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		// Record metrics
		duration := time.Since(start)

		// This would integrate with your metrics system
		// Example: metrics.RecordRequest(c.Request.Method, c.Request.URL.Path, c.Writer.Status(), duration)

		// Add metrics headers
		c.Header("X-Response-Time", duration.String())
	}
}

// CORS adds CORS middleware
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, X-Request-ID, X-Trace-ID")
		c.Header("Access-Control-Expose-Headers", "X-Request-ID, X-Trace-ID, X-Rate-Limit-Remaining, X-Rate-Limit-Reset")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
