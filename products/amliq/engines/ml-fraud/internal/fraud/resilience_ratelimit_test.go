package fraud

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"quantumbeam/internal/interfaces"
)

// resetRateLimitStore clears the package-level rate limit state
// so that tests start from a known baseline.
func resetRateLimitStore() {
	rateLimitMutex.Lock()
	rateLimitStore = map[string]rateLimitEntry{}
	rateLimitMutex.Unlock()
}

// TestResilience_RateLimit_ExhaustMutating verifies that request 121
// to a mutating endpoint returns 429.
func TestResilience_RateLimit_ExhaustMutating(t *testing.T) {
	resetRateLimitStore()

	gin.SetMode(gin.TestMode)
	r := gin.New()
	v1 := r.Group("/v1")
	v1.Use(RequestIDMiddleware())
	v1.Use(RateLimitMiddleware(120))
	v1.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	// Send 120 requests -- all should succeed
	for i := 0; i < 120; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/v1/ping", nil)
		req.Header.Set("X-API-Key", "rate-test-key-mutating")
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code, "request %d should succeed", i+1)
	}

	// Request 121 should be rate limited
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/ping", nil)
	req.Header.Set("X-API-Key", "rate-test-key-mutating")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusTooManyRequests, w.Code)
	assert.Equal(t, "0", w.Header().Get("X-RateLimit-Remaining"))

	var body map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &body)
	assert.NoError(t, err)
	assert.Contains(t, body["error"], "rate limit exceeded")
}

// TestResilience_RateLimit_ReadOnlyHigherLimit verifies that read-only
// endpoints tolerate up to 240 requests before returning 429.
func TestResilience_RateLimit_ReadOnlyHigherLimit(t *testing.T) {
	resetRateLimitStore()

	fraudService := new(MockFraudDetectionService)
	intelligentRouter := new(MockIntelligentRouter)

	fraudService.On("GetQuantumPerformance", mock.Anything).
		Return(&interfaces.QuantumPerformanceMetrics{}, nil)

	r := setupFraudRoutesRouter(fraudService, intelligentRouter)

	// Send 240 requests -- all should succeed
	for i := 0; i < 240; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/v1/performance", nil)
		req.Header.Set("X-API-Key", "rate-test-readonly")
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code, "request %d should succeed", i+1)
	}

	// Request 241 should be rate limited
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/performance", nil)
	req.Header.Set("X-API-Key", "rate-test-readonly")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusTooManyRequests, w.Code)
	assert.Equal(t, "240", w.Header().Get("X-RateLimit-Limit"))
}

// TestResilience_RateLimit_PerKeyIsolation verifies that different
// API keys have independent rate limit counters.
func TestResilience_RateLimit_PerKeyIsolation(t *testing.T) {
	resetRateLimitStore()

	gin.SetMode(gin.TestMode)
	r := gin.New()
	v1 := r.Group("/v1")
	v1.Use(RateLimitMiddleware(5))
	v1.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	// Exhaust limit for key-A
	for i := 0; i < 5; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/v1/test", nil)
		req.Header.Set("X-API-Key", "key-A")
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	}

	// key-A is now exhausted
	wA := httptest.NewRecorder()
	reqA, _ := http.NewRequest(http.MethodGet, "/v1/test", nil)
	reqA.Header.Set("X-API-Key", "key-A")
	r.ServeHTTP(wA, reqA)
	assert.Equal(t, http.StatusTooManyRequests, wA.Code)

	// key-B should still work
	wB := httptest.NewRecorder()
	reqB, _ := http.NewRequest(http.MethodGet, "/v1/test", nil)
	reqB.Header.Set("X-API-Key", "key-B")
	r.ServeHTTP(wB, reqB)
	assert.Equal(t, http.StatusOK, wB.Code)
}

// TestResilience_RateLimit_HeaderValues verifies the rate limit headers
// contain correct values at various points.
func TestResilience_RateLimit_HeaderValues(t *testing.T) {
	resetRateLimitStore()

	gin.SetMode(gin.TestMode)
	r := gin.New()
	v1 := r.Group("/v1")
	v1.Use(RateLimitMiddleware(10))
	v1.GET("/check", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	// First request
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/check", nil)
	req.Header.Set("X-API-Key", "header-test-key")
	r.ServeHTTP(w, req)

	assert.Equal(t, "10", w.Header().Get("X-RateLimit-Limit"))
	assert.Equal(t, "9", w.Header().Get("X-RateLimit-Remaining"))
	assert.NotEmpty(t, w.Header().Get("X-RateLimit-Reset"))
}

// cleanupMu serialises cleanup for race-detector safety.
var cleanupMu sync.Mutex

func init() {
	cleanupMu.Lock()
	cleanupMu.Unlock()
}
