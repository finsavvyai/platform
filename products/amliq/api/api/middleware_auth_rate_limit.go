package api

import (
	"net/http"
	"sync"
	"time"
)

// AuthRateLimiter limits auth endpoint requests per IP.
type AuthRateLimiter struct {
	mu       sync.Mutex
	attempts map[string]*ipRecord
	maxPerMin int
	lockoutMin int
}

type ipRecord struct {
	count    int
	firstAt  time.Time
	lockedAt *time.Time
}

func NewAuthRateLimiter(maxPerMin, lockoutMin int) *AuthRateLimiter {
	if maxPerMin <= 0 {
		maxPerMin = 10
	}
	if lockoutMin <= 0 {
		lockoutMin = 30
	}
	return &AuthRateLimiter{
		attempts:   make(map[string]*ipRecord),
		maxPerMin:  maxPerMin,
		lockoutMin: lockoutMin,
	}
}

// Middleware blocks IPs that exceed the auth rate limit.
func (rl *AuthRateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := clientIP(r)
		if rl.isBlocked(ip) {
			Error(w, "RATE_LIMITED", "too many auth attempts, try later",
				http.StatusTooManyRequests)
			return
		}
		rl.record(ip)
		next.ServeHTTP(w, r)
	})
}

func (rl *AuthRateLimiter) isBlocked(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	rec, ok := rl.attempts[ip]
	if !ok {
		return false
	}
	if rec.lockedAt != nil {
		if time.Since(*rec.lockedAt) < time.Duration(rl.lockoutMin)*time.Minute {
			return true
		}
		delete(rl.attempts, ip)
		return false
	}
	return false
}

func (rl *AuthRateLimiter) record(ip string) {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	rec, ok := rl.attempts[ip]
	if !ok || time.Since(rec.firstAt) > time.Minute {
		rl.attempts[ip] = &ipRecord{count: 1, firstAt: time.Now()}
		return
	}
	rec.count++
	if rec.count > rl.maxPerMin {
		now := time.Now()
		rec.lockedAt = &now
	}
}
