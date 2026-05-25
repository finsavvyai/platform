package server

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"golang.org/x/time/rate"
)

// RateLimiterConfig defines configuration for rate limiting
type RateLimiterConfig struct {
	RequestsPerSecond float64                   // Requests allowed per second
	BurstSize         int                       // Maximum burst size
	WindowDuration    time.Duration             // Time window for rate limiting
	Enabled           bool                      // Whether rate limiting is enabled
	KeyGenerator      func(*gin.Context) string // Custom key generator
}

// DefaultRateLimiterConfig returns default rate limiter configuration
func DefaultRateLimiterConfig() RateLimiterConfig {
	return RateLimiterConfig{
		RequestsPerSecond: 10.0,
		BurstSize:         20,
		WindowDuration:    time.Minute,
		Enabled:           true,
		KeyGenerator:      func(c *gin.Context) string { return c.ClientIP() },
	}
}

// IPRateLimiter manages rate limiters for different IPs
type IPRateLimiter struct {
	limiters map[string]*rate.Limiter
	mu       sync.RWMutex
	config   RateLimiterConfig
}

// NewIPRateLimiter creates a new IP-based rate limiter
func NewIPRateLimiter(config RateLimiterConfig) *IPRateLimiter {
	return &IPRateLimiter{
		limiters: make(map[string]*rate.Limiter),
		config:   config,
	}
}

// GetLimiter returns a rate limiter for the given key
func (rl *IPRateLimiter) GetLimiter(key string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	limiter, exists := rl.limiters[key]
	if !exists {
		limiter = rate.NewLimiter(rate.Limit(rl.config.RequestsPerSecond), rl.config.BurstSize)
		rl.limiters[key] = limiter
	}

	return limiter
}

// CleanupLimiters removes stale limiters (should be called periodically)
func (rl *IPRateLimiter) CleanupLimiters() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	// Remove limiters that haven't been used recently
	// In production, you might want to track last access time
	if len(rl.limiters) > 10000 {
		// Clear all limiters if we have too many (simple strategy)
		rl.limiters = make(map[string]*rate.Limiter)
	}
}

// RedisRateLimiter uses Redis for distributed rate limiting
type RedisRateLimiter struct {
	client *redis.Client
	config RateLimiterConfig
}

// NewRedisRateLimiter creates a new Redis-based rate limiter
func NewRedisRateLimiter(client *redis.Client, config RateLimiterConfig) *RedisRateLimiter {
	return &RedisRateLimiter{
		client: client,
		config: config,
	}
}

// Allow checks if a request should be allowed
func (rl *RedisRateLimiter) Allow(key string) (bool, error) {
	if !rl.config.Enabled {
		return true, nil
	}

	ctx := context.Background()
	redisKey := fmt.Sprintf("rate_limit:%s", key)

	// Increment counter
	pipe := rl.client.Pipeline()
	incrCmd := pipe.Incr(ctx, redisKey)
	pipe.Expire(ctx, redisKey, rl.config.WindowDuration)

	_, err := pipe.Exec(ctx)
	if err != nil {
		return false, err
	}

	count := incrCmd.Val()
	return count <= int64(rl.config.BurstSize), nil
}

// RateLimitMiddleware creates a rate limiting middleware using in-memory limiter
func RateLimitMiddleware(config RateLimiterConfig) gin.HandlerFunc {
	limiter := NewIPRateLimiter(config)

	// Start cleanup goroutine
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			limiter.CleanupLimiters()
		}
	}()

	return func(c *gin.Context) {
		if !config.Enabled {
			c.Next()
			return
		}

		key := config.KeyGenerator(c)
		limiter := limiter.GetLimiter(key)

		if !limiter.Allow() {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "RATE_LIMIT_EXCEEDED",
				"message":     "Too many requests. Please try again later.",
				"retry_after": int(config.WindowDuration.Seconds()),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// AuthRateLimitMiddleware creates a rate limiting middleware specifically for auth endpoints
// This is more strict than general rate limiting
func AuthRateLimitMiddleware(client *redis.Client) gin.HandlerFunc {
	config := RateLimiterConfig{
		RequestsPerSecond: 5.0, // More strict for auth
		BurstSize:         10,  // Smaller burst
		WindowDuration:    time.Minute,
		Enabled:           true,
		KeyGenerator: func(c *gin.Context) string {
			// Rate limit by IP for auth endpoints
			return fmt.Sprintf("auth:%s", c.ClientIP())
		},
	}

	if client != nil {
		return redisRateLimitMiddleware(client, config)
	}

	return RateLimitMiddleware(config)
}

// redisRateLimitMiddleware creates a Redis-based rate limiting middleware
func redisRateLimitMiddleware(client *redis.Client, config RateLimiterConfig) gin.HandlerFunc {
	limiter := NewRedisRateLimiter(client, config)

	return func(c *gin.Context) {
		if !config.Enabled {
			c.Next()
			return
		}

		key := config.KeyGenerator(c)
		allowed, err := limiter.Allow(key)
		if err != nil {
			// Log error but allow request on Redis failure
			// This prevents Redis issues from blocking all requests
			c.Next()
			return
		}

		if !allowed {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "RATE_LIMIT_EXCEEDED",
				"message":     "Too many requests. Please try again later.",
				"retry_after": int(config.WindowDuration.Seconds()),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// getUserIDForRateLimit extracts user ID from context for user-based rate limiting
func getUserIDForRateLimit(c *gin.Context) string {
	if userID, exists := c.Get("user_id"); exists {
		return fmt.Sprintf("user:%v", userID)
	}
	return fmt.Sprintf("ip:%s", c.ClientIP())
}

// UserRateLimitMiddleware creates user-based rate limiting (requires auth)
func UserRateLimitMiddleware(client *redis.Client, requestsPerMinute int) gin.HandlerFunc {
	config := RateLimiterConfig{
		RequestsPerSecond: float64(requestsPerMinute) / 60.0,
		BurstSize:         requestsPerMinute,
		WindowDuration:    time.Minute,
		Enabled:           true,
		KeyGenerator:      getUserIDForRateLimit,
	}

	if client != nil {
		return redisRateLimitMiddleware(client, config)
	}

	return RateLimitMiddleware(config)
}

// APIRateLimitMiddleware creates API endpoint-specific rate limiting
func APIRateLimitMiddleware(client *redis.Client, endpoint string, requestsPerMinute int) gin.HandlerFunc {
	config := RateLimiterConfig{
		RequestsPerSecond: float64(requestsPerMinute) / 60.0,
		BurstSize:         requestsPerMinute,
		WindowDuration:    time.Minute,
		Enabled:           true,
		KeyGenerator: func(c *gin.Context) string {
			userID := getUserIDForRateLimit(c)
			return fmt.Sprintf("%s:%s:%s", endpoint, userID, c.ClientIP())
		},
	}

	if client != nil {
		return redisRateLimitMiddleware(client, config)
	}

	return RateLimitMiddleware(config)
}
