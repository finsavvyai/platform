package adapter

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/pkg/logger"
	"github.com/stretchr/testify/assert"
)

func TestCORSMiddleware_AllowedOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(CORSMiddleware("http://localhost:5173"))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "http://localhost:5173", w.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSMiddleware_DisallowedOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(CORSMiddleware("http://localhost:5173"))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "http://evil.com")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSMiddleware_Preflight(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(CORSMiddleware("http://localhost:5173"))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodOptions, "/test", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestCORSMiddleware_MultipleOrigins(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(CORSMiddleware("http://localhost:5173, http://app.queryflux.dev"))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "http://app.queryflux.dev")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, "http://app.queryflux.dev", w.Header().Get("Access-Control-Allow-Origin"))
}

func TestRateLimiter_AllowsWithinLimit(t *testing.T) {
	limiter := NewRateLimiter(5, time.Minute)

	for i := 0; i < 5; i++ {
		assert.True(t, limiter.Allow("test-ip"), "request %d should be allowed", i+1)
	}
}

func TestRateLimiter_BlocksOverLimit(t *testing.T) {
	limiter := NewRateLimiter(3, time.Minute)

	for i := 0; i < 3; i++ {
		limiter.Allow("test-ip")
	}

	assert.False(t, limiter.Allow("test-ip"), "4th request should be blocked")
}

func TestRateLimiter_SeparateKeys(t *testing.T) {
	limiter := NewRateLimiter(2, time.Minute)

	assert.True(t, limiter.Allow("ip-1"))
	assert.True(t, limiter.Allow("ip-1"))
	assert.False(t, limiter.Allow("ip-1"))
	assert.True(t, limiter.Allow("ip-2"))
}

func TestRateLimitMiddleware_Returns429(t *testing.T) {
	gin.SetMode(gin.TestMode)
	limiter := NewRateLimiter(1, time.Minute)
	router := gin.New()
	router.POST("/auth/login", RateLimitMiddleware(limiter), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req1 := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)
	assert.Equal(t, http.StatusOK, w1.Code)

	req2 := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)
	assert.Equal(t, http.StatusTooManyRequests, w2.Code)
}

func TestRequestLoggingMiddleware_SkipsHealth(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log := logger.New("error")
	router := gin.New()
	router.Use(RequestLoggingMiddleware(log))
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRequestLoggingMiddleware_LogsOtherPaths(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log := logger.New("info")
	router := gin.New()
	router.Use(RequestLoggingMiddleware(log))
	router.GET("/api/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}
