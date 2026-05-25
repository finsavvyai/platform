package analytics

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/sirupsen/logrus"
)

// ClickHouseAdapter provides connectivity to ClickHouse analytics database
type ClickHouseAdapter struct {
	conn     *entities.Connection
	driver   driver.Conn
	settings map[string]string
	logger   *logrus.Logger
}

// Connect establishes a connection to ClickHouse
func (a *ClickHouseAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	a.conn = conn

	// Build ClickHouse connection options
	options := clickhouse.Options{
		Addr: []string{fmt.Sprintf("%s:%d", conn.Host, conn.Port)},
		Auth: clickhouse.Auth{
			Database: conn.Database,
			Username: conn.Username,
			Password: conn.Password,
		},
		Settings: clickhouse.Settings{
			"max_execution_time": 60,
			"max_memory_usage":   10000000000, // 10GB
		},
		DialTimeout:     30 * time.Second,
		MaxOpenConns:    10,
		MaxIdleConns:    5,
		ConnMaxLifetime: time.Hour,
		Compression: &clickhouse.Compression{
			Method: clickhouse.CompressionLZ4,
		},
	}

	// Configure SSL if enabled
	if conn.SSL {
		// Note: TLS configuration depends on clickhouse-go version
		// This would need to be updated based on the specific version being used
		a.logger.Info("SSL requested for ClickHouse, but configuration not yet implemented")
	}

	// Parse additional options from connection
	for key, value := range conn.Options {
		switch key {
		case "dial_timeout":
			if duration, err := time.ParseDuration(value); err == nil {
				options.DialTimeout = duration
			}
		case "max_open_conns":
			// Parse int value
			if val := parseIntOption(value); val > 0 {
				options.MaxOpenConns = val
			}
		case "max_idle_conns":
			if val := parseIntOption(value); val > 0 {
				options.MaxIdleConns = val
			}
		case "compression":
			if value == "lz4" {
				options.Compression.Method = clickhouse.CompressionLZ4
			} else if value == "zstd" {
				options.Compression.Method = clickhouse.CompressionZSTD
			} else if value == "none" {
				options.Compression = nil
			}
		default:
			// Add as ClickHouse setting
			options.Settings[key] = value
		}
	}

	// Connect to ClickHouse
	driverConn, err := clickhouse.Open(&options)
	if err != nil {
		return fmt.Errorf("failed to connect to ClickHouse: %w", err)
	}

	// Test connection
	if err := driverConn.Ping(ctx); err != nil {
		driverConn.Close()
		return fmt.Errorf("ClickHouse ping failed: %w", err)
	}

	a.driver = driverConn
	a.logger.Info("Successfully connected to ClickHouse")
	return nil
}

// Disconnect closes the ClickHouse connection
func (a *ClickHouseAdapter) Disconnect(ctx context.Context) error {
	if a.driver != nil {
		if err := a.driver.Close(); err != nil {
			return fmt.Errorf("failed to close ClickHouse connection: %w", err)
		}
		a.driver = nil
		a.logger.Info("ClickHouse connection closed")
	}
	return nil
}

// Shutdown closes the connection
func (a *ClickHouseAdapter) Shutdown(ctx context.Context) error {
	return a.Disconnect(ctx)
}

// Ping checks the connection
func (a *ClickHouseAdapter) Ping(ctx context.Context) error {
	if a.driver == nil {
		return fmt.Errorf("not connected to ClickHouse")
	}
	return a.driver.Ping(ctx)
}

// TestConnection tests if the ClickHouse connection is valid
func (a *ClickHouseAdapter) TestConnection(ctx context.Context) error {
	return a.Ping(ctx)
}

// HealthCheck checks the health of the connection (alias for Ping)
func (a *ClickHouseAdapter) HealthCheck(ctx context.Context) error {
	return a.Ping(ctx)
}

// BeginTransaction starts a new transaction
func (a *ClickHouseAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	return nil, fmt.Errorf("transactions are not supported in ClickHouse")
}

// GetMetrics returns connection metrics
func (a *ClickHouseAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	if a.driver == nil {
		return nil, fmt.Errorf("not connected")
	}

	stats := a.driver.Stats()

	return &types.ConnectionMetrics{
		LastUpdated: time.Now(),
		DatabaseInfo: types.DatabaseInfo{
			Engine:  "clickhouse",
			Version: "Unknown",
		},
		ConnectionPoolStats: types.ConnectionPoolStats{
			OpenConnections:  int(stats.Open),
			InUseConnections: int(stats.Open - stats.Idle),
			IdleConnections:  int(stats.Idle),
			// WaitCount and WaitDuration are not available in this driver version
			// MaxOpenConnections: int(stats.MaxOpenConnections), // Also might be missing?
		},
	}, nil
}

// ExecuteQuery executes a ClickHouse query and returns results
func (a *ClickHouseAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	if a.driver == nil {
		return nil, fmt.Errorf("not connected to ClickHouse")
	}

	// Prepare query with parameters
	finalQuery := query
	if len(params) > 0 {
		// ClickHouse uses $1, $2 syntax for parameters
		// This is a simplified implementation
		finalQuery = fmt.Sprintf(query, params...)
	}

	// Execute query
	rows, err := a.driver.Query(ctx, finalQuery)
	if err != nil {
		return nil, fmt.Errorf("ClickHouse query failed: %w", err)
	}
	defer rows.Close()

	// Get column information
	columnNames := rows.Columns()
	if len(columnNames) == 0 {
		// For queries without results (like INSERT, CREATE, etc.)
		return &types.QueryResult{
			Columns: []types.ColumnInfo{},
			Rows:    []map[string]interface{}{},
			Count:   0,
		}, nil
	}

	// Get column types
	colTypes := rows.ColumnTypes()

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

	return &types.QueryResult{
		Columns: columns,
		Rows:    results,
		Count:   int64(len(results)),
	}, nil
}

// GetSchema retrieves schema information from ClickHouse
func (a *ClickHouseAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	if a.driver == nil {
		return nil, fmt.Errorf("not connected to ClickHouse")
	}

	schema := &types.SchemaInfo{
		Tables: []types.TableInfo{},
	}

	// Get all tables in the database
	query := "SELECT name, engine, comment FROM system.tables WHERE database = ? ORDER BY name"
	rows, err := a.driver.Query(ctx, query, a.conn.Database)
	if err != nil {
		return nil, fmt.Errorf("failed to query tables: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var tableName, engine, comment string
		if err := rows.Scan(&tableName, &engine, &comment); err != nil {
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
			Schema:  a.conn.Database,
			Columns: columns,
			Indexes: []types.IndexInfo{}, // ClickHouse doesn't have traditional indexes
		}

		schema.Tables = append(schema.Tables, tableInfo)
	}

	return schema, nil
}

// GetTableInfo retrieves information about a specific ClickHouse table
func (a *ClickHouseAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	if a.driver == nil {
		return nil, fmt.Errorf("not connected to ClickHouse")
	}

	columns, err := a.getTableColumns(ctx, tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to get table columns: %w", err)
	}

	return &types.TableInfo{
		Name:    tableName,
		Schema:  a.conn.Database,
		Columns: columns,
		Indexes: []types.IndexInfo{}, // ClickHouse doesn't have traditional indexes
	}, nil
}

// IsConnected returns true if the adapter is connected
func (a *ClickHouseAdapter) IsConnected() bool {
	return a.driver != nil
}

// GetConnectionInfo returns connection information
func (a *ClickHouseAdapter) GetConnectionInfo() *entities.Connection {
	return a.conn
}

// getTableColumns retrieves column information for a specific table
func (a *ClickHouseAdapter) getTableColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	query := `
		SELECT
			name,
			type,
			is_in_primary_key,
			default_kind,
			default_expression
		FROM system.columns
		WHERE database = ? AND table = ?
		ORDER BY position
	`

	rows, err := a.driver.Query(ctx, query, a.conn.Database, tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to query columns: %w", err)
	}
	defer rows.Close()

	var columns []types.ColumnInfo

	for rows.Next() {
		var name, colType, defaultKind, defaultExpr sql.NullString
		var isPrimaryKey bool

		if err := rows.Scan(&name, &colType, &isPrimaryKey, &defaultKind, &defaultExpr); err != nil {
			continue
		}

		column := types.ColumnInfo{
			Name:         name.String,
			Type:         colType.String,
			Nullable:     !isPrimaryKey && !isClickHouseTypeNotNull(colType.String),
			IsPrimaryKey: isPrimaryKey,
			DefaultValue: getClickHouseDefaultValue(defaultKind, defaultExpr),
		}

		columns = append(columns, column)
	}

	return columns, nil
}

// GetColumns returns a list of columns for a table
func (a *ClickHouseAdapter) GetColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	return a.getTableColumns(ctx, tableName)
}

// Helper functions
func parseIntOption(value string) int {
	var result int
	if _, err := fmt.Sscanf(value, "%d", &result); err != nil {
		return 0
	}
	return result
}

func isClickHouseTypeNotNull(colType string) bool {
	// ClickHouse types that are never null
	notNullTypes := map[string]bool{
		"UInt8": true, "UInt16": true, "UInt32": true, "UInt64": true, "UInt128": true, "UInt256": true,
		"Int8": true, "Int16": true, "Int32": true, "Int64": true, "Int128": true, "Int256": true,
		"Float32": true, "Float64": true,
		"Decimal": true, "Decimal32": true, "Decimal64": true, "Decimal128": true, "Decimal256": true,
		"Date": true, "Date32": true, "DateTime": true, "DateTime64": true,
		"UUID": true, "IPv4": true, "IPv6": true,
	}
	return notNullTypes[colType] || len(colType) > 7 && colType[:7] == "Decimal" ||
		len(colType) > 9 && colType[:9] == "DateTime64"
}

func getClickHouseDefaultValue(defaultKind, defaultExpr sql.NullString) string {
	if defaultKind.Valid && defaultKind.String == "DEFAULT" && defaultExpr.Valid {
		return defaultExpr.String
	}
	return ""
}
