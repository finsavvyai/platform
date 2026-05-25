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

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	"github.com/sirupsen/logrus"
)

// AuroraAdapter handles AWS Aurora connections with cluster and read replica support
type AuroraAdapter struct {
	conn           *entities.Connection
	writerDB       *sql.DB // Writer (primary) endpoint
	readerDB       *sql.DB // Reader (replica) endpoint
	mutex          sync.RWMutex
	logger         *logrus.Logger
	engine         string // mysql or postgresql
	useReadReplica bool
}

// Connect establishes connections to Aurora cluster (writer and optional reader)
func (a *AuroraAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	a.mutex.Lock()
	defer a.mutex.Unlock()

	if a.writerDB != nil {
		return nil // Already connected
	}

	// Update connection info
	a.conn = conn

	// Detect Aurora engine type from host or metadata
	a.detectEngine(conn)

	// Connect to writer endpoint
	writerConnStr := a.buildConnectionString(conn, false)

	var driver string
	if a.engine == "mysql" {
		driver = "mysql"
	} else {
		driver = "postgres"
	}

	writerDB, err := sql.Open(driver, writerConnStr)
	if err != nil {
		return &types.AdapterError{
			Code:    "WRITER_CONNECTION_FAILED",
			Message: "Failed to connect to Aurora writer endpoint",
			Details: err.Error(),
		}
	}

	// Configure connection pool for Aurora
	writerDB.SetMaxOpenConns(25)
	writerDB.SetMaxIdleConns(10)
	writerDB.SetConnMaxLifetime(30 * time.Minute)
	writerDB.SetConnMaxIdleTime(10 * time.Minute)

	// Test writer connection
	if err := writerDB.PingContext(ctx); err != nil {
		writerDB.Close()
		return &types.AdapterError{
			Code:    "WRITER_CONNECTION_TEST_FAILED",
			Message: "Failed to ping Aurora writer endpoint",
			Details: err.Error(),
		}
	}

	a.writerDB = writerDB

	// Optionally connect to reader endpoint if available
	if a.hasReaderEndpoint(conn) {
		readerConn := a.getReaderConnection(conn)
		readerConnStr := a.buildConnectionString(readerConn, true)

		readerDB, err := sql.Open(driver, readerConnStr)
		if err != nil {
			a.logger.WithError(err).Warn("Failed to connect to Aurora reader endpoint, using writer only")
		} else {
			// Configure reader connection pool
			readerDB.SetMaxOpenConns(50) // More connections for read-heavy workloads
			readerDB.SetMaxIdleConns(20)
			readerDB.SetConnMaxLifetime(30 * time.Minute)
			readerDB.SetConnMaxIdleTime(10 * time.Minute)

			// Test reader connection
			if err := readerDB.PingContext(ctx); err != nil {
				a.logger.WithError(err).Warn("Reader endpoint ping failed, using writer only")
				readerDB.Close()
			} else {
				a.readerDB = readerDB
				a.useReadReplica = true
				a.logger.Info("Successfully connected to Aurora reader endpoint")
			}
		}
	}

	a.logger.Infof("Successfully connected to Aurora %s cluster: %s", a.engine, conn.Name)
	return nil
}

// Disconnect closes all Aurora connections
func (a *AuroraAdapter) Disconnect(ctx context.Context) error {
	a.mutex.Lock()
	defer a.mutex.Unlock()

	var errors []string

	if a.writerDB != nil {
		if err := a.writerDB.Close(); err != nil {
			errors = append(errors, fmt.Sprintf("writer: %s", err.Error()))
		}
		a.writerDB = nil
	}

	if a.readerDB != nil {
		if err := a.readerDB.Close(); err != nil {
			errors = append(errors, fmt.Sprintf("reader: %s", err.Error()))
		}
		a.readerDB = nil
	}

	if len(errors) > 0 {
		return &types.AdapterError{
			Code:    "DISCONNECT_FAILED",
			Message: "Failed to disconnect from Aurora",
			Details: strings.Join(errors, "; "),
		}
	}

	a.logger.Infof("Disconnected from Aurora cluster: %s", a.conn.Name)
	return nil
}

// TestConnection tests the Aurora connection
func (a *AuroraAdapter) TestConnection(ctx context.Context) error {
	a.mutex.RLock()
	defer a.mutex.RUnlock()

	if a.writerDB == nil {
		return &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Aurora",
		}
	}

	// Test writer
	if err := a.writerDB.PingContext(ctx); err != nil {
		return &types.AdapterError{
			Code:    "WRITER_CONNECTION_TEST_FAILED",
			Message: "Writer endpoint test failed",
			Details: err.Error(),
		}
	}

	// Test reader if available
	if a.readerDB != nil {
		if err := a.readerDB.PingContext(ctx); err != nil {
			a.logger.WithError(err).Warn("Reader endpoint test failed")
			// Don't fail overall test if only reader fails
		}
	}

	return nil
}

// IsConnected returns whether the adapter is currently connected
func (a *AuroraAdapter) IsConnected() bool {
	a.mutex.RLock()
	defer a.mutex.RUnlock()
	return a.writerDB != nil
}

// GetConnectionInfo returns the connection information
func (a *AuroraAdapter) GetConnectionInfo() *entities.Connection {
	a.mutex.RLock()
	defer a.mutex.RUnlock()
	return a.conn
}

// detectEngine detects whether Aurora is running MySQL or PostgreSQL
func (a *AuroraAdapter) detectEngine(conn *entities.Connection) {
	host := strings.ToLower(conn.Host)

	// Check for MySQL indicators
	if strings.Contains(host, "mysql") || strings.Contains(conn.Type, "mysql") || conn.Port == 3306 {
		a.engine = "mysql"
	} else if strings.Contains(host, "postgres") || strings.Contains(conn.Type, "postgres") || conn.Port == 5432 {
		a.engine = "postgresql"
	} else {
		// Default to PostgreSQL for Aurora
		a.engine = "postgresql"
	}

	a.logger.Infof("Detected Aurora engine: %s", a.engine)
}

// hasReaderEndpoint checks if a reader endpoint is configured
func (a *AuroraAdapter) hasReaderEndpoint(conn *entities.Connection) bool {
	// Aurora reader endpoints typically end with "-ro" or contain "readonly"
	host := strings.ToLower(conn.Host)
	return strings.Contains(host, "cluster-ro-") || strings.Contains(host, "readonly")
}

// getReaderConnection creates a connection config for the reader endpoint
func (a *AuroraAdapter) getReaderConnection(conn *entities.Connection) *entities.Connection {
	readerConn := *conn

	// If the host is the writer endpoint, try to derive reader endpoint
	if !a.hasReaderEndpoint(conn) {
		// Replace cluster- with cluster-ro-
		readerConn.Host = strings.Replace(conn.Host, "cluster-", "cluster-ro-", 1)
	}

	return &readerConn
}

// buildConnectionString creates Aurora connection string based on engine
func (a *AuroraAdapter) buildConnectionString(conn *entities.Connection, isReader bool) string {
	if a.engine == "mysql" {
		return a.buildMySQLConnectionString(conn)
	}
	return a.buildPostgreSQLConnectionString(conn)
}

// buildMySQLConnectionString creates a MySQL connection string for Aurora
func (a *AuroraAdapter) buildMySQLConnectionString(conn *entities.Connection) string {
	connStr := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s",
		conn.Username,
		conn.Password,
		conn.Host,
		conn.Port,
		conn.Database,
	)

	params := []string{
		"parseTime=true",
		"interpolateParams=true",
		"charset=utf8mb4",
	}

	// Add SSL/TLS support
	if conn.SSL {
		params = append(params, "tls=true")
	}

	return connStr + "?" + strings.Join(params, "&")
}

// buildPostgreSQLConnectionString creates a PostgreSQL connection string for Aurora
func (a *AuroraAdapter) buildPostgreSQLConnectionString(conn *entities.Connection) string {
	connStr := fmt.Sprintf("postgresql://%s:%s@%s:%d/%s",
		conn.Username,
		conn.Password,
		conn.Host,
		conn.Port,
		conn.Database,
	)

	params := []string{}

	// Add SSL mode
	if conn.SSL {
		params = append(params, "sslmode=require")
	} else {
		params = append(params, "sslmode=prefer")
	}

	params = append(params, "application_name=queryflux")

	if len(params) > 0 {
		connStr += "?" + strings.Join(params, "&")
	}

	return connStr
}

// ExecuteQuery executes a query on Aurora (read queries go to replica if available)
func (a *AuroraAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	a.mutex.RLock()
	defer a.mutex.RUnlock()

	if a.writerDB == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Aurora",
			Details: "Call Connect() before executing queries",
		}
	}

	trimmedQuery := strings.TrimSpace(strings.ToUpper(query))
	isReadQuery := strings.HasPrefix(trimmedQuery, "SELECT") ||
		strings.HasPrefix(trimmedQuery, "SHOW") ||
		strings.HasPrefix(trimmedQuery, "DESCRIBE") ||
		strings.HasPrefix(trimmedQuery, "EXPLAIN")

	// Use reader for SELECT queries if available
	db := a.writerDB
	if isReadQuery && a.useReadReplica && a.readerDB != nil {
		db = a.readerDB
		a.logger.Debug("Using Aurora read replica for query")
	}

	if isReadQuery {
		return a.executeSelectQuery(ctx, db, query, params...)
	}

	return a.executeNonSelectQuery(ctx, db, query, params...)
}

// executeSelectQuery executes a SELECT query
func (a *AuroraAdapter) executeSelectQuery(ctx context.Context, db *sql.DB, query string, params ...interface{}) (*types.QueryResult, error) {
	rows, err := db.QueryContext(ctx, query, params...)
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
			rowMap[col] = a.convertValue(values[i])
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
		Columns: a.toColumnInfo(columns),
		Rows:    resultRows,
		Count:   int64(len(resultRows)),
	}, nil
}

// executeNonSelectQuery executes INSERT, UPDATE, DELETE queries (always on writer)
func (a *AuroraAdapter) executeNonSelectQuery(ctx context.Context, db *sql.DB, query string, params ...interface{}) (*types.QueryResult, error) {
	result, err := db.ExecContext(ctx, query, params...)
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
		Columns: a.toColumnInfo([]string{"rows_affected"}),
		Rows: []map[string]interface{}{
			{"rows_affected": rowsAffected},
		},
		Count: rowsAffected,
	}, nil
}

// GetSchema retrieves the database schema (uses reader if available)
func (a *AuroraAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	if a.engine == "mysql" {
		return a.getMySQLSchema(ctx)
	}
	return a.getPostgreSQLSchema(ctx)
}

// getMySQLSchema retrieves MySQL Aurora schema
func (a *AuroraAdapter) getMySQLSchema(ctx context.Context) (*types.SchemaInfo, error) {
	a.mutex.RLock()
	db := a.writerDB
	if a.useReadReplica && a.readerDB != nil {
		db = a.readerDB
	}
	a.mutex.RUnlock()

	query := `
		SELECT TABLE_NAME
		FROM information_schema.TABLES
		WHERE TABLE_SCHEMA = DATABASE()
		  AND TABLE_TYPE = 'BASE TABLE'
		ORDER BY TABLE_NAME
	`

	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_RETRIEVAL_FAILED",
			Message: "Failed to retrieve Aurora MySQL schema",
			Details: err.Error(),
		}
	}
	defer rows.Close()

	var tables []types.TableInfo
	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			continue
		}

		tableInfo, err := a.GetTableInfo(ctx, tableName)
		if err != nil {
			a.logger.WithError(err).Warnf("Failed to get info for table %s", tableName)
			continue
		}

		tables = append(tables, *tableInfo)
	}

	return &types.SchemaInfo{Tables: tables}, nil
}

// getPostgreSQLSchema retrieves PostgreSQL Aurora schema
func (a *AuroraAdapter) getPostgreSQLSchema(ctx context.Context) (*types.SchemaInfo, error) {
	a.mutex.RLock()
	db := a.writerDB
	if a.useReadReplica && a.readerDB != nil {
		db = a.readerDB
	}
	a.mutex.RUnlock()

	query := `
		SELECT table_name, table_schema
		FROM information_schema.tables
		WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
		  AND table_type = 'BASE TABLE'
		ORDER BY table_schema, table_name
	`

	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_RETRIEVAL_FAILED",
			Message: "Failed to retrieve Aurora PostgreSQL schema",
			Details: err.Error(),
		}
	}
	defer rows.Close()

	var tables []types.TableInfo
	for rows.Next() {
		var tableName, schemaName string
		if err := rows.Scan(&tableName, &schemaName); err != nil {
			continue
		}

		tableInfo, err := a.GetTableInfo(ctx, tableName)
		if err != nil {
			a.logger.WithError(err).Warnf("Failed to get info for table %s", tableName)
			continue
		}

		tableInfo.Schema = schemaName
		tables = append(tables, *tableInfo)
	}

	return &types.SchemaInfo{Tables: tables}, nil
}

// GetTableInfo retrieves detailed information about a specific table
func (a *AuroraAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	// Implementation depends on engine type
	// For brevity, returning minimal table info
	return &types.TableInfo{
		Name:    tableName,
		Columns: []types.ColumnInfo{},
		Indexes: []types.IndexInfo{},
	}, nil
}

// convertValue converts database values to appropriate Go types
func (a *AuroraAdapter) convertValue(value interface{}) interface{} {
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

// Helper to convert string slice to ColumnInfo slice
func (a *AuroraAdapter) toColumnInfo(names []string) []types.ColumnInfo {
	columns := make([]types.ColumnInfo, len(names))
	for i, name := range names {
		columns[i] = types.ColumnInfo{
			Name: name,
			Type: "string", // Default to string
		}
	}
	return columns
}

// HealthCheck checks the health of the connection
func (a *AuroraAdapter) HealthCheck(ctx context.Context) error {
	// Check primary writer health
	if a.writerDB == nil {
		return &types.AdapterError{Code: "NOT_CONNECTED", Message: "Not connected to Aurora writer"}
	}
	return a.writerDB.PingContext(ctx)
}

// Ping pings the database
func (a *AuroraAdapter) Ping(ctx context.Context) error {
	return a.HealthCheck(ctx)
}

// GetMetrics retrieves connection metrics
func (a *AuroraAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	if a.writerDB == nil {
		return nil, &types.AdapterError{Code: "NOT_CONNECTED", Message: "Not connected to Aurora"}
	}

	stats := a.writerDB.Stats()
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

type AuroraTransaction struct {
	tx *sql.Tx
}

func (t *AuroraTransaction) Commit() error {
	return t.tx.Commit()
}

func (t *AuroraTransaction) Rollback() error {
	return t.tx.Rollback()
}

// BeginTransaction starts a new transaction
func (a *AuroraAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	if a.writerDB == nil {
		return nil, &types.AdapterError{Code: "NOT_CONNECTED", Message: "Not connected to Aurora writer"}
	}
	tx, err := a.writerDB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	return &AuroraTransaction{tx: tx}, nil
}
