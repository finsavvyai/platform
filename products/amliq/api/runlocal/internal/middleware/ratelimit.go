package middleware

import (
	"net/http"
	"sync"
	"time"
)

type bucket struct {
	tokens    int
	lastReset time.Time
}

// RateLimiter implements token-bucket rate limiting per key.
type RateLimiter struct {
	mu       sync.Mutex
	buckets  map[string]*bucket
	rate     int
	interval time.Duration
}

// NewRateLimiter creates a limiter allowing rate requests per interval.
func NewRateLimiter(rate int, interval time.Duration) *RateLimiter {
	rl := &RateLimiter{
		buckets:  make(map[string]*bucket),
		rate:     rate,
		interval: interval,
	}
	go rl.cleanup()
	return rl
}

// Allow checks if key has tokens remaining.
func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	b, ok := rl.buckets[key]
	now := time.Now()
	if !ok || now.Sub(b.lastReset) >= rl.interval {
		rl.buckets[key] = &bucket{tokens: rl.rate - 1, lastReset: now}
		return true
	}
	if b.tokens <= 0 {
		return false
	}
	b.tokens--
	return true
}

func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(rl.interval * 2)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		cutoff := time.Now().Add(-rl.interval * 2)
		for k, b := range rl.buckets {
			if b.lastReset.Before(cutoff) {
				delete(rl.buckets, k)
			}
		}
		rl.mu.Unlock()
	}
}

// Middleware returns HTTP middleware that rate-limits by IP.
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := r.Header.Get("X-Forwarded-For")
		if ip == "" {
			ip = r.RemoteAddr
		}
		if !rl.Allow(ip) {
			w.Header().Set("Retry-After", "60")
			http.Error(w, `{"error":"rate limit exceeded"}`, http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}
