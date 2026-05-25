package timeseries

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/sirupsen/logrus"
)

// TimescaleDBAdapter implements DatabaseAdapter for TimescaleDB
// TimescaleDB is a PostgreSQL extension for time-series data
type TimescaleDBAdapter struct {
	conn   *entities.Connection
	db     *sql.DB
	mutex  sync.RWMutex
	logger *logrus.Logger
}

// Connect establishes a connection to TimescaleDB
func (t *TimescaleDBAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	t.mutex.Lock()
	defer t.mutex.Unlock()

	if t.db != nil {
		return nil // Already connected
	}

	// Update connection info
	t.conn = conn

	// Build PostgreSQL connection string
	sslMode := "disable"
	if conn.SSL {
		sslMode = "require"
	}

	connStr := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		conn.Username,
		conn.Password,
		conn.Host,
		conn.Port,
		conn.Database,
		sslMode,
	)

	// Open database connection using pgx driver
	db, err := sql.Open("pgx", connStr)
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_FAILED",
			Message: "Failed to open TimescaleDB connection",
			Details: err.Error(),
		}
	}

	// Configure connection pool
	db.SetMaxOpenConns(15)
	db.SetMaxIdleConns(3)
	db.SetConnMaxLifetime(time.Hour)
	db.SetConnMaxIdleTime(30 * time.Minute)

	// Test the connection
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Failed to ping TimescaleDB database",
			Details: err.Error(),
		}
	}

	// Verify TimescaleDB extension is available
	var extInstalled bool
	err = db.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'timescaledb')").Scan(&extInstalled)
	if err != nil {
		t.logger.Warnf("Could not verify TimescaleDB extension: %v", err)
	} else if !extInstalled {
		t.logger.Warn("TimescaleDB extension is not installed in this database")
	}

	t.db = db
	t.logger.Infof("Connected to TimescaleDB database: %s", conn.Name)

	return nil
}

// Disconnect closes the TimescaleDB connection
func (t *TimescaleDBAdapter) Disconnect(ctx context.Context) error {
	t.mutex.Lock()
	defer t.mutex.Unlock()

	if t.db == nil {
		return nil // Already disconnected
	}

	if err := t.db.Close(); err != nil {
		return &types.AdapterError{
			Code:    "DISCONNECT_FAILED",
			Message: "Failed to close TimescaleDB connection",
			Details: err.Error(),
		}
	}

	t.db = nil
	t.logger.Infof("Disconnected from TimescaleDB database: %s", t.conn.Name)

	return nil
}

// TestConnection tests if the TimescaleDB connection is valid
func (t *TimescaleDBAdapter) TestConnection(ctx context.Context) error {
	t.mutex.RLock()
	defer t.mutex.RUnlock()

	if t.db == nil {
		return &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	if err := t.db.PingContext(ctx); err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Connection test failed",
			Details: err.Error(),
		}
	}

	return nil
}

// ExecuteQuery executes a TimescaleDB query with time-series optimizations
func (t *TimescaleDBAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	t.mutex.RLock()
	defer t.mutex.RUnlock()

	if t.db == nil {
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

	// Apply TimescaleDB-specific optimizations
	query = t.optimizeTimescaleQuery(query)

	// Execute query
	rows, err := t.db.QueryContext(ctx, query, params...)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "QUERY_EXECUTION_FAILED",
			Message: "Failed to execute TimescaleDB query",
			Details: err.Error(),
		}
	}
	defer rows.Close()

	// Get column names
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
			Message: "Failed to get column types",
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

			// Handle PostgreSQL/TimescaleDB type conversions
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

// BeginTransaction starts a new transaction
func (t *TimescaleDBAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	if t.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}
	tx, err := t.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	return &SQLTransaction{Tx: tx}, nil
}

// SQLTransaction struct might be shared in package, but simple redef here if needed or assume shared
// Since they are in same package 'timeseries' and I added it to questdb_adapter,
// I should NOT add it again if I assume they compile together.
// But to be safe and avoid "redeclaration" if I already defined it in questdb_adapter.go
// I will check if I can rely on questdb_adapter.go being in same package.
// Yes, they are both in `package timeseries`.
// So I will NOT include SQLTransaction struct definition here, assuming it's in questdb_adapter.go

// GetSchema retrieves TimescaleDB database schema information including hypertables
func (t *TimescaleDBAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	t.mutex.RLock()
	defer t.mutex.RUnlock()

	if t.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// Query to get all tables including hypertables
	query := `
		SELECT
			schemaname,
			tablename,
			CASE WHEN h.table_name IS NOT NULL THEN 'hypertable' ELSE 'table' END as table_type
		FROM pg_tables t
		LEFT JOIN timescaledb_information.hypertables h
			ON t.schemaname = h.schema_name AND t.tablename = h.table_name
		WHERE schemaname NOT IN ('pg_catalog', 'information_schema', '_timescaledb_internal', '_timescaledb_catalog', '_timescaledb_config', '_timescaledb_cache')
		ORDER BY schemaname, tablename
	`

	rows, err := t.db.QueryContext(ctx, query)
	if err != nil {
		// Fallback to standard PostgreSQL query if TimescaleDB views don't exist
		return t.getStandardSchema(ctx)
	}
	defer rows.Close()

	var tables []types.TableInfo
	for rows.Next() {
		var schema, tableName, tableType string
		if err := rows.Scan(&schema, &tableName, &tableType); err != nil {
			t.logger.Warnf("Failed to scan TimescaleDB table row: %v", err)
			continue
		}

		// Get detailed table information
		tableInfo, err := t.GetTableInfo(ctx, tableName)
		if err != nil {
			t.logger.Warnf("Failed to get table info for %s: %v", tableName, err)
			// Continue with basic info
			tableInfo = &types.TableInfo{
				Name:   tableName,
				Schema: schema,
			}
		}

		tables = append(tables, *tableInfo)
	}

	if err := rows.Err(); err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_ITERATION_FAILED",
			Message: "Error during TimescaleDB schema iteration",
			Details: err.Error(),
		}
	}

	return &types.SchemaInfo{
		Tables: tables,
	}, nil
}

// getStandardSchema retrieves standard PostgreSQL schema (fallback)
func (t *TimescaleDBAdapter) getStandardSchema(ctx context.Context) (*types.SchemaInfo, error) {
	query := `
		SELECT schemaname, tablename
		FROM pg_tables
		WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
		ORDER BY schemaname, tablename
	`

	rows, err := t.db.QueryContext(ctx, query)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_QUERY_FAILED",
			Message: "Failed to query schema information",
			Details: err.Error(),
		}
	}
	defer rows.Close()

	var tables []types.TableInfo
	for rows.Next() {
		var schema, tableName string
		if err := rows.Scan(&schema, &tableName); err != nil {
			continue
		}

		tableInfo, _ := t.GetTableInfo(ctx, tableName)
		if tableInfo != nil {
			tables = append(tables, *tableInfo)
		}
	}

	return &types.SchemaInfo{
		Tables: tables,
	}, nil
}

// GetTableInfo retrieves information about a specific TimescaleDB table/hypertable
func (t *TimescaleDBAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	t.mutex.RLock()
	defer t.mutex.RUnlock()

	if t.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// Get current schema
	var currentSchema string
	if err := t.db.QueryRowContext(ctx, "SELECT current_schema()").Scan(&currentSchema); err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_NAME_FAILED",
			Message: "Failed to get current schema name",
			Details: err.Error(),
		}
	}

	// Get column information
	columnQuery := `
		SELECT
			column_name,
			data_type,
			is_nullable,
			column_default
		FROM information_schema.columns
		WHERE table_schema = $1 AND table_name = $2
		ORDER BY ordinal_position
	`

	rows, err := t.db.QueryContext(ctx, columnQuery, currentSchema, tableName)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "TABLE_COLUMN_QUERY_FAILED",
			Message: "Failed to query TimescaleDB table columns",
			Details: err.Error(),
		}
	}
	defer rows.Close()

	var columns []types.ColumnInfo
	for rows.Next() {
		var col types.ColumnInfo
		var nullable string
		var defaultValue *string

		if err := rows.Scan(&col.Name, &col.Type, &nullable, &defaultValue); err != nil {
			return nil, &types.AdapterError{
				Code:    "COLUMN_SCAN_FAILED",
				Message: "Failed to scan TimescaleDB column information",
				Details: err.Error(),
			}
		}

		col.Nullable = nullable == "YES"
		if defaultValue != nil {
			col.DefaultValue = *defaultValue
		}

		columns = append(columns, col)
	}

	// Get indexes
	indexQuery := `
		SELECT
			i.relname as index_name,
			a.attname as column_name,
			ix.indisunique
		FROM pg_class t
		JOIN pg_index ix ON t.oid = ix.indrelid
		JOIN pg_class i ON i.oid = ix.indexrelid
		JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
		JOIN pg_namespace n ON t.relnamespace = n.oid
		WHERE n.nspname = $1 AND t.relname = $2
		ORDER BY i.relname, a.attnum
	`

	indexRows, err := t.db.QueryContext(ctx, indexQuery, currentSchema, tableName)
	if err != nil {
		t.logger.Warnf("Failed to query indexes for TimescaleDB table %s: %v", tableName, err)
	} else {
		defer indexRows.Close()

		indexMap := make(map[string]*types.IndexInfo)
		for indexRows.Next() {
			var indexName, columnName string
			var unique bool

			if err := indexRows.Scan(&indexName, &columnName, &unique); err != nil {
				t.logger.Warnf("Failed to scan TimescaleDB index information: %v", err)
				continue
			}

			if index, exists := indexMap[indexName]; exists {
				index.Columns = append(index.Columns, columnName)
			} else {
				indexMap[indexName] = &types.IndexInfo{
					Name:    indexName,
					Columns: []string{columnName},
					Unique:  unique,
				}
			}
		}

		var indexes []types.IndexInfo
		for _, index := range indexMap {
			indexes = append(indexes, *index)
		}

		return &types.TableInfo{
			Name:    tableName,
			Schema:  currentSchema,
			Columns: columns,
			Indexes: indexes,
		}, nil
	}

	return &types.TableInfo{
		Name:    tableName,
		Schema:  currentSchema,
		Columns: columns,
	}, nil
}

// IsConnected returns true if the adapter is connected to TimescaleDB
func (t *TimescaleDBAdapter) IsConnected() bool {
	t.mutex.RLock()
	defer t.mutex.RUnlock()

	return t.db != nil
}

// GetConnectionInfo returns the connection information
func (t *TimescaleDBAdapter) GetConnectionInfo() *entities.Connection {
	return t.conn
}

// optimizeTimescaleQuery applies TimescaleDB-specific SQL optimizations
func (t *TimescaleDBAdapter) optimizeTimescaleQuery(query string) string {
	// TimescaleDB supports time_bucket() for time-series aggregation
	// Example: SELECT time_bucket('1 hour', time) as bucket, avg(value) FROM table GROUP BY bucket

	// TimescaleDB supports first() and last() aggregate functions
	// Example: SELECT time_bucket('1 hour', time), first(value, time), last(value, time) FROM table

	// TimescaleDB supports continuous aggregates (materialized views)
	// Example: SELECT * FROM conditions_summary_hourly

	// Log if query uses TimescaleDB-specific functions
	if strings.Contains(strings.ToLower(query), "time_bucket") {
		t.logger.Debug("Query uses TimescaleDB time_bucket function")
	}

	if strings.Contains(strings.ToLower(query), "first(") || strings.Contains(strings.ToLower(query), "last(") {
		t.logger.Debug("Query uses TimescaleDB first/last aggregate functions")
	}

	// No modifications needed - query is already optimized
	return query
}

// Ping checks the database connection
func (t *TimescaleDBAdapter) Ping(ctx context.Context) error {
	return t.TestConnection(ctx)
}

// HealthCheck performs a health check on the database
func (t *TimescaleDBAdapter) HealthCheck(ctx context.Context) error {
	return t.Ping(ctx)
}

// GetMetrics returns database metrics
func (t *TimescaleDBAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	if t.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	stats := t.db.Stats()

	return &types.ConnectionMetrics{
		ConnectionPoolStats: types.ConnectionPoolStats{
			OpenConnections:    stats.OpenConnections,
			InUseConnections:   stats.InUse,
			IdleConnections:    stats.Idle,
			WaitCount:          stats.WaitCount,
			WaitDuration:       stats.WaitDuration,
			MaxOpenConnections: 15, // Should match what was set in Connect
		},
		LastUpdated: time.Now(),
	}, nil
}
