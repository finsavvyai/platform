package cloud

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/sirupsen/logrus"
	_ "github.com/snowflakedb/gosnowflake" // Snowflake driver
)

// SnowflakeAdapter provides connectivity to Snowflake data warehouse
type SnowflakeAdapter struct {
	conn      *entities.Connection
	db        *sql.DB
	logger    *logrus.Logger
	warehouse string
	role      string
}

// NewSnowflakeAdapter creates a new Snowflake adapter
func NewSnowflakeAdapter(conn *entities.Connection, logger *logrus.Logger) *SnowflakeAdapter {
	return &SnowflakeAdapter{
		conn:      conn,
		logger:    logger,
		warehouse: conn.Options["warehouse"],
		role:      conn.Options["role"],
	}
}

// Connect establishes a connection to Snowflake
func (a *SnowflakeAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	if conn != nil {
		a.conn = conn
		a.warehouse = conn.Options["warehouse"]
		a.role = conn.Options["role"]
	}
	// Build DSN for Snowflake
	dsn := a.buildDSN()

	db, err := sql.Open("snowflake", dsn)
	if err != nil {
		return fmt.Errorf("failed to open Snowflake connection: %w", err)
	}

	// Test connection
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return fmt.Errorf("failed to ping Snowflake: %w", err)
	}

	a.db = db

	// Set warehouse and role if specified
	if a.warehouse != "" {
		if _, err := db.ExecContext(ctx, "USE WAREHOUSE "+a.warehouse); err != nil {
			a.logger.Warnf("Failed to set warehouse %s: %v", a.warehouse, err)
		}
	}

	if a.role != "" {
		if _, err := db.ExecContext(ctx, "USE ROLE "+a.role); err != nil {
			a.logger.Warnf("Failed to set role %s: %v", a.role, err)
		}
	}

	a.logger.Info("Successfully connected to Snowflake")
	return nil
}

// Disconnect closes the Snowflake connection
func (a *SnowflakeAdapter) Disconnect(ctx context.Context) error {
	if a.db != nil {
		err := a.db.Close()
		a.db = nil
		a.logger.Info("Snowflake connection closed")
		return err
	}
	return nil
}

// TestConnection tests if the connection is valid
func (a *SnowflakeAdapter) TestConnection(ctx context.Context) error {
	if a.db == nil {
		return fmt.Errorf("not connected to Snowflake")
	}
	return a.db.PingContext(ctx)
}

// IsConnected checks if the adapter is connected
func (a *SnowflakeAdapter) IsConnected() bool {
	return a.db != nil
}

// GetConnectionInfo returns connection info
func (a *SnowflakeAdapter) GetConnectionInfo() *entities.Connection {
	return a.conn
}

// ExecuteQuery executes a SQL query against Snowflake
func (a *SnowflakeAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to Snowflake")
	}

	startTime := time.Now()

	// Execute query
	rows, err := a.db.QueryContext(ctx, query, params...)
	if err != nil {
		return &types.QueryResult{
			Query:         query,
			RowsAffected:  0,
			ExecutionTime: time.Since(startTime).Milliseconds(),
			Error:         err.Error(),
			Success:       false,
		}, nil
	}
	defer rows.Close()

	// Get column information
	columns, err := rows.Columns()
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

	// Process rows
	var results []map[string]interface{}
	for rows.Next() {
		// Create slice of interfaces for scanning
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
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
		for i, col := range columns {
			// Handle NULL values and type conversion
			if values[i] != nil {
				row[col] = a.convertSnowflakeValue(values[i], columnTypes[i])
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

	executionTime := time.Since(startTime)

	// Convert column types to ColumnInfo format
	columnInfo := make([]types.ColumnInfo, len(columns))
	for i, col := range columns {
		columnInfo[i] = types.ColumnInfo{
			Name:     col,
			Type:     a.mapSnowflakeType(columnTypes[i].DatabaseTypeName()),
			Nullable: true, // Assume nullable by default
		}
	}

	return &types.QueryResult{
		Query:         query,
		Rows:          results,
		Columns:       columnInfo,
		RowsAffected:  int64(len(results)),
		ExecutionTime: executionTime.Milliseconds(),
		Success:       true,
	}, nil
}

// GetSchema retrieves schema information from Snowflake
func (a *SnowflakeAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to Snowflake")
	}

	schema := &types.SchemaInfo{
		Database: a.conn.Database,
		Tables:   make([]types.TableInfo, 0),
	}

	// Get all tables and views
	query := `
		SELECT table_schema, table_name, table_type
		FROM information_schema.tables
		WHERE table_schema NOT IN ('INFORMATION_SCHEMA', 'PG_CATALOG', 'PUBLIC')
		ORDER BY table_schema, table_name
	`

	rows, err := a.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query tables: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var schemaName, tableName, tableType string
		if err := rows.Scan(&schemaName, &tableName, &tableType); err != nil {
			continue
		}

		// Get columns for this table
		columns, err := a.getTableColumns(ctx, schemaName, tableName)
		if err != nil {
			a.logger.Warnf("Failed to get columns for %s.%s: %v", schemaName, tableName, err)
			columns = []types.ColumnInfo{}
		}

		table := types.TableInfo{
			Name:    fmt.Sprintf("%s.%s", schemaName, tableName),
			Schema:  schemaName,
			Type:    tableType,
			Columns: columns,
		}
		schema.Tables = append(schema.Tables, table)
	}

	return schema, nil
}

// GetTableInfo returns column information for a specific table
func (a *SnowflakeAdapter) GetTableInfo(ctx context.Context, table string) (*types.TableInfo, error) {
	// Parse schema.table format
	parts := splitByLastDot(table)
	var schemaName, tableName string
	if len(parts) != 2 {
		schemaName = "PUBLIC" // Default schema
		tableName = table
	} else {
		schemaName = parts[0]
		tableName = parts[1]
	}

	columns, err := a.getTableColumns(ctx, schemaName, tableName)
	if err != nil {
		return nil, err
	}

	return &types.TableInfo{
		Name:    table,
		Schema:  schemaName,
		Columns: columns,
	}, nil
}

// BeginTransaction starts a new transaction
func (a *SnowflakeAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to Snowflake")
	}

	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}

	return &SnowflakeTransaction{tx: tx}, nil
}

// HealthCheck checks the health of the Snowflake connection
func (a *SnowflakeAdapter) HealthCheck(ctx context.Context) error {
	if a.db == nil {
		return fmt.Errorf("not connected to Snowflake")
	}

	return a.db.PingContext(ctx)
}

// GetMetrics returns metrics
func (a *SnowflakeAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return &types.ConnectionMetrics{}, nil
}

// Ping checks the connection
func (a *SnowflakeAdapter) Ping(ctx context.Context) error {
	return a.HealthCheck(ctx)
}

// GetMetadata retrieves metadata about the Snowflake connection
func (a *SnowflakeAdapter) GetMetadata() map[string]interface{} {
	return map[string]interface{}{
		"engine":                "snowflake",
		"data_warehouse":        true,
		"cloud_native":          true,
		"columnar":              true,
		"warehouse":             a.warehouse,
		"role":                  a.role,
		"account":               a.conn.Host,
		"supports_transactions": true,
	}
}

// Helper methods

func (a *SnowflakeAdapter) buildDSN() string {
	dsn := fmt.Sprintf("%s:%s@%s/%s", a.conn.Username, a.conn.Password, a.conn.Host, a.conn.Database)

	// Add warehouse
	if a.warehouse != "" {
		dsn += fmt.Sprintf("?warehouse=%s", a.warehouse)
	}

	// Add role
	if a.role != "" {
		if a.warehouse != "" {
			dsn += fmt.Sprintf("&role=%s", a.role)
		} else {
			dsn += fmt.Sprintf("?role=%s", a.role)
		}
	}

	return dsn
}

func (a *SnowflakeAdapter) getTableColumns(ctx context.Context, schemaName, tableName string) ([]types.ColumnInfo, error) {
	query := `
		SELECT column_name, data_type, is_nullable, column_default
		FROM information_schema.columns
		WHERE table_schema = ? AND table_name = ?
		ORDER BY ordinal_position
	`

	rows, err := a.db.QueryContext(ctx, query, schemaName, tableName)
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
			Name:     columnName.String,
			Type:     a.mapSnowflakeType(dataType.String),
			Nullable: isNullable.Valid && isNullable.String == "YES",
			Default:  columnDefault.String,
		}

		columns = append(columns, column)
	}

	return columns, nil
}

func (a *SnowflakeAdapter) mapSnowflakeType(snowflakeType string) string {
	// Map Snowflake types to standard types
	switch snowflakeType {
	case "NUMBER", "DECIMAL", "NUMERIC":
		return "decimal"
	case "INTEGER", "INT", "BIGINT", "SMALLINT", "TINYINT":
		return "integer"
	case "FLOAT", "FLOAT4", "FLOAT8", "DOUBLE", "REAL":
		return "double"
	case "VARCHAR", "STRING", "TEXT", "CHAR", "CHARACTER":
		return "string"
	case "BOOLEAN":
		return "boolean"
	case "DATE":
		return "date"
	case "TIMESTAMP", "TIMESTAMP_NTZ", "TIMESTAMP_TZ", "TIMESTAMP_LTZ":
		return "timestamp"
	case "TIME", "TIME_TZ":
		return "time"
	case "BINARY", "VARBINARY", "BLOB":
		return "blob"
	case "ARRAY":
		return "array"
	case "OBJECT", "VARIANT":
		return "object"
	case "GEOGRAPHY", "GEOMETRY":
		return "geospatial"
	default:
		return snowflakeType
	}
}

func (a *SnowflakeAdapter) convertSnowflakeValue(value interface{}, columnType *sql.ColumnType) interface{} {
	// Handle Snowflake-specific types
	switch v := value.(type) {
	case []byte:
		// Snowflake sometimes returns bytes for strings
		return string(v)
	default:
		return v
	}
}

// SnowflakeTransaction implements the Transaction interface
type SnowflakeTransaction struct {
	tx *sql.Tx
}

func (t *SnowflakeTransaction) Commit() error {
	return t.tx.Commit()
}

func (t *SnowflakeTransaction) Rollback() error {
	return t.tx.Rollback()
}

func splitByLastDot(s string) []string {
	lastIndex := len(s)
	for i := len(s) - 1; i >= 0; i-- {
		if s[i] == '.' {
			lastIndex = i
			break
		}
	}

	if lastIndex == len(s) {
		return []string{s}
	}

	return []string{s[:lastIndex], s[lastIndex+1:]}
}
