package sql

import (
	"context"
	"database/sql"
	"time"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// HealthCheck delegates to TestConnection (cheap ping).
func (s *SQLiteAdapter) HealthCheck(ctx context.Context) error {
	return s.TestConnection(ctx)
}

// Ping delegates to TestConnection.
func (s *SQLiteAdapter) Ping(ctx context.Context) error {
	return s.TestConnection(ctx)
}

// GetMetrics surfaces database/sql pool stats and static engine info.
func (s *SQLiteAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	s.mutex.RLock()
	db := s.db
	s.mutex.RUnlock()

	if db == nil {
		return nil, notConnected()
	}

	stats := db.Stats()
	poolStats := types.ConnectionPoolStats{
		OpenConnections:    stats.OpenConnections,
		IdleConnections:    stats.Idle,
		InUseConnections:   stats.InUse,
		WaitCount:          int64(stats.WaitCount),
		WaitDuration:       stats.WaitDuration,
		MaxOpenConnections: stats.MaxOpenConnections,
	}
	dbInfo := types.DatabaseInfo{Engine: "SQLite", Version: "3.x"}

	if s.base != nil {
		s.base.UpdateMetrics(poolStats, dbInfo)
		return s.base.GetMetrics(), nil
	}
	return &types.ConnectionMetrics{
		ConnectionPoolStats: poolStats,
		DatabaseInfo:        dbInfo,
	}, nil
}

// SQLiteTransaction wraps *sql.Tx to satisfy types.Transaction.
type SQLiteTransaction struct{ tx *sql.Tx }

func (t *SQLiteTransaction) Commit() error   { return t.tx.Commit() }
func (t *SQLiteTransaction) Rollback() error { return t.tx.Rollback() }

// BeginTransaction starts a new database/sql transaction.
func (s *SQLiteAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	s.mutex.RLock()
	db := s.db
	s.mutex.RUnlock()
	if db == nil {
		return nil, notConnected()
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, (&types.AdapterError{
			Code:    "TX_BEGIN_FAILED",
			Message: "Failed to begin transaction",
			Details: err.Error(),
		}).WithSentinel(mapSQLiteError(err))
	}
	return &SQLiteTransaction{tx: tx}, nil
}

// nowMonotonic / sinceMonotonic — kept in this file to avoid an extra utility
// file and to keep sqlite_connect.go free of time imports.
func nowMonotonic() time.Time         { return time.Now() }
func sinceMonotonic(t time.Time) time.Duration { return time.Since(t) }
