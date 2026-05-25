package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// RateLimitConfig defines rate limiting configuration
type RateLimitConfig struct {
	// RequestsPerWindow is the maximum number of requests allowed in the time window
	RequestsPerWindow int
	// Window is the time window for rate limiting
	Window time.Duration
	// KeyPrefix is used to namespace rate limit keys in Redis
	KeyPrefix string
	// SkipFailedLimiters determines if requests should proceed when rate limiter fails
	SkipFailedLimiters bool
}

// DefaultRateLimitConfig returns sensible default rate limiting configuration
func DefaultRateLimitConfig() RateLimitConfig {
	return RateLimitConfig{
		RequestsPerWindow:  100,
		Window:             time.Minute,
		KeyPrefix:          "ratelimit",
		SkipFailedLimiters: false,
	}
}

// RateLimiterRedis creates a Redis-based rate limiting middleware
// This implementation uses the sliding window counter algorithm with Redis
func RateLimiterRedis(redisClient *redis.Client, config RateLimitConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		// If Redis is not available and we're configured to skip, allow the request
		if redisClient == nil {
			if config.SkipFailedLimiters {
				c.Next()
				return
			}
			c.JSON(http.StatusServiceUnavailable, ErrorResponse{
				Error:   "Rate limiting service unavailable",
				Code:    "RATE_LIMIT_UNAVAILABLE",
				Details: "The rate limiting service is temporarily unavailable",
				Request: struct {
					Method string `json:"method"`
					Path   string `json:"path"`
				}{
					Method: c.Request.Method,
					Path:   c.Request.URL.Path,
				},
				Timestamp: time.Now().Format(time.RFC3339),
			})
			c.Abort()
			return
		}

		// Generate rate limit key based on client IP and path
		clientIP := c.ClientIP()
		path := c.Request.URL.Path
		key := fmt.Sprintf("%s:%s:%s", config.KeyPrefix, clientIP, path)

		// Check rate limit
		allowed, remaining, resetTime, err := checkRateLimit(
			c.Request.Context(),
			redisClient,
			key,
			config.RequestsPerWindow,
			config.Window,
		)

		// Handle rate limiter errors
		if err != nil {
			if config.SkipFailedLimiters {
				c.Next()
				return
			}
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "Rate limit check failed",
				Code:    "RATE_LIMIT_ERROR",
				Details: err.Error(),
				Request: struct {
					Method string `json:"method"`
					Path   string `json:"path"`
				}{
					Method: c.Request.Method,
					Path:   c.Request.URL.Path,
				},
				Timestamp: time.Now().Format(time.RFC3339),
			})
			c.Abort()
			return
		}

		// Set rate limit headers
		c.Header("X-RateLimit-Limit", strconv.Itoa(config.RequestsPerWindow))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(resetTime.Unix(), 10))

		// Block request if rate limit exceeded
		if !allowed {
			retryAfter := time.Until(resetTime).Seconds()
			c.Header("Retry-After", strconv.FormatFloat(retryAfter, 'f', 0, 64))

			c.JSON(http.StatusTooManyRequests, ErrorResponse{
				Error:   "Rate limit exceeded",
				Code:    "RATE_LIMIT_EXCEEDED",
				Details: fmt.Sprintf("Too many requests. Retry after %d seconds", int(retryAfter)),
				Request: struct {
					Method string `json:"method"`
					Path   string `json:"path"`
				}{
					Method: c.Request.Method,
					Path:   c.Request.URL.Path,
				},
				Timestamp: time.Now().Format(time.RFC3339),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// checkRateLimit implements the sliding window counter algorithm using Redis
// Returns: (allowed bool, remaining int, resetTime time.Time, error)
func checkRateLimit(
	ctx context.Context,
	redisClient *redis.Client,
	key string,
	limit int,
	window time.Duration,
) (bool, int, time.Time, error) {
	now := time.Now()
	windowStart := now.Add(-window)

	// Use Redis pipeline for atomic operations
	pipe := redisClient.Pipeline()

	// Remove old entries outside the current window
	pipe.ZRemRangeByScore(ctx, key, "0", strconv.FormatInt(windowStart.UnixNano(), 10))

	// Count entries in the current window
	countCmd := pipe.ZCard(ctx, key)

	// Execute pipeline
	if _, err := pipe.Exec(ctx); err != nil {
		return false, 0, time.Time{}, fmt.Errorf("failed to check rate limit: %w", err)
	}

	// Get current count
	count, err := countCmd.Result()
	if err != nil {
		return false, 0, time.Time{}, fmt.Errorf("failed to get rate limit count: %w", err)
	}

	// Check if limit exceeded
	if int(count) >= limit {
		// Get the oldest entry to calculate reset time
		oldestCmd := redisClient.ZRange(ctx, key, 0, 0)
		oldest, err := oldestCmd.Result()
		if err != nil || len(oldest) == 0 {
			return false, 0, now.Add(window), nil
		}

		// Parse the oldest timestamp
		oldestScore, err := strconv.ParseInt(oldest[0], 10, 64)
		if err != nil {
			return false, 0, now.Add(window), nil
		}

		oldestTime := time.Unix(0, oldestScore)
		resetTime := oldestTime.Add(window)

		return false, 0, resetTime, nil
	}

	// Add current request to the window
	score := now.UnixNano()
	member := fmt.Sprintf("%d", score)

	pipe2 := redisClient.Pipeline()
	pipe2.ZAdd(ctx, key, redis.Z{
		Score:  float64(score),
		Member: member,
	})

	// Set expiration on the key to clean up old data
	pipe2.Expire(ctx, key, window*2)

	if _, err := pipe2.Exec(ctx); err != nil {
		return false, 0, time.Time{}, fmt.Errorf("failed to record request: %w", err)
	}

	remaining := limit - int(count) - 1
	resetTime := now.Add(window)

	return true, remaining, resetTime, nil
}

// RateLimiterByUser creates a rate limiter that limits based on authenticated user ID
func RateLimiterByUser(redisClient *redis.Client, config RateLimitConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user ID from context (set by auth middleware)
		userID, exists := c.Get("user_id")
		if !exists {
			// Fall back to IP-based rate limiting
			RateLimiterRedis(redisClient, config)(c)
			return
		}

		// Override key to use user ID instead of IP
		key := fmt.Sprintf("%s:user:%v:%s", config.KeyPrefix, userID, c.Request.URL.Path)

		allowed, remaining, resetTime, err := checkRateLimit(
			c.Request.Context(),
			redisClient,
			key,
			config.RequestsPerWindow,
			config.Window,
		)

		if err != nil {
			if config.SkipFailedLimiters {
				c.Next()
				return
			}
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "Rate limit check failed",
				Code:    "RATE_LIMIT_ERROR",
				Details: err.Error(),
				Request: struct {
					Method string `json:"method"`
					Path   string `json:"path"`
				}{
					Method: c.Request.Method,
					Path:   c.Request.URL.Path,
				},
				Timestamp: time.Now().Format(time.RFC3339),
			})
			c.Abort()
			return
		}

		c.Header("X-RateLimit-Limit", strconv.Itoa(config.RequestsPerWindow))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(resetTime.Unix(), 10))

		if !allowed {
			retryAfter := time.Until(resetTime).Seconds()
			c.Header("Retry-After", strconv.FormatFloat(retryAfter, 'f', 0, 64))

			c.JSON(http.StatusTooManyRequests, ErrorResponse{
				Error:   "Rate limit exceeded",
				Code:    "RATE_LIMIT_EXCEEDED",
				Details: fmt.Sprintf("Too many requests. Retry after %d seconds", int(retryAfter)),
				Request: struct {
					Method string `json:"method"`
					Path   string `json:"path"`
				}{
					Method: c.Request.Method,
					Path:   c.Request.URL.Path,
				},
				Timestamp: time.Now().Format(time.RFC3339),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RateLimiterByAPIKey creates a rate limiter for API key based requests
func RateLimiterByAPIKey(redisClient *redis.Client, config RateLimitConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get API key from header
		apiKey := c.GetHeader("X-API-Key")
		if apiKey == "" {
			// Fall back to IP-based rate limiting
			RateLimiterRedis(redisClient, config)(c)
			return
		}

		// Use hashed API key for privacy
		key := fmt.Sprintf("%s:apikey:%s:%s", config.KeyPrefix, hashAPIKey(apiKey), c.Request.URL.Path)

		allowed, remaining, resetTime, err := checkRateLimit(
			c.Request.Context(),
			redisClient,
			key,
			config.RequestsPerWindow,
			config.Window,
		)

		if err != nil {
			if config.SkipFailedLimiters {
				c.Next()
				return
			}
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "Rate limit check failed",
				Code:    "RATE_LIMIT_ERROR",
				Details: err.Error(),
				Request: struct {
					Method string `json:"method"`
					Path   string `json:"path"`
				}{
					Method: c.Request.Method,
					Path:   c.Request.URL.Path,
				},
				Timestamp: time.Now().Format(time.RFC3339),
			})
			c.Abort()
			return
		}

		c.Header("X-RateLimit-Limit", strconv.Itoa(config.RequestsPerWindow))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(resetTime.Unix(), 10))

		if !allowed {
			retryAfter := time.Until(resetTime).Seconds()
			c.Header("Retry-After", strconv.FormatFloat(retryAfter, 'f', 0, 64))

			c.JSON(http.StatusTooManyRequests, ErrorResponse{
				Error:   "Rate limit exceeded",
				Code:    "RATE_LIMIT_EXCEEDED",
				Details: fmt.Sprintf("Too many requests. Retry after %d seconds", int(retryAfter)),
				Request: struct {
					Method string `json:"method"`
					Path   string `json:"path"`
				}{
					Method: c.Request.Method,
					Path:   c.Request.URL.Path,
				},
				Timestamp: time.Now().Format(time.RFC3339),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RateLimiterByAPIKey creates a rate limiter for API key based requests
// ... (previous code)

// hashAPIKey removed, using shared implementation from auth.go
