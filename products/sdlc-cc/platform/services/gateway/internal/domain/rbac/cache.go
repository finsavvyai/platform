// Redis-backed permission cache. Wraps the in-memory cache that
// lives in evaluator.go: callers either use the local cache (fast
// path, single replica) or — when Redis is configured — share
// permission decisions across replicas so an Invalidate on any node
// is honored fleet-wide.
//
// The cache keys boolean Allow decisions per (userID, permission)
// rather than the full permission set; that matches how the
// middleware actually queries it (one perm per request) and avoids
// having to keep the decoded slice in sync with cluster invalidation.
//
// Day 22 of the production-ready roadmap.
package rbac

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// RedisClient is the subset of *redis.Client we need. Defining it
// inline keeps the test seam small and lets miniredis stand in.
type RedisClient interface {
	Get(ctx context.Context, key string) *redis.StringCmd
	Set(ctx context.Context, key string, value interface{}, expiration time.Duration) *redis.StatusCmd
	Del(ctx context.Context, keys ...string) *redis.IntCmd
	Keys(ctx context.Context, pattern string) *redis.StringSliceCmd
}

// RedisCache stores per-user permission decisions in Redis with a TTL.
// It is safe to instantiate without Redis (pass nil) — every call
// becomes a miss so the caller falls through to the underlying
// evaluator.
type RedisCache struct {
	rdb    RedisClient
	ttl    time.Duration
	prefix string
}

// DefaultTTL is the cache lifetime when none is supplied.
const DefaultTTL = 60 * time.Second

// NewRedisCache wires a RedisCache. ttl<=0 applies DefaultTTL.
// prefix scopes keys so multiple environments can share a Redis.
func NewRedisCache(rdb RedisClient, ttl time.Duration, prefix string) *RedisCache {
	if ttl <= 0 {
		ttl = DefaultTTL
	}
	if prefix == "" {
		prefix = "rbac"
	}
	return &RedisCache{rdb: rdb, ttl: ttl, prefix: prefix}
}

// Get returns the cached decision for (userID, perm). The second
// return value is false on cache miss / disabled cache / Redis error
// so callers know to fall through to the loader.
func (c *RedisCache) Get(ctx context.Context, userID uuid.UUID, perm Permission) (bool, bool) {
	if c == nil || c.rdb == nil {
		return false, false
	}
	v, err := c.rdb.Get(ctx, c.key(userID, perm)).Result()
	if errors.Is(err, redis.Nil) || err != nil {
		return false, false
	}
	switch v {
	case "1":
		return true, true
	case "0":
		return false, true
	default:
		return false, false
	}
}

// Set stores the decision with the configured TTL. Errors are
// swallowed — a failed cache write is not fatal to the request.
func (c *RedisCache) Set(ctx context.Context, userID uuid.UUID, perm Permission, allowed bool) {
	if c == nil || c.rdb == nil {
		return
	}
	val := "0"
	if allowed {
		val = "1"
	}
	_ = c.rdb.Set(ctx, c.key(userID, perm), val, c.ttl).Err()
}

// InvalidateUser drops every cached decision for a user. Call after
// a role/permission change so the next Allow re-fetches.
func (c *RedisCache) InvalidateUser(ctx context.Context, userID uuid.UUID) error {
	if c == nil || c.rdb == nil {
		return nil
	}
	pattern := fmt.Sprintf("%s:u:%s:*", c.prefix, userID.String())
	keys, err := c.rdb.Keys(ctx, pattern).Result()
	if err != nil {
		return fmt.Errorf("rbac cache: keys: %w", err)
	}
	if len(keys) == 0 {
		return nil
	}
	if err := c.rdb.Del(ctx, keys...).Err(); err != nil {
		return fmt.Errorf("rbac cache: del: %w", err)
	}
	return nil
}

func (c *RedisCache) key(userID uuid.UUID, perm Permission) string {
	return fmt.Sprintf("%s:u:%s:p:%s", c.prefix, userID.String(), string(perm))
}

// CachedEvaluator composes the in-memory Evaluator with a Redis
// cache: cache hit → return; miss → call evaluator → store.
type CachedEvaluator struct {
	inner *Evaluator
	cache *RedisCache
}

// NewCachedEvaluator wires an Evaluator with a Redis-backed cache.
// Pass cache=nil to disable the distributed layer (the in-memory
// cache inside Evaluator still applies).
func NewCachedEvaluator(inner *Evaluator, cache *RedisCache) *CachedEvaluator {
	return &CachedEvaluator{inner: inner, cache: cache}
}

// Allow returns the cached decision when present; otherwise falls
// through to the wrapped Evaluator and writes the result.
func (e *CachedEvaluator) Allow(ctx context.Context, userID uuid.UUID, required Permission) (bool, error) {
	if v, ok := e.cache.Get(ctx, userID, required); ok {
		return v, nil
	}
	allowed, err := e.inner.Allow(ctx, userID, required)
	if err != nil {
		return false, err
	}
	e.cache.Set(ctx, userID, required, allowed)
	return allowed, nil
}

// InvalidateUser evicts both layers so the next Allow re-fetches
// from the loader. Call from role/permission admin endpoints.
func (e *CachedEvaluator) InvalidateUser(ctx context.Context, userID uuid.UUID) error {
	e.inner.Invalidate(userID)
	return e.cache.InvalidateUser(ctx, userID)
}
