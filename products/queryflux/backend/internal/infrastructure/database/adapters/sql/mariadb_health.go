package sql

import (
	"context"
	"database/sql"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// IsConnected reports whether the MariaDB *sql.DB is live.
func (m *MariaDBAdapter) IsConnected() bool {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return m.db != nil
}

// GetConnectionInfo returns the cached *entities.Connection.
func (m *MariaDBAdapter) GetConnectionInfo() *entities.Connection {
	return m.conn
}

// HealthCheck pings the database.
func (m *MariaDBAdapter) HealthCheck(ctx context.Context) error {
	m.mutex.RLock()
	db := m.db
	m.mutex.RUnlock()
	if db == nil {
		return wrapMySQLAdapterErr("MariaDB.HealthCheck", "NOT_CONNECTED", "Not connected to MariaDB", errMySQLNotConn)
	}
	return mapMySQLError(ctx, "MariaDB.Ping", db.PingContext(ctx))
}

// Ping is an alias for HealthCheck.
func (m *MariaDBAdapter) Ping(ctx context.Context) error {
	return m.HealthCheck(ctx)
}

// GetMetrics returns pool stats.
func (m *MariaDBAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	if m.db == nil {
		return nil, wrapMySQLAdapterErr("MariaDB.GetMetrics", "NOT_CONNECTED", "Not connected to MariaDB", errMySQLNotConn)
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

// MariaDBAdapterTransaction wraps *sql.Tx for the types.Transaction surface.
type MariaDBAdapterTransaction struct {
	tx *sql.Tx
}

// Commit commits the transaction.
func (t *MariaDBAdapterTransaction) Commit() error { return t.tx.Commit() }

// Rollback rolls the transaction back.
func (t *MariaDBAdapterTransaction) Rollback() error { return t.tx.Rollback() }

// BeginTransaction starts a transaction on the active MariaDB connection.
func (m *MariaDBAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	m.mutex.RLock()
	db := m.db
	m.mutex.RUnlock()
	if db == nil {
		return nil, wrapMySQLAdapterErr("MariaDB.BeginTransaction", "NOT_CONNECTED", "Not connected to MariaDB", errMySQLNotConn)
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, mapMySQLError(ctx, "MariaDB.BeginTx", err)
	}
	return &MariaDBAdapterTransaction{tx: tx}, nil
}
