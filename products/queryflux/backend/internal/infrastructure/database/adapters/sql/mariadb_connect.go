package sql

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// Connect opens a MariaDB connection using the MySQL driver (wire-compatible).
// Multi-statement SQL is rejected at the DSN level (QUERY_CONTRACT.md §4).
func (m *MariaDBAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if m.db != nil {
		return nil
	}
	m.conn = conn

	connStr, err := conn.GetConnectionString()
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_STRING_ERROR",
			Message: "Failed to build MariaDB connection string",
			Details: err.Error(),
		}
	}
	connStr = ensureMariaDBDSNParams(connStr)
	connStr = stripMultiStatementsDSN(connStr)

	db, err := sql.Open("mysql", connStr)
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_FAILED",
			Message: "Failed to open MariaDB connection",
			Details: err.Error(),
		}
	}

	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(time.Hour)
	db.SetConnMaxIdleTime(30 * time.Minute)

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return wrapMySQLAdapterErr("MariaDB.Ping", "CONNECTION_TEST_FAILED", err.Error(), errMySQLConnection)
	}

	m.db = db
	m.logger.Infof("Connected to MariaDB database: %s", conn.Name)
	return nil
}

// Disconnect closes the MariaDB connection.
func (m *MariaDBAdapter) Disconnect(ctx context.Context) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if m.db == nil {
		return nil
	}
	if err := m.db.Close(); err != nil {
		return &types.AdapterError{
			Code:    "DISCONNECT_FAILED",
			Message: "Failed to close MariaDB connection",
			Details: err.Error(),
		}
	}
	m.db = nil
	m.logger.Infof("Disconnected from MariaDB database: %s", m.conn.Name)
	return nil
}

// TestConnection pings MariaDB.
func (m *MariaDBAdapter) TestConnection(ctx context.Context) error {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	if m.db == nil {
		return wrapMySQLAdapterErr("MariaDB.TestConnection", "NOT_CONNECTED", "Not connected to database", errMySQLNotConn)
	}
	if err := m.db.PingContext(ctx); err != nil {
		return wrapMySQLAdapterErr("MariaDB.TestConnection", "CONNECTION_TEST_FAILED", err.Error(), errMySQLConnection)
	}
	return nil
}

// ensureMariaDBDSNParams appends parseTime, charset, collation defaults.
func ensureMariaDBDSNParams(dsn string) string {
	if !strings.Contains(dsn, "parseTime=") {
		dsn = appendDSNParam(dsn, "parseTime=true")
	}
	if !strings.Contains(dsn, "charset=") {
		dsn = appendDSNParam(dsn, "charset=utf8mb4")
	}
	if !strings.Contains(dsn, "collation=") {
		dsn = appendDSNParam(dsn, "collation=utf8mb4_unicode_ci")
	}
	return dsn
}
