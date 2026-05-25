package ratelimit

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
)

// slidingWindowLua is an atomic Redis Lua script implementing a sliding-window
// counter using a sorted set. All arithmetic is in milliseconds.
//
// KEYS[1]  = rate-limit key (one sorted set per tenant+route)
// ARGV[1]  = now_ms   — current Unix timestamp in milliseconds
// ARGV[2]  = window_ms — window length in milliseconds (60000 = 1 minute)
// ARGV[3]  = limit    — max requests allowed per window
// ARGV[4]  = weight   — cost of this request (usually 1)
// ARGV[5]  = uid      — unique string to avoid ZADD collisions within 1 ms
//
// Returns {allowed (1|0), remaining, retry_after_ms}
const slidingWindowLua = `
local key     = KEYS[1]
local now     = tonumber(ARGV[1])
local window  = tonumber(ARGV[2])
local lim     = tonumber(ARGV[3])
local weight  = tonumber(ARGV[4])
local uid     = ARGV[5]
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local cur = tonumber(redis.call('ZCARD', key))
if cur + weight > lim then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry = window
  if #oldest >= 2 then
    retry = tonumber(oldest[2]) + window - now
    if retry < 0 then retry = 0 end
  end
  return {0, lim - cur, retry}
end
for i = 1, weight do
  redis.call('ZADD', key, now, uid .. ':' .. tostring(i))
end
redis.call('PEXPIRE', key, window)
return {1, lim - cur - weight, 0}
`

// RouteRule holds rate limit config for one (tenant, route) pair, sourced
// from the rate_limits table created by migration 008.
type RouteRule struct {
	RequestsPerMinute int
	Burst             int
}

// ConfigStore resolves the RouteRule for a (tenantID, routePattern) pair.
// Return ok=false to skip rate limiting for that pair (allow by default).
type ConfigStore interface {
	Get(ctx context.Context, tenantID, routePattern string) (RouteRule, bool)
}

// MapConfigStore is an in-memory ConfigStore for tests and local dev.
// Use the wildcard route "#" to set a catch-all for a tenant.
type MapConfigStore struct {
	rules map[string]RouteRule
}

// NewMapConfigStore returns an empty MapConfigStore.
func NewMapConfigStore() *MapConfigStore {
	return &MapConfigStore{rules: make(map[string]RouteRule)}
}

// Set stores a rule keyed by tenantID+routePattern.
func (m *MapConfigStore) Set(tenantID, routePattern string, rule RouteRule) {
	m.rules[tenantID+":"+routePattern] = rule
}

// Get looks up the rule; falls back to the tenant's wildcard ("#") rule.
func (m *MapConfigStore) Get(_ context.Context, tenantID, routePattern string) (RouteRule, bool) {
	if r, ok := m.rules[tenantID+":"+routePattern]; ok {
		return r, true
	}
	r, ok := m.rules[tenantID+":#"]
	return r, ok
}

// RedisLimiter implements the domain/services.Allower interface via a
// Redis sorted-set sliding window. One ZSET per (tenantID, route).
type RedisLimiter struct {
	rdb    *redis.Client
	script *redis.Script
	store  ConfigStore
}

// NewRedisLimiter constructs a RedisLimiter that reads rules from store.
func NewRedisLimiter(rdb *redis.Client, store ConfigStore) *RedisLimiter {
	return &RedisLimiter{
		rdb:    rdb,
		script: redis.NewScript(slidingWindowLua),
		store:  store,
	}
}

// Allow checks whether tenantID may issue weight units against route.
// Returns (true, 0, nil) when no rule is configured (fail-open).
// retryAfter is only meaningful when allowed is false.
func (l *RedisLimiter) Allow(ctx context.Context, tenantID, route string, weight int) (bool, time.Duration, error) {
	rule, ok := l.store.Get(ctx, tenantID, route)
	if !ok {
		return true, 0, nil
	}

	if weight <= 0 {
		weight = 1
	}
	if weight > rule.Burst {
		weight = rule.Burst
	}

	key := fmt.Sprintf("rl:sw:%s:%s", tenantID, route)
	nowMs := time.Now().UnixMilli()
	const windowMs = int64(60_000) // 60 s

	uid := strconv.FormatInt(nowMs, 36) + strconv.FormatInt(time.Now().UnixNano()%1_000_000, 36)

	res, err := l.script.Run(ctx, l.rdb,
		[]string{key},
		nowMs, windowMs, rule.RequestsPerMinute, weight, uid,
	).Result()
	if err != nil {
		return false, 0, fmt.Errorf("redis sliding-window: %w", err)
	}

	vals, ok := res.([]interface{})
	if !ok || len(vals) < 3 {
		return false, 0, fmt.Errorf("redis sliding-window: unexpected result %T", res)
	}

	allowed := vals[0].(int64) == 1
	retryAfterMs, _ := vals[2].(int64)
	return allowed, time.Duration(retryAfterMs) * time.Millisecond, nil
}
