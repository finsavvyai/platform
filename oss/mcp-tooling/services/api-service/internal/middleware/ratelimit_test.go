package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestRedis(t *testing.T) *redis.Client {
	// Use Redis instance 15 for testing to avoid conflicts
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   15,
	})

	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Skip("Redis not available, skipping rate limit tests")
		return nil
	}

	// Clear test database
	client.FlushDB(ctx)

	return client
}

func TestRateLimiterRedis(t *testing.T) {
	redisClient := setupTestRedis(t)
	if redisClient == nil {
		return
	}
	defer redisClient.Close()

	gin.SetMode(gin.TestMode)

	tests := []struct {
		name            string
		config          RateLimitConfig
		requestCount    int
		expectedAllowed int
		expectedBlocked int
		waitBetween     time.Duration
	}{
		{
			name: "allows requests within limit",
			config: RateLimitConfig{
				RequestsPerWindow:  5,
				Window:             time.Second,
				KeyPrefix:          "test_allow",
				SkipFailedLimiters: false,
			},
			requestCount:    3,
			expectedAllowed: 3,
			expectedBlocked: 0,
		},
		{
			name: "blocks requests exceeding limit",
			config: RateLimitConfig{
				RequestsPerWindow:  3,
				Window:             time.Second,
				KeyPrefix:          "test_block",
				SkipFailedLimiters: false,
			},
			requestCount:    5,
			expectedAllowed: 3,
			expectedBlocked: 2,
		},
		{
			name: "resets after window expires",
			config: RateLimitConfig{
				RequestsPerWindow:  2,
				Window:             100 * time.Millisecond,
				KeyPrefix:          "test_reset",
				SkipFailedLimiters: false,
			},
			requestCount:    4,
			expectedAllowed: 4,
			expectedBlocked: 0,
			waitBetween:     150 * time.Millisecond,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clear Redis before each test
			redisClient.FlushDB(context.Background())

			router := gin.New()
			router.Use(RateLimiterRedis(redisClient, tt.config))
			router.GET("/test", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"status": "ok"})
			})

			allowedCount := 0
			blockedCount := 0

			for i := 0; i < tt.requestCount; i++ {
				if tt.waitBetween > 0 && i == tt.requestCount/2 {
					time.Sleep(tt.waitBetween)
				}

				req := httptest.NewRequest("GET", "/test", nil)
				req.RemoteAddr = "192.168.1.1:1234"
				w := httptest.NewRecorder()

				router.ServeHTTP(w, req)

				if w.Code == http.StatusOK {
					allowedCount++
				} else if w.Code == http.StatusTooManyRequests {
					blockedCount++
				}
			}

			assert.Equal(t, tt.expectedAllowed, allowedCount, "allowed requests mismatch")
			assert.Equal(t, tt.expectedBlocked, blockedCount, "blocked requests mismatch")
		})
	}
}

func TestRateLimiterHeaders(t *testing.T) {
	redisClient := setupTestRedis(t)
	if redisClient == nil {
		return
	}
	defer redisClient.Close()

	gin.SetMode(gin.TestMode)

	config := RateLimitConfig{
		RequestsPerWindow:  5,
		Window:             time.Minute,
		KeyPrefix:          "test_headers",
		SkipFailedLimiters: false,
	}

	router := gin.New()
	router.Use(RateLimiterRedis(redisClient, config))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Clear Redis
	redisClient.FlushDB(context.Background())

	// First request
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.1:1234"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "5", w.Header().Get("X-RateLimit-Limit"))
	assert.Equal(t, "4", w.Header().Get("X-RateLimit-Remaining"))
	assert.NotEmpty(t, w.Header().Get("X-RateLimit-Reset"))

	// Second request
	req2 := httptest.NewRequest("GET", "/test", nil)
	req2.RemoteAddr = "192.168.1.1:1234"
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)

	assert.Equal(t, http.StatusOK, w2.Code)
	assert.Equal(t, "5", w2.Header().Get("X-RateLimit-Limit"))
	assert.Equal(t, "3", w2.Header().Get("X-RateLimit-Remaining"))
}

func TestRateLimiterByUser(t *testing.T) {
	redisClient := setupTestRedis(t)
	if redisClient == nil {
		return
	}
	defer redisClient.Close()

	gin.SetMode(gin.TestMode)

	config := RateLimitConfig{
		RequestsPerWindow:  3,
		Window:             time.Second,
		KeyPrefix:          "test_user",
		SkipFailedLimiters: false,
	}

	router := gin.New()

	// Mock auth middleware that sets user_id
	router.Use(func(c *gin.Context) {
		userID := c.GetHeader("X-User-ID")
		if userID != "" {
			c.Set("user_id", userID)
		}
		c.Next()
	})

	router.Use(RateLimiterByUser(redisClient, config))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Clear Redis
	redisClient.FlushDB(context.Background())

	// Test that different users have separate limits
	user1Allowed := 0
	user2Allowed := 0

	// User 1 makes 4 requests
	for i := 0; i < 4; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("X-User-ID", "user1")
		req.RemoteAddr = "192.168.1.1:1234"
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code == http.StatusOK {
			user1Allowed++
		}
	}

	// User 2 makes 3 requests
	for i := 0; i < 3; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("X-User-ID", "user2")
		req.RemoteAddr = "192.168.1.1:1234"
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code == http.StatusOK {
			user2Allowed++
		}
	}

	assert.Equal(t, 3, user1Allowed, "user1 should be limited to 3 requests")
	assert.Equal(t, 3, user2Allowed, "user2 should have separate limit")
}

func TestRateLimiterByAPIKey(t *testing.T) {
	redisClient := setupTestRedis(t)
	if redisClient == nil {
		return
	}
	defer redisClient.Close()

	gin.SetMode(gin.TestMode)

	config := RateLimitConfig{
		RequestsPerWindow:  3,
		Window:             time.Second,
		KeyPrefix:          "test_apikey",
		SkipFailedLimiters: false,
	}

	router := gin.New()
	router.Use(RateLimiterByAPIKey(redisClient, config))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Clear Redis
	redisClient.FlushDB(context.Background())

	apiKey := "test-api-key-12345"

	allowedCount := 0
	blockedCount := 0

	// Make 5 requests with the same API key
	for i := 0; i < 5; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("X-API-Key", apiKey)
		req.RemoteAddr = "192.168.1.1:1234"
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code == http.StatusOK {
			allowedCount++
		} else if w.Code == http.StatusTooManyRequests {
			blockedCount++
		}
	}

	assert.Equal(t, 3, allowedCount, "should allow 3 requests")
	assert.Equal(t, 2, blockedCount, "should block 2 requests")
}

func TestRateLimiterNoRedis(t *testing.T) {
	gin.SetMode(gin.TestMode)

	config := RateLimitConfig{
		RequestsPerWindow:  5,
		Window:             time.Minute,
		KeyPrefix:          "test_no_redis",
		SkipFailedLimiters: true,
	}

	router := gin.New()
	router.Use(RateLimiterRedis(nil, config))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Should allow request when Redis is nil and SkipFailedLimiters is true
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.1:1234"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRateLimiterNoRedisStrict(t *testing.T) {
	gin.SetMode(gin.TestMode)

	config := RateLimitConfig{
		RequestsPerWindow:  5,
		Window:             time.Minute,
		KeyPrefix:          "test_no_redis_strict",
		SkipFailedLimiters: false,
	}

	router := gin.New()
	router.Use(RateLimiterRedis(nil, config))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Should return 503 when Redis is nil and SkipFailedLimiters is false
	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.1:1234"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
}

func TestCheckRateLimit(t *testing.T) {
	redisClient := setupTestRedis(t)
	if redisClient == nil {
		return
	}
	defer redisClient.Close()

	ctx := context.Background()
	key := "test:rate:limit"
	limit := 5
	window := time.Second

	// Clear Redis
	redisClient.FlushDB(ctx)

	// Test first request
	allowed, remaining, resetTime, err := checkRateLimit(ctx, redisClient, key, limit, window)
	require.NoError(t, err)
	assert.True(t, allowed, "first request should be allowed")
	assert.Equal(t, 4, remaining, "should have 4 requests remaining")
	assert.True(t, resetTime.After(time.Now()), "reset time should be in the future")

	// Test subsequent requests
	for i := 0; i < 4; i++ {
		allowed, remaining, _, err := checkRateLimit(ctx, redisClient, key, limit, window)
		require.NoError(t, err)
		assert.True(t, allowed)
		assert.Equal(t, 3-i, remaining)
	}

	// Test limit exceeded
	allowed, remaining, resetTime, err = checkRateLimit(ctx, redisClient, key, limit, window)
	require.NoError(t, err)
	assert.False(t, allowed, "should be rate limited")
	assert.Equal(t, 0, remaining)
	assert.True(t, resetTime.After(time.Now()), "reset time should be in the future")

	// Wait for window to expire
	time.Sleep(window + 100*time.Millisecond)

	// Test that limit resets
	allowed, remaining, _, err = checkRateLimit(ctx, redisClient, key, limit, window)
	require.NoError(t, err)
	assert.True(t, allowed, "should be allowed after window expires")
	assert.Equal(t, 4, remaining)
}

func TestHashAPIKey(t *testing.T) {
	// hashAPIKey uses HMAC-SHA256 with a fixed salt, so we test that:
	// 1. The same input always produces the same hash
	// 2. Different inputs produce different hashes
	// 3. The output is a valid hex string (64 chars for SHA256)

	tests := []struct {
		name   string
		apiKey string
	}{
		{
			name:   "long api key",
			apiKey: "sk-1234567890abcdef",
		},
		{
			name:   "short api key",
			apiKey: "short",
		},
		{
			name:   "exact 8 chars",
			apiKey: "12345678",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := hashAPIKey(tt.apiKey)
			// Should be 64 chars (hex-encoded SHA256)
			assert.Equal(t, 64, len(result), "hash should be 64 hex characters")
			// Same input should produce same hash
			result2 := hashAPIKey(tt.apiKey)
			assert.Equal(t, result, result2, "hash should be deterministic")
		})
	}

	// Test that different inputs produce different hashes
	hash1 := hashAPIKey("api-key-1")
	hash2 := hashAPIKey("api-key-2")
	assert.NotEqual(t, hash1, hash2, "different inputs should produce different hashes")
}
