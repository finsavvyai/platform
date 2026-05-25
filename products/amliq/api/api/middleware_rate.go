package api

import (
	"net/http"
	"strconv"
	"sync"
	"time"
)

type RateLimiter struct {
	buckets      sync.Map
	defaultRate  float64
	defaultBurst int
}

func NewRateLimiter(defaultRate float64, defaultBurst int) *RateLimiter {
	return &RateLimiter{
		defaultRate:  defaultRate,
		defaultBurst: defaultBurst,
	}
}

func (rl *RateLimiter) Middleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tenantID := GetTenantID(r)
			if tenantID == "" {
				Error(w, "MISSING_TENANT",
					"tenant_id required for rate limiting",
					http.StatusBadRequest)
				return
			}

			b := rl.getBucket(tenantID)
			allowed, remaining := b.allow(1)
			resetAt := b.resetAt()

			w.Header().Set("X-RateLimit-Remaining",
				strconv.Itoa(int(remaining)))
			w.Header().Set("X-RateLimit-Reset",
				strconv.FormatInt(resetAt.Unix(), 10))

			if !allowed {
				secondsLeft := int64(resetAt.Sub(
					time.Now()).Seconds() + 1)
				w.Header().Set("Retry-After",
					strconv.FormatInt(secondsLeft, 10))
				Error(w, "RATE_LIMIT_EXCEEDED",
					"too many requests",
					http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func (rl *RateLimiter) getBucket(tenantID string) *bucket {
	b, _ := rl.buckets.LoadOrStore(tenantID,
		newBucket(rl.defaultRate, float64(rl.defaultBurst)))
	return b.(*bucket)
}
