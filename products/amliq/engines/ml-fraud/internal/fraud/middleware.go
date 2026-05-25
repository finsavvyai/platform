package fraud

import (
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type rateLimitEntry struct {
	count       int
	windowStart time.Time
}

var (
	rateLimitMutex sync.Mutex
	rateLimitStore = map[string]rateLimitEntry{}
)

// RequestIDMiddleware adds or propagates X-Request-ID for traceability.
func RequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = generateRequestID()
		}
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
}

// CORSMiddlewareWithOrigins enforces an explicit origin allowlist.
func CORSMiddlewareWithOrigins(allowedOrigins []string) gin.HandlerFunc {
	normalized := make([]string, 0, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		trimmed := strings.TrimSpace(origin)
		if trimmed != "" {
			normalized = append(normalized, trimmed)
		}
	}
	useWildcard := len(normalized) == 0 || (len(normalized) == 1 && normalized[0] == "*")

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if useWildcard {
			c.Header("Access-Control-Allow-Origin", "*")
			c.Header("Access-Control-Allow-Credentials", "false")
		} else {
			c.Header("Vary", "Origin")
			if origin != "" && !slices.Contains(normalized, origin) {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
					"error": "origin not allowed",
				})
				return
			}
			allowOrigin := origin
			if allowOrigin == "" {
				allowOrigin = normalized[0]
			}
			c.Header("Access-Control-Allow-Origin", allowOrigin)
			c.Header("Access-Control-Allow-Credentials", "true")
		}

		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-API-Key, X-Request-ID")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// RateLimitMiddleware applies a per-IP/API-key fixed window rate limit.
func RateLimitMiddleware(requestsPerMinute int) gin.HandlerFunc {
	return func(c *gin.Context) {
		if requestsPerMinute <= 0 {
			c.Next()
			return
		}

		key := c.GetHeader("X-API-Key")
		if key == "" {
			key = "ip:" + c.ClientIP()
		}

		now := time.Now()
		window := now.Truncate(time.Minute)

		rateLimitMutex.Lock()
		entry := rateLimitStore[key]
		if entry.windowStart != window {
			entry = rateLimitEntry{
				count:       0,
				windowStart: window,
			}
		}
		entry.count++
		rateLimitStore[key] = entry
		currentCount := entry.count
		rateLimitMutex.Unlock()

		remaining := requestsPerMinute - currentCount
		if remaining < 0 {
			remaining = 0
		}
		c.Header("X-RateLimit-Limit", strconv.Itoa(requestsPerMinute))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(window.Add(time.Minute).Unix(), 10))

		if currentCount > requestsPerMinute {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "rate limit exceeded",
			})
			return
		}

		c.Next()
	}
}

// JSONContentTypeAndBodyLimitMiddleware validates JSON content-type and limits payload size.
func JSONContentTypeAndBodyLimitMiddleware(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == http.MethodPost || c.Request.Method == http.MethodPut || c.Request.Method == http.MethodPatch {
			contentType := strings.ToLower(c.GetHeader("Content-Type"))
			if contentType == "" || !strings.HasPrefix(contentType, "application/json") {
				c.AbortWithStatusJSON(http.StatusUnsupportedMediaType, gin.H{
					"error": "content-type must be application/json",
				})
				return
			}
			if maxBytes > 0 {
				if c.Request.ContentLength > maxBytes {
					c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{
						"error": "request body too large",
					})
					return
				}
				c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
			}
		}

		c.Next()
	}
}
