package main

import (
	"log"
	"strconv"
	"os"
	"time"

	"github.com/aegis-aml/aegis/internal/cache"
	"github.com/aegis-aml/aegis/internal/config"
	"github.com/aegis-aml/aegis/internal/screening"
)

// wireRedisCache connects the screening engine to a shared Redis
// result cache when REDIS_URL is set to a non-dev value. Failure
// to connect is non-fatal — the engine falls back to per-node LRU.
func wireRedisCache(cfg config.Config, engine *screening.Engine) {
	if cfg.Redis.URL == "" || cfg.Redis.URL == "redis://localhost:6379" {
		return
	}
	redisCache, err := cache.NewRedisSharedCache(cache.RedisConfig{
		Addr:     redisAddr(cfg.Redis.URL),
		PoolSize: cfg.Redis.PoolSize,
		TTL:      24 * time.Hour,
	})
	if err != nil {
		log.Printf("Redis cache unavailable: %v (using per-node LRU only)", err)
		return
	}
	screening.WithScreeningCache(redisCache)(engine)
	log.Printf("Redis shared cache connected (pool=%d)", cfg.Redis.PoolSize)
}

// redisAddr extracts host:port from a redis:// URL for go-redis.
// Accepts both redis:// and rediss:// schemes.
func redisAddr(url string) string {
	s := url
	if len(s) > 8 && s[:8] == "redis://" {
		s = s[8:]
	}
	if len(s) > 9 && s[:9] == "rediss://" {
		s = s[9:]
	}
	if idx := lastIndex(s, '@'); idx >= 0 {
		s = s[idx+1:]
	}
	if idx := lastIndex(s, '/'); idx >= 0 {
		s = s[:idx]
	}
	if s == "" {
		return "localhost:6379"
	}
	return s
}

func lastIndex(s string, b byte) int {
	for i := len(s) - 1; i >= 0; i-- {
		if s[i] == b {
			return i
		}
	}
	return -1
}

// envInt returns the env var parsed as an int, or fallback.
func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
