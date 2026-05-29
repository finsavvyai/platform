package adapter

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/pkg/logger"
)

func CORSMiddleware(allowedOrigins string) gin.HandlerFunc {
	origins := strings.Split(allowedOrigins, ",")
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		for _, allowed := range origins {
			if origin == allowed {
				c.Header("Access-Control-Allow-Origin", origin)
				break
			}
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

type tokenBucket struct {
	tokens     float64
	maxTokens  float64
	refillRate float64
	lastRefill time.Time
}

type RateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*tokenBucket
	limit   float64
	window  time.Duration
}

func NewRateLimiter(requestsPerWindow float64, window time.Duration) *RateLimiter {
	return &RateLimiter{
		buckets: make(map[string]*tokenBucket),
		limit:   requestsPerWindow,
		window:  window,
	}
}

func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	bucket, exists := rl.buckets[key]

	if !exists {
		rl.buckets[key] = &tokenBucket{
			tokens:     rl.limit - 1,
			maxTokens:  rl.limit,
			refillRate: rl.limit / rl.window.Seconds(),
			lastRefill: now,
		}
		return true
	}

	elapsed := now.Sub(bucket.lastRefill).Seconds()
	bucket.tokens += elapsed * bucket.refillRate
	if bucket.tokens > bucket.maxTokens {
		bucket.tokens = bucket.maxTokens
	}
	bucket.lastRefill = now

	if bucket.tokens < 1 {
		return false
	}

	bucket.tokens--
	return true
}

func RateLimitMiddleware(limiter *RateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !limiter.Allow(ip) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "rate limit exceeded, try again later",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

func RequestLoggingMiddleware(log *logger.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.URL.Path == "/health" {
			c.Next()
			return
		}

		start := time.Now()
		c.Next()
		duration := time.Since(start)

		log.Info("request",
			"method", c.Request.Method,
			"path", c.Request.URL.Path,
			"status", c.Writer.Status(),
			"duration_ms", duration.Milliseconds(),
		)
	}
}
