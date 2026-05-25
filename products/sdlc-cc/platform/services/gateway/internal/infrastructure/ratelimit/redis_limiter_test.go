package ratelimit

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestRedisLimiter(t *testing.T, store ConfigStore) (*RedisLimiter, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	return NewRedisLimiter(client, store), mr
}

func TestRedisLimiter_NoRule_AllowsAll(t *testing.T) {
	store := NewMapConfigStore()
	rl, _ := newTestRedisLimiter(t, store)
	ctx := context.Background()

	for i := 0; i < 10; i++ {
		allowed, retryAfter, err := rl.Allow(ctx, "tenant-a", "/v1/query", 1)
		require.NoError(t, err)
		assert.True(t, allowed, "no rule → allow")
		assert.Zero(t, retryAfter)
	}
}

func TestRedisLimiter_AllowsUpToLimit(t *testing.T) {
	store := NewMapConfigStore()
	store.Set("t1", "/api", RouteRule{RequestsPerMinute: 5, Burst: 5})
	rl, _ := newTestRedisLimiter(t, store)
	ctx := context.Background()

	for i := 0; i < 5; i++ {
		allowed, _, err := rl.Allow(ctx, "t1", "/api", 1)
		require.NoError(t, err)
		assert.Truef(t, allowed, "request %d should be allowed", i+1)
	}
}

func TestRedisLimiter_BlocksAtLimit(t *testing.T) {
	store := NewMapConfigStore()
	store.Set("t1", "/api", RouteRule{RequestsPerMinute: 3, Burst: 3})
	rl, _ := newTestRedisLimiter(t, store)
	ctx := context.Background()

	for i := 0; i < 3; i++ {
		allowed, _, err := rl.Allow(ctx, "t1", "/api", 1)
		require.NoError(t, err)
		require.Truef(t, allowed, "request %d should be allowed", i+1)
	}

	allowed, retryAfter, err := rl.Allow(ctx, "t1", "/api", 1)
	require.NoError(t, err)
	assert.False(t, allowed, "4th request must be blocked")
	assert.Greater(t, retryAfter, time.Duration(0), "retry-after must be positive")
}

func TestRedisLimiter_TenantIsolation(t *testing.T) {
	store := NewMapConfigStore()
	rule := RouteRule{RequestsPerMinute: 2, Burst: 2}
	store.Set("tenant-a", "/api", rule)
	store.Set("tenant-b", "/api", rule)
	rl, _ := newTestRedisLimiter(t, store)
	ctx := context.Background()

	// Exhaust tenant-a
	for i := 0; i < 2; i++ {
		allowed, _, _ := rl.Allow(ctx, "tenant-a", "/api", 1)
		require.True(t, allowed)
	}
	blockedA, _, _ := rl.Allow(ctx, "tenant-a", "/api", 1)
	assert.False(t, blockedA, "tenant-a should be blocked")

	// tenant-b still has capacity
	allowedB, _, err := rl.Allow(ctx, "tenant-b", "/api", 1)
	require.NoError(t, err)
	assert.True(t, allowedB, "tenant-b must not be affected by tenant-a's limit")
}

func TestRedisLimiter_WindowReset(t *testing.T) {
	store := NewMapConfigStore()
	store.Set("t1", "/api", RouteRule{RequestsPerMinute: 1, Burst: 1})
	rl, mr := newTestRedisLimiter(t, store)
	ctx := context.Background()

	allowed, _, err := rl.Allow(ctx, "t1", "/api", 1)
	require.NoError(t, err)
	require.True(t, allowed)

	blocked, _, err := rl.Allow(ctx, "t1", "/api", 1)
	require.NoError(t, err)
	require.False(t, blocked)

	// Advance the miniredis clock past the 60 s window so the ZSET entry expires.
	mr.FastForward(61 * time.Second)

	reset, _, err := rl.Allow(ctx, "t1", "/api", 1)
	require.NoError(t, err)
	assert.True(t, reset, "should be allowed after window resets")
}

func TestRedisLimiter_WildcardRule(t *testing.T) {
	store := NewMapConfigStore()
	// Catch-all rule for tenant-x
	store.Set("tenant-x", "#", RouteRule{RequestsPerMinute: 2, Burst: 2})
	rl, _ := newTestRedisLimiter(t, store)
	ctx := context.Background()

	for i := 0; i < 2; i++ {
		allowed, _, _ := rl.Allow(ctx, "tenant-x", "/anything", 1)
		assert.True(t, allowed)
	}
	blocked, _, _ := rl.Allow(ctx, "tenant-x", "/anything", 1)
	assert.False(t, blocked)
}

func TestRedisLimiter_ZeroWeightClamped(t *testing.T) {
	store := NewMapConfigStore()
	store.Set("t1", "/api", RouteRule{RequestsPerMinute: 1, Burst: 1})
	rl, _ := newTestRedisLimiter(t, store)
	ctx := context.Background()

	// weight=0 should be treated as 1
	allowed, _, err := rl.Allow(ctx, "t1", "/api", 0)
	require.NoError(t, err)
	assert.True(t, allowed)

	blocked, _, err := rl.Allow(ctx, "t1", "/api", 0)
	require.NoError(t, err)
	assert.False(t, blocked)
}

func TestRedisLimiter_WeightClampedToBurst(t *testing.T) {
	store := NewMapConfigStore()
	// Burst=2 so weight=10 should be clamped to 2
	store.Set("t1", "/api", RouteRule{RequestsPerMinute: 5, Burst: 2})
	rl, _ := newTestRedisLimiter(t, store)
	ctx := context.Background()

	// weight=10 → clamped to burst=2; uses 2 of the 5 limit
	allowed, _, err := rl.Allow(ctx, "t1", "/api", 10)
	require.NoError(t, err)
	assert.True(t, allowed)
}

// BenchmarkRedisLimiter_Allow measures the added latency of a sliding-window
// check via miniredis. Real Redis will be faster; this is a conservative
// upper bound. The Day 6 "Done when" requires p99 < 2ms.
func BenchmarkRedisLimiter_Allow(b *testing.B) {
	mr, _ := miniredis.Run()
	defer mr.Close()
	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer client.Close()

	store := NewMapConfigStore()
	store.Set("bench-tenant", "/api", RouteRule{RequestsPerMinute: 1_000_000, Burst: 1_000_000})
	rl := NewRedisLimiter(client, store)
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_, _, _ = rl.Allow(ctx, "bench-tenant", "/api", 1)
	}
}

func TestRedisLimiter_RedisUnavailable_ReturnsError(t *testing.T) {
	store := NewMapConfigStore()
	store.Set("t1", "/api", RouteRule{RequestsPerMinute: 10, Burst: 5})

	mr := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})

	rl := NewRedisLimiter(client, store)
	ctx := context.Background()

	// Kill the Redis server before calling Allow.
	mr.Close()

	allowed, _, err := rl.Allow(ctx, "t1", "/api", 1)
	assert.Error(t, err, "should return error when Redis is down")
	assert.False(t, allowed, "should deny on Redis error")
}
