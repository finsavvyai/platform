package ratelimit

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
)

// TierConfig defines rate limits for a tenant plan tier
type TierConfig struct {
	Name             string `json:"name"`
	RequestsPerMin   int    `json:"requests_per_min"`
	RequestsPerHour  int    `json:"requests_per_hour"`
	RequestsPerDay   int    `json:"requests_per_day"`
	BurstSize        int    `json:"burst_size"`
	ConcurrentLimit  int    `json:"concurrent_limit"`
	MaxPayloadBytes  int64  `json:"max_payload_bytes"`
	QueryRatePerMin  int    `json:"query_rate_per_min"`
	UploadRatePerMin int    `json:"upload_rate_per_min"`
}

// DefaultTiers returns the standard tier configurations
func DefaultTiers() map[string]TierConfig {
	return map[string]TierConfig{
		"free": {
			Name:             "free",
			RequestsPerMin:   30,
			RequestsPerHour:  500,
			RequestsPerDay:   5000,
			BurstSize:        10,
			ConcurrentLimit:  2,
			MaxPayloadBytes:  5 * 1024 * 1024, // 5MB
			QueryRatePerMin:  10,
			UploadRatePerMin: 5,
		},
		"starter": {
			Name:             "starter",
			RequestsPerMin:   120,
			RequestsPerHour:  5000,
			RequestsPerDay:   50000,
			BurstSize:        30,
			ConcurrentLimit:  5,
			MaxPayloadBytes:  25 * 1024 * 1024, // 25MB
			QueryRatePerMin:  60,
			UploadRatePerMin: 20,
		},
		"professional": {
			Name:             "professional",
			RequestsPerMin:   600,
			RequestsPerHour:  30000,
			RequestsPerDay:   300000,
			BurstSize:        100,
			ConcurrentLimit:  20,
			MaxPayloadBytes:  100 * 1024 * 1024, // 100MB
			QueryRatePerMin:  300,
			UploadRatePerMin: 60,
		},
		"enterprise": {
			Name:             "enterprise",
			RequestsPerMin:   3000,
			RequestsPerHour:  150000,
			RequestsPerDay:   1500000,
			BurstSize:        500,
			ConcurrentLimit:  100,
			MaxPayloadBytes:  500 * 1024 * 1024, // 500MB
			QueryRatePerMin:  1500,
			UploadRatePerMin: 300,
		},
	}
}

// TierRateLimiter enforces rate limits based on tenant plan tier
type TierRateLimiter struct {
	redis    *redis.Client
	tiers    map[string]TierConfig
	mu       sync.RWMutex
	keyPrefix string
}

// NewTierRateLimiter creates a new tier-based rate limiter
func NewTierRateLimiter(redisClient *redis.Client) *TierRateLimiter {
	return &TierRateLimiter{
		redis:     redisClient,
		tiers:     DefaultTiers(),
		keyPrefix: "rl:",
	}
}

// SetTierConfig allows overriding tier configuration at runtime
func (t *TierRateLimiter) SetTierConfig(tier string, config TierConfig) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.tiers[tier] = config
}

// GetTierConfig returns the configuration for a given tier
func (t *TierRateLimiter) GetTierConfig(tier string) (TierConfig, bool) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	config, ok := t.tiers[tier]
	return config, ok
}

// RateLimitResult contains the result of a rate limit check
type RateLimitResult struct {
	Allowed    bool
	Limit      int
	Remaining  int
	ResetAt    time.Time
	RetryAfter time.Duration
	Window     string
}

// Check evaluates rate limits for a tenant on a specific window
func (t *TierRateLimiter) Check(ctx context.Context, tenantID, tier, endpoint string) (*RateLimitResult, error) {
	config, ok := t.GetTierConfig(tier)
	if !ok {
		config = t.tiers["free"] // fallback to free tier
	}

	now := time.Now().UTC()

	// Check per-minute window
	minuteResult, err := t.checkWindow(ctx, tenantID, endpoint, config.RequestsPerMin, "1m", now.Truncate(time.Minute))
	if err != nil {
		return nil, fmt.Errorf("minute window check failed: %w", err)
	}
	if !minuteResult.Allowed {
		minuteResult.Window = "per-minute"
		return minuteResult, nil
	}

	// Check per-hour window
	hourResult, err := t.checkWindow(ctx, tenantID, endpoint, config.RequestsPerHour, "1h", now.Truncate(time.Hour))
	if err != nil {
		return nil, fmt.Errorf("hour window check failed: %w", err)
	}
	if !hourResult.Allowed {
		hourResult.Window = "per-hour"
		return hourResult, nil
	}

	// Check per-day window
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	dayResult, err := t.checkWindow(ctx, tenantID, endpoint, config.RequestsPerDay, "1d", dayStart)
	if err != nil {
		return nil, fmt.Errorf("day window check failed: %w", err)
	}
	if !dayResult.Allowed {
		dayResult.Window = "per-day"
		return dayResult, nil
	}

	return minuteResult, nil
}

// checkWindow checks rate limit for a specific time window using Redis INCR + EXPIRE
func (t *TierRateLimiter) checkWindow(ctx context.Context, tenantID, endpoint string, limit int, window string, windowStart time.Time) (*RateLimitResult, error) {
	key := fmt.Sprintf("%s%s:%s:%s:%d", t.keyPrefix, tenantID, endpoint, window, windowStart.Unix())

	var ttl time.Duration
	switch window {
	case "1m":
		ttl = time.Minute
	case "1h":
		ttl = time.Hour
	case "1d":
		ttl = 24 * time.Hour
	default:
		ttl = time.Minute
	}

	resetAt := windowStart.Add(ttl)

	// Atomic increment + set expiry
	pipe := t.redis.Pipeline()
	incr := pipe.Incr(ctx, key)
	pipe.ExpireNX(ctx, key, ttl)
	_, err := pipe.Exec(ctx)
	if err != nil {
		return nil, fmt.Errorf("redis pipeline failed: %w", err)
	}

	count := int(incr.Val())
	remaining := limit - count
	if remaining < 0 {
		remaining = 0
	}

	result := &RateLimitResult{
		Allowed:   count <= limit,
		Limit:     limit,
		Remaining: remaining,
		ResetAt:   resetAt,
	}

	if !result.Allowed {
		result.RetryAfter = time.Until(resetAt)
	}

	return result, nil
}

// CheckConcurrent checks concurrent request limits for a tenant
func (t *TierRateLimiter) CheckConcurrent(ctx context.Context, tenantID, tier string) (bool, error) {
	config, ok := t.GetTierConfig(tier)
	if !ok {
		config = t.tiers["free"]
	}

	key := fmt.Sprintf("%sconcurrent:%s", t.keyPrefix, tenantID)

	count, err := t.redis.Incr(ctx, key).Result()
	if err != nil {
		return false, err
	}

	// Set a short TTL as safety net in case Release is never called
	t.redis.Expire(ctx, key, 5*time.Minute)

	if int(count) > config.ConcurrentLimit {
		// Roll back the increment
		t.redis.Decr(ctx, key)
		return false, nil
	}

	return true, nil
}

// ReleaseConcurrent decrements the concurrent request counter
func (t *TierRateLimiter) ReleaseConcurrent(ctx context.Context, tenantID string) {
	key := fmt.Sprintf("%sconcurrent:%s", t.keyPrefix, tenantID)
	t.redis.Decr(ctx, key)
}

// Middleware returns an HTTP middleware that enforces tier rate limits
func (t *TierRateLimiter) Middleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tenantID := r.Header.Get("X-Tenant-ID")
			if tenantID == "" {
				http.Error(w, `{"error":{"code":"MISSING_TENANT","message":"X-Tenant-ID header required"}}`, http.StatusBadRequest)
				return
			}

			tier := r.Header.Get("X-Tenant-Tier")
			if tier == "" {
				tier = "free"
			}

			ctx := r.Context()

			// Check concurrent limits
			allowed, err := t.CheckConcurrent(ctx, tenantID, tier)
			if err == nil && !allowed {
				config, _ := t.GetTierConfig(tier)
				w.Header().Set("X-RateLimit-Concurrent-Limit", strconv.Itoa(config.ConcurrentLimit))
				http.Error(w, `{"error":{"code":"CONCURRENT_LIMIT","message":"Too many concurrent requests"}}`, http.StatusTooManyRequests)
				return
			}
			if allowed {
				defer t.ReleaseConcurrent(ctx, tenantID)
			}

			// Check request rate limits
			result, err := t.Check(ctx, tenantID, tier, "global")
			if err != nil {
				// On Redis failure, allow the request (fail-open)
				next.ServeHTTP(w, r)
				return
			}

			// Set rate limit headers on every response
			w.Header().Set("X-RateLimit-Limit", strconv.Itoa(result.Limit))
			w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(result.Remaining))
			w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(result.ResetAt.Unix(), 10))

			if !result.Allowed {
				retryAfter := int(result.RetryAfter.Seconds())
				if retryAfter < 1 {
					retryAfter = 1
				}
				w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
				w.Header().Set("X-RateLimit-Window", result.Window)
				http.Error(w, fmt.Sprintf(`{"error":{"code":"RATE_LIMITED","message":"Rate limit exceeded","window":"%s","retry_after":%d}}`, result.Window, retryAfter), http.StatusTooManyRequests)
				return
			}

			// Check payload size
			config, _ := t.GetTierConfig(tier)
			if r.ContentLength > config.MaxPayloadBytes {
				http.Error(w, fmt.Sprintf(`{"error":{"code":"PAYLOAD_TOO_LARGE","message":"Request body exceeds %dMB limit for %s plan"}}`, config.MaxPayloadBytes/(1024*1024), tier), http.StatusRequestEntityTooLarge)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
