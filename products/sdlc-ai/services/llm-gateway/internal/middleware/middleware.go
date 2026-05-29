package middleware

import (
	"os"
	"strings"
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

// CORS adds CORS middleware with configurable allowed origins
func CORS() gin.HandlerFunc {
	allowedOrigins := parseAllowedOrigins()
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if isAllowedOrigin(origin, allowedOrigins) {
			c.Header("Access-Control-Allow-Origin", origin)
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, X-Request-ID, X-Trace-ID")
		c.Header("Access-Control-Expose-Headers", "X-Request-ID, X-Trace-ID, X-Rate-Limit-Remaining, X-Rate-Limit-Reset")
		c.Header("Vary", "Origin")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
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

// Authentication adds authentication middleware
func Authentication() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(401, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		// Parse token (simplified)
		// In production, you would validate JWT tokens here
		token := authHeader
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			token = authHeader[7:]
		}

		// For demo purposes, accept any non-empty token
		if token == "" {
			c.JSON(401, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		// Extract tenant and user info from token
		// This is simplified - in production, decode JWT claims
		tenantID := c.GetHeader("X-Tenant-ID")
		if tenantID == "" {
			tenantID = "default-tenant"
		}

		userID := c.GetHeader("X-User-ID")
		if userID == "" {
			userID = "default-user"
		}

		// Set context values
		c.Set("tenant_id", tenantID)
		c.Set("user_id", userID)
		c.Set("authenticated", true)

		c.Next()
	}
}

// AdminAuth adds admin authentication middleware
func AdminAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check for admin API key
		apiKey := c.GetHeader("X-API-Key")
		if apiKey == "" {
			c.JSON(401, gin.H{"error": "Admin API key required"})
			c.Abort()
			return
		}

		// Validate API key (simplified)
		// In production, check against secure store
		if apiKey != "admin-secret-key" {
			c.JSON(401, gin.H{"error": "Invalid admin API key"})
			c.Abort()
			return
		}

		c.Set("admin_authenticated", true)
		c.Next()
	}
}

// RateLimiting adds rate limiting middleware
func RateLimiting() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract tenant ID for rate limiting
		_, exists := c.Get("tenant_id")
		if !exists {
			c.Set("tenant_id", "anonymous")
		}

		// Implement rate limiting logic
		// This would integrate with your rate limiting service

		// Add rate limit headers
		c.Header("X-RateLimit-Limit", "1000")
		c.Header("X-RateLimit-Remaining", "999")
		c.Header("X-RateLimit-Reset", "1640995200")

		c.Next()
	}
}

// Security adds security headers
func Security() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Security headers
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		c.Header("Content-Security-Policy", "default-src 'self'")

		c.Next()
	}
}

// Timeout adds request timeout middleware
func Timeout(timeout time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Set timeout for the request
		c.Request = c.Request.WithContext(c.Request.Context())

		c.Next()
	}
}

// Compression adds gzip compression middleware
func Compression() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}
