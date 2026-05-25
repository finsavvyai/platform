package cache

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"time"
)

// DefaultTTL is the default cache entry lifetime.
const DefaultTTL = 5 * time.Minute

// RedisCache is a shared screening result cache backed by Redis.
type RedisCache struct {
	pool ConnPool
}

// ConnPool abstracts a Redis connection pool for testing. Composed
// of three single-responsibility interfaces (Getter / Setter /
// Deleter) so fakes can stub only what they need — and so it
// respects the "interface max 3 methods" rule. Close() is tacked
// on separately so readers and writers can be mocked without
// having to implement shutdown semantics.
type ConnPool interface {
	CachePool
	io.Closer
}

// CachePool is the read/write/delete surface without Close.
type CachePool interface {
	Get(ctx context.Context, key string) ([]byte, error)
	Set(ctx context.Context, key string, val []byte, ttl time.Duration) error
	Del(ctx context.Context, key string) error
}

// NewRedisCache creates a cache using the given connection pool.
func NewRedisCache(pool ConnPool) *RedisCache {
	return &RedisCache{pool: pool}
}

// KeyFor builds a standardized cache key for screening results.
func KeyFor(normalizedName, listHash string) string {
	return fmt.Sprintf("screen:%s:%s", normalizedName, listHash)
}

// Get retrieves a cached screening result. Returns nil, nil on miss.
// The caller's context drives cancellation; a 2s per-operation budget
// is layered on top to bound tail latency when Redis is slow.
func (rc *RedisCache) Get(ctx context.Context, key string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	data, err := rc.pool.Get(ctx, key)
	if err != nil {
		if isNilErr(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("redis get: %w", err)
	}
	return data, nil
}

// Set stores a screening result with the given TTL.
func (rc *RedisCache) Set(ctx context.Context, key string, value []byte, ttl time.Duration) error {
	if ttl <= 0 {
		ttl = DefaultTTL
	}
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	if err := rc.pool.Set(ctx, key, value, ttl); err != nil {
		return fmt.Errorf("redis set: %w", err)
	}
	return nil
}

// Delete removes a cached entry.
func (rc *RedisCache) Delete(ctx context.Context, key string) error {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	if err := rc.pool.Del(ctx, key); err != nil {
		return fmt.Errorf("redis del: %w", err)
	}
	return nil
}

// Close shuts down the connection pool.
func (rc *RedisCache) Close() error {
	return rc.pool.Close()
}

func isNilErr(err error) bool {
	if err == nil {
		return false
	}
	var netErr *net.OpError
	if errors.As(err, &netErr) {
		return false
	}
	return err.Error() == "redis: nil" || err.Error() == "not found"
}
