package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
}

func TestRateLimiterAllowsNormalTraffic(t *testing.T) {
	rl := NewRateLimiter()
	// community burst = 10, so 5 requests must all pass
	rl.SetTier("127.0.0.1", "community")
	handler := rl.Middleware(okHandler())

	for i := 0; i < 5; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = "127.0.0.1"
		rw := httptest.NewRecorder()
		handler.ServeHTTP(rw, req)
		if rw.Code != http.StatusOK {
			t.Fatalf("request %d: got %d, want 200", i+1, rw.Code)
		}
	}
}

func TestRateLimiterBlocksOverLimit(t *testing.T) {
	rl := NewRateLimiter()
	// community burst = 10; drain all burst tokens then expect 429
	rl.SetTier("10.0.0.1", "community")
	handler := rl.Middleware(okHandler())

	const total = 15 // more than burst of 10
	var blocked int
	for i := 0; i < total; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = "10.0.0.1"
		rw := httptest.NewRecorder()
		handler.ServeHTTP(rw, req)
		if rw.Code == http.StatusTooManyRequests {
			blocked++
		}
	}
	if blocked == 0 {
		t.Fatal("expected at least one 429 after exhausting burst tokens")
	}
}

func TestRateLimiterDifferentTiers(t *testing.T) {
	rl := NewRateLimiter()
	rl.SetTier("com.ip", "community")  // burst 10
	rl.SetTier("ent.ip", "enterprise") // burst 120

	communityHandler := rl.Middleware(okHandler())

	// Drain community bucket
	var communityBlocked int
	for i := 0; i < 20; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("X-Forwarded-For", "com.ip")
		rw := httptest.NewRecorder()
		communityHandler.ServeHTTP(rw, req)
		if rw.Code == http.StatusTooManyRequests {
			communityBlocked++
		}
	}

	// Enterprise bucket should still allow up to 120 burst
	var enterpriseBlocked int
	for i := 0; i < 20; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("X-Forwarded-For", "ent.ip")
		rw := httptest.NewRecorder()
		communityHandler.ServeHTTP(rw, req)
		if rw.Code == http.StatusTooManyRequests {
			enterpriseBlocked++
		}
	}

	if communityBlocked == 0 {
		t.Error("community tier should have been rate-limited")
	}
	if enterpriseBlocked > 0 {
		t.Errorf("enterprise tier should not be rate-limited for 20 requests, got %d blocked", enterpriseBlocked)
	}
}

func TestRateLimiterHeaders(t *testing.T) {
	rl := NewRateLimiter()
	rl.SetTier("hdr.ip", "starter")
	handler := rl.Middleware(okHandler())

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Forwarded-For", "hdr.ip")
	rw := httptest.NewRecorder()
	handler.ServeHTTP(rw, req)

	for _, hdr := range []string{"X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"} {
		if rw.Header().Get(hdr) == "" {
			t.Errorf("missing header %s", hdr)
		}
	}
}
