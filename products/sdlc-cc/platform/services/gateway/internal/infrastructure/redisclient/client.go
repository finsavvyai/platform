package redisclient

import (
	"context"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/config"
)

// New builds a v8 redis.Client from RedisConfig. Returns nil client and nil
// error when host is empty (rate limiting becomes a no-op via fail-open path).
func New(ctx context.Context, cfg config.RedisConfig) (*redis.Client, error) {
	if cfg.Host == "" {
		return nil, nil
	}

	client := redis.NewClient(&redis.Options{
		Addr:         fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		Password:     cfg.Password,
		DB:           cfg.Database,
		PoolSize:     cfg.PoolSize,
		MinIdleConns: cfg.MinIdleConns,
		MaxRetries:   cfg.MaxRetries,
		DialTimeout:  cfg.DialTimeout,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
		IdleTimeout:  cfg.IdleTimeout,
	})

	pingCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	if err := client.Ping(pingCtx).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("redis ping failed at %s: %w", cfg.Host, err)
	}

	return client, nil
}
