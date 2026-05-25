package middleware

import (
	"fmt"
	"log"
	"net/http"
	"runtime/debug"
	"time"

	"github.com/gin-gonic/gin"
)

// ErrorResponse represents a standardized error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Code    string `json:"code"`
	Details string `json:"details,omitempty"`
	Request struct {
		Method string `json:"method"`
		Path   string `json:"path"`
	} `json:"request"`
	Timestamp string `json:"timestamp"`
}

// ErrorHandler middleware catches panics and returns JSON error responses
func ErrorHandler() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered interface{}) {
		// Log the panic with stack trace
		log.Printf("Panic recovered: %v\n%s", recovered, debug.Stack())

		// Determine error message
		var err string
		if e, ok := recovered.(string); ok {
			err = e
		} else {
			err = "Internal server error"
		}

		// Don't expose internal errors in production
		errorMsg := err
		if gin.Mode() == gin.ReleaseMode {
			errorMsg = "Internal server error"
		}

		response := ErrorResponse{
			Error:   errorMsg,
			Code:    "INTERNAL_ERROR",
			Details: "An unexpected error occurred while processing your request",
			Request: struct {
				Method string `json:"method"`
				Path   string `json:"path"`
			}{
				Method: c.Request.Method,
				Path:   c.Request.URL.Path,
			},
			Timestamp: time.Now().Format(time.RFC3339),
		}

		c.JSON(http.StatusInternalServerError, response)
	})
}

// RequestLogger middleware logs HTTP requests
func RequestLogger() gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		// Custom log format for better debugging
		return fmt.Sprintf("%s - [%s] \"%s %s %s\" %d %s \"%s\" \"%s\"\n",
			param.ClientIP,
			param.TimeStamp.Format("02/Jan/2006:15:04:05 -0700"),
			param.Method,
			param.Path,
			param.Request.Proto,
			param.StatusCode,
			param.Latency,
			param.Request.UserAgent(),
			param.ErrorMessage,
		)
	})
}

// CORS middleware handles Cross-Origin Resource Sharing
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// For development, allow all origins
		// In production, you should check against allowed domains
		if origin != "" {
			c.Header("Access-Control-Allow-Origin", origin)
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, X-API-Key")
		c.Header("Access-Control-Expose-Headers", "Content-Length")
		c.Header("Access-Control-Allow-Credentials", "true")

		// Handle preflight requests
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// SecurityHeaders middleware adds security-related headers
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Content-Security-Policy", "default-src 'self'")

		// In production with HTTPS, uncomment these:
		// c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		// c.Header("Content-Security-Policy", "upgrade-insecure-requests")

		c.Next()
	}
}

// Note: RateLimiter has been moved to ratelimit.go
// Use RateLimiterRedis, RateLimiterByUser, or RateLimiterByAPIKey instead
