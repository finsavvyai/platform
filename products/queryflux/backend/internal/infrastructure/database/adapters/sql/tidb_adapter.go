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

	_ "github.com/go-sql-driver/mysql" // MySQL driver for TiDB
	"github.com/sirupsen/logrus"
)

// TiDBAdapter provides connectivity to TiDB
type TiDBAdapter struct {
	conn   *entities.Connection
	db     *sql.DB
	logger *logrus.Logger
}

// NewTiDBAdapter creates a new TiDB adapter
func NewTiDBAdapter(conn *entities.Connection) *TiDBAdapter {
	return &TiDBAdapter{
		conn:   conn,
		logger: logrus.New(),
	}
}

// Connect establishes a connection to TiDB
func (a *TiDBAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	a.conn = conn

	// Build DSN for TiDB (MySQL-compatible)
	dsn := a.buildDSN()

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return fmt.Errorf("failed to open TiDB connection: %w", err)
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
		return fmt.Errorf("failed to ping TiDB: %w", err)
	}

	a.db = db

	// Verify it's TiDB
	var version string
	if err := db.QueryRowContext(ctx, "SELECT VERSION()").Scan(&version); err != nil {
		a.logger.Warnf("Failed to get version: %v", err)
	} else {
		a.logger.Infof("Connected to TiDB version: %s", version)
	}

	a.logger.Info("Successfully connected to TiDB")
	return nil
}

// Close closes the TiDB connection
func (a *TiDBAdapter) Shutdown(ctx context.Context) error {
	return a.Disconnect(ctx)
}

// Disconnect closes the TiDB connection
func (a *TiDBAdapter) Disconnect(ctx context.Context) error {
	if a.db != nil {
		err := a.db.Close()
		a.db = nil
		a.logger.Info("TiDB connection closed")
		return err
	}
	return nil
}

// IsConnected checks if the adapter is connected
func (a *TiDBAdapter) IsConnected() bool {
	return a.db != nil
}

// GetConnectionInfo returns the connection info
func (a *TiDBAdapter) GetConnectionInfo() *entities.Connection {
	return a.conn
}

// ExecuteQuery executes a SQL query against TiDB
func (a *TiDBAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to TiDB")
	}

	startTime := time.Now()

	// Check if it's a DML query (INSERT, UPDATE, DELETE) to get rows affected
	isDML := isTiDBDMLQuery(query)

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
				Type:     a.mapTiDBType(columnTypes[i].DatabaseTypeName()),
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
					row[col] = a.convertTiDBValue(values[i], columnTypes[i])
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

// GetSchema retrieves schema information from TiDB
func (a *TiDBAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to TiDB")
	}

	schema := &types.SchemaInfo{
		Database: a.conn.Database,
		Tables:   make([]types.TableInfo, 0),
	}

	// Get all tables
	query := `
		SELECT table_name, table_type
		FROM information_schema.tables
		WHERE table_schema = DATABASE() AND table_type IN ('BASE TABLE', 'VIEW')
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
func (a *TiDBAdapter) GetTables(ctx context.Context) ([]string, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to TiDB")
	}

	query := `
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema = DATABASE() AND table_type IN ('BASE TABLE', 'VIEW')
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

// GetTableInfo retrieves info for a specific table
func (a *TiDBAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
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
func (a *TiDBAdapter) GetColumns(ctx context.Context, table string) ([]types.ColumnInfo, error) {
	return a.getTableColumns(ctx, table)
}

// BeginTransaction starts a new transaction
func (a *TiDBAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to TiDB")
	}

	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}

	return &TiDBTransaction{tx: tx}, nil
}

// HealthCheck checks the health of the TiDB connection
func (a *TiDBAdapter) HealthCheck(ctx context.Context) error {
	if a.db == nil {
		return fmt.Errorf("not connected to TiDB")
	}

	return a.db.PingContext(ctx)
}

// GetMetrics returns database metrics
func (a *TiDBAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to TiDB")
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
func (a *TiDBAdapter) Ping(ctx context.Context) error {
	return a.HealthCheck(ctx)
}

// TestConnection tests the connection
func (a *TiDBAdapter) TestConnection(ctx context.Context) error {
	return a.HealthCheck(ctx)
}

// Helper methods

func (a *TiDBAdapter) buildDSN() string {
	// TiDB uses MySQL connection string format
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s",
		a.conn.Username, a.conn.Password, a.conn.Host, a.conn.Port, a.conn.Database)

	params := make([]string, 0)

	// Add SSL options
	if a.conn.SSL {
		params = append(params, "tls=true")
	}

	// Add custom options
	for key, value := range a.conn.Options {
		params = append(params, fmt.Sprintf("%s=%s", key, value))
	}

	if len(params) > 0 {
		dsn += "?" + strings.Join(params, "&")
	}

	return dsn
}

func (a *TiDBAdapter) getTableColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	query := `
		SELECT column_name, data_type, is_nullable, column_default, column_key, extra
		FROM information_schema.columns
		WHERE table_name = ?
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
		var columnDefault, columnKey, extra sql.NullString

		if err := rows.Scan(&columnName, &dataType, &isNullable, &columnDefault, &columnKey, &extra); err != nil {
			continue
		}

		column := types.ColumnInfo{
			Name:         columnName.String,
			Type:         a.mapTiDBType(dataType.String),
			Nullable:     isNullable.Valid && isNullable.String == "YES",
			DefaultValue: columnDefault.String,
		}

		// Mark primary key columns
		if columnKey.Valid && columnKey.String == "PRI" {
			column.IsPrimaryKey = true
		}

		// Mark auto increment columns
		// if extra.Valid && strings.Contains(extra.String, "auto_increment") {
		// 	column.AutoIncrement = true
		// }

		columns = append(columns, column)
	}

	return columns, nil
}

func (a *TiDBAdapter) mapTiDBType(tidbType string) string {
	// Map TiDB types to standard types (same as MySQL)
	switch tidbType {
	case "tinyint":
		return "tinyint"
	case "smallint":
		return "smallint"
	case "mediumint", "int", "integer":
		return "integer"
	case "bigint":
		return "bigint"
	case "decimal", "numeric":
		return "decimal"
	case "float":
		return "float"
	case "double":
		return "double"
	case "bit":
		return "bit"
	case "char", "varchar", "tinytext", "text", "mediumtext", "longtext":
		return "string"
	case "binary", "varbinary", "tinyblob", "blob", "mediumblob", "longblob":
		return "blob"
	case "date":
		return "date"
	case "datetime", "timestamp":
		return "timestamp"
	case "time":
		return "time"
	case "year":
		return "year"
	case "enum", "set":
		return "enum"
	case "json":
		return "json"
	case "boolean":
		return "boolean"
	default:
		return tidbType
	}
}

func (a *TiDBAdapter) convertTiDBValue(value interface{}, columnType *sql.ColumnType) interface{} {
	// TiDB values should be the same as MySQL
	switch v := value.(type) {
	case []byte:
		return string(v)
	default:
		return v
	}
}

// TiDBTransaction implements the Transaction interface
type TiDBTransaction struct {
	tx *sql.Tx
}

func (t *TiDBTransaction) Commit() error {
	return t.tx.Commit()
}

func (t *TiDBTransaction) Rollback() error {
	return t.tx.Rollback()
}

func (t *TiDBTransaction) IsActive() bool {
	return t.tx != nil
}

func isTiDBDMLQuery(query string) bool {
	queryLower := strings.ToLower(query)
	return strings.HasPrefix(queryLower, "insert ") ||
		strings.HasPrefix(queryLower, "update ") ||
		strings.HasPrefix(queryLower, "delete ") ||
		strings.HasPrefix(queryLower, "create ") ||
		strings.HasPrefix(queryLower, "drop ") ||
		strings.HasPrefix(queryLower, "alter ")
}
