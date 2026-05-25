package sql

import (
	"context"
	"database/sql"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// IsConnected reports whether a live *sql.DB handle exists.
func (m *MySQLAdapter) IsConnected() bool {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return m.db != nil
}

// GetConnectionInfo returns the cached *entities.Connection.
func (m *MySQLAdapter) GetConnectionInfo() *entities.Connection {
	return m.conn
}

// HealthCheck is an alias for TestConnection — both call db.PingContext.
func (m *MySQLAdapter) HealthCheck(ctx context.Context) error {
	return m.TestConnection(ctx)
}

// Ping is an alias for TestConnection.
func (m *MySQLAdapter) Ping(ctx context.Context) error {
	return m.TestConnection(ctx)
}

// GetMetrics returns *sql.DB pool stats wrapped in the canonical envelope.
func (m *MySQLAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	if m.db == nil {
		return nil, wrapMySQLAdapterErr("MySQL.GetMetrics", "NOT_CONNECTED", "Not connected", errMySQLNotConn)
	}
	stats := m.db.Stats()
	return &types.ConnectionMetrics{
		ConnectionPoolStats: types.ConnectionPoolStats{
			OpenConnections:    stats.OpenConnections,
			IdleConnections:    stats.Idle,
			InUseConnections:   stats.InUse,
			WaitCount:          int64(stats.WaitCount),
			WaitDuration:       stats.WaitDuration,
			MaxOpenConnections: stats.MaxOpenConnections,
		},
	}, nil
}

// MySQLTransaction wraps *sql.Tx for the types.Transaction surface.
type MySQLTransaction struct {
	tx *sql.Tx
}

// Commit commits the transaction.
func (t *MySQLTransaction) Commit() error { return t.tx.Commit() }

// Rollback rolls the transaction back.
func (t *MySQLTransaction) Rollback() error { return t.tx.Rollback() }

// BeginTransaction starts a transaction on the active MySQL connection.
func (m *MySQLAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	m.mutex.RLock()
	db := m.db
	m.mutex.RUnlock()
	if db == nil {
		return nil, wrapMySQLAdapterErr("MySQL.BeginTransaction", "NOT_CONNECTED", "Not connected", errMySQLNotConn)
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, mapMySQLError(ctx, "MySQL.BeginTx", err)
	}
	return &MySQLTransaction{tx: tx}, nil
}
