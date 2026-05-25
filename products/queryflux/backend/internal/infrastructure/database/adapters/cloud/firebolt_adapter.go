package cloud

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	_ "github.com/lib/pq" // PostgreSQL driver compatible with Firebolt
	"github.com/sirupsen/logrus"
)

// FireboltAdapter provides connectivity to Firebolt data warehouse
type FireboltAdapter struct {
	conn   *entities.Connection
	db     *sql.DB
	logger *logrus.Logger
	engine string
}

// NewFireboltAdapter creates a new Firebolt adapter
func NewFireboltAdapter(conn *entities.Connection, logger *logrus.Logger) *FireboltAdapter {
	return &FireboltAdapter{
		conn:   conn,
		logger: logger,
		engine: conn.Options["engine"],
	}
}

// Connect establishes a connection to Firebolt
func (a *FireboltAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	if conn != nil {
		a.conn = conn
		a.engine = conn.Options["engine"]
	}
	// Build DSN for Firebolt (PostgreSQL-compatible)
	dsn := a.buildDSN()

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return fmt.Errorf("failed to open Firebolt connection: %w", err)
	}

	// Set connection pool parameters
	// Default values if not present
	maxOpen := 5
	maxIdle := 2
	maxLife := 3600

	// We don't have GetInt helper, doing manually or ignoring for simple implementation
	// For now, hardcode defaults or parse from options string if critical

	db.SetMaxOpenConns(maxOpen)
	db.SetMaxIdleConns(maxIdle)
	db.SetConnMaxLifetime(time.Duration(maxLife) * time.Second)

	// Test connection
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return fmt.Errorf("failed to ping Firebolt: %w", err)
	}

	a.db = db

	// Set engine if specified
	if a.engine != "" {
		if _, err := db.ExecContext(ctx, fmt.Sprintf("USE ENGINE %s", a.engine)); err != nil {
			a.logger.Warnf("Failed to set engine %s: %v", a.engine, err)
		}
	}

	a.logger.Info("Successfully connected to Firebolt")
	return nil
}

// Disconnect closes the Firebolt connection
func (a *FireboltAdapter) Disconnect(ctx context.Context) error {
	if a.db != nil {
		err := a.db.Close()
		a.db = nil
		a.logger.Info("Firebolt connection closed")
		return err
	}
	return nil
}

// IsConnected checks if the adapter is connected
func (a *FireboltAdapter) IsConnected() bool {
	return a.db != nil
}

// GetConnectionInfo returns connection info
func (a *FireboltAdapter) GetConnectionInfo() *entities.Connection {
	return a.conn
}

// ExecuteQuery executes a SQL query against Firebolt
func (a *FireboltAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to Firebolt")
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
				row[col] = a.convertFireboltValue(values[i], columnTypes[i])
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
			Type:     a.mapFireboltType(columnTypes[i].DatabaseTypeName()),
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

// GetSchema retrieves schema information from Firebolt
func (a *FireboltAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to Firebolt")
	}

	schema := &types.SchemaInfo{
		Database: a.conn.Database,
		Tables:   make([]types.TableInfo, 0),
	}

	// Get all tables
	query := `
		SELECT table_name, table_type
		FROM information_schema.tables
		WHERE table_schema = 'public'
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
			columns = []types.ColumnInfo{}
		}

		table := types.TableInfo{
			Name:    tableName,
			Type:    tableType,
			Schema:  "public",
			Columns: columns,
		}
		schema.Tables = append(schema.Tables, table)
	}

	return schema, nil
}

// GetTableInfo returns column information for a specific table
func (a *FireboltAdapter) GetTableInfo(ctx context.Context, table string) (*types.TableInfo, error) {
	columns, err := a.getTableColumns(ctx, table)
	if err != nil {
		return nil, err
	}
	return &types.TableInfo{
		Name:    table,
		Schema:  "public",
		Columns: columns,
	}, nil
}

// BeginTransaction starts a new transaction
func (a *FireboltAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to Firebolt")
	}

	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}

	return &FireboltTransaction{tx: tx}, nil
}

// TestConnection tests if the connection is valid
func (a *FireboltAdapter) TestConnection(ctx context.Context) error {
	return a.HealthCheck(ctx)
}

// HealthCheck checks the health of the Firebolt connection
func (a *FireboltAdapter) HealthCheck(ctx context.Context) error {
	if a.db == nil {
		return fmt.Errorf("not connected to Firebolt")
	}

	return a.db.PingContext(ctx)
}

// GetMetrics returns metrics
func (a *FireboltAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return &types.ConnectionMetrics{}, nil
}

// Ping checks the connection
func (a *FireboltAdapter) Ping(ctx context.Context) error {
	return a.HealthCheck(ctx)
}

// GetMetadata retrieves metadata about the Firebolt connection
func (a *FireboltAdapter) GetMetadata() map[string]interface{} {
	return map[string]interface{}{
		"engine":                "firebolt",
		"data_warehouse":        true,
		"cloud_native":          true,
		"columnar":              true,
		"engine_name":           a.engine,
		"endpoint":              a.conn.Host,
		"supports_transactions": true,
	}
}

// Helper methods

func (a *FireboltAdapter) buildDSN() string {
	// Firebolt uses PostgreSQL-compatible connection string
	// Format: postgresql://user:password@host:port/database?sslmode=require

	dsn := fmt.Sprintf("postgresql://%s:%s@%s:%d/%s",
		a.conn.Username, a.conn.Password, a.conn.Host, a.conn.Port, a.conn.Database)

	// Add SSL parameters
	params := []string{"sslmode=require"}
	if !a.conn.SSL {
		params[0] = "sslmode=disable"
	}

	// Add custom options
	for key, value := range a.conn.Options {
		params = append(params, fmt.Sprintf("%s=%s", key, value))
	}

	if len(params) > 0 {
		dsn += "?" + params[0]
		for _, param := range params[1:] {
			dsn += "&" + param
		}
	}

	return dsn
}

func (a *FireboltAdapter) getTableColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	query := `
		SELECT column_name, data_type, is_nullable, column_default
		FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = ?
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
			Name:     columnName.String,
			Type:     a.mapFireboltType(dataType.String),
			Nullable: isNullable.Valid && isNullable.String == "YES",
			Default:  columnDefault.String,
		}

		columns = append(columns, column)
	}

	return columns, nil
}

func (a *FireboltAdapter) mapFireboltType(fireboltType string) string {
	// Map Firebolt types to standard types
	switch fireboltType {
	case "INTEGER", "INT":
		return "integer"
	case "BIGINT":
		return "bigint"
	case "DECIMAL", "NUMERIC":
		return "decimal"
	case "FLOAT", "DOUBLE":
		return "double"
	case "VARCHAR", "TEXT", "STRING":
		return "string"
	case "BOOLEAN":
		return "boolean"
	case "DATE":
		return "date"
	case "TIMESTAMP", "DATETIME":
		return "timestamp"
	case "ARRAY":
		return "array"
	case "TUPLE":
		return "object"
	default:
		return fireboltType
	}
}

func (a *FireboltAdapter) convertFireboltValue(value interface{}, columnType *sql.ColumnType) interface{} {
	// Handle Firebolt-specific types
	switch v := value.(type) {
	case []byte:
		// Firebolt might return bytes for strings
		return string(v)
	default:
		return v
	}
}

// FireboltTransaction implements the Transaction interface
type FireboltTransaction struct {
	tx *sql.Tx
}

func (t *FireboltTransaction) Commit() error {
	return t.tx.Commit()
}

func (t *FireboltTransaction) Rollback() error {
	return t.tx.Rollback()
}

func (t *FireboltTransaction) IsActive() bool {
	return t.tx != nil
}
