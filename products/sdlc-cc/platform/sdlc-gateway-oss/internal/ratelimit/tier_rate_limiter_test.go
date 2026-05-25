package ratelimit

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestLimiter(t *testing.T) (*TierRateLimiter, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	return NewTierRateLimiter(client), mr
}

func TestDefaultTiers_AllFieldsSet(t *testing.T) {
	tiers := DefaultTiers()
	for _, name := range []string{"free", "starter", "professional", "enterprise"} {
		tc, ok := tiers[name]
		require.Truef(t, ok, "missing tier %s", name)
		assert.NotZero(t, tc.RequestsPerMin, name)
		assert.NotZero(t, tc.RequestsPerHour, name)
		assert.NotZero(t, tc.RequestsPerDay, name)
		assert.NotZero(t, tc.ConcurrentLimit, name)
		assert.NotZero(t, tc.MaxPayloadBytes, name)
	}
}

func TestGetTierConfig_UnknownFallback(t *testing.T) {
	rl, _ := newTestLimiter(t)
	_, ok := rl.GetTierConfig("unknown")
	assert.False(t, ok)
}

func TestCheck_AllowsUnderLimit(t *testing.T) {
	rl, _ := newTestLimiter(t)
	ctx := context.Background()

	for i := 0; i < 5; i++ {
		res, err := rl.Check(ctx, "tenant-a", "free", "global")
		require.NoError(t, err)
		assert.True(t, res.Allowed, "req %d should be allowed", i)
		assert.Equal(t, 30, res.Limit)
	}
}

func TestCheck_BlocksAtMinuteLimit(t *testing.T) {
	rl, _ := newTestLimiter(t)
	rl.SetTierConfig("tiny", TierConfig{
		Name: "tiny", RequestsPerMin: 3, RequestsPerHour: 100,
		RequestsPerDay: 1000, ConcurrentLimit: 10, MaxPayloadBytes: 1024,
	})
	ctx := context.Background()

	for i := 0; i < 3; i++ {
		res, err := rl.Check(ctx, "t1", "tiny", "global")
		require.NoError(t, err)
		assert.True(t, res.Allowed, "req %d allowed", i)
	}
	res, err := rl.Check(ctx, "t1", "tiny", "global")
	require.NoError(t, err)
	assert.False(t, res.Allowed)
	assert.Equal(t, "per-minute", res.Window)
	assert.Greater(t, res.RetryAfter, time.Duration(0))
}

func TestCheck_TenantIsolation(t *testing.T) {
	rl, _ := newTestLimiter(t)
	rl.SetTierConfig("tiny", TierConfig{
		Name: "tiny", RequestsPerMin: 2, RequestsPerHour: 100,
		RequestsPerDay: 1000, ConcurrentLimit: 10, MaxPayloadBytes: 1024,
	})
	ctx := context.Background()

	for i := 0; i < 2; i++ {
		r, _ := rl.Check(ctx, "tenant-a", "tiny", "global")
		assert.True(t, r.Allowed)
	}
	// tenant-a blocked
	r, _ := rl.Check(ctx, "tenant-a", "tiny", "global")
	assert.False(t, r.Allowed)
	// tenant-b still allowed
	r, _ = rl.Check(ctx, "tenant-b", "tiny", "global")
	assert.True(t, r.Allowed)
}

func TestCheck_WindowResets(t *testing.T) {
	rl, mr := newTestLimiter(t)
	rl.SetTierConfig("tiny", TierConfig{
		Name: "tiny", RequestsPerMin: 1, RequestsPerHour: 100,
		RequestsPerDay: 1000, ConcurrentLimit: 10, MaxPayloadBytes: 1024,
	})
	ctx := context.Background()

	r, _ := rl.Check(ctx, "t1", "tiny", "global")
	require.True(t, r.Allowed)
	r, _ = rl.Check(ctx, "t1", "tiny", "global")
	require.False(t, r.Allowed)

	// advance miniredis clock past minute TTL — keys expire
	mr.FastForward(61 * time.Second)

	r, _ = rl.Check(ctx, "t1", "tiny", "global")
	assert.True(t, r.Allowed, "should reset after window")
}

func TestCheckConcurrent_AllowsAndBlocks(t *testing.T) {
	rl, _ := newTestLimiter(t)
	rl.SetTierConfig("con", TierConfig{
		Name: "con", RequestsPerMin: 1000, RequestsPerHour: 10000,
		RequestsPerDay: 100000, ConcurrentLimit: 2, MaxPayloadBytes: 1024,
	})
	ctx := context.Background()

	ok, err := rl.CheckConcurrent(ctx, "t1", "con")
	require.NoError(t, err)
	assert.True(t, ok)

	ok, _ = rl.CheckConcurrent(ctx, "t1", "con")
	assert.True(t, ok)

	ok, _ = rl.CheckConcurrent(ctx, "t1", "con")
	assert.False(t, ok, "third concurrent should block")
}

func TestReleaseConcurrent_FreesSlot(t *testing.T) {
	rl, _ := newTestLimiter(t)
	rl.SetTierConfig("con", TierConfig{
		Name: "con", RequestsPerMin: 1000, RequestsPerHour: 10000,
		RequestsPerDay: 100000, ConcurrentLimit: 1, MaxPayloadBytes: 1024,
	})
	ctx := context.Background()

	ok, _ := rl.CheckConcurrent(ctx, "t1", "con")
	require.True(t, ok)
	ok, _ = rl.CheckConcurrent(ctx, "t1", "con")
	require.False(t, ok)

	rl.ReleaseConcurrent(ctx, "t1")
	ok, _ = rl.CheckConcurrent(ctx, "t1", "con")
	assert.True(t, ok)
}

func TestMiddleware_MissingTenant_400(t *testing.T) {
	rl, _ := newTestLimiter(t)
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	h := rl.Middleware()(next)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestMiddleware_AllowsRequest_SetsHeaders(t *testing.T) {
	rl, _ := newTestLimiter(t)
	called := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	h := rl.Middleware()(next)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Tenant-ID", "t1")
	req.Header.Set("X-Tenant-Tier", "free")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	assert.True(t, called)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.NotEmpty(t, rec.Header().Get("X-RateLimit-Limit"))
	assert.NotEmpty(t, rec.Header().Get("X-RateLimit-Remaining"))
	assert.NotEmpty(t, rec.Header().Get("X-RateLimit-Reset"))
}

func TestMiddleware_BlocksOverLimit(t *testing.T) {
	rl, _ := newTestLimiter(t)
	rl.SetTierConfig("tiny", TierConfig{
		Name: "tiny", RequestsPerMin: 1, RequestsPerHour: 100,
		RequestsPerDay: 1000, ConcurrentLimit: 10, MaxPayloadBytes: 1024,
	})
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	h := rl.Middleware()(next)

	call := func() int {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("X-Tenant-ID", "t-block")
		req.Header.Set("X-Tenant-Tier", "tiny")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}

	assert.Equal(t, http.StatusOK, call())
	assert.Equal(t, http.StatusTooManyRequests, call())
}

func TestMiddleware_PayloadTooLarge(t *testing.T) {
	rl, _ := newTestLimiter(t)
	rl.SetTierConfig("tiny", TierConfig{
		Name: "tiny", RequestsPerMin: 1000, RequestsPerHour: 10000,
		RequestsPerDay: 100000, ConcurrentLimit: 10, MaxPayloadBytes: 10,
	})
	h := rl.Middleware()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req.ContentLength = 100
	req.Header.Set("X-Tenant-ID", "t-pay")
	req.Header.Set("X-Tenant-Tier", "tiny")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusRequestEntityTooLarge, rec.Code)
}

func TestMiddleware_DefaultsToFreeTier(t *testing.T) {
	rl, _ := newTestLimiter(t)
	h := rl.Middleware()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Tenant-ID", "t1")
	// no tier header
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, fmt.Sprintf("%d", 30), rec.Header().Get("X-RateLimit-Limit"))
}
