package analytics

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/sirupsen/logrus"
)

// validDuckDBIdentifier matches safe SQL identifiers
var validDuckDBIdentifier = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)

// sanitizeDuckDBID validates and quotes an identifier for safe use
func sanitizeDuckDBID(name string) (string, error) {
	if !validDuckDBIdentifier.MatchString(name) {
		return "", fmt.Errorf("invalid SQL identifier: %q", name)
	}
	return `"` + name + `"`, nil
}

// DuckDBAdapter provides connectivity to DuckDB analytics database
type DuckDBAdapter struct {
	conn     *entities.Connection
	db       *sql.DB
	logger   *logrus.Logger
	isMemory bool
}

// Connect establishes a connection to DuckDB
func (a *DuckDBAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	a.conn = conn

	// Determine database path
	var dbPath string
	if conn.Host == ":memory:" || conn.Database == ":memory:" {
		dbPath = ":memory:"
		a.isMemory = true
	} else if conn.Database != "" {
		// Use database field as path
		dbPath = conn.Database
		if !filepath.IsAbs(dbPath) {
			// Relative path - make it absolute
			if absPath, err := filepath.Abs(dbPath); err == nil {
				dbPath = absPath
			}
		}
	} else if conn.Host != "" && conn.Host != "localhost" {
		// Use host as database path
		dbPath = conn.Host
	} else {
		// Default to in-memory
		dbPath = ":memory:"
		a.isMemory = true
	}

	// Create directory if it doesn't exist for file-based database
	if dbPath != ":memory:" {
		dir := filepath.Dir(dbPath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create database directory: %w", err)
		}
	}

	// Open DuckDB connection using standard database/sql interface
	db, err := sql.Open("duckdb", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open DuckDB: %w", err)
	}

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return fmt.Errorf("failed to ping DuckDB: %w", err)
	}

	a.db = db

	// Configure DuckDB settings
	if err := a.configureSettings(ctx); err != nil {
		a.logger.Warnf("Failed to configure some DuckDB settings: %v", err)
	}

	a.logger.WithFields(logrus.Fields{
		"path":     dbPath,
		"memory":   a.isMemory,
		"database": conn.Database,
	}).Info("Successfully connected to DuckDB")

	return nil
}

// configureSettings applies DuckDB-specific settings
func (a *DuckDBAdapter) configureSettings(ctx context.Context) error {
	// Default settings for analytics workloads
	settings := map[string]string{
		"memory_limit":             "1GB",
		"threads":                  "4",
		"max_memory":               "1GB",
		"enable_progress_bar":      "false",
		"null_order":               "nulls_last",
		"preserve_insertion_order": "false",
	}

	// Override with connection options
	for key, value := range a.conn.Options {
		settings[key] = value
	}

	// Apply settings
	for key, value := range settings {
		if _, err := a.db.ExecContext(ctx, fmt.Sprintf("SET %s = '%s'", key, value)); err != nil {
			a.logger.Warnf("Failed to set %s = %s: %v", key, value, err)
		}
	}

	// Install and load common extensions
	extensions := []string{"httpfs", "fts", "json", "parquet"}
	for _, ext := range extensions {
		if _, err := a.db.ExecContext(ctx, fmt.Sprintf("INSTALL %s; LOAD %s;", ext, ext)); err != nil {
			a.logger.Warnf("Failed to install/load extension %s: %v", ext, err)
		}
	}

	return nil
}

// Disconnect closes the DuckDB connection
func (a *DuckDBAdapter) Disconnect(ctx context.Context) error {
	if a.db != nil {
		if err := a.db.Close(); err != nil {
			return fmt.Errorf("failed to close DuckDB connection: %w", err)
		}
		a.db = nil
	}
	a.logger.Info("DuckDB connection closed")
	return nil
}

// Shutdown closes the connection
func (a *DuckDBAdapter) Shutdown(ctx context.Context) error {
	return a.Disconnect(ctx)
}

// Ping checks the connection
func (a *DuckDBAdapter) Ping(ctx context.Context) error {
	if a.db == nil {
		return fmt.Errorf("not connected to DuckDB")
	}
	return a.db.PingContext(ctx)
}

// HealthCheck checks the health of the connection (alias for Ping)
func (a *DuckDBAdapter) HealthCheck(ctx context.Context) error {
	return a.Ping(ctx)
}

// BeginTransaction starts a new transaction
func (a *DuckDBAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	return nil, fmt.Errorf("transactions are not supported in DuckDB")
}

// TestConnection tests if the DuckDB connection is valid
func (a *DuckDBAdapter) TestConnection(ctx context.Context) error {
	return a.Ping(ctx)
}

// GetMetrics returns connection metrics
func (a *DuckDBAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected")
	}

	stats := a.db.Stats()

	return &types.ConnectionMetrics{
		LastUpdated: time.Now(),
		DatabaseInfo: types.DatabaseInfo{
			Engine:  "duckdb",
			Version: "Unknown",
		},
		ConnectionPoolStats: types.ConnectionPoolStats{
			OpenConnections:  stats.OpenConnections,
			InUseConnections: stats.InUse,
			IdleConnections:  stats.Idle,
		},
	}, nil
}

// ExecuteQuery executes a DuckDB query and returns results
func (a *DuckDBAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to DuckDB")
	}

	startTime := time.Now()

	// Execute query with parameters
	var rows *sql.Rows
	var err error

	if len(params) > 0 {
		rows, err = a.db.QueryContext(ctx, query, params...)
	} else {
		rows, err = a.db.QueryContext(ctx, query)
	}

	if err != nil {
		return nil, fmt.Errorf("DuckDB query failed: %w", err)
	}
	defer rows.Close()

	// Get column information
	columnNames, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to get columns: %w", err)
	}

	if len(columnNames) == 0 {
		// For queries without results (like INSERT, CREATE, etc.)
		return &types.QueryResult{
			Columns: []types.ColumnInfo{},
			Rows:    []map[string]interface{}{},
			Count:   0,
		}, nil
	}

	// Get column types
	colTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, fmt.Errorf("failed to get column types: %w", err)
	}

	var columns []types.ColumnInfo
	for i, name := range columnNames {
		colType := "unknown"
		if i < len(colTypes) {
			colType = colTypes[i].DatabaseTypeName()
		}
		columns = append(columns, types.ColumnInfo{
			Name: name,
			Type: colType,
		})
	}

	// Scan results
	var results []map[string]interface{}

	for rows.Next() {
		// Create interface slice for scanning
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range columns {
			valuePtrs[i] = &values[i]
		}

		// Scan row
		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		// Convert to map
		row := make(map[string]interface{})
		for i, col := range columns {
			row[col.Name] = values[i]
		}
		results = append(results, row)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration error: %w", err)
	}

	a.logger.WithFields(logrus.Fields{
		"query":    truncateQuery(query, 50),
		"rows":     len(results),
		"columns":  len(columns),
		"duration": time.Since(startTime).Milliseconds(),
	}).Debug("DuckDB query executed")

	return &types.QueryResult{
		Columns: columns,
		Rows:    results,
		Count:   int64(len(results)),
	}, nil
}

// GetSchema retrieves schema information from DuckDB
func (a *DuckDBAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to DuckDB")
	}

	schema := &types.SchemaInfo{
		Tables: []types.TableInfo{},
	}

	// Get all tables in the database
	query := "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog') ORDER BY table_name"
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

		// Get table columns
		columns, err := a.getTableColumns(ctx, tableName)
		if err != nil {
			a.logger.Warnf("Failed to get columns for table %s: %v", tableName, err)
			continue
		}

		tableInfo := types.TableInfo{
			Name:    tableName,
			Schema:  "main", // DuckDB default schema
			Columns: columns,
			Indexes: []types.IndexInfo{}, // DuckDB doesn't have traditional indexes
		}

		schema.Tables = append(schema.Tables, tableInfo)
	}

	return schema, nil
}

// GetTableInfo retrieves information about a specific DuckDB table
func (a *DuckDBAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to DuckDB")
	}

	columns, err := a.getTableColumns(ctx, tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to get table columns: %w", err)
	}

	return &types.TableInfo{
		Name:    tableName,
		Schema:  "main", // DuckDB default schema
		Columns: columns,
		Indexes: []types.IndexInfo{}, // DuckDB doesn't have traditional indexes
	}, nil
}

// IsConnected returns true if the adapter is connected
func (a *DuckDBAdapter) IsConnected() bool {
	return a.db != nil
}

// GetConnectionInfo returns connection information
func (a *DuckDBAdapter) GetConnectionInfo() *entities.Connection {
	return a.conn
}

// getTableColumns retrieves column information for a specific table
func (a *DuckDBAdapter) getTableColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	query := `
		SELECT
			column_name,
			data_type,
			is_nullable,
			column_default,
			ordinal_position
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
		var name, dataType, nullable sql.NullString
		var defaultValue sql.NullString
		var position int

		if err := rows.Scan(&name, &dataType, &nullable, &defaultValue, &position); err != nil {
			continue
		}

		column := types.ColumnInfo{
			Name:         name.String,
			Type:         dataType.String,
			Nullable:     nullable.Valid && nullable.String == "YES",
			DefaultValue: defaultValue.String,
			IsPrimaryKey: false, // DuckDB doesn't expose primary key info easily in information_schema
		}

		columns = append(columns, column)
	}

	return columns, nil
}

// GetColumns returns a list of columns for a table
func (a *DuckDBAdapter) GetColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	return a.getTableColumns(ctx, tableName)
}

// Helper functions
func truncateQuery(query string, maxLen int) string {
	if len(query) <= maxLen {
		return query
	}
	return query[:maxLen] + "..."
}

// GetDatabasePath returns the current database path
func (a *DuckDBAdapter) GetDatabasePath() string {
	if a.isMemory {
		return ":memory:"
	}
	return a.conn.Database
}

// ExportTable exports a table to a file (DuckDB specialty)
func (a *DuckDBAdapter) ExportTable(ctx context.Context, tableName, filePath, format string) error {
	if a.db == nil {
		return fmt.Errorf("not connected to DuckDB")
	}

	// Support common export formats
	validFormats := map[string]bool{
		"parquet": true, "csv": true, "json": true, "sqlite": true,
	}

	if !validFormats[format] {
		return fmt.Errorf("unsupported export format: %s", format)
	}

	safeTable, err := sanitizeDuckDBID(tableName)
	if err != nil {
		return fmt.Errorf("invalid table name: %w", err)
	}
	query := fmt.Sprintf("COPY %s TO '%s' (FORMAT %s)", safeTable, filePath, strings.ToUpper(format))
	_, err = a.db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to export table %s: %w", tableName, err)
	}

	a.logger.WithFields(logrus.Fields{
		"table":  tableName,
		"file":   filePath,
		"format": format,
	}).Info("Table exported successfully")

	return nil
}

// ImportTable imports data from a file (DuckDB specialty)
func (a *DuckDBAdapter) ImportTable(ctx context.Context, tableName, filePath, format string) error {
	if a.db == nil {
		return fmt.Errorf("not connected to DuckDB")
	}

	// Support common import formats
	validFormats := map[string]bool{
		"parquet": true, "csv": true, "json": true,
	}

	if !validFormats[format] {
		return fmt.Errorf("unsupported import format: %s", format)
	}

	safeTable, err := sanitizeDuckDBID(tableName)
	if err != nil {
		return fmt.Errorf("invalid table name: %w", err)
	}
	query := fmt.Sprintf("CREATE OR REPLACE TABLE %s AS SELECT * FROM read_%s('%s')",
		safeTable, format, filePath)

	_, err = a.db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to import table %s: %w", tableName, err)
	}

	a.logger.WithFields(logrus.Fields{
		"table":  tableName,
		"file":   filePath,
		"format": format,
	}).Info("Table imported successfully")

	return nil
}
