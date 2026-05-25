package rbac

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

func newTestRedis(t *testing.T) (*redis.Client, *miniredis.Miniredis) {
	t.Helper()
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	t.Cleanup(mr.Close)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	return rdb, mr
}

func TestRedisCache_GetMissThenSetThenHit(t *testing.T) {
	rdb, _ := newTestRedis(t)
	c := NewRedisCache(rdb, time.Minute, "test")

	uid := uuid.New()
	if _, ok := c.Get(context.Background(), uid, "audit:read"); ok {
		t.Fatal("empty cache must miss")
	}

	c.Set(context.Background(), uid, "audit:read", true)
	v, ok := c.Get(context.Background(), uid, "audit:read")
	if !ok || !v {
		t.Fatalf("after Set, expected hit=true allow=true, got hit=%v allow=%v", ok, v)
	}
}

func TestRedisCache_StoresDeniesDistinctly(t *testing.T) {
	rdb, _ := newTestRedis(t)
	c := NewRedisCache(rdb, time.Minute, "test")
	uid := uuid.New()

	c.Set(context.Background(), uid, "billing:write", false)
	v, ok := c.Get(context.Background(), uid, "billing:write")
	if !ok {
		t.Fatal("expected hit on cached deny")
	}
	if v {
		t.Fatal("expected cached deny to surface as false")
	}
}

func TestRedisCache_TTLExpires(t *testing.T) {
	rdb, mr := newTestRedis(t)
	c := NewRedisCache(rdb, time.Second, "test")
	uid := uuid.New()
	c.Set(context.Background(), uid, "x:y", true)

	mr.FastForward(2 * time.Second)
	if _, ok := c.Get(context.Background(), uid, "x:y"); ok {
		t.Fatal("expired key must miss")
	}
}

func TestRedisCache_InvalidateUserDropsAllPerms(t *testing.T) {
	rdb, _ := newTestRedis(t)
	c := NewRedisCache(rdb, time.Minute, "test")
	uid := uuid.New()
	c.Set(context.Background(), uid, "audit:read", true)
	c.Set(context.Background(), uid, "billing:write", true)
	otherUID := uuid.New()
	c.Set(context.Background(), otherUID, "audit:read", true)

	if err := c.InvalidateUser(context.Background(), uid); err != nil {
		t.Fatalf("InvalidateUser: %v", err)
	}

	if _, ok := c.Get(context.Background(), uid, "audit:read"); ok {
		t.Fatal("user perm must be evicted")
	}
	if _, ok := c.Get(context.Background(), uid, "billing:write"); ok {
		t.Fatal("user perm must be evicted")
	}
	// Other user not touched.
	if _, ok := c.Get(context.Background(), otherUID, "audit:read"); !ok {
		t.Fatal("other user must NOT be evicted")
	}
}

func TestRedisCache_NilClientNoOp(t *testing.T) {
	c := NewRedisCache(nil, time.Minute, "test")
	uid := uuid.New()
	c.Set(context.Background(), uid, "x:y", true) // must not panic
	if _, ok := c.Get(context.Background(), uid, "x:y"); ok {
		t.Fatal("nil client must always miss")
	}
	if err := c.InvalidateUser(context.Background(), uid); err != nil {
		t.Fatalf("nil client invalidate must be a no-op: %v", err)
	}
}

func TestCachedEvaluator_HitAvoidsLoader(t *testing.T) {
	rdb, _ := newTestRedis(t)
	loader := &fakeLoader{perms: []Permission{"audit:read"}}
	inner := NewEvaluator(loader, time.Minute)
	cache := NewRedisCache(rdb, time.Minute, "test")
	ce := NewCachedEvaluator(inner, cache)

	uid := uuid.New()
	if ok, _ := ce.Allow(context.Background(), uid, "audit:read"); !ok {
		t.Fatal("first call must allow")
	}
	// Force a stale loader: switch perms to deny but expect the cache to
	// answer. We invalidate the *in-memory* layer so the result must
	// come from Redis.
	loader.perms = nil
	inner.Invalidate(uid)

	ok, _ := ce.Allow(context.Background(), uid, "audit:read")
	if !ok {
		t.Fatal("cached decision must serve even after loader changes")
	}
}

func TestCachedEvaluator_InvalidateUserForcesReload(t *testing.T) {
	rdb, _ := newTestRedis(t)
	loader := &fakeLoader{perms: []Permission{"audit:read"}}
	inner := NewEvaluator(loader, time.Minute)
	cache := NewRedisCache(rdb, time.Minute, "test")
	ce := NewCachedEvaluator(inner, cache)
	uid := uuid.New()

	_, _ = ce.Allow(context.Background(), uid, "audit:read")
	if err := ce.InvalidateUser(context.Background(), uid); err != nil {
		t.Fatalf("invalidate: %v", err)
	}
	loader.perms = nil
	atomic.StoreInt32(&loader.calls, 0)

	ok, _ := ce.Allow(context.Background(), uid, "audit:read")
	if ok {
		t.Fatal("after invalidate + perms removed, must deny")
	}
	if got := atomic.LoadInt32(&loader.calls); got == 0 {
		t.Fatal("invalidate must force loader call")
	}
}
