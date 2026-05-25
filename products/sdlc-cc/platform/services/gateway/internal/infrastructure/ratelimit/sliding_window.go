// Package ratelimit implements a Redis-backed sliding-window rate limiter
// for the gateway. The limiter is consulted by the HTTP middleware on
// every request after Auth + Tenant resolution; the actual
// allow/deny + retry-after decision is computed atomically in Redis via
// the Lua script in slidingWindowLuaScript so racing replicas can't
// mis-count requests under load.
//
// Day 6 of the production-ready roadmap (docs/roadmap/phase-1-release-blockers.md).
package ratelimit

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Decision is the outcome for a single request.
type Decision struct {
	Allowed    bool          // false => caller must reject with 429
	Limit      int           // configured requests-per-window
	Remaining  int           // requests remaining in the current window
	RetryAfter time.Duration // 0 when Allowed; >0 = wait at least this long
	ResetAt    time.Time     // when the window resets
}

// Limiter is the public Redis sliding-window rate limiter.
//
// Use NewLimiter to construct; Allow is goroutine-safe.
type Limiter struct {
	rdb    redis.UniversalClient
	prefix string
}

// NewLimiter wires a limiter to an existing Redis client. prefix
// namespaces the keys (default "rl:") so multiple limiters can share a
// Redis instance without collision.
func NewLimiter(rdb redis.UniversalClient, prefix string) *Limiter {
	if prefix == "" {
		prefix = "rl:"
	}
	return &Limiter{rdb: rdb, prefix: prefix}
}

// Allow consults Redis and returns whether the request fits within the
// configured limit + burst over the rolling 60-second window. The
// counter is atomic via Lua; concurrent gateway replicas observe a
// consistent total.
//
// key is the rate-limit identity (typically tenant_id + route or
// api_key_id + route). limit is requests-per-minute. burst is the
// per-second ceiling.
func (l *Limiter) Allow(ctx context.Context, key string, limit, burst int) (Decision, error) {
	if limit <= 0 || burst <= 0 {
		return Decision{}, errors.New("ratelimit: limit and burst must be > 0")
	}
	if key == "" {
		return Decision{}, errors.New("ratelimit: key required")
	}

	now := time.Now()
	res, err := slidingWindowScript.Run(
		ctx,
		l.rdb,
		[]string{l.prefix + key},
		limit,
		burst,
		now.UnixMilli(),
		windowMillis,
	).Result()
	if err != nil {
		return Decision{}, fmt.Errorf("ratelimit: redis: %w", err)
	}

	values, ok := res.([]interface{})
	if !ok || len(values) != 4 {
		return Decision{}, fmt.Errorf("ratelimit: unexpected lua reply %T", res)
	}
	allowed, _ := values[0].(int64)
	remaining, _ := values[1].(int64)
	retryAfterMs, _ := values[2].(int64)
	resetAtMs, _ := values[3].(int64)

	return Decision{
		Allowed:    allowed == 1,
		Limit:      limit,
		Remaining:  int(remaining),
		RetryAfter: time.Duration(retryAfterMs) * time.Millisecond,
		ResetAt:    time.UnixMilli(resetAtMs),
	}, nil
}

// Reset clears the counter for a key — useful in tests, and for an
// admin "unblock" action when a tenant has been mis-configured.
func (l *Limiter) Reset(ctx context.Context, key string) error {
	if key == "" {
		return nil
	}
	return l.rdb.Del(ctx, l.prefix+key).Err()
}

const windowMillis = 60_000 // 60-second sliding window

// slidingWindowScript: atomic INCR + EXPIRE under a sliding window.
//
// Algorithm:
//   1. Trim entries older than (now - window).
//   2. Count remaining entries (= current usage).
//   3. If usage >= limit OR per-second burst exceeded, deny: return
//      retry-after = oldest entry expiry - now.
//   4. Else add a new timestamp, set TTL to window (so idle keys expire),
//      and return remaining = limit - usage - 1.
//
// We use a sorted set keyed on the timestamp; ZREMRANGEBYSCORE makes
// the trim O(log N + M) where M is the count being removed.
//
// KEYS[1] = rate-limit key
// ARGV[1] = limit (requests per window)
// ARGV[2] = burst (requests per 1-second sub-window)
// ARGV[3] = now in ms
// ARGV[4] = window in ms
//
// Returns: {allowed, remaining, retryAfterMs, resetAtMs}
var slidingWindowScript = redis.NewScript(`
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local burst = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local window = tonumber(ARGV[4])
local oldest = now - window
redis.call('ZREMRANGEBYSCORE', key, '-inf', oldest)
local count = redis.call('ZCARD', key)
local burstWindow = now - 1000
local burstCount = redis.call('ZCOUNT', key, burstWindow, '+inf')
if count >= limit or burstCount >= burst then
  local first = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retryAfter = window
  if first[2] then
    retryAfter = (tonumber(first[2]) + window) - now
    if retryAfter < 0 then retryAfter = 0 end
  end
  return {0, limit - count, retryAfter, now + retryAfter}
end
redis.call('ZADD', key, now, now .. ':' .. math.random())
redis.call('PEXPIRE', key, window)
return {1, limit - count - 1, 0, now + window}
`)
