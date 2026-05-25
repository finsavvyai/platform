package redisclient

import (
	"context"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
)

// Options configures the Redis client. Self-contained to keep this package
// importable without the parent gateway's config package.
type Options struct {
	Host         string
	Port         int
	Password     string
	Database     int
	PoolSize     int
	MinIdleConns int
	MaxRetries   int
	DialTimeout  time.Duration
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
}

// New builds a v8 redis.Client from Options. Returns nil client and nil
// error when host is empty (rate limiting becomes a no-op via fail-open path).
func New(ctx context.Context, cfg Options) (*redis.Client, error) {
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
