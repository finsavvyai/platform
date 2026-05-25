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

// QuestDBAdapter implements DatabaseAdapter for QuestDB
// QuestDB is a high-performance time-series database with PostgreSQL wire protocol compatibility
type QuestDBAdapter struct {
	conn   *entities.Connection
	db     *sql.DB
	mutex  sync.RWMutex
	logger *logrus.Logger
}

// Connect establishes a connection to QuestDB using PostgreSQL wire protocol
func (q *QuestDBAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	q.mutex.Lock()
	defer q.mutex.Unlock()

	if q.db != nil {
		return nil // Already connected
	}

	// Update connection info
	q.conn = conn

	// Build QuestDB connection string (uses PostgreSQL format)
	connStr := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable",
		conn.Username,
		conn.Password,
		conn.Host,
		conn.Port,
		conn.Database,
	)

	// QuestDB typically doesn't use SSL on the PostgreSQL wire protocol port
	// Use pgx driver for PostgreSQL wire protocol
	db, err := sql.Open("pgx", connStr)
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_FAILED",
			Message: "Failed to open QuestDB connection",
			Details: err.Error(),
		}
	}

	// Configure connection pool for time-series workloads
	db.SetMaxOpenConns(20) // Higher for time-series ingestion
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(time.Hour)
	db.SetConnMaxIdleTime(30 * time.Minute)

	// Test the connection
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Failed to ping QuestDB database",
			Details: err.Error(),
		}
	}

	q.db = db
	q.logger.Infof("Connected to QuestDB database: %s", conn.Name)

	return nil
}

// Disconnect closes the QuestDB connection
func (q *QuestDBAdapter) Disconnect(ctx context.Context) error {
	q.mutex.Lock()
	defer q.mutex.Unlock()

	if q.db == nil {
		return nil // Already disconnected
	}

	if err := q.db.Close(); err != nil {
		return &types.AdapterError{
			Code:    "DISCONNECT_FAILED",
			Message: "Failed to close QuestDB connection",
			Details: err.Error(),
		}
	}

	q.db = nil
	q.logger.Infof("Disconnected from QuestDB database: %s", q.conn.Name)

	return nil
}

// TestConnection tests if the QuestDB connection is valid
func (q *QuestDBAdapter) TestConnection(ctx context.Context) error {
	q.mutex.RLock()
	defer q.mutex.RUnlock()

	if q.db == nil {
		return &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	if err := q.db.PingContext(ctx); err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Connection test failed",
			Details: err.Error(),
		}
	}

	return nil
}

// ExecuteQuery executes a QuestDB query with time-series optimizations
func (q *QuestDBAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	q.mutex.RLock()
	defer q.mutex.RUnlock()

	if q.db == nil {
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

	// Apply QuestDB-specific SQL syntax optimizations
	query = q.optimizeQuestDBQuery(query)

	// Execute query
	rows, err := q.db.QueryContext(ctx, query, params...)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "QUERY_EXECUTION_FAILED",
			Message: "Failed to execute QuestDB query",
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

	// Get column types for QuestDB-specific type handling
	columnTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "COLUMN_TYPE_FAILED",
			Message: "Failed to get column types",
			Details: err.Error(),
		}
	}

	// Convert to ColumnInfo
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

	// Collect rows with QuestDB-specific type conversion
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

			// Handle QuestDB-specific type conversions
			row[col] = q.convertQuestDBType(val, columnTypes[i])
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
func (q *QuestDBAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	if q.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}
	// QuestDB limited support for transactions, but we can try basic begin
	tx, err := q.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	return &SQLTransaction{Tx: tx}, nil
}

// SQLTransaction wraps sql.Tx to satisfy types.Transaction
type SQLTransaction struct {
	Tx *sql.Tx
}

func (t *SQLTransaction) Commit() error {
	return t.Tx.Commit()
}

func (t *SQLTransaction) Rollback() error {
	return t.Tx.Rollback()
}

// GetSchema retrieves QuestDB database schema information
func (q *QuestDBAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	q.mutex.RLock()
	defer q.mutex.RUnlock()

	if q.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// QuestDB uses 'tables()' system function to list tables
	query := `SELECT table_name, designatedTimestamp, partitionBy, walEnabled FROM tables()`

	rows, err := q.db.QueryContext(ctx, query)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_QUERY_FAILED",
			Message: "Failed to query QuestDB schema information",
			Details: err.Error(),
		}
	}
	defer rows.Close()

	var tables []types.TableInfo
	for rows.Next() {
		var tableName, designatedTimestamp, partitionBy string
		var walEnabled bool
		if err := rows.Scan(&tableName, &designatedTimestamp, &partitionBy, &walEnabled); err != nil {
			q.logger.Warnf("Failed to scan QuestDB table row: %v", err)
			continue
		}

		// Get detailed table information
		tableInfo, err := q.GetTableInfo(ctx, tableName)
		if err != nil {
			q.logger.Warnf("Failed to get table info for %s: %v", tableName, err)
			// Continue with basic info
			tableInfo = &types.TableInfo{
				Name:   tableName,
				Schema: "public",
			}
		}

		tables = append(tables, *tableInfo)
	}

	if err := rows.Err(); err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_ITERATION_FAILED",
			Message: "Error during QuestDB schema iteration",
			Details: err.Error(),
		}
	}

	return &types.SchemaInfo{
		Tables: tables,
	}, nil
}

// GetTableInfo retrieves information about a specific QuestDB table
func (q *QuestDBAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	q.mutex.RLock()
	defer q.mutex.RUnlock()

	if q.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// QuestDB uses table_columns() system function
	columnQuery := `SELECT column, type, indexed, indexBlockCapacity, symbolCached, symbolCapacity, designated
	                FROM table_columns($1)`

	rows, err := q.db.QueryContext(ctx, columnQuery, tableName)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "TABLE_COLUMN_QUERY_FAILED",
			Message: "Failed to query QuestDB table columns",
			Details: err.Error(),
		}
	}
	defer rows.Close()

	var columns []types.ColumnInfo
	for rows.Next() {
		var col types.ColumnInfo
		var indexed, symbolCached, designated bool
		var indexBlockCapacity, symbolCapacity int

		if err := rows.Scan(&col.Name, &col.Type, &indexed, &indexBlockCapacity, &symbolCached, &symbolCapacity, &designated); err != nil {
			return nil, &types.AdapterError{
				Code:    "COLUMN_SCAN_FAILED",
				Message: "Failed to scan QuestDB column information",
				Details: err.Error(),
			}
		}

		// QuestDB columns are generally nullable unless it's a designated timestamp
		col.Nullable = !designated
		col.IsPrimaryKey = designated // Designated timestamp acts as primary key

		columns = append(columns, col)
	}

	// Get indexes (QuestDB has implicit indexes on timestamp columns)
	var indexes []types.IndexInfo
	// QuestDB automatically creates indexes on designated timestamp columns
	for _, col := range columns {
		if col.IsPrimaryKey {
			indexes = append(indexes, types.IndexInfo{
				Name:    tableName + "_timestamp_idx",
				Columns: []string{col.Name},
				Unique:  false,
			})
		}
	}

	return &types.TableInfo{
		Name:    tableName,
		Schema:  "public",
		Columns: columns,
		Indexes: indexes,
	}, nil
}

// IsConnected returns true if the adapter is connected to QuestDB
func (q *QuestDBAdapter) IsConnected() bool {
	q.mutex.RLock()
	defer q.mutex.RUnlock()

	return q.db != nil
}

// GetConnectionInfo returns the connection information
func (q *QuestDBAdapter) GetConnectionInfo() *entities.Connection {
	return q.conn
}

// optimizeQuestDBQuery applies QuestDB-specific SQL syntax optimizations
func (q *QuestDBAdapter) optimizeQuestDBQuery(query string) string {
	// QuestDB supports SAMPLE BY for time-series aggregation
	// Example: SELECT timestamp, avg(value) FROM table SAMPLE BY 1h

	// QuestDB uses LATEST ON for getting latest records
	// Example: SELECT * FROM table LATEST ON timestamp PARTITION BY symbol

	// Add QuestDB-specific hint for better performance on time ranges
	if strings.Contains(strings.ToUpper(query), "WHERE") &&
		strings.Contains(strings.ToUpper(query), "TIMESTAMP") {
		// QuestDB performs best with timestamp filters
		q.logger.Debug("Query contains timestamp filter - QuestDB optimized")
	}

	// No modifications needed - QuestDB is PostgreSQL-compatible for most syntax
	return query
}

// convertQuestDBType converts QuestDB-specific types to Go types
func (q *QuestDBAdapter) convertQuestDBType(val interface{}, colType *sql.ColumnType) interface{} {
	if val == nil {
		return nil
	}

	// Handle QuestDB-specific types
	switch colType.DatabaseTypeName() {
	case "TIMESTAMP":
		// QuestDB timestamp type - convert to RFC3339
		if t, ok := val.(time.Time); ok {
			return t.Format(time.RFC3339Nano)
		}
	case "SYMBOL":
		// QuestDB symbol type - treat as string
		if b, ok := val.([]byte); ok {
			return string(b)
		}
	case "LONG256":
		// QuestDB 256-bit integer - convert to string
		return fmt.Sprintf("%v", val)
	case "GEOHASH":
		// QuestDB geohash type
		if b, ok := val.([]byte); ok {
			return string(b)
		}
	case "UUID":
		// QuestDB UUID type
		if b, ok := val.([]byte); ok {
			return string(b)
		}
	default:
		// Standard type conversion
		switch v := val.(type) {
		case []byte:
			return string(v)
		case time.Time:
			return v.Format(time.RFC3339)
		default:
			return val
		}
	}

	return val
}

// Ping checks the database connection
func (q *QuestDBAdapter) Ping(ctx context.Context) error {
	return q.TestConnection(ctx)
}

// HealthCheck performs a health check on the database
func (q *QuestDBAdapter) HealthCheck(ctx context.Context) error {
	return q.Ping(ctx)
}

// GetMetrics returns database metrics
func (q *QuestDBAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	if q.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	stats := q.db.Stats()

	return &types.ConnectionMetrics{
		ConnectionPoolStats: types.ConnectionPoolStats{
			OpenConnections:    stats.OpenConnections,
			InUseConnections:   stats.InUse,
			IdleConnections:    stats.Idle,
			WaitCount:          stats.WaitCount,
			WaitDuration:       stats.WaitDuration,
			MaxOpenConnections: 20, // Should match what was set in Connect
		},
		LastUpdated: time.Now(),
	}, nil
}
