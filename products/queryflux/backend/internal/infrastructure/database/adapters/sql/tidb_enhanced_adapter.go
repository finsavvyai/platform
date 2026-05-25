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

	_ "github.com/go-sql-driver/mysql" // TiDB is MySQL-compatible
	"github.com/sirupsen/logrus"
)

// TiDBEnhancedAdapter provides enhanced connectivity to TiDB distributed SQL database
type TiDBEnhancedAdapter struct {
	conn         *entities.Connection
	db           *sql.DB
	poolSettings map[string]string
	logger       *logrus.Logger
}

// Connect establishes a connection to TiDB
func (a *TiDBEnhancedAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	a.conn = conn

	// Build TiDB DSN (Data Source Name)
	dsn := a.buildDSN(conn)

	// Open database connection
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return fmt.Errorf("failed to open TiDB connection: %w", err)
	}

	// Configure connection pool
	if err := a.configurePool(db, conn); err != nil {
		db.Close()
		return fmt.Errorf("failed to configure TiDB connection pool: %w", err)
	}

	// Test connection
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return fmt.Errorf("TiDB ping failed: %w", err)
	}

	// Verify it's actually TiDB
	if err := a.verifyTiDB(ctx, db); err != nil {
		db.Close()
		return fmt.Errorf("TiDB verification failed: %w", err)
	}

	a.db = db
	a.logger.WithFields(logrus.Fields{
		"host":     conn.Host,
		"port":     conn.Port,
		"database": conn.Database,
	}).Info("Successfully connected to TiDB")

	return nil
}

// buildDSN constructs the TiDB DSN
func (a *TiDBEnhancedAdapter) buildDSN(conn *entities.Connection) string {
	// TiDB uses MySQL-compatible connection string
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s",
		conn.Username,
		conn.Password,
		conn.Host,
		conn.Port,
		conn.Database)

	// Build parameters
	params := make([]string, 0)

	// TLS for secure connections
	if conn.SSL {
		params = append(params, "tls=true")
		if caFile := conn.Options["ca_file"]; caFile != "" {
			params = append(params, fmt.Sprintf("ca=%s", caFile))
		}
		if certFile := conn.Options["cert_file"]; certFile != "" {
			params = append(params, fmt.Sprintf("cert=%s", certFile))
		}
		if keyFile := conn.Options["key_file"]; keyFile != "" {
			params = append(params, fmt.Sprintf("key=%s", keyFile))
		}
		if skipVerify := conn.Options["skip_verify"]; skipVerify == "true" {
			params = append(params, "skip-verify=true")
		}
	} else {
		params = append(params, "tls=false")
	}

	// TiDB-specific settings
	if charset := conn.Options["charset"]; charset != "" {
		params = append(params, fmt.Sprintf("charset=%s", charset))
	} else {
		params = append(params, "charset=utf8mb4")
	}

	if collation := conn.Options["collation"]; collation != "" {
		params = append(params, fmt.Sprintf("collation=%s", collation))
	} else {
		params = append(params, "collation=utf8mb4_unicode_ci")
	}

	// Connection timeout settings
	if timeout := conn.Options["timeout"]; timeout != "" {
		params = append(params, fmt.Sprintf("timeout=%s", timeout))
	}

	// Read timeout
	if readTimeout := conn.Options["read_timeout"]; readTimeout != "" {
		params = append(params, fmt.Sprintf("readTimeout=%s", readTimeout))
	}

	// Write timeout
	if writeTimeout := conn.Options["write_timeout"]; writeTimeout != "" {
		params = append(params, fmt.Sprintf("writeTimeout=%s", writeTimeout))
	}

	// Parse time for proper time handling
	params = append(params, "parseTime=true")

	// Custom options
	for key, value := range conn.Options {
		if !strings.Contains(key, "charset") &&
			!strings.Contains(key, "collation") &&
			!strings.Contains(key, "timeout") &&
			!strings.Contains(key, "tls") &&
			!strings.Contains(key, "ca_file") &&
			!strings.Contains(key, "cert_file") &&
			!strings.Contains(key, "key_file") &&
			!strings.Contains(key, "skip_verify") {
			params = append(params, fmt.Sprintf("%s=%s", key, value))
		}
	}

	if len(params) > 0 {
		dsn += "?" + strings.Join(params, "&")
	}

	return dsn
}

// configurePool configures the connection pool
func (a *TiDBEnhancedAdapter) configurePool(db *sql.DB, conn *entities.Connection) error {
	// Set maximum open connections
	maxOpenConns := 25 // Default
	if maxConns := conn.Options["max_open_conns"]; maxConns != "" {
		if val, err := strconv.Atoi(maxConns); err == nil && val > 0 {
			maxOpenConns = val
		}
	}
	db.SetMaxOpenConns(maxOpenConns)

	// Set maximum idle connections
	maxIdleConns := 10 // Default
	if idleConns := conn.Options["max_idle_conns"]; idleConns != "" {
		if val, err := strconv.Atoi(idleConns); err == nil && val > 0 {
			maxIdleConns = val
		}
	}
	db.SetMaxIdleConns(maxIdleConns)

	// Set connection max lifetime
	connMaxLifetime := time.Hour // Default
	if lifetime := conn.Options["conn_max_lifetime"]; lifetime != "" {
		if duration, err := time.ParseDuration(lifetime); err == nil {
			connMaxLifetime = duration
		}
	}
	db.SetConnMaxLifetime(connMaxLifetime)

	// Store settings for reference
	a.poolSettings = map[string]string{
		"max_open_conns":    strconv.Itoa(maxOpenConns),
		"max_idle_conns":    strconv.Itoa(maxIdleConns),
		"conn_max_lifetime": connMaxLifetime.String(),
	}

	return nil
}

// verifyTiDB verifies that we're connected to TiDB
func (a *TiDBEnhancedAdapter) verifyTiDB(ctx context.Context, db *sql.DB) error {
	var version string
	err := db.QueryRowContext(ctx, "SELECT VERSION()").Scan(&version)
	if err != nil {
		return fmt.Errorf("failed to query version: %w", err)
	}

	// Check if it's actually TiDB
	if !strings.Contains(strings.ToLower(version), "tidb") {
		a.logger.Warnf("Connected to MySQL-compatible database but version doesn't indicate TiDB: %s", version)
		return fmt.Errorf("expected TiDB but got: %s", version)
	}

	a.logger.Infof("Connected to TiDB version: %s", version)
	return nil
}

// Disconnect closes the TiDB connection
func (a *TiDBEnhancedAdapter) Disconnect(ctx context.Context) error {
	if a.db != nil {
		if err := a.db.Close(); err != nil {
			return fmt.Errorf("failed to close TiDB connection: %w", err)
		}
		a.db = nil
		a.logger.Info("TiDB connection closed")
	}
	return nil
}

// TestConnection tests if the TiDB connection is valid
func (a *TiDBEnhancedAdapter) TestConnection(ctx context.Context) error {
	if a.db == nil {
		return fmt.Errorf("not connected to TiDB")
	}
	return a.db.PingContext(ctx)
}

// ExecuteQuery executes a TiDB query and returns results
func (a *TiDBEnhancedAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to TiDB")
	}

	startTime := time.Now()

	// Execute query
	rows, err := a.db.QueryContext(ctx, query, params...)
	if err != nil {
		return nil, fmt.Errorf("TiDB query failed: %w", err)
	}
	defer rows.Close()

	// Get column information
	colNames, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to get columns: %w", err)
	}

	// Convert to ColumnInfo
	columns := make([]types.ColumnInfo, len(colNames))
	for i, name := range colNames {
		columns[i] = types.ColumnInfo{
			Name: name,
			Type: "unknown", // we don't have types here easily from rows.Columns()
		}
	}
	// Try to get detailed column types if possible
	if colTypes, err := rows.ColumnTypes(); err == nil {
		for i, ct := range colTypes {
			columns[i].Type = ct.DatabaseTypeName()
			if nullable, ok := ct.Nullable(); ok {
				columns[i].Nullable = nullable
			}
		}
	}

	if len(columns) == 0 {
		// For queries without results (like INSERT, UPDATE, DELETE, etc.)
		return &types.QueryResult{
			Columns: []types.ColumnInfo{},
			Rows:    []map[string]interface{}{},
			Count:   0,
		}, nil
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
	}).Debug("TiDB query executed")

	return &types.QueryResult{
		Columns: columns,
		Rows:    results,
		Count:   int64(len(results)),
	}, nil
}

// GetSchema retrieves schema information from TiDB
func (a *TiDBEnhancedAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to TiDB")
	}

	schema := &types.SchemaInfo{
		Tables: []types.TableInfo{},
	}

	// Get all tables in the database
	query := "SELECT table_name, table_type, table_comment FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name"
	rows, err := a.db.QueryContext(ctx, query, a.conn.Database)
	if err != nil {
		return nil, fmt.Errorf("failed to query tables: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var tableName, tableType, comment sql.NullString
		if err := rows.Scan(&tableName, &tableType, &comment); err != nil {
			continue
		}

		// Get table columns
		columns, err := a.getTableColumns(ctx, tableName.String)
		if err != nil {
			a.logger.Warnf("Failed to get columns for table %s: %v", tableName.String, err)
			continue
		}

		// Get table indexes
		indexes, err := a.getTableIndexes(ctx, tableName.String)
		if err != nil {
			a.logger.Warnf("Failed to get indexes for table %s: %v", tableName.String, err)
			indexes = []types.IndexInfo{} // Continue without indexes
		}

		tableInfo := types.TableInfo{
			Name:    tableName.String,
			Schema:  a.conn.Database,
			Columns: columns,
			Indexes: indexes,
		}

		schema.Tables = append(schema.Tables, tableInfo)
	}

	return schema, nil
}

// GetTableInfo retrieves information about a specific TiDB table
func (a *TiDBEnhancedAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to TiDB")
	}

	columns, err := a.getTableColumns(ctx, tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to get table columns: %w", err)
	}

	indexes, err := a.getTableIndexes(ctx, tableName)
	if err != nil {
		a.logger.Warnf("Failed to get indexes for table %s: %v", tableName, err)
		indexes = []types.IndexInfo{} // Continue without indexes
	}

	return &types.TableInfo{
		Name:    tableName,
		Schema:  a.conn.Database,
		Columns: columns,
		Indexes: indexes,
	}, nil
}

// IsConnected returns true if the adapter is connected
func (a *TiDBEnhancedAdapter) IsConnected() bool {
	return a.db != nil
}

// GetConnectionInfo returns connection information
func (a *TiDBEnhancedAdapter) GetConnectionInfo() *entities.Connection {
	return a.conn
}

// getTableColumns retrieves column information for a specific table
func (a *TiDBEnhancedAdapter) getTableColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	query := `
		SELECT
			column_name,
			data_type,
			is_nullable,
			column_default,
			column_key,
			extra,
			character_maximum_length,
			numeric_precision,
			numeric_scale
		FROM information_schema.columns
		WHERE table_schema = ? AND table_name = ?
		ORDER BY ordinal_position
	`

	rows, err := a.db.QueryContext(ctx, query, a.conn.Database, tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to query columns: %w", err)
	}
	defer rows.Close()

	var columns []types.ColumnInfo

	for rows.Next() {
		var name, dataType, nullable, defaultValue, columnKey, extra sql.NullString
		var maxLen, precision, scale sql.NullInt64

		if err := rows.Scan(&name, &dataType, &nullable, &defaultValue, &columnKey, &extra, &maxLen, &precision, &scale); err != nil {
			continue
		}

		// Build full type string
		fullType := dataType.String
		if maxLen.Valid && maxLen.Int64 > 0 {
			fullType += fmt.Sprintf("(%d)", maxLen.Int64)
		} else if precision.Valid {
			if scale.Valid && scale.Int64 > 0 {
				fullType += fmt.Sprintf("(%d,%d)", precision.Int64, scale.Int64)
			} else {
				fullType += fmt.Sprintf("(%d)", precision.Int64)
			}
		}

		column := types.ColumnInfo{
			Name:         name.String,
			Type:         fullType,
			Nullable:     nullable.Valid && nullable.String == "YES",
			DefaultValue: defaultValue.String,
			IsPrimaryKey: columnKey.Valid && columnKey.String == "PRI",
		}

		columns = append(columns, column)
	}

	return columns, nil
}

// getTableIndexes retrieves index information for a specific table
func (a *TiDBEnhancedAdapter) getTableIndexes(ctx context.Context, tableName string) ([]types.IndexInfo, error) {
	query := `
		SELECT
			index_name,
			column_name,
			non_unique,
			seq_in_index
		FROM information_schema.statistics
		WHERE table_schema = ? AND table_name = ?
		ORDER BY index_name, seq_in_index
	`

	rows, err := a.db.QueryContext(ctx, query, a.conn.Database, tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to query indexes: %w", err)
	}
	defer rows.Close()

	indexMap := make(map[string][]string)

	for rows.Next() {
		var indexName, columnName sql.NullString
		var nonUnique sql.NullInt64
		var seqInIndex sql.NullInt64

		if err := rows.Scan(&indexName, &columnName, &nonUnique, &seqInIndex); err != nil {
			continue
		}

		indexNameStr := indexName.String
		if indexMap[indexNameStr] == nil {
			indexMap[indexNameStr] = []string{}
		}
		indexMap[indexNameStr] = append(indexMap[indexNameStr], columnName.String)
	}

	var indexes []types.IndexInfo
	for name, columns := range indexMap {
		indexes = append(indexes, types.IndexInfo{
			Name:    name,
			Columns: columns,
			Unique:  name == "PRIMARY" || strings.HasPrefix(name, "uk_"),
		})
	}

	return indexes, nil
}

// GetTiDBVersion returns the TiDB server version
func (a *TiDBEnhancedAdapter) GetTiDBVersion(ctx context.Context) (string, error) {
	if a.db == nil {
		return "", fmt.Errorf("not connected to TiDB")
	}

	var version string
	err := a.db.QueryRowContext(ctx, "SELECT VERSION()").Scan(&version)
	if err != nil {
		return "", fmt.Errorf("failed to get TiDB version: %w", err)
	}

	return version, nil
}

// GetClusterInfo returns TiDB cluster information
func (a *TiDBEnhancedAdapter) GetClusterInfo(ctx context.Context) (map[string]interface{}, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to TiDB")
	}

	clusterInfo := make(map[string]interface{})

	// Get TiDB server information
	if version, err := a.GetTiDBVersion(ctx); err == nil {
		clusterInfo["version"] = version
	}

	// Get TiDB configuration
	query := "SELECT VARIABLE_NAME, VARIABLE_VALUE FROM INFORMATION_SCHEMA.TIDB_CONFIG WHERE VARIABLE_NAME IN ('tidb_version', 'tidb_build_hash', 'tikv_version', 'pd_version')"
	rows, err := a.db.QueryContext(ctx, query)
	if err == nil {
		defer rows.Close()

		for rows.Next() {
			var name, value sql.NullString
			if err := rows.Scan(&name, &value); err == nil {
				clusterInfo[name.String] = value.String
			}
		}
	}

	return clusterInfo, nil
}

// HealthCheck checks the health of the connection
func (a *TiDBEnhancedAdapter) HealthCheck(ctx context.Context) error {
	if a.db == nil {
		return fmt.Errorf("not connected to TiDB")
	}
	return a.db.PingContext(ctx)
}

// Ping pings the database
func (a *TiDBEnhancedAdapter) Ping(ctx context.Context) error {
	return a.HealthCheck(ctx)
}

// GetMetrics retrieves connection metrics
func (a *TiDBEnhancedAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to TiDB")
	}

	stats := a.db.Stats()
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

// BeginTransaction starts a new transaction
func (a *TiDBEnhancedAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to TiDB")
	}
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	return &TiDBTransaction{tx: tx}, nil
}
