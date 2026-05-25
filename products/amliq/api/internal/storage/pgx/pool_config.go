package pgx

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// PoolConfig defines connection pool tuning parameters.
type PoolConfig struct {
	MaxConns          int
	MinConns          int
	MaxIdleTime       time.Duration
	MaxLifetime       time.Duration
	HealthCheckPeriod time.Duration
}

// DefaultPoolConfig returns conservative defaults for general use.
func DefaultPoolConfig() PoolConfig {
	return PoolConfig{
		MaxConns:          25,
		MinConns:          5,
		MaxIdleTime:       30 * time.Second,
		MaxLifetime:       5 * time.Minute,
		HealthCheckPeriod: 30 * time.Second,
	}
}

// HighThroughputConfig returns aggressive settings for 10K+ screens/sec.
func HighThroughputConfig() PoolConfig {
	return PoolConfig{
		MaxConns:          100,
		MinConns:          25,
		MaxIdleTime:       10 * time.Second,
		MaxLifetime:       3 * time.Minute,
		HealthCheckPeriod: 15 * time.Second,
	}
}

// NewPoolFromConfig creates a *sql.DB with the given pool configuration.
func NewPoolFromConfig(connStr string, cfg PoolConfig) (*sql.DB, error) {
	db, err := sql.Open("pgx", connStr)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	db.SetMaxOpenConns(cfg.MaxConns)
	db.SetMaxIdleConns(cfg.MinConns)
	db.SetConnMaxLifetime(cfg.MaxLifetime)
	db.SetConnMaxIdleTime(cfg.MaxIdleTime)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping db: %w", err)
	}
	return db, nil
}
