package sql

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	_ "github.com/lib/pq"
	"github.com/sirupsen/logrus"
)

// CockroachDBAdapter handles CockroachDB connections with distributed database features
type CockroachDBAdapter struct {
	conn          *entities.Connection
	db            *sql.DB
	mutex         sync.RWMutex
	logger        *logrus.Logger
	maxRetries    int
	retryInterval time.Duration
}

// Connect establishes a connection to CockroachDB with distributed database configuration
func (c *CockroachDBAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if c.db != nil {
		return nil // Already connected
	}

	// Update connection info
	c.conn = conn

	connStr := c.buildConnectionString(conn)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_FAILED",
			Message: "Failed to connect to CockroachDB",
			Details: err.Error(),
		}
	}

	// Configure connection pool for distributed database
	db.SetMaxOpenConns(50) // Higher for distributed workloads
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(30 * time.Minute)
	db.SetConnMaxIdleTime(10 * time.Minute)

	// Test connection with retry logic
	if err := c.testConnectionWithRetry(ctx, db); err != nil {
		db.Close()
		return err
	}

	c.db = db
	c.logger.Infof("Successfully connected to CockroachDB database: %s", conn.Name)

	return nil
}

// Disconnect closes the CockroachDB connection
func (c *CockroachDBAdapter) Disconnect(ctx context.Context) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if c.db == nil {
		return nil // Already disconnected
	}

	err := c.db.Close()
	c.db = nil
	if err != nil {
		return &types.AdapterError{
			Code:    "DISCONNECT_FAILED",
			Message: "Failed to disconnect from CockroachDB",
			Details: err.Error(),
		}
	}

	c.logger.Infof("Disconnected from CockroachDB database: %s", c.conn.Name)
	return nil
}

// TestConnection tests the CockroachDB connection
func (c *CockroachDBAdapter) TestConnection(ctx context.Context) error {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	if c.db == nil {
		return &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to CockroachDB",
		}
	}

	return c.db.PingContext(ctx)
}

// IsConnected returns whether the adapter is currently connected
func (c *CockroachDBAdapter) IsConnected() bool {
	c.mutex.RLock()
	defer c.mutex.RUnlock()
	return c.db != nil
}

// GetConnectionInfo returns the connection information
func (c *CockroachDBAdapter) GetConnectionInfo() *entities.Connection {
	c.mutex.RLock()
	defer c.mutex.RUnlock()
	return c.conn
}

// testConnectionWithRetry tests the connection with retry logic for distributed systems
func (c *CockroachDBAdapter) testConnectionWithRetry(ctx context.Context, db *sql.DB) error {
	var lastErr error

	for attempt := 1; attempt <= c.maxRetries; attempt++ {
		err := db.PingContext(ctx)
		if err == nil {
			// Verify CockroachDB version
			var version string
			err = db.QueryRowContext(ctx, "SELECT version()").Scan(&version)
			if err == nil && strings.Contains(strings.ToLower(version), "cockroachdb") {
				return nil
			}
			if err != nil {
				lastErr = err
			} else {
				lastErr = fmt.Errorf("connected database is not CockroachDB")
			}
		} else {
			lastErr = err
		}

		if attempt < c.maxRetries {
			c.logger.WithFields(logrus.Fields{
				"attempt": attempt,
				"error":   lastErr,
			}).Warn("CockroachDB connection attempt failed, retrying...")

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(c.retryInterval):
				// Continue to next retry
			}
		}
	}

	return &types.AdapterError{
		Code:    "CONNECTION_TEST_FAILED",
		Message: fmt.Sprintf("Failed to connect to CockroachDB after %d attempts", c.maxRetries),
		Details: lastErr.Error(),
	}
}

// buildConnectionString creates a CockroachDB connection string
func (c *CockroachDBAdapter) buildConnectionString(conn *entities.Connection) string {
	// CockroachDB uses PostgreSQL wire protocol
	connStr := fmt.Sprintf("postgresql://%s:%s@%s:%d/%s",
		conn.Username,
		conn.Password,
		conn.Host,
		conn.Port,
		conn.Database,
	)

	// Add SSL mode (CockroachDB strongly recommends SSL)
	if conn.SSL {
		connStr += "?sslmode=require"
	} else {
		connStr += "?sslmode=disable"
	}

	// Add application name for monitoring
	connStr += "&application_name=queryflux"

	return connStr
}

// ExecuteQuery executes a query with CockroachDB-specific retry logic for serialization errors
func (c *CockroachDBAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	if c.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to CockroachDB",
			Details: "Call Connect() before executing queries",
		}
	}

	var result *types.QueryResult
	var lastErr error

	// Retry logic for serialization errors (40001)
	for attempt := 1; attempt <= c.maxRetries; attempt++ {
		result, lastErr = c.executeQueryAttempt(ctx, query, params...)

		if lastErr == nil {
			return result, nil
		}

		// Check if error is a serialization error that should be retried
		if !c.isRetryableError(lastErr) {
			break
		}

		if attempt < c.maxRetries {
			c.logger.WithFields(logrus.Fields{
				"attempt": attempt,
				"error":   lastErr,
			}).Warn("CockroachDB serialization error, retrying transaction...")

			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(c.retryInterval):
				// Continue to next retry
			}
		}
	}

	return nil, &types.AdapterError{
		Code:    "QUERY_EXECUTION_FAILED",
		Message: "Failed to execute CockroachDB query",
		Details: lastErr.Error(),
	}
}

// executeQueryAttempt performs a single query execution attempt
func (c *CockroachDBAdapter) executeQueryAttempt(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	trimmedQuery := strings.TrimSpace(strings.ToUpper(query))

	if strings.HasPrefix(trimmedQuery, "SELECT") || strings.HasPrefix(trimmedQuery, "SHOW") || strings.HasPrefix(trimmedQuery, "EXPLAIN") {
		return c.executeSelectQuery(ctx, query, params...)
	}

	return c.executeNonSelectQuery(ctx, query, params...)
}

// executeSelectQuery executes a SELECT query
func (c *CockroachDBAdapter) executeSelectQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	rows, err := c.db.QueryContext(ctx, query, params...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Get column types information
	columnTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, err
	}

	// Get column names to ensure we have them even if types fail (though types contain names)
	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	// Prepare column info
	columnInfos := make([]types.ColumnInfo, len(columns))
	for i, col := range columns {
		colType := "unknown"
		if i < len(columnTypes) {
			colType = columnTypes[i].DatabaseTypeName()
		}

		columnInfos[i] = types.ColumnInfo{
			Name:     col,
			Type:     colType,
			Nullable: true, // Default to true if unknown
		}

		// Try to refine nullable info
		if i < len(columnTypes) {
			if nullable, ok := columnTypes[i].Nullable(); ok {
				columnInfos[i].Nullable = nullable
			}
		}
	}

	var resultRows []map[string]interface{}
	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, err
		}

		rowMap := make(map[string]interface{})
		for i, col := range columns {
			rowMap[col] = c.convertValue(values[i])
		}
		resultRows = append(resultRows, rowMap)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &types.QueryResult{
		Columns: columnInfos,
		Rows:    resultRows,
		Count:   int64(len(resultRows)),
	}, nil
}

// executeNonSelectQuery executes INSERT, UPDATE, DELETE queries
func (c *CockroachDBAdapter) executeNonSelectQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	result, err := c.db.ExecContext(ctx, query, params...)
	if err != nil {
		return nil, err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return nil, err
	}

	return &types.QueryResult{
		Columns: []types.ColumnInfo{{Name: "rows_affected", Type: "bigint"}},
		Rows: []map[string]interface{}{
			{"rows_affected": rowsAffected},
		},
		Count: rowsAffected,
	}, nil
}

// isRetryableError checks if an error should trigger a retry
func (c *CockroachDBAdapter) isRetryableError(err error) bool {
	if err == nil {
		return false
	}

	errStr := err.Error()
	// CockroachDB serialization errors (SQLSTATE 40001)
	// and retry write too old errors
	return strings.Contains(errStr, "40001") ||
		strings.Contains(errStr, "restart transaction") ||
		strings.Contains(errStr, "RETRY_WRITE_TOO_OLD") ||
		strings.Contains(errStr, "RETRY_SERIALIZABLE")
}

// GetSchema retrieves the database schema for CockroachDB
func (c *CockroachDBAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	if c.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to CockroachDB",
			Details: "Call Connect() before retrieving schema",
		}
	}

	query := `
		SELECT table_name, table_schema
		FROM information_schema.tables
		WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'crdb_internal', 'pg_extension')
		ORDER BY table_schema, table_name
	`

	rows, err := c.db.QueryContext(ctx, query)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_RETRIEVAL_FAILED",
			Message: "Failed to retrieve CockroachDB schema",
			Details: err.Error(),
		}
	}
	defer rows.Close()

	var tables []types.TableInfo
	for rows.Next() {
		var tableName, schemaName string
		if err := rows.Scan(&tableName, &schemaName); err != nil {
			return nil, &types.AdapterError{
				Code:    "SCHEMA_SCAN_FAILED",
				Message: "Failed to scan schema rows",
				Details: err.Error(),
			}
		}

		tableInfo, err := c.GetTableInfo(ctx, tableName)
		if err != nil {
			c.logger.WithError(err).Warnf("Failed to get info for table %s", tableName)
			continue
		}

		tableInfo.Schema = schemaName
		tables = append(tables, *tableInfo)
	}

	if err := rows.Err(); err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_ITERATION_FAILED",
			Message: "Error iterating schema rows",
			Details: err.Error(),
		}
	}

	return &types.SchemaInfo{
		Tables: tables,
	}, nil
}

// GetTableInfo retrieves detailed information about a specific table
func (c *CockroachDBAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	if c.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to CockroachDB",
			Details: "Call Connect() before retrieving table info",
		}
	}

	// Get columns
	columnsQuery := `
		SELECT
			column_name,
			data_type,
			is_nullable,
			column_default
		FROM information_schema.columns
		WHERE table_name = $1
		ORDER BY ordinal_position
	`

	rows, err := c.db.QueryContext(ctx, columnsQuery, tableName)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "TABLE_INFO_FAILED",
			Message: fmt.Sprintf("Failed to get info for table %s", tableName),
			Details: err.Error(),
		}
	}
	defer rows.Close()

	var columns []types.ColumnInfo
	for rows.Next() {
		var colName, dataType, isNullable string
		var defaultValue sql.NullString

		if err := rows.Scan(&colName, &dataType, &isNullable, &defaultValue); err != nil {
			return nil, err
		}

		defVal := ""
		if defaultValue.Valid {
			defVal = defaultValue.String
		}

		columns = append(columns, types.ColumnInfo{
			Name:         colName,
			Type:         dataType,
			Nullable:     isNullable == "YES",
			DefaultValue: defVal,
		})
	}

	// Get indexes
	indexQuery := `
		SELECT
			i.relname AS index_name,
			a.attname AS column_name,
			ix.indisunique AS is_unique
		FROM pg_class t
		JOIN pg_index ix ON t.oid = ix.indrelid
		JOIN pg_class i ON i.oid = ix.indexrelid
		JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
		WHERE t.relname = $1
		ORDER BY i.relname, a.attnum
	`

	indexRows, err := c.db.QueryContext(ctx, indexQuery, tableName)
	if err != nil {
		c.logger.WithError(err).Warn("Failed to retrieve indexes")
	} else {
		defer indexRows.Close()

		indexMap := make(map[string]*types.IndexInfo)
		for indexRows.Next() {
			var indexName, columnName string
			var isUnique bool

			if err := indexRows.Scan(&indexName, &columnName, &isUnique); err != nil {
				continue
			}

			if idx, exists := indexMap[indexName]; exists {
				idx.Columns = append(idx.Columns, columnName)
			} else {
				indexMap[indexName] = &types.IndexInfo{
					Name:    indexName,
					Columns: []string{columnName},
					Unique:  isUnique,
				}
			}
		}

		var indexes []types.IndexInfo
		for _, idx := range indexMap {
			indexes = append(indexes, *idx)
		}

		return &types.TableInfo{
			Name:    tableName,
			Columns: columns,
			Indexes: indexes,
		}, nil
	}

	return &types.TableInfo{
		Name:    tableName,
		Columns: columns,
		Indexes: []types.IndexInfo{},
	}, nil
}

// convertValue converts database values to appropriate Go types
func (c *CockroachDBAdapter) convertValue(value interface{}) interface{} {
	if value == nil {
		return nil
	}

	switch v := value.(type) {
	case []byte:
		return string(v)
	case time.Time:
		return v.Format(time.RFC3339)
	default:
		return v
	}
}

// HealthCheck checks the health of the connection
func (c *CockroachDBAdapter) HealthCheck(ctx context.Context) error {
	return c.TestConnection(ctx)
}

// Ping pings the database
func (c *CockroachDBAdapter) Ping(ctx context.Context) error {
	return c.TestConnection(ctx)
}

// GetMetrics retrieves connection metrics
func (c *CockroachDBAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	if c.db == nil {
		return nil, &types.AdapterError{Code: "NOT_CONNECTED", Message: "Not connected"}
	}
	stats := c.db.Stats()
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

type CockroachDBTransaction struct {
	tx *sql.Tx
}

func (t *CockroachDBTransaction) Commit() error {
	return t.tx.Commit()
}

func (t *CockroachDBTransaction) Rollback() error {
	return t.tx.Rollback()
}

// BeginTransaction starts a new transaction
func (c *CockroachDBAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	if c.db == nil {
		return nil, &types.AdapterError{Code: "NOT_CONNECTED", Message: "Not connected"}
	}
	tx, err := c.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	return &CockroachDBTransaction{tx: tx}, nil
}
