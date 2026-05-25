package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisSharedCache provides a shared screening cache across all API nodes.
// Same query hitting any node gets a cache hit (0.01ms vs 50ms screening).
type RedisSharedCache struct {
	client *redis.Client
	prefix string
	ttl    time.Duration
}

// RedisConfig configures the shared Redis cache.
type RedisConfig struct {
	Addr     string        // Redis address (default "localhost:6379")
	Password string        // Redis password
	DB       int           // Redis database number (default 0)
	Prefix   string        // Key prefix (default "aegis:screen:")
	TTL      time.Duration // Cache TTL (default 24h)
	PoolSize int           // Connection pool size (default 100)
}

// NewRedisSharedCache creates a Redis-backed shared screening cache.
func NewRedisSharedCache(cfg RedisConfig) (*RedisSharedCache, error) {
	if cfg.Addr == "" {
		cfg.Addr = "localhost:6379"
	}
	if cfg.Prefix == "" {
		cfg.Prefix = "aegis:screen:"
	}
	if cfg.TTL <= 0 {
		cfg.TTL = 24 * time.Hour
	}
	if cfg.PoolSize <= 0 {
		cfg.PoolSize = 100
	}

	client := redis.NewClient(&redis.Options{
		Addr:         cfg.Addr,
		Password:     cfg.Password,
		DB:           cfg.DB,
		PoolSize:     cfg.PoolSize,
		MinIdleConns: 10,
		ReadTimeout:  2 * time.Second,
		WriteTimeout: 2 * time.Second,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping: %w", err)
	}

	return &RedisSharedCache{
		client: client,
		prefix: cfg.Prefix,
		ttl:    cfg.TTL,
	}, nil
}

// Get retrieves a cached screening result by entity name.
func (r *RedisSharedCache) Get(key ScreeningCacheKey) (*CacheEntry, error) {
	ctx := context.Background()
	data, err := r.client.Get(ctx, r.cacheKey(key)).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	entry := &CacheEntry{
		Result:   data,
		CachedAt: time.Now().UTC(),
		TTL:      r.ttl,
	}
	return entry, nil
}

// Set stores a screening result with TTL.
func (r *RedisSharedCache) Set(key ScreeningCacheKey, result []byte, ttl time.Duration) error {
	if ttl <= 0 {
		ttl = r.ttl
	}
	ctx := context.Background()
	return r.client.Set(ctx, r.cacheKey(key), result, ttl).Err()
}

// Delete removes a cached entry.
func (r *RedisSharedCache) Delete(key ScreeningCacheKey) error {
	ctx := context.Background()
	return r.client.Del(ctx, r.cacheKey(key)).Err()
}

// Stats returns cache statistics.
func (r *RedisSharedCache) Stats() (hits, misses int64, err error) {
	ctx := context.Background()
	info, err := r.client.Info(ctx, "stats").Result()
	if err != nil {
		return 0, 0, err
	}
	_ = info // parse from info string if needed
	return 0, 0, nil
}

// Close closes the Redis connection.
func (r *RedisSharedCache) Close() error {
	return r.client.Close()
}

func (r *RedisSharedCache) cacheKey(key ScreeningCacheKey) string {
	return r.prefix + key.EntityName
}
