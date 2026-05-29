package cache

import (
	"context"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
)

// RedisCache provides Redis-backed caching
type RedisCache struct {
	client *redis.Client
	logger *logrus.Logger
}

// NewRedisCache creates a new RedisCache instance
func NewRedisCache(client *redis.Client, logger *logrus.Logger) *RedisCache {
	return &RedisCache{
		client: client,
		logger: logger,
	}
}

// Get retrieves a cached value by key
func (rc *RedisCache) Get(ctx context.Context, key string) (string, error) {
	return rc.client.Get(ctx, key).Result()
}

// Set stores a value in the cache with TTL
func (rc *RedisCache) Set(ctx context.Context, key, value string, ttl time.Duration) error {
	return rc.client.Set(ctx, key, value, ttl).Err()
}

// Delete removes a key from the cache
func (rc *RedisCache) Delete(ctx context.Context, key string) error {
	return rc.client.Del(ctx, key).Err()
}
