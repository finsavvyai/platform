package sql

import (
	"context"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// TestConnection runs a SELECT 1-equivalent (pgx.Pool.Ping) and returns nil
// on success. Sentinel: ErrNotConnected when pool is nil; otherwise the
// classified driver error.
func (p *PostgreSQLAdapter) TestConnection(ctx context.Context) error {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	if p.pool == nil {
		return notConnectedError()
	}
	if err := p.pool.Ping(ctx); err != nil {
		return pgAdapterError("CONNECTION_TEST_FAILED",
			"Connection test failed", ctx, err)
	}
	return nil
}

// HealthCheck is an alias for TestConnection per the canonical interface.
func (p *PostgreSQLAdapter) HealthCheck(ctx context.Context) error {
	return p.TestConnection(ctx)
}

// Ping is a thin alias for TestConnection per the canonical interface.
func (p *PostgreSQLAdapter) Ping(ctx context.Context) error {
	return p.TestConnection(ctx)
}

// GetMetrics returns pool-level connection statistics. Returned struct only
// populates the fields pgxpool exposes — total / idle counts. Other fields
// stay at zero values until a real metrics collector is wired in.
func (p *PostgreSQLAdapter) GetMetrics(_ context.Context) (*types.ConnectionMetrics, error) {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	if p.pool == nil {
		return nil, notConnectedError()
	}
	stats := p.pool.Stat()
	return &types.ConnectionMetrics{
		ConnectionPoolStats: types.ConnectionPoolStats{
			OpenConnections: int(stats.TotalConns()),
			IdleConnections: int(stats.IdleConns()),
		},
	}, nil
}
