// Package middleware provides HTTP middleware for the PipeWarden server.
package middleware

import (
	"encoding/json"
	"math"
	"net/http"
	"strconv"
	"sync"
	"time"
)

// tierLimit defines request limits for a billing tier.
type tierLimit struct {
	requestsPerMinute int
	burstSize         int
}

// bucket holds token bucket state for a single IP.
type bucket struct {
	tokens   float64
	lastSeen time.Time
	tier     string
}

// RateLimiter enforces per-IP + per-tier request limits using token buckets.
type RateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	limits  map[string]tierLimit
}

// rateLimitResponse is the JSON body returned on 429.
type rateLimitResponse struct {
	Error      string `json:"error"`
	Tier       string `json:"tier"`
	Limit      int    `json:"limit"`
	RetryAfter int    `json:"retry_after"`
}

// NewRateLimiter creates a RateLimiter with default tier limits.
func NewRateLimiter() *RateLimiter {
	return &RateLimiter{
		buckets: make(map[string]*bucket),
		limits: map[string]tierLimit{
			"community":       {requestsPerMinute: 30, burstSize: 10},
			"starter":         {requestsPerMinute: 120, burstSize: 30},
			"professional":    {requestsPerMinute: 300, burstSize: 60},
			"enterprise":      {requestsPerMinute: 600, burstSize: 120},
			"enterprise_plus": {requestsPerMinute: 1200, burstSize: 240},
			"default":         {requestsPerMinute: 20, burstSize: 5},
		},
	}
}

// SetTier assigns a tier to an IP address (called after auth resolves tier).
// If the bucket already exists, only the tier label is updated (tokens preserved).
// If the bucket is new, it is seeded with the tier's burst capacity.
func (rl *RateLimiter) SetTier(ip, tier string) {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	if b, ok := rl.buckets[ip]; ok {
		b.tier = tier
	} else {
		lim := rl.resolveLimit(tier)
		rl.buckets[ip] = &bucket{
			tokens:   float64(lim.burstSize),
			lastSeen: time.Now(),
			tier:     tier,
		}
	}
}

// resolveLimit returns the tierLimit for the given tier name (falls back to default).
func (rl *RateLimiter) resolveLimit(tier string) tierLimit {
	if lim, ok := rl.limits[tier]; ok {
		return lim
	}
	return rl.limits["default"]
}

// Middleware returns an http.Handler that enforces rate limiting.
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := clientIP(r)
		// Loopback traffic (tests, local dev) is never rate-limited.
		if ip == "127.0.0.1" || ip == "::1" {
			next.ServeHTTP(w, r)
			return
		}

		rl.mu.Lock()
		b, ok := rl.buckets[ip]
		if !ok {
			lim := rl.resolveLimit("default")
			b = &bucket{
				tokens:   float64(lim.burstSize),
				lastSeen: time.Now(),
				tier:     "default",
			}
			rl.buckets[ip] = b
		}

		lim := rl.resolveLimit(b.tier)
		refillRate := float64(lim.requestsPerMinute) / 60.0
		now := time.Now()
		elapsed := now.Sub(b.lastSeen).Seconds()
		b.tokens = math.Min(float64(lim.burstSize), b.tokens+elapsed*refillRate)
		b.lastSeen = now

		remaining := int(math.Max(0, b.tokens-1))
		resetSecs := 0
		allowed := b.tokens >= 1.0
		tier := b.tier
		if allowed {
			b.tokens--
		} else {
			// seconds until 1 token available
			resetSecs = int(math.Ceil((1.0 - b.tokens) / refillRate))
		}
		rl.mu.Unlock()

		w.Header().Set("X-RateLimit-Limit", strconv.Itoa(lim.requestsPerMinute))
		w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
		w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(time.Duration(resetSecs)*time.Second).Unix(), 10))

		if !allowed {
			w.Header().Set("Retry-After", strconv.Itoa(resetSecs))
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			_ = json.NewEncoder(w).Encode(rateLimitResponse{
				Error:      "rate limit exceeded",
				Tier:       tier,
				Limit:      lim.requestsPerMinute,
				RetryAfter: resetSecs,
			})
			return
		}

		next.ServeHTTP(w, r)
	})
}
