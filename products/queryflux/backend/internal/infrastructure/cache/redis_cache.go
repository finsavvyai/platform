package cache

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisCache is a small wrapper around go-redis used by application services.
// It keeps services decoupled from the concrete Redis client while preserving
// byte-oriented cache payloads for JSON and export data.
type RedisCache struct {
	client redis.UniversalClient
}

// NewRedisCache creates a Redis-backed cache from an existing client.
func NewRedisCache(client redis.UniversalClient) *RedisCache {
	return &RedisCache{client: client}
}

// Get returns the cached value for key.
func (c *RedisCache) Get(ctx context.Context, key string) ([]byte, error) {
	return c.client.Get(ctx, key).Bytes()
}

// Set stores value for key with the provided TTL.
func (c *RedisCache) Set(ctx context.Context, key string, value []byte, ttl time.Duration) error {
	return c.client.Set(ctx, key, value, ttl).Err()
}

// Delete removes key from the cache.
func (c *RedisCache) Delete(ctx context.Context, key string) error {
	return c.client.Del(ctx, key).Err()
}
