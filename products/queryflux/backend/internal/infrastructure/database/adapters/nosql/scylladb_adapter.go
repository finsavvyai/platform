package nosql

import (
	"context"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/gocql/gocql"
	"github.com/sirupsen/logrus"
)

// ScyllaDBAdapter provides connectivity to ScyllaDB
type ScyllaDBAdapter struct {
	conn    *entities.Connection
	session *gocql.Session
	logger  *logrus.Logger
}

// Connect establishes a connection to ScyllaDB
func (a *ScyllaDBAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	// Store the connection
	a.conn = conn

	// Build cluster configuration
	cluster := gocql.NewCluster(conn.Host)

	// ScyllaDB specific configuration
	cluster.Port = conn.Port
	cluster.Keyspace = conn.Database

	// Authentication
	if conn.Username != "" && conn.Password != "" {
		cluster.Authenticator = gocql.PasswordAuthenticator{
			Username: conn.Username,
			Password: conn.Password,
		}
	}

	// SSL/TLS configuration
	// TODO: Implement proper SSL configuration for gocql v1.7.0
	// SSL options depend on the gocql version
	if conn.SSL {
		// SSL would be configured here based on gocql version
		a.logger.Info("SSL requested for ScyllaDB, but configuration not yet implemented")
	}

	// Connection pool settings optimized for ScyllaDB
	// Use default values if not specified in options
	cluster.NumConns = 2
	if numConns, ok := conn.Options["num_conns"]; ok {
		if val, err := fmt.Sscanf(numConns, "%d", new(int)); err == nil && val > 0 {
			cluster.NumConns = val
		}
	}

	cluster.Timeout = 10 * time.Second
	if timeout, ok := conn.Options["timeout"]; ok {
		if val, err := fmt.Sscanf(timeout, "%d", new(int)); err == nil && val > 0 {
			cluster.Timeout = time.Duration(val) * time.Second
		}
	}

	// Consistency level (ScyllaDB defaults to LOCAL_QUORUM)
	consistencyStr := "LOCAL_QUORUM"
	if consistency, ok := conn.Options["consistency"]; ok {
		consistencyStr = consistency
	}
	cluster.Consistency = gocql.ParseConsistency(consistencyStr)

	// ScyllaDB specific optimizations
	cluster.PoolConfig.HostSelectionPolicy = gocql.TokenAwareHostPolicy(gocql.RoundRobinHostPolicy())
	cluster.RetryPolicy = &gocql.DowngradingConsistencyRetryPolicy{}

	// Create session
	session, err := cluster.CreateSession()
	if err != nil {
		return fmt.Errorf("failed to connect to ScyllaDB: %w", err)
	}

	a.session = session

	// Verify ScyllaDB connection and get version
	if err := a.healthCheck(ctx); err != nil {
		session.Close()
		return fmt.Errorf("ScyllaDB health check failed: %w", err)
	}

	a.logger.Info("Successfully connected to ScyllaDB")
	return nil
}

// Close closes the ScyllaDB connection
func (a *ScyllaDBAdapter) Close() error {
	if a.session != nil {
		a.session.Close()
		a.session = nil
		a.logger.Info("ScyllaDB connection closed")
	}
	return nil
}

// Disconnect closes the ScyllaDB connection (implements DatabaseAdapter)
func (a *ScyllaDBAdapter) Disconnect(ctx context.Context) error {
	return a.Close()
}

// IsConnected checks if the adapter is connected
func (a *ScyllaDBAdapter) IsConnected() bool {
	return a.session != nil && !a.session.Closed()
}

// ExecuteQuery executes a CQL query against ScyllaDB
func (a *ScyllaDBAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	if a.session == nil {
		return nil, fmt.Errorf("not connected to ScyllaDB")
	}

	// Execute query with context
	iter := a.session.Query(query, params...).WithContext(ctx).Iter()
	defer iter.Close()

	// Get column information
	columnNames := iter.Columns()
	if len(columnNames) == 0 {
		// For DDL queries or queries without results
		return &types.QueryResult{
			Columns: []types.ColumnInfo{},
			Rows:    []map[string]interface{}{},
			Count:   0,
		}, nil
	}

	// Scan results
	var results []map[string]interface{}

	// Scan results using MapScan
	row := make(map[string]interface{})
	for iter.MapScan(row) {
		// Copy the row to avoid overwriting
		rowCopy := make(map[string]interface{})
		for k, v := range row {
			rowCopy[k] = v
		}
		results = append(results, rowCopy)
		row = make(map[string]interface{}) // Reset for next row
	}

	// Convert column names to string slice
	var resultColumns []types.ColumnInfo
	for _, name := range columnNames {
		resultColumns = append(resultColumns, types.ColumnInfo{
			Name: name.String(),
			Type: name.TypeInfo.Type().String(),
		})
	}

	return &types.QueryResult{
		Columns: resultColumns,
		Rows:    results,
		Count:   int64(len(results)),
	}, nil
}

// GetSchema retrieves schema information from ScyllaDB
func (a *ScyllaDBAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	if a.session == nil {
		return nil, fmt.Errorf("not connected to ScyllaDB")
	}

	schema := &types.SchemaInfo{
		Tables: []types.TableInfo{},
	}

	// Get all tables in the keyspace
	tableQuery := "SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?"
	iter := a.session.Query(tableQuery, a.conn.Database).Iter()

	var tableName string
	for iter.Scan(&tableName) {
		// Get table columns
		columns, err := a.getTableColumns(ctx, tableName)
		if err != nil {
			a.logger.Warnf("Failed to get columns for table %s: %v", tableName, err)
			continue
		}

		table := types.TableInfo{
			Name:    tableName,
			Schema:  a.conn.Database,
			Columns: convertToColumnInfoSlice(columns),
		}
		schema.Tables = append(schema.Tables, table)
	}

	if err := iter.Close(); err != nil {
		return nil, fmt.Errorf("failed to scan tables: %w", err)
	}

	return schema, nil
}

// Shutdown closes the connection
func (a *ScyllaDBAdapter) Shutdown(ctx context.Context) error {
	return a.Close()
}

// Ping checks the connection
func (a *ScyllaDBAdapter) Ping(ctx context.Context) error {
	return a.healthCheck(ctx)
}

// HealthCheck checks the health of the connection (alias for Ping)
func (a *ScyllaDBAdapter) HealthCheck(ctx context.Context) error {
	return a.Ping(ctx)
}

// TestConnection tests the connection
func (a *ScyllaDBAdapter) TestConnection(ctx context.Context) error {
	return a.healthCheck(ctx)
}

// GetMetrics returns connection metrics
func (a *ScyllaDBAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return &types.ConnectionMetrics{
		LastUpdated: time.Now(),
		DatabaseInfo: types.DatabaseInfo{
			Engine: "scylladb",
		},
	}, nil
}

// BeginTransaction starts a new transaction (limited support in ScyllaDB)
func (a *ScyllaDBAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	// ScyllaDB has limited transaction support
	// Only lightweight transactions for conditional updates
	return nil, fmt.Errorf("transactions not supported for ScyllaDB adapter")
}

// GetTableInfo retrieves information about a specific table
func (a *ScyllaDBAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	columns, err := a.getTableColumns(ctx, tableName)
	if err != nil {
		return nil, err
	}

	return &types.TableInfo{
		Name:    tableName,
		Schema:  a.conn.Database,
		Columns: convertToColumnInfoSlice(columns),
	}, nil
}

// GetColumns returns column information for a specific table
func (a *ScyllaDBAdapter) GetColumns(ctx context.Context, table string) ([]types.ColumnInfo, error) {
	ptrCols, err := a.getTableColumns(ctx, table)
	if err != nil {
		return nil, err
	}
	// Convert pointers to values
	cols := make([]types.ColumnInfo, len(ptrCols))
	for i, c := range ptrCols {
		if c != nil {
			cols[i] = *c
		}
	}
	return cols, nil
}

// GetConnectionInfo returns connection information
func (a *ScyllaDBAdapter) GetConnectionInfo() *entities.Connection {
	return a.conn
}

// Helper methods

func (a *ScyllaDBAdapter) healthCheck(ctx context.Context) error {
	if a.session == nil {
		return fmt.Errorf("not connected to ScyllaDB")
	}

	// Simple health check using system tables
	query := "SELECT now() FROM system.local"
	iter := a.session.Query(query).Iter()
	defer iter.Close()

	var now time.Time
	if !iter.Scan(&now) {
		return fmt.Errorf("health check failed")
	}

	// Try to get ScyllaDB version information
	versionQuery := "SELECT release_version FROM system.local"
	versionIter := a.session.Query(versionQuery).Iter()
	defer versionIter.Close()

	var version string
	if versionIter.Scan(&version) {
		a.logger.Infof("ScyllaDB version: %s", version)
	}

	return nil
}

func (a *ScyllaDBAdapter) getTableColumns(ctx context.Context, tableName string) ([]*types.ColumnInfo, error) {
	query := `
		SELECT column_name, type, kind
		FROM system_schema.columns
		WHERE keyspace_name = ? AND table_name = ?
		ORDER BY position
	`

	iter := a.session.Query(query, a.conn.Database, tableName).Iter()
	defer iter.Close()

	var columns []*types.ColumnInfo
	var columnName, columnType, columnKind string

	for iter.Scan(&columnName, &columnType, &columnKind) {
		column := &types.ColumnInfo{
			Name:     columnName,
			Type:     a.mapScyllaDBType(columnType),
			Nullable: columnKind != "partition_key" && columnKind != "clustering",
		}

		// Mark primary key columns
		if columnKind == "partition_key" {
			column.IsPrimaryKey = true
		}

		columns = append(columns, column)
	}

	if err := iter.Close(); err != nil {
		return nil, fmt.Errorf("failed to scan columns: %w", err)
	}

	return columns, nil
}

func (a *ScyllaDBAdapter) mapScyllaDBType(scyllaType string) string {
	// Map ScyllaDB types to standard types (same as Cassandra)
	switch {
	case hasPrefixIgnoreCase(scyllaType, "text"), hasPrefixIgnoreCase(scyllaType, "varchar"):
		return "string"
	case hasPrefixIgnoreCase(scyllaType, "int"):
		return "integer"
	case hasPrefixIgnoreCase(scyllaType, "bigint"):
		return "bigint"
	case hasPrefixIgnoreCase(scyllaType, "double"), hasPrefixIgnoreCase(scyllaType, "float"):
		return "double"
	case hasPrefixIgnoreCase(scyllaType, "boolean"):
		return "boolean"
	case hasPrefixIgnoreCase(scyllaType, "timestamp"):
		return "timestamp"
	case hasPrefixIgnoreCase(scyllaType, "uuid"):
		return "uuid"
	case hasPrefixIgnoreCase(scyllaType, "timeuuid"):
		return "timeuuid"
	case hasPrefixIgnoreCase(scyllaType, "decimal"):
		return "decimal"
	case hasPrefixIgnoreCase(scyllaType, "varint"):
		return "bigint"
	case hasPrefixIgnoreCase(scyllaType, "blob"):
		return "blob"
	case hasPrefixIgnoreCase(scyllaType, "list"), hasPrefixIgnoreCase(scyllaType, "set"), hasPrefixIgnoreCase(scyllaType, "map"):
		return "json" // Complex types as JSON
	default:
		return scyllaType
	}
}

// convertToColumnInfoSlice converts []*types.ColumnInfo to []types.ColumnInfo
func convertToColumnInfoSlice(ptrSlice []*types.ColumnInfo) []types.ColumnInfo {
	slice := make([]types.ColumnInfo, len(ptrSlice))
	for i, col := range ptrSlice {
		if col != nil {
			slice[i] = *col
		}
	}
	return slice
}

func hasPrefixIgnoreCase(s, prefix string) bool {
	return len(s) >= len(prefix) && s[:len(prefix)] == prefix
}

// ScyllaDBTransaction - transactions not supported for ScyllaDB
// Would need to implement transaction interface if added to types package
