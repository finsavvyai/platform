package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"golang.org/x/time/rate"
	"quantumbeam/internal/models"
)

// TestRateLimitMiddleware_WithinLimit verifies that requests within
// the allowed burst are not blocked.
func TestRateLimitMiddleware_WithinLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mw, _, _ := setupTestMiddleware()

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "test-user")
		c.Next()
	})
	router.Use(mw.RateLimit(100, rate.InfDuration))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

// TestRateLimitMiddleware_ExceedsLimit verifies that exceeding the
// burst limit returns 429.
func TestRateLimitMiddleware_ExceedsLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mw, _, _ := setupTestMiddleware()

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "test-rate-user")
		c.Next()
	})
	// Allow only 1 request in the burst
	router.Use(mw.RateLimit(1, rate.InfDuration))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	// First request should succeed
	w1 := httptest.NewRecorder()
	r1 := httptest.NewRequest(http.MethodGet, "/test", nil)
	router.ServeHTTP(w1, r1)
	assert.Equal(t, http.StatusOK, w1.Code)

	// Second request should be rate limited
	w2 := httptest.NewRecorder()
	r2 := httptest.NewRequest(http.MethodGet, "/test", nil)
	router.ServeHTTP(w2, r2)
	assert.Equal(t, http.StatusTooManyRequests, w2.Code)
	assert.Contains(t, w2.Body.String(), "RATE_LIMIT_EXCEEDED")
}

// TestRateLimitMiddleware_PerAPIKeyLimits verifies that different
// API keys have separate rate limit buckets.
func TestRateLimitMiddleware_PerAPIKeyLimits(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mw, _, _ := setupTestMiddleware()

	router := gin.New()
	router.Use(func(c *gin.Context) {
		keyID := c.GetHeader("X-Test-Key-ID")
		if keyID != "" {
			c.Set("api_key", &models.APIKey{
				KeyID:     keyID,
				UserID:    "user-1",
				RateLimit: 1,
			})
		}
		c.Next()
	})
	router.Use(mw.RateLimit(10, rate.InfDuration))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	// Key A: first request succeeds
	w1 := httptest.NewRecorder()
	r1 := httptest.NewRequest(http.MethodGet, "/test", nil)
	r1.Header.Set("X-Test-Key-ID", "key-a")
	router.ServeHTTP(w1, r1)
	assert.Equal(t, http.StatusOK, w1.Code)

	// Key B: should also succeed (separate bucket)
	w2 := httptest.NewRecorder()
	r2 := httptest.NewRequest(http.MethodGet, "/test", nil)
	r2.Header.Set("X-Test-Key-ID", "key-b")
	router.ServeHTTP(w2, r2)
	assert.Equal(t, http.StatusOK, w2.Code)
}

// TestRateLimitMiddleware_UnauthenticatedLowerLimit verifies that
// requests without any auth get a lower rate limit.
func TestRateLimitMiddleware_UnauthenticatedLowerLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mw, _, _ := setupTestMiddleware()

	router := gin.New()
	// No user_id or api_key set -- unauthenticated
	router.Use(mw.RateLimit(10, rate.InfDuration))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	// Unauthenticated limit = defaultLimit / 10 = 1
	w1 := httptest.NewRecorder()
	r1 := httptest.NewRequest(http.MethodGet, "/test", nil)
	router.ServeHTTP(w1, r1)
	assert.Equal(t, http.StatusOK, w1.Code)

	// Second request should be rate limited (burst = 1)
	w2 := httptest.NewRecorder()
	r2 := httptest.NewRequest(http.MethodGet, "/test", nil)
	router.ServeHTTP(w2, r2)
	assert.Equal(t, http.StatusTooManyRequests, w2.Code)
}

// TestRateLimitMiddleware_429ResponseFormat verifies the error
// response body for rate limited requests.
func TestRateLimitMiddleware_429ResponseFormat(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mw, _, _ := setupTestMiddleware()

	router := gin.New()
	// Set user_id so the request is treated as authenticated
	// (avoids defaultLimit/10 = 0 divide-by-zero for small limits).
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "format-check-user")
		c.Next()
	})
	router.Use(mw.RateLimit(1, rate.InfDuration))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	// First request consumes the single token.
	w1 := httptest.NewRecorder()
	r1 := httptest.NewRequest(http.MethodGet, "/test", nil)
	router.ServeHTTP(w1, r1)
	assert.Equal(t, http.StatusOK, w1.Code)

	// Second request triggers 429.
	w2 := httptest.NewRecorder()
	r2 := httptest.NewRequest(http.MethodGet, "/test", nil)
	router.ServeHTTP(w2, r2)

	assert.Equal(t, http.StatusTooManyRequests, w2.Code)
	assert.Contains(t, w2.Body.String(), "RATE_LIMIT_EXCEEDED")
}
