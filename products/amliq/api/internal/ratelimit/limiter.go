package ratelimit

import (
	"sync"
	"time"
)

// TierConfig defines rate limits for a subscription tier.
type TierConfig struct {
	RequestsPerMinute, RequestsPerHour, BurstSize, ScreeningsPerDay int
}

// RateLimitInfo contains rate limit status for a response.
type RateLimitInfo struct {
	Limit, Remaining int
	ResetAt          time.Time
	RetryAfter       time.Duration
}

type tenantBucket struct {
	count   int
	resetAt time.Time
}

// RateLimiter enforces per-tenant rate limits by tier.
type RateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*tenantBucket
	tiers   map[string]TierConfig
}

// Tiers are pre-built tier configurations.
var Tiers = map[string]TierConfig{
	"free":         {RequestsPerMinute: 10, RequestsPerHour: 100, BurstSize: 15, ScreeningsPerDay: 100},
	"starter":      {RequestsPerMinute: 60, RequestsPerHour: 1000, BurstSize: 90, ScreeningsPerDay: 10000},
	"professional": {RequestsPerMinute: 300, RequestsPerHour: 10000, BurstSize: 450, ScreeningsPerDay: 100000},
	"enterprise":   {RequestsPerMinute: 1000, RequestsPerHour: 0, BurstSize: 1500, ScreeningsPerDay: 0},
}

// New creates a RateLimiter with the default tier configs.
func New() *RateLimiter {
	rl := &RateLimiter{
		buckets: make(map[string]*tenantBucket),
		tiers:   Tiers,
	}
	go rl.cleanupLoop()
	return rl
}

// Allow checks whether a request from tenantID on the given tier is allowed.
func (rl *RateLimiter) Allow(tenantID, tier string) (bool, *RateLimitInfo) {
	cfg, ok := rl.tiers[tier]
	if !ok {
		cfg = rl.tiers["free"]
	}
	limit := cfg.RequestsPerMinute
	if limit == 0 {
		return true, &RateLimitInfo{ResetAt: time.Now()}
	}
	rl.mu.Lock()
	defer rl.mu.Unlock()
	key := tenantID + ":" + tier
	b, exists := rl.buckets[key]
	now := time.Now()
	if !exists || now.After(b.resetAt) {
		b = &tenantBucket{count: 0, resetAt: now.Add(time.Minute)}
		rl.buckets[key] = b
	}
	b.count++
	remaining := limit - b.count
	if remaining < 0 {
		remaining = 0
	}
	info := &RateLimitInfo{
		Limit: limit, Remaining: remaining,
		ResetAt: b.resetAt, RetryAfter: time.Until(b.resetAt),
	}
	return b.count <= cfg.BurstSize, info
}

func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		rl.cleanup()
	}
}

func (rl *RateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	for k, b := range rl.buckets {
		if now.After(b.resetAt) {
			delete(rl.buckets, k)
		}
	}
}
