package sql

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	_ "github.com/lib/pq" // PostgreSQL driver for Yugabyte
	"github.com/sirupsen/logrus"
)

// YugabyteAdapter provides connectivity to YugabyteDB
type YugabyteAdapter struct {
	conn   *entities.Connection
	db     *sql.DB
	logger *logrus.Logger
}

// NewYugabyteAdapter creates a new YugabyteDB adapter
func NewYugabyteAdapter(conn *entities.Connection) *YugabyteAdapter {
	return &YugabyteAdapter{
		conn:   conn,
		logger: logrus.New(),
	}
}

// Connect establishes a connection to YugabyteDB
func (a *YugabyteAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	a.conn = conn

	// Build DSN for YugabyteDB (PostgreSQL-compatible)
	dsn := a.buildDSN()

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return fmt.Errorf("failed to open YugabyteDB connection: %w", err)
	}

	// Set connection pool parameters
	maxOpenConns := 10
	if val, ok := a.conn.Options["max_open_conns"]; ok {
		if i, err := strconv.Atoi(val); err == nil {
			maxOpenConns = i
		}
	}
	db.SetMaxOpenConns(maxOpenConns)

	maxIdleConns := 5
	if val, ok := a.conn.Options["max_idle_conns"]; ok {
		if i, err := strconv.Atoi(val); err == nil {
			maxIdleConns = i
		}
	}
	db.SetMaxIdleConns(maxIdleConns)

	connMaxLifetime := 3600
	if val, ok := a.conn.Options["conn_max_lifetime"]; ok {
		if i, err := strconv.Atoi(val); err == nil {
			connMaxLifetime = i
		}
	}
	db.SetConnMaxLifetime(time.Duration(connMaxLifetime) * time.Second)

	// Test connection
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return fmt.Errorf("failed to ping YugabyteDB: %w", err)
	}

	a.db = db

	// Verify it's YugabyteDB
	var version string
	if err := db.QueryRowContext(ctx, "SELECT version()").Scan(&version); err != nil {
		a.logger.Warnf("Failed to get version: %v", err)
	} else {
		a.logger.Infof("Connected to YugabyteDB version: %s", version)
	}

	a.logger.Info("Successfully connected to YugabyteDB")
	return nil
}

// Disconnect closes the YugabyteDB connection
func (a *YugabyteAdapter) Disconnect(ctx context.Context) error {
	if a.db != nil {
		err := a.db.Close()
		a.db = nil
		a.logger.Info("YugabyteDB connection closed")
		return err
	}
	return nil
}

// IsConnected checks if the adapter is connected
func (a *YugabyteAdapter) IsConnected() bool {
	return a.db != nil
}

// GetConnectionInfo returns the connection info
func (a *YugabyteAdapter) GetConnectionInfo() *entities.Connection {
	return a.conn
}

// ExecuteQuery executes a SQL query against YugabyteDB
func (a *YugabyteAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to YugabyteDB")
	}

	startTime := time.Now()

	// Check if it's a DML query (INSERT, UPDATE, DELETE) to get rows affected
	isDML := isYugabyteDMLQuery(query)

	// Execute query
	var rows *sql.Rows
	var result sql.Result
	var err error

	if isDML {
		result, err = a.db.ExecContext(ctx, query, params...)
	} else {
		rows, err = a.db.QueryContext(ctx, query, params...)
	}

	if err != nil {
		return &types.QueryResult{
			Query:         query,
			RowsAffected:  0,
			ExecutionTime: time.Since(startTime).Milliseconds(),
			Error:         err.Error(),
			Success:       false,
		}, nil
	}

	var rowsAffected int64
	var results []map[string]interface{}
	var columns []types.ColumnInfo

	if isDML {
		// For DML queries, get rows affected
		rowsAffected, _ = result.RowsAffected()
	} else {
		defer rows.Close()

		// Get column information
		columnNames, err := rows.Columns()
		if err != nil {
			return &types.QueryResult{
				Query:         query,
				RowsAffected:  0,
				ExecutionTime: time.Since(startTime).Milliseconds(),
				Error:         err.Error(),
				Success:       false,
			}, nil
		}

		// Get column types
		columnTypes, err := rows.ColumnTypes()
		if err != nil {
			return &types.QueryResult{
				Query:         query,
				RowsAffected:  0,
				ExecutionTime: time.Since(startTime).Milliseconds(),
				Error:         err.Error(),
				Success:       false,
			}, nil
		}

		// Convert column types to ColumnInfo format
		columns = make([]types.ColumnInfo, len(columnNames))
		for i, col := range columnNames {
			columns[i] = types.ColumnInfo{
				Name:     col,
				Type:     a.mapYugabyteType(columnTypes[i].DatabaseTypeName()),
				Nullable: true,
			}
		}

		// Process rows
		for rows.Next() {
			// Create slice of interfaces for scanning
			values := make([]interface{}, len(columnNames))
			valuePtrs := make([]interface{}, len(columnNames))
			for i := range values {
				valuePtrs[i] = &values[i]
			}

			if err := rows.Scan(valuePtrs...); err != nil {
				return &types.QueryResult{
					Query:         query,
					RowsAffected:  0,
					ExecutionTime: time.Since(startTime).Milliseconds(),
					Error:         err.Error(),
					Success:       false,
				}, nil
			}

			// Convert to map
			row := make(map[string]interface{})
			for i, col := range columnNames {
				// Handle NULL values and type conversion
				if values[i] != nil {
					row[col] = a.convertYugabyteValue(values[i], columnTypes[i])
				} else {
					row[col] = nil
				}
			}
			results = append(results, row)
		}

		// Check for errors from iterating over rows
		if err := rows.Err(); err != nil {
			return &types.QueryResult{
				Query:         query,
				RowsAffected:  0,
				ExecutionTime: time.Since(startTime).Milliseconds(),
				Error:         err.Error(),
				Success:       false,
			}, nil
		}

		rowsAffected = int64(len(results))
	}

	executionTime := time.Since(startTime)

	return &types.QueryResult{
		Query:         query,
		Rows:          results,
		Columns:       columns,
		RowsAffected:  rowsAffected,
		ExecutionTime: executionTime.Milliseconds(),
		Success:       true,
	}, nil
}

// GetSchema retrieves schema information from YugabyteDB
func (a *YugabyteAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to YugabyteDB")
	}

	schema := &types.SchemaInfo{
		Database: a.conn.Database,
		Tables:   make([]types.TableInfo, 0),
	}

	// Get all tables
	query := `
		SELECT table_name, table_type
		FROM information_schema.tables
		WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
		ORDER BY table_name
	`

	rows, err := a.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query tables: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var tableName, tableType string
		if err := rows.Scan(&tableName, &tableType); err != nil {
			continue
		}

		// Get columns for this table
		columns, err := a.getTableColumns(ctx, tableName)
		if err != nil {
			a.logger.Warnf("Failed to get columns for %s: %v", tableName, err)
			continue
		}

		table := types.TableInfo{
			Name:    tableName,
			Type:    tableType,
			Columns: columns,
		}
		schema.Tables = append(schema.Tables, table)
	}

	return schema, nil
}

// GetTables returns a list of tables in the database
func (a *YugabyteAdapter) GetTables(ctx context.Context) ([]string, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to YugabyteDB")
	}

	query := `
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
		ORDER BY table_name
	`

	rows, err := a.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query tables: %w", err)
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			continue
		}
		tables = append(tables, tableName)
	}

	return tables, nil
}

// GetTableInfo retrieves info for a detailed table
func (a *YugabyteAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	columns, err := a.getTableColumns(ctx, tableName)
	if err != nil {
		return nil, err
	}
	return &types.TableInfo{
		Name:    tableName,
		Columns: columns,
	}, nil
}

// GetColumns returns column information for a specific table
func (a *YugabyteAdapter) GetColumns(ctx context.Context, table string) ([]types.ColumnInfo, error) {
	return a.getTableColumns(ctx, table)
}

// BeginTransaction starts a new transaction
func (a *YugabyteAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to YugabyteDB")
	}

	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}

	return &YugabyteTransaction{tx: tx}, nil
}

// HealthCheck checks the health of the YugabyteDB connection
func (a *YugabyteAdapter) HealthCheck(ctx context.Context) error {
	if a.db == nil {
		return fmt.Errorf("not connected to YugabyteDB")
	}

	return a.db.PingContext(ctx)
}

// GetMetrics returns database metrics
func (a *YugabyteAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to YugabyteDB")
	}
	stats := a.db.Stats()
	return &types.ConnectionMetrics{
		ConnectionPoolStats: types.ConnectionPoolStats{
			OpenConnections:  stats.OpenConnections,
			InUseConnections: stats.InUse,
			IdleConnections:  stats.Idle,
		},
	}, nil
}

// Ping checks the connection
func (a *YugabyteAdapter) Ping(ctx context.Context) error {
	return a.HealthCheck(ctx)
}

// TestConnection tests the connection
func (a *YugabyteAdapter) TestConnection(ctx context.Context) error {
	return a.HealthCheck(ctx)
}

// GetMetadata retrieves metadata about the YugabyteDB connection
func (a *YugabyteAdapter) GetMetadata() map[string]interface{} {
	return map[string]interface{}{
		"engine":                "yugabytedb",
		"distributed":           true,
		"postgresql_compatible": true,
		"acid_compliant":        true,
		"multi_region":          true,
		"supports_transactions": true,
		"endpoint":              fmt.Sprintf("%s:%d", a.conn.Host, a.conn.Port),
	}
}

// Helper methods

func (a *YugabyteAdapter) buildDSN() string {
	// YugabyteDB uses PostgreSQL connection string format
	sslMode := "prefer"
	if a.conn.SSL {
		sslMode = "require"
	}

	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		a.conn.Host, a.conn.Port, a.conn.Username, a.conn.Password, a.conn.Database, sslMode)

	// Add custom options
	for key, value := range a.conn.Options {
		dsn += fmt.Sprintf(" %s=%s", key, value)
	}

	return dsn
}

func (a *YugabyteAdapter) getTableColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	query := `
		SELECT column_name, data_type, is_nullable, column_default
		FROM information_schema.columns
		WHERE table_name = $1
		ORDER BY ordinal_position
	`

	rows, err := a.db.QueryContext(ctx, query, tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to query columns: %w", err)
	}
	defer rows.Close()

	var columns []types.ColumnInfo
	for rows.Next() {
		var columnName, dataType, isNullable sql.NullString
		var columnDefault sql.NullString

		if err := rows.Scan(&columnName, &dataType, &isNullable, &columnDefault); err != nil {
			continue
		}

		column := types.ColumnInfo{
			Name:         columnName.String,
			Type:         a.mapYugabyteType(dataType.String),
			Nullable:     isNullable.Valid && isNullable.String == "YES",
			DefaultValue: columnDefault.String,
		}

		columns = append(columns, column)
	}

	return columns, nil
}

func (a *YugabyteAdapter) mapYugabyteType(yugabyteType string) string {
	// Map YugabyteDB types to standard types (same as PostgreSQL)
	switch yugabyteType {
	case "integer", "int4":
		return "integer"
	case "bigint", "int8":
		return "bigint"
	case "smallint", "int2":
		return "smallint"
	case "decimal", "numeric":
		return "decimal"
	case "real", "float4":
		return "float"
	case "double precision", "float8":
		return "double"
	case "varchar", "text", "char", "character":
		return "string"
	case "boolean", "bool":
		return "boolean"
	case "date":
		return "date"
	case "timestamp", "timestamptz":
		return "timestamp"
	case "time", "timetz":
		return "time"
	case "json", "jsonb":
		return "json"
	case "uuid":
		return "uuid"
	case "bytea":
		return "blob"
	case "inet":
		return "inet"
	case "cidr":
		return "cidr"
	default:
		return yugabyteType
	}
}

func (a *YugabyteAdapter) convertYugabyteValue(value interface{}, columnType *sql.ColumnType) interface{} {
	// YugabyteDB values should be the same as PostgreSQL
	switch v := value.(type) {
	case []byte:
		return string(v)
	default:
		return v
	}
}

// YugabyteTransaction implements the Transaction interface
type YugabyteTransaction struct {
	tx *sql.Tx
}

func (t *YugabyteTransaction) Commit() error {
	return t.tx.Commit()
}

func (t *YugabyteTransaction) Rollback() error {
	return t.tx.Rollback()
}

func (t *YugabyteTransaction) IsActive() bool {
	return t.tx != nil
}

func isYugabyteDMLQuery(query string) bool {
	queryLower := strings.ToLower(query)
	return strings.HasPrefix(queryLower, "insert ") ||
		strings.HasPrefix(queryLower, "update ") ||
		strings.HasPrefix(queryLower, "delete ") ||
		strings.HasPrefix(queryLower, "create ") ||
		strings.HasPrefix(queryLower, "drop ") ||
		strings.HasPrefix(queryLower, "alter ")
}
