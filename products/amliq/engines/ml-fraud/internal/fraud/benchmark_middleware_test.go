package fraud

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	secmw "quantumbeam/internal/middleware"
)

// noopHandler returns 200 with minimal work to isolate middleware overhead.
func noopHandler(c *gin.Context) {
	c.Status(http.StatusOK)
}

func newBenchGin() *gin.Engine {
	gin.SetMode(gin.TestMode)
	return gin.New()
}

// BenchmarkMiddleware_SecurityHeaders measures SecurityHeaders middleware alone.
func BenchmarkMiddleware_SecurityHeaders(b *testing.B) {
	r := newBenchGin()
	r.Use(secmw.SecurityHeadersGin())
	r.GET("/bench", noopHandler)

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/bench", nil)
		r.ServeHTTP(w, req)
	}
}

// BenchmarkMiddleware_RequestID measures RequestID middleware alone.
func BenchmarkMiddleware_RequestID(b *testing.B) {
	r := newBenchGin()
	r.Use(RequestIDMiddleware())
	r.GET("/bench", noopHandler)

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/bench", nil)
		r.ServeHTTP(w, req)
	}
}

// BenchmarkMiddleware_RateLimit measures RateLimit middleware alone.
// Uses a unique API key per iteration window to avoid exhausting the limit.
func BenchmarkMiddleware_RateLimit(b *testing.B) {
	r := newBenchGin()
	r.Use(RateLimitMiddleware(1000000)) // high limit to never reject
	r.GET("/bench", noopHandler)

	key := "bench-rl-" + time.Now().Format("150405.000000")
	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/bench", nil)
		req.Header.Set("X-API-Key", key)
		r.ServeHTTP(w, req)
	}
}

// BenchmarkMiddleware_FullStack measures all middleware composed together.
func BenchmarkMiddleware_FullStack(b *testing.B) {
	r := newBenchGin()
	r.Use(secmw.SecurityHeadersGin())
	r.Use(RequestIDMiddleware())
	r.Use(RateLimitMiddleware(1000000))
	r.Use(CORSMiddlewareWithOrigins([]string{"https://dashboard.fintech.io"}))
	r.GET("/bench", noopHandler)

	key := "bench-full-" + time.Now().Format("150405.000000")
	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/bench", nil)
		req.Header.Set("X-API-Key", key)
		r.ServeHTTP(w, req)
	}
}

// BenchmarkMiddleware_Bare measures a bare handler with no middleware.
func BenchmarkMiddleware_Bare(b *testing.B) {
	r := newBenchGin()
	r.GET("/bench", noopHandler)

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/bench", nil)
		r.ServeHTTP(w, req)
	}
}
