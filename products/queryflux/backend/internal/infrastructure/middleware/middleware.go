package middleware

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/infrastructure/logger"
	"github.com/queryflux/backend/internal/infrastructure/metrics"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// RequestContextKey is the type for context keys
type RequestContextKey string

const (
	RequestIDKey RequestContextKey = "request_id"
	UserIDKey    RequestContextKey = "user_id"
	LoggerKey    RequestContextKey = "logger"
)

// RequestID middleware adds a unique request ID to each request
func RequestID() gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		// Try to get existing request ID from header
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			// Generate new UUID
			requestID = uuid.New().String()
		}

		// Add to context
		c.Set(string(RequestIDKey), requestID)
		c.Header("X-Request-ID", requestID)

		// Add to logger context
		log := logger.GetGlobal().WithRequestID(requestID)
		c.Set(string(LoggerKey), log)

		c.Next()
	})
}

// Logging middleware logs HTTP requests
func Logging() gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		// Process request
		c.Next()

		// Calculate latency
		latency := time.Since(start)

		// Get request ID
		requestID, exists := c.Get(string(RequestIDKey))
		if !exists {
			requestID = "unknown"
		}

		// Get logger from context or use global
		var log *logger.Logger
		if loggerFromCtx, exists := c.Get(string(LoggerKey)); exists {
			log = loggerFromCtx.(*logger.Logger)
		} else {
			log = logger.GetGlobal().WithRequestID(requestID.(string))
		}

		// Build log fields
		fields := []zap.Field{
			zap.String("request_id", requestID.(string)),
			zap.String("method", c.Request.Method),
			zap.String("path", path),
			zap.Int("status", c.Writer.Status()),
			zap.Duration("latency", latency),
			zap.String("client_ip", c.ClientIP()),
			zap.String("user_agent", c.Request.UserAgent()),
		}

		// Add query string if present
		if raw != "" {
			fields = append(fields, zap.String("query", raw))
		}

		// Add user ID if present
		if userID, exists := c.Get(string(UserIDKey)); exists {
			fields = append(fields, zap.String("user_id", userID.(string)))
		}

		// Add response size
		if c.Writer.Size() > 0 {
			fields = append(fields, zap.Int("response_size", c.Writer.Size()))
		}

		// Add error if present
		if len(c.Errors) > 0 {
			fields = append(fields, zap.Error(c.Errors.Last()))
		}

		// Log based on status code
		if c.Writer.Status() >= 500 {
			log.Error("HTTP request", fields...)
		} else if c.Writer.Status() >= 400 {
			log.Warn("HTTP request", fields...)
		} else {
			log.Info("HTTP request", fields...)
		}
	})
}

// Metrics middleware collects HTTP metrics
func Metrics() gin.HandlerFunc {
	metricsInstance := metrics.GetGlobal()

	return gin.HandlerFunc(func(c *gin.Context) {
		start := time.Now()

		// Increment active connections
		metricsInstance.IncrementActiveConnections()
		defer metricsInstance.DecrementActiveConnections()

		// Get request size
		var requestSize int64
		if c.Request.ContentLength > 0 {
			requestSize = c.Request.ContentLength
		}

		// Process request
		c.Next()

		// Calculate duration
		duration := time.Since(start)

		// Get response size
		responseSize := int64(c.Writer.Size())

		// Record metrics
		statusCode := fmt.Sprintf("%d", c.Writer.Status())
		metricsInstance.RecordHTTPRequest(
			c.Request.Method,
			c.FullPath(),
			statusCode,
			duration,
			requestSize,
			responseSize,
		)
	})
}

// Recovery middleware recovers from panics and logs them
func Recovery() gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				// Get request ID
				requestID, exists := c.Get(string(RequestIDKey))
				if !exists {
					requestID = "unknown"
				}

				// Get logger from context or use global
				var log *logger.Logger
				if loggerFromCtx, exists := c.Get(string(LoggerKey)); exists {
					log = loggerFromCtx.(*logger.Logger)
				} else {
					log = logger.GetGlobal().WithRequestID(requestID.(string))
				}

				// Log panic
				log.Error("Request panic",
					zap.String("request_id", requestID.(string)),
					zap.String("method", c.Request.Method),
					zap.String("path", c.Request.URL.Path),
					zap.Any("panic", err),
					zap.Stack("stack"),
				)

				// Record metrics
				metrics.GetGlobal().RecordAlert("critical", "panic")

				// Return error response
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":      "Internal server error",
					"request_id": requestID,
				})

				c.Abort()
			}
		}()

		c.Next()
	})
}

// CORS middleware handles Cross-Origin Resource Sharing with configurable origins
func CORS() gin.HandlerFunc {
	allowedOrigins := parseAllowedOrigins()
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// Only set CORS headers for allowed origins
		if isAllowedOrigin(origin, allowedOrigins) {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
			c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, X-Request-ID")
			c.Header("Access-Control-Expose-Headers", "X-Request-ID")
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

// parseAllowedOrigins reads ALLOWED_ORIGINS env var (comma-separated)
func parseAllowedOrigins() []string {
	origins := os.Getenv("ALLOWED_ORIGINS")
	if origins == "" {
		return []string{"http://localhost:3000"}
	}
	parts := strings.Split(origins, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" && trimmed != "*" {
			result = append(result, trimmed)
		}
	}
	return result
}

// isAllowedOrigin checks if origin is in the allowlist
func isAllowedOrigin(origin string, allowed []string) bool {
	for _, a := range allowed {
		if a == origin {
			return true
		}
	}
	return false
}

// RateLimit middleware implements basic rate limiting
func RateLimit(rps int) gin.HandlerFunc {
	type client struct {
		lastSeen time.Time
		tokens   int
	}

	clients := make(map[string]*client)
	ticker := time.NewTicker(time.Second / time.Duration(rps))
	defer ticker.Stop()

	// Cleanup routine
	go func() {
		for range ticker.C {
			for ip, client := range clients {
				if time.Since(client.lastSeen) > time.Minute {
					delete(clients, ip)
				}
			}
		}
	}()

	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()

		if cl, exists := clients[ip]; exists {
			if cl.tokens > 0 {
				cl.tokens--
				cl.lastSeen = now
			} else {
				// Rate limit exceeded
				c.JSON(http.StatusTooManyRequests, gin.H{
					"error":       "Rate limit exceeded",
					"retry_after": time.Second,
				})
				c.Abort()
				return
			}
		} else {
			// New client
			clients[ip] = &client{
				lastSeen: now,
				tokens:   rps - 1,
			}
		}

		c.Next()
	}
}

// SecurityHeaders middleware adds security headers
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Security headers
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		c.Header("Content-Security-Policy", "default-src 'self'")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

		c.Next()
	}
}

// RequestSizeLimit middleware limits the size of requests
func RequestSizeLimit(maxSize int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.ContentLength > maxSize {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{
				"error":    "Request entity too large",
				"max_size": maxSize,
			})
			c.Abort()
			return
		}

		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxSize)
		c.Next()
	}
}

// Timeout middleware adds a timeout to requests
func Timeout(timeout time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), timeout)
		defer cancel()

		c.Request = c.Request.WithContext(ctx)

		done := make(chan struct{})
		go func() {
			defer func() {
				if err := recover(); err != nil {
					// Log timeout panic
					logger.GetGlobal().Error("Request timeout panic",
						zap.Any("panic", err),
						zap.Duration("timeout", timeout),
					)
				}
			}()

			c.Next()
			close(done)
		}()

		select {
		case <-done:
			// Request completed normally
		case <-ctx.Done():
			// Request timed out
			c.JSON(http.StatusRequestTimeout, gin.H{
				"error":   "Request timeout",
				"timeout": timeout.String(),
			})
			c.Abort()
		}
	}
}

// UserContext middleware extracts user information and adds it to the context
func UserContext() gin.HandlerFunc {
	return func(c *gin.Context) {
		// This is a placeholder - in a real implementation,
		// you would extract user information from JWT tokens or other auth mechanisms
		// and add the user ID to the context

		// For now, we'll skip this implementation
		c.Next()
	}
}

// SystemMetrics middleware collects system metrics periodically
func SystemMetrics() gin.HandlerFunc {
	metricsInstance := metrics.GetGlobal()

	// Start system metrics collection goroutine
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		var m runtime.MemStats
		lastGC := time.Now()

		for range ticker.C {
			// Memory metrics
			runtime.ReadMemStats(&m)
			metricsInstance.SetMemoryUsage(int64(m.Alloc))
			metricsInstance.SetGoroutines(runtime.NumGoroutine())

			// GC metrics
			if m.LastGC > 0 {
				gcTime := time.Unix(0, int64(m.LastGC))
				if !lastGC.IsZero() {
					metricsInstance.RecordGCDuration(gcTime.Sub(lastGC))
				}
				lastGC = gcTime
			}
		}
	}()

	return func(c *gin.Context) {
		c.Next()
	}
}

// HealthCheck middleware provides a health check endpoint
func HealthCheck(healthPath string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.URL.Path == healthPath {
			// This will be handled by the health check handler
			c.Next()
			return
		}
		c.Next()
	}
}

// GetRequestID retrieves the request ID from the context
func GetRequestID(c *gin.Context) string {
	if requestID, exists := c.Get(string(RequestIDKey)); exists {
		return requestID.(string)
	}
	return ""
}

// GetLogger retrieves the logger from the context
func GetLogger(c *gin.Context) *logger.Logger {
	if log, exists := c.Get(string(LoggerKey)); exists {
		return log.(*logger.Logger)
	}
	return logger.GetGlobal().WithRequestID(GetRequestID(c))
}

// GetUserID retrieves the user ID from the context
func GetUserID(c *gin.Context) string {
	if userID, exists := c.Get(string(UserIDKey)); exists {
		return userID.(string)
	}
	return ""
}

// SetUserID sets the user ID in the context
func SetUserID(c *gin.Context, userID string) {
	c.Set(string(UserIDKey), userID)
}
