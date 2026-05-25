package aws

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

// RedshiftAdapter handles AWS Redshift data warehouse connections
type RedshiftAdapter struct {
	conn   *entities.Connection
	db     *sql.DB
	mutex  sync.RWMutex
	logger *logrus.Logger
}

// Connect establishes a connection to AWS Redshift
func (r *RedshiftAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	if r.db != nil {
		return nil // Already connected
	}

	// Update connection info
	r.conn = conn

	connStr := r.buildConnectionString(conn)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_FAILED",
			Message: "Failed to connect to Redshift",
			Details: err.Error(),
		}
	}

	// Configure connection pool for data warehouse
	// Redshift benefits from persistent connections
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(60 * time.Minute) // Longer for data warehouse
	db.SetConnMaxIdleTime(15 * time.Minute)

	// Test the connection
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Failed to ping Redshift cluster",
			Details: err.Error(),
		}
	}

	// Verify Redshift version
	var version string
	err = db.QueryRowContext(ctx, "SELECT version()").Scan(&version)
	if err != nil {
		db.Close()
		return &types.AdapterError{
			Code:    "VERSION_CHECK_FAILED",
			Message: "Failed to verify Redshift version",
			Details: err.Error(),
		}
	}

	if !strings.Contains(strings.ToLower(version), "redshift") {
		db.Close()
		return &types.AdapterError{
			Code:    "INVALID_DATABASE",
			Message: "Connected database is not Amazon Redshift",
			Details: fmt.Sprintf("Version: %s", version),
		}
	}

	r.db = db
	r.logger.Infof("Successfully connected to Redshift cluster: %s", conn.Name)

	return nil
}

// Disconnect closes the Redshift connection
func (r *RedshiftAdapter) Disconnect(ctx context.Context) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	if r.db == nil {
		return nil // Already disconnected
	}

	err := r.db.Close()
	r.db = nil
	if err != nil {
		return &types.AdapterError{
			Code:    "DISCONNECT_FAILED",
			Message: "Failed to disconnect from Redshift",
			Details: err.Error(),
		}
	}

	r.logger.Infof("Disconnected from Redshift cluster: %s", r.conn.Name)
	return nil
}

// TestConnection tests the Redshift connection
func (r *RedshiftAdapter) TestConnection(ctx context.Context) error {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	if r.db == nil {
		return &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Redshift",
		}
	}

	return r.db.PingContext(ctx)
}

// IsConnected returns whether the adapter is currently connected
func (r *RedshiftAdapter) IsConnected() bool {
	r.mutex.RLock()
	defer r.mutex.RUnlock()
	return r.db != nil
}

// GetConnectionInfo returns the connection information
func (r *RedshiftAdapter) GetConnectionInfo() *entities.Connection {
	r.mutex.RLock()
	defer r.mutex.RUnlock()
	return r.conn
}

// buildConnectionString creates a Redshift connection string
func (r *RedshiftAdapter) buildConnectionString(conn *entities.Connection) string {
	// Redshift uses PostgreSQL protocol
	connStr := fmt.Sprintf("postgresql://%s:%s@%s:%d/%s",
		conn.Username,
		conn.Password,
		conn.Host,
		conn.Port,
		conn.Database,
	)

	params := []string{}

	// Redshift requires SSL
	if conn.SSL {
		params = append(params, "sslmode=require")
	} else {
		params = append(params, "sslmode=prefer")
	}

	params = append(params, "application_name=queryflux")

	// Redshift-specific connection parameters
	params = append(params, "connect_timeout=30")

	if len(params) > 0 {
		connStr += "?" + strings.Join(params, "&")
	}

	return connStr
}

// ExecuteQuery executes a query on Redshift with data warehouse optimizations
func (r *RedshiftAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	if r.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Redshift",
			Details: "Call Connect() before executing queries",
		}
	}

	trimmedQuery := strings.TrimSpace(strings.ToUpper(query))

	if strings.HasPrefix(trimmedQuery, "SELECT") || strings.HasPrefix(trimmedQuery, "SHOW") || strings.HasPrefix(trimmedQuery, "EXPLAIN") || strings.HasPrefix(trimmedQuery, "WITH") {
		return r.executeSelectQuery(ctx, query, params...)
	}

	return r.executeNonSelectQuery(ctx, query, params...)
}

// executeSelectQuery executes a SELECT query with Redshift-specific handling
func (r *RedshiftAdapter) executeSelectQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	rows, err := r.db.QueryContext(ctx, query, params...)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "QUERY_EXECUTION_FAILED",
			Message: "Failed to execute query",
			Details: err.Error(),
		}
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "COLUMN_RETRIEVAL_FAILED",
			Message: "Failed to retrieve columns",
			Details: err.Error(),
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
			return nil, &types.AdapterError{
				Code:    "ROW_SCAN_FAILED",
				Message: "Failed to scan row",
				Details: err.Error(),
			}
		}

		rowMap := make(map[string]interface{})
		for i, col := range columns {
			rowMap[col] = r.convertValue(values[i])
		}
		resultRows = append(resultRows, rowMap)
	}

	if err := rows.Err(); err != nil {
		return nil, &types.AdapterError{
			Code:    "ROW_ITERATION_FAILED",
			Message: "Error iterating rows",
			Details: err.Error(),
		}
	}

	return &types.QueryResult{
		Columns: r.toColumnInfo(columns),
		Rows:    resultRows,
		Count:   int64(len(resultRows)),
	}, nil
}

// executeNonSelectQuery executes INSERT, UPDATE, DELETE, COPY queries
func (r *RedshiftAdapter) executeNonSelectQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	result, err := r.db.ExecContext(ctx, query, params...)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "QUERY_EXECUTION_FAILED",
			Message: "Failed to execute query",
			Details: err.Error(),
		}
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "ROWS_AFFECTED_FAILED",
			Message: "Failed to get rows affected",
			Details: err.Error(),
		}
	}

	return &types.QueryResult{
		Columns: r.toColumnInfo([]string{"rows_affected"}),
		Rows: []map[string]interface{}{
			{"rows_affected": rowsAffected},
		},
		Count: rowsAffected,
	}, nil
}

func (r *RedshiftAdapter) toColumnInfo(columns []string) []types.ColumnInfo {
	colInfos := make([]types.ColumnInfo, len(columns))
	for i, col := range columns {
		colInfos[i] = types.ColumnInfo{
			Name: col,
			Type: "string",
		}
	}
	return colInfos
}

// GetSchema retrieves the Redshift schema information
func (r *RedshiftAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	if r.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Redshift",
			Details: "Call Connect() before retrieving schema",
		}
	}

	// Redshift uses PostgreSQL-compatible system tables
	query := `
		SELECT schemaname, tablename
		FROM pg_tables
		WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
		ORDER BY schemaname, tablename
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_RETRIEVAL_FAILED",
			Message: "Failed to retrieve Redshift schema",
			Details: err.Error(),
		}
	}
	defer rows.Close()

	var tables []types.TableInfo
	for rows.Next() {
		var schemaName, tableName string
		if err := rows.Scan(&schemaName, &tableName); err != nil {
			return nil, &types.AdapterError{
				Code:    "SCHEMA_SCAN_FAILED",
				Message: "Failed to scan schema rows",
				Details: err.Error(),
			}
		}

		tableInfo, err := r.GetTableInfo(ctx, tableName)
		if err != nil {
			r.logger.WithError(err).Warnf("Failed to get info for table %s", tableName)
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
func (r *RedshiftAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	if r.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Redshift",
			Details: "Call Connect() before retrieving table info",
		}
	}

	// Get columns using Redshift-specific system tables
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

	rows, err := r.db.QueryContext(ctx, columnsQuery, tableName)
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
		var defaultValue *string

		if err := rows.Scan(&colName, &dataType, &isNullable, &defaultValue); err != nil {
			return nil, &types.AdapterError{
				Code:    "COLUMN_SCAN_FAILED",
				Message: "Failed to scan column information",
				Details: err.Error(),
			}
		}

		defVal := ""
		if defaultValue != nil {
			defVal = *defaultValue
		}

		columns = append(columns, types.ColumnInfo{
			Name:         colName,
			Type:         dataType,
			Nullable:     isNullable == "YES",
			DefaultValue: defVal,
		})
	}

	// Get indexes (Redshift has limited index support - sort keys and dist keys)
	// For simplicity, return empty index list
	return &types.TableInfo{
		Name:    tableName,
		Columns: columns,
		Indexes: []types.IndexInfo{},
	}, nil
}

// convertValue converts database values to appropriate Go types
func (r *RedshiftAdapter) convertValue(value interface{}) interface{} {
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
func (r *RedshiftAdapter) HealthCheck(ctx context.Context) error {
	if r.db == nil {
		return &types.AdapterError{Code: "NOT_CONNECTED", Message: "Not connected to Redshift"}
	}
	return r.db.PingContext(ctx)
}

// Ping pings the database
func (r *RedshiftAdapter) Ping(ctx context.Context) error {
	return r.HealthCheck(ctx)
}

// GetMetrics retrieves connection metrics
func (r *RedshiftAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	if r.db == nil {
		return nil, &types.AdapterError{Code: "NOT_CONNECTED", Message: "Not connected to Redshift"}
	}

	stats := r.db.Stats()
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

type RedshiftTransaction struct {
	tx *sql.Tx
}

func (t *RedshiftTransaction) Commit() error {
	return t.tx.Commit()
}

func (t *RedshiftTransaction) Rollback() error {
	return t.tx.Rollback()
}

// BeginTransaction starts a new transaction
func (r *RedshiftAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	if r.db == nil {
		return nil, &types.AdapterError{Code: "NOT_CONNECTED", Message: "Not connected to Redshift"}
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	return &RedshiftTransaction{tx: tx}, nil
}
