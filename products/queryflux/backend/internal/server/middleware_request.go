package server

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/queryflux/backend/internal/infrastructure/logger"
	"github.com/queryflux/backend/internal/infrastructure/metrics"
)

// RequestTrackingMiddleware adds request ID and logs HTTP requests
func (s *Server) RequestTrackingMiddleware() gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		// Get request ID from context
		requestID, _ := param.Keys["request_id"].(string)
		if requestID == "" {
			requestID = "unknown"
		}

		// Get user ID from context if available
		userID, _ := param.Keys["user_id"].(string)

		// Create structured log entry
		logEntry := s.logger.WithFields(map[string]interface{}{
			"request_id":   requestID,
			"method":       param.Method,
			"path":         param.Path,
			"status_code":  param.StatusCode,
			"latency":      param.Latency,
			"client_ip":    param.ClientIP,
			"user_agent":   param.Request.UserAgent(),
			"request_size": param.Request.ContentLength,
		})

		if userID != "" {
			logEntry = logEntry.WithFields(map[string]interface{}{
				"user_id": userID,
			})
		}

		// Add error information if present
		if param.ErrorMessage != "" {
			logEntry = logEntry.WithFields(map[string]interface{}{
				"error": param.ErrorMessage,
			})
		}

		// Log based on status code
		if param.StatusCode >= 500 {
			logEntry.Error("HTTP request failed")
		} else if param.StatusCode >= 400 {
			logEntry.Warn("HTTP request error")
		} else {
			logEntry.Info("HTTP request completed")
		}

		// Return empty string since we're logging manually
		return ""
	})
}

// RequestIDMiddleware adds a unique request ID to each request
func RequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check if request ID already exists (from upstream)
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = c.GetHeader("X-Correlation-ID")
		}
		if requestID == "" {
			requestID = uuid.New().String()
		}

		// Set request ID in context and response header
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)

		// Add request ID to logger in context
		if logger := logger.GetGlobal(); logger != nil {
			c.Set("logger", logger.WithRequestID(requestID))
		}

		c.Next()
	}
}

// MetricsMiddleware records HTTP metrics
func (s *Server) MetricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		method := c.Request.Method

		// Get request size
		var requestSize int64
		if c.Request.Body != nil {
			requestSize = c.Request.ContentLength
		}

		// Increment active connections
		if s.metrics != nil {
			s.metrics.IncrementActiveConnections()
		}

		// Process request
		c.Next()

		// Calculate metrics
		duration := time.Since(start)
		statusCode := fmt.Sprintf("%d", c.Writer.Status())

		// Get response size
		var responseSize int64
		if c.Writer != nil {
			responseSize = int64(c.Writer.Size())
		}

		// Record metrics
		if s.metrics != nil {
			s.metrics.RecordHTTPRequest(method, path, statusCode, duration, requestSize, responseSize)
			s.metrics.DecrementActiveConnections()
		}

		// Add duration to context for logging
		c.Set("duration", duration)
	}
}

// SecurityMiddleware adds security headers
func SecurityMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Security headers
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

		// Add CORS headers for development — use env-based origins
		if gin.Mode() == gin.DebugMode {
			origin := c.Request.Header.Get("Origin")
			if origin != "" {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Vary", "Origin")
			}
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, X-Request-ID")
		}

		c.Next()
	}
}

// CORSMiddleware handles CORS
func CORSMiddleware(allowedOrigins []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// Check if origin is allowed
		allowed := false
		for _, allowedOrigin := range allowedOrigins {
			if allowedOrigin == "*" || allowedOrigin == origin {
				allowed = true
				break
			}
		}

		if allowed {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, X-Request-ID")
			c.Header("Access-Control-Allow-Credentials", "true")
		}

		// Handle preflight requests
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// RecoveryMiddleware recovers from panics and logs them
func RecoveryMiddleware() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered interface{}) {
		// Get logger from context or use global
		var log *logger.Logger
		if l, exists := c.Get("logger"); exists {
			log = l.(*logger.Logger)
		} else {
			log = logger.GetGlobal()
		}

		// Get request ID
		requestID, _ := c.Get("request_id")

		// Log the panic with stack trace
		log.WithFields(map[string]interface{}{
			"request_id": requestID,
			"method":     c.Request.Method,
			"path":       c.Request.URL.Path,
			"panic":      recovered,
			"stack":      string(debug.Stack()),
		}).Error("Request panic recovered")

		// Record metrics
		if metrics := metrics.GetGlobal(); metrics != nil {
			metrics.RecordAlert("critical", "panic")
		}

		// Return error response
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":      "Internal server error",
			"request_id": requestID,
		})
	})
}

// TimeoutMiddleware adds request timeout
func TimeoutMiddleware(timeout time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), timeout)
		defer cancel()

		c.Request = c.Request.WithContext(ctx)

		done := make(chan struct{})
		go func() {
			defer func() {
				if err := recover(); err != nil {
					// Handle panic in goroutine
					c.JSON(http.StatusInternalServerError, gin.H{
						"error": "Internal server error",
					})
				}
				close(done)
			}()
			c.Next()
		}()

		select {
		case <-done:
			// Request completed normally
		case <-ctx.Done():
			// Request timed out
			c.JSON(http.StatusRequestTimeout, gin.H{
				"error": "Request timeout",
			})
			c.Abort()
		}
	}
}

// BasicRateLimitMiddleware implements basic rate limiting.
func BasicRateLimitMiddleware(requestsPerMinute int) gin.HandlerFunc {
	// Simple in-memory rate limiter (replace with Redis for production)
	clients := make(map[string][]time.Time)

	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		now := time.Now()

		// Clean old entries
		if timestamps, exists := clients[clientIP]; exists {
			var validTimestamps []time.Time
			for _, timestamp := range timestamps {
				if now.Sub(timestamp) < time.Minute {
					validTimestamps = append(validTimestamps, timestamp)
				}
			}
			clients[clientIP] = validTimestamps
		}

		// Check rate limit
		if len(clients[clientIP]) >= requestsPerMinute {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Rate limit exceeded",
			})
			c.Abort()
			return
		}

		// Add current request
		clients[clientIP] = append(clients[clientIP], now)

		c.Next()
	}
}

// RequestSizeLimitMiddleware limits request size
func RequestSizeLimitMiddleware(maxSize int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.ContentLength > maxSize {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{
				"error": fmt.Sprintf("Request too large. Maximum size is %d bytes", maxSize),
			})
			c.Abort()
			return
		}

		// Wrap the request body to limit reading
		if c.Request.Body != nil {
			c.Request.Body = &limitedReader{
				reader: c.Request.Body,
				limit:  maxSize,
			}
		}

		c.Next()
	}
}

// limitedReader wraps a reader to limit the number of bytes read
type limitedReader struct {
	reader io.ReadCloser
	limit  int64
	read   int64
}

func (lr *limitedReader) Read(p []byte) (n int, err error) {
	if lr.read >= lr.limit {
		return 0, fmt.Errorf("request size limit exceeded")
	}

	max := len(p)
	if int64(max) > lr.limit-lr.read {
		max = int(lr.limit - lr.read)
	}

	n, err = lr.reader.Read(p[:max])
	lr.read += int64(n)
	return n, err
}

func (lr *limitedReader) Close() error {
	return lr.reader.Close()
}

// TruncateRequestBodyMiddleware truncates request body for logging
func TruncateRequestBodyMiddleware(maxSize int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Body != nil {
			// Read body
			body, err := io.ReadAll(c.Request.Body)
			if err != nil {
				c.Next()
				return
			}

			// Store body for logging
			if len(body) > 0 {
				if int64(len(body)) > maxSize {
					// Truncate body
					truncated := body[:maxSize]
					c.Set("request_body", string(truncated)+"... [truncated]")
				} else {
					c.Set("request_body", string(body))
				}
			}

			// Restore body for reading
			c.Request.Body = io.NopCloser(bytes.NewBuffer(body))
		}

		c.Next()
	}
}

// ContentTypeMiddleware ensures JSON content type for API endpoints
func ContentTypeMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip for certain paths
		if strings.HasPrefix(c.Request.URL.Path, "/health") ||
			strings.HasPrefix(c.Request.URL.Path, "/metrics") ||
			c.Request.Method == "GET" {
			c.Next()
			return
		}

		contentType := c.GetHeader("Content-Type")
		if contentType != "" && !strings.Contains(contentType, "application/json") &&
			c.Request.Method != "GET" && c.Request.Method != "DELETE" {
			c.JSON(http.StatusUnsupportedMediaType, gin.H{
				"error": "Content-Type must be application/json",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
