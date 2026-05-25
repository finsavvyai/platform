package sql

import (
	"context"
	"database/sql"
	"strings"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/sirupsen/logrus"
)

// BaseSQLAdapter provides common functionality for SQL database adapters
type BaseSQLAdapter struct {
	conn   *entities.Connection
	db     *sql.DB
	mutex  sync.RWMutex
	logger *logrus.Logger
}

// Connect establishes a connection using the provided driver
func (b *BaseSQLAdapter) Connect(ctx context.Context, conn *entities.Connection, driverName string) error {
	b.mutex.Lock()
	defer b.mutex.Unlock()

	if b.db != nil {
		return nil // Already connected
	}

	// Update connection info
	b.conn = conn

	// Build connection string
	connStr, err := conn.GetConnectionString()
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_STRING_ERROR",
			Message: "Failed to build connection string",
			Details: err.Error(),
		}
	}

	// Open database connection
	db, err := sql.Open(driverName, connStr)
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_FAILED",
			Message: "Failed to open database connection",
			Details: err.Error(),
		}
	}

	// Configure connection pool
	b.configureConnectionPool(db, conn.Type)

	// Test the connection
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Failed to ping database",
			Details: err.Error(),
		}
	}

	b.db = db
	b.logger.Infof("Connected to %s database: %s", conn.Type, conn.Name)

	return nil
}

// configureConnectionPool sets up connection pool based on database type
func (b *BaseSQLAdapter) configureConnectionPool(db *sql.DB, dbType string) {
	switch dbType {
	case entities.TypeSQLite:
		// SQLite works best with single connection
		db.SetMaxOpenConns(1)
		db.SetMaxIdleConns(1)
		db.SetConnMaxLifetime(0)
	case entities.TypePostgreSQL, entities.TypeCockroachDB, entities.TypeTimescaleDB, entities.TypeSupabase:
		// PostgreSQL-based databases
		db.SetMaxOpenConns(10)
		db.SetMaxIdleConns(2)
		db.SetConnMaxLifetime(0)
		db.SetConnMaxIdleTime(0)
	default:
		// Default configuration for other SQL databases
		db.SetMaxOpenConns(10)
		db.SetMaxIdleConns(2)
		db.SetConnMaxLifetime(time.Hour)
		db.SetConnMaxIdleTime(30 * time.Minute)
	}
}

// Disconnect closes the database connection
func (b *BaseSQLAdapter) Disconnect(ctx context.Context) error {
	b.mutex.Lock()
	defer b.mutex.Unlock()

	if b.db == nil {
		return nil // Already disconnected
	}

	if err := b.db.Close(); err != nil {
		return &types.AdapterError{
			Code:    "DISCONNECT_FAILED",
			Message: "Failed to close database connection",
			Details: err.Error(),
		}
	}

	b.db = nil
	b.logger.Infof("Disconnected from %s database: %s", b.conn.Type, b.conn.Name)

	return nil
}

// TestConnection tests if the database connection is valid
func (b *BaseSQLAdapter) TestConnection(ctx context.Context) error {
	b.mutex.RLock()
	defer b.mutex.RUnlock()

	if b.db == nil {
		return &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	if err := b.db.PingContext(ctx); err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Connection test failed",
			Details: err.Error(),
		}
	}

	return nil
}

// ExecuteQuery executes a SQL query and returns results
func (b *BaseSQLAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	b.mutex.RLock()
	defer b.mutex.RUnlock()

	if b.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// Trim and validate query
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, &types.AdapterError{
			Code:    "EMPTY_QUERY",
			Message: "Query cannot be empty",
		}
	}

	// Execute query
	rows, err := b.db.QueryContext(ctx, query, params...)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "QUERY_EXECUTION_FAILED",
			Message: "Failed to execute query",
			Details: err.Error(),
		}
	}
	defer rows.Close()

	// Get column information
	columns, err := rows.Columns()
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "COLUMN_INFO_FAILED",
			Message: "Failed to get column information",
			Details: err.Error(),
		}
	}

	// Get column types
	columnTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "COLUMN_TYPE_FAILED",
			Message: "Failed to get column type information",
			Details: err.Error(),
		}
	}

	// Map to ColumnInfo
	columnInfos := make([]types.ColumnInfo, len(columns))
	for i, col := range columns {
		colType := "unknown"
		if i < len(columnTypes) {
			colType = columnTypes[i].DatabaseTypeName()
		}

		columnInfos[i] = types.ColumnInfo{
			Name:     col,
			Type:     colType,
			Nullable: true,
		}

		// Try to refine nullable info
		if i < len(columnTypes) {
			if nullable, ok := columnTypes[i].Nullable(); ok {
				columnInfos[i].Nullable = nullable
			}
		}
	}

	// Prepare value containers
	values := make([]interface{}, len(columns))
	valuePtrs := make([]interface{}, len(columns))
	for i := range values {
		valuePtrs[i] = &values[i]
	}

	// Collect rows
	var resultRows []map[string]interface{}
	for rows.Next() {
		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, &types.AdapterError{
				Code:    "ROW_SCAN_FAILED",
				Message: "Failed to scan row",
				Details: err.Error(),
			}
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			val := values[i]

			// Handle common type conversions
			if val != nil {
				switch v := val.(type) {
				case []byte:
					row[col] = string(v)
				case time.Time:
					row[col] = v.Format(time.RFC3339)
				default:
					row[col] = val
				}
			} else {
				row[col] = nil
			}
		}
		resultRows = append(resultRows, row)
	}

	if err := rows.Err(); err != nil {
		return nil, &types.AdapterError{
			Code:    "ROWS_ITERATION_FAILED",
			Message: "Error during rows iteration",
			Details: err.Error(),
		}
	}

	return &types.QueryResult{
		Columns: columnInfos,
		Rows:    resultRows,
		Count:   int64(len(resultRows)),
	}, nil
}

// IsConnected returns true if the adapter is connected
func (b *BaseSQLAdapter) IsConnected() bool {
	b.mutex.RLock()
	defer b.mutex.RUnlock()

	return b.db != nil
}

// GetConnectionInfo returns the connection information
func (b *BaseSQLAdapter) GetConnectionInfo() *entities.Connection {
	return b.conn
}

// GetDB returns the underlying database connection (for advanced operations)
func (b *BaseSQLAdapter) GetDB() *sql.DB {
	b.mutex.RLock()
	defer b.mutex.RUnlock()
	return b.db
}
