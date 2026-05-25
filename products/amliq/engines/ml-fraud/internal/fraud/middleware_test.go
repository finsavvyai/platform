package fraud

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestRequestIDMiddleware_GeneratesAndPreserves(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(RequestIDMiddleware())
	router.GET("/health", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	// Generates request id when missing.
	wGenerated := httptest.NewRecorder()
	reqGenerated, _ := http.NewRequest(http.MethodGet, "/health", nil)
	router.ServeHTTP(wGenerated, reqGenerated)
	assert.NotEmpty(t, wGenerated.Header().Get("X-Request-ID"))

	// Preserves request id when provided by caller.
	wProvided := httptest.NewRecorder()
	reqProvided, _ := http.NewRequest(http.MethodGet, "/health", nil)
	reqProvided.Header.Set("X-Request-ID", "req-abc")
	router.ServeHTTP(wProvided, reqProvided)
	assert.Equal(t, "req-abc", wProvided.Header().Get("X-Request-ID"))
}

func TestCORSMiddlewareWithOrigins_RejectsUnknownOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(CORSMiddlewareWithOrigins([]string{"https://dashboard.fintech.local"}))
	router.GET("/health", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/health", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestRateLimitMiddleware_BlocksAfterLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(RateLimitMiddleware(1))
	router.GET("/health", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	w1 := httptest.NewRecorder()
	req1, _ := http.NewRequest(http.MethodGet, "/health", nil)
	req1.Header.Set("X-API-Key", "fraud-rate-test")
	router.ServeHTTP(w1, req1)
	assert.Equal(t, http.StatusOK, w1.Code)

	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest(http.MethodGet, "/health", nil)
	req2.Header.Set("X-API-Key", "fraud-rate-test")
	router.ServeHTTP(w2, req2)
	assert.Equal(t, http.StatusTooManyRequests, w2.Code)
}
