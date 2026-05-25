package aws

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/gocql/gocql"
	"github.com/sirupsen/logrus"
)

// KeyspacesAdapter provides connectivity to Amazon Keyspaces (Apache Cassandra-compatible)
type KeyspacesAdapter struct {
	conn    *entities.Connection
	session *gocql.Session
	logger  *logrus.Logger
}

// NewKeyspacesAdapter creates a new Keyspaces adapter
func NewKeyspacesAdapter(conn *entities.Connection) *KeyspacesAdapter {
	return &KeyspacesAdapter{
		conn:   conn,
		logger: logrus.New(),
	}
}

// Connect establishes a connection to Amazon Keyspaces
func (a *KeyspacesAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	a.conn = conn

	// Build cluster configuration
	cluster := gocql.NewCluster(a.conn.Host)

	// Keyspaces specific configuration
	cluster.Port = a.conn.Port
	cluster.Keyspace = a.conn.Database

	// Authentication
	if a.conn.Username != "" && a.conn.Password != "" {
		cluster.Authenticator = gocql.PasswordAuthenticator{
			Username: a.conn.Username,
			Password: a.conn.Password,
		}
	}

	// SSL/TLS configuration (required for Keyspaces)
	cluster.SslOpts = &gocql.SslOptions{
		CaPath:                 a.getStringOption("ca_path", ""),
		CertPath:               a.getStringOption("cert_path", ""),
		KeyPath:                a.getStringOption("key_path", ""),
		EnableHostVerification: !a.getBoolOption("insecure_skip_verify", false),
	}

	// Connection pool settings
	cluster.NumConns = a.getIntOption("num_conns", 2)
	cluster.Timeout = time.Duration(a.getIntOption("timeout", 10)) * time.Second

	// Consistency level (Keyspaces defaults to LOCAL_QUORUM)
	consistency := gocql.ParseConsistency(a.getStringOption("consistency", "LOCAL_QUORUM"))
	cluster.Consistency = consistency

	// Retry policy for Keyspaces
	cluster.RetryPolicy = &gocql.SimpleRetryPolicy{
		NumRetries: 3,
	}

	// Create session
	session, err := cluster.CreateSession()
	if err != nil {
		return fmt.Errorf("failed to connect to Keyspaces: %w", err)
	}

	a.session = session
	a.logger.Info("Successfully connected to Amazon Keyspaces")
	return nil
}

// Disconnect closes the Keyspaces connection
func (a *KeyspacesAdapter) Disconnect(ctx context.Context) error {
	return a.Close()
}

// Close closes the Keyspaces connection
func (a *KeyspacesAdapter) Close() error {
	if a.session != nil {
		a.session.Close()
		a.session = nil
		a.logger.Info("Keyspaces connection closed")
	}
	return nil
}

// IsConnected checks if the adapter is connected
func (a *KeyspacesAdapter) IsConnected() bool {
	return a.session != nil && !a.session.Closed()
}

// ExecuteQuery executes a CQL query against Keyspaces
func (a *KeyspacesAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	if a.session == nil {
		return nil, fmt.Errorf("not connected to Keyspaces")
	}

	startTime := time.Now()

	// Execute query with context
	iter := a.session.Query(query, params...).WithContext(ctx).Iter()
	defer iter.Close()

	// Get column information
	columnNames := iter.Columns()
	if len(columnNames) == 0 {
		// For DDL queries or queries without results
		return &types.QueryResult{
			Query:         query,
			RowsAffected:  0,
			ExecutionTime: time.Since(startTime).Milliseconds(),
			Success:       true,
		}, nil
	}

	// Scan results
	var results []map[string]interface{}

	// Create slice of interfaces for scanning
	row := make(map[string]interface{})
	for iter.MapScan(row) {
		results = append(results, row)
		row = make(map[string]interface{})
	}

	executionTime := time.Since(startTime)

	// Convert column names to types.ColumnInfo format
	columns := make([]types.ColumnInfo, len(columnNames))
	for i, colInfo := range columnNames {
		columns[i] = types.ColumnInfo{
			Name:     colInfo.Name,
			Type:     colInfo.TypeInfo.Type().String(), // Use TypeInfo string representation
			Nullable: true,
		}
	}

	return &types.QueryResult{
		Query:         query,
		Rows:          results,
		Columns:       columns,
		RowsAffected:  int64(len(results)),
		ExecutionTime: executionTime.Milliseconds(),
		Success:       true,
	}, nil
}

// GetSchema retrieves schema information from Keyspaces
func (a *KeyspacesAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	if a.session == nil {
		return nil, fmt.Errorf("not connected to Keyspaces")
	}

	schema := &types.SchemaInfo{
		Tables: make([]types.TableInfo, 0),
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
			Type:    "table",
			Columns: columns,
		}
		schema.Tables = append(schema.Tables, table)
	}

	if err := iter.Close(); err != nil {
		return nil, fmt.Errorf("failed to scan tables: %w", err)
	}

	return schema, nil
}

// GetTables returns a list of tables in the keyspace
func (a *KeyspacesAdapter) GetTables(ctx context.Context) ([]string, error) {
	if a.session == nil {
		return nil, fmt.Errorf("not connected to Keyspaces")
	}

	query := "SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?"
	iter := a.session.Query(query, a.conn.Database).Iter()
	defer iter.Close()

	var tables []string
	var tableName string
	for iter.Scan(&tableName) {
		tables = append(tables, tableName)
	}

	if err := iter.Close(); err != nil {
		return nil, fmt.Errorf("failed to scan tables: %w", err)
	}

	return tables, nil
}

// GetColumns returns column information for a specific table
func (a *KeyspacesAdapter) GetColumns(ctx context.Context, table string) ([]types.ColumnInfo, error) {
	return a.getTableColumns(ctx, table)
}

// GetTableInfo retrieves information about a specific table
func (a *KeyspacesAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	columns, err := a.GetColumns(ctx, tableName)
	if err != nil {
		return nil, err
	}
	return &types.TableInfo{
		Name:    tableName,
		Type:    "table",
		Columns: columns,
	}, nil
}

// BeginTransaction starts a new transaction (limited support in Cassandra)
func (a *KeyspacesAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	// Cassandra/Keyspaces has limited transaction support
	// Only lightweight transactions for conditional updates
	return &KeyspacesTransaction{adapter: a}, nil
}

// HealthCheck checks the health of the Keyspaces connection
func (a *KeyspacesAdapter) HealthCheck(ctx context.Context) error {
	if a.session == nil {
		return fmt.Errorf("not connected to Keyspaces")
	}

	// Simple health check using system tables
	query := "SELECT now() FROM system.local"
	iter := a.session.Query(query).Iter()
	defer iter.Close()

	var now time.Time
	if !iter.Scan(&now) {
		return fmt.Errorf("health check failed")
	}

	return nil
}

// GetMetadata retrieves metadata about the Keyspaces connection
func (a *KeyspacesAdapter) GetMetadata() map[string]interface{} {
	return map[string]interface{}{
		"engine":                "keyspaces",
		"cassandra_compatible":  true,
		"distributed":           true,
		"eventual_consistency":  true,
		"tunable_consistency":   true,
		"region":                a.getStringOption("region", "us-east-1"),
		"keyspace":              a.conn.Database,
		"supports_transactions": false,
	}
}

// GetConnectionInfo returns the connection info
func (a *KeyspacesAdapter) GetConnectionInfo() *entities.Connection {
	return a.conn
}

// Ping checks connectivity
func (a *KeyspacesAdapter) Ping(ctx context.Context) error {
	return a.HealthCheck(ctx)
}

// TestConnection tests the connection
func (a *KeyspacesAdapter) TestConnection(ctx context.Context) error {
	return a.HealthCheck(ctx)
}

// GetMetrics returns connection metrics (stub)
func (a *KeyspacesAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return &types.ConnectionMetrics{
		LastUpdated: time.Now(),
		DatabaseInfo: types.DatabaseInfo{
			Engine:  "keyspaces",
			Version: "Unknown",
		},
	}, nil
}

// Helper methods

func (a *KeyspacesAdapter) getTableColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	query := `
		SELECT column_name, type, kind
		FROM system_schema.columns
		WHERE keyspace_name = ? AND table_name = ?
		ORDER BY position
	`

	iter := a.session.Query(query, a.conn.Database, tableName).Iter()
	defer iter.Close()

	var columns []types.ColumnInfo
	var columnName, columnType, columnKind string

	for iter.Scan(&columnName, &columnType, &columnKind) {
		column := types.ColumnInfo{
			Name:     columnName,
			Type:     a.mapCassandraType(columnType),
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

func (a *KeyspacesAdapter) mapCassandraType(cassandraType string) string {
	// Map Cassandra types to standard types
	switch {
	case hasPrefixIgnoreCase(cassandraType, "text"), hasPrefixIgnoreCase(cassandraType, "varchar"):
		return "string"
	case hasPrefixIgnoreCase(cassandraType, "int"):
		return "integer"
	case hasPrefixIgnoreCase(cassandraType, "bigint"):
		return "bigint"
	case hasPrefixIgnoreCase(cassandraType, "double"), hasPrefixIgnoreCase(cassandraType, "float"):
		return "double"
	case hasPrefixIgnoreCase(cassandraType, "boolean"):
		return "boolean"
	case hasPrefixIgnoreCase(cassandraType, "timestamp"):
		return "timestamp"
	case hasPrefixIgnoreCase(cassandraType, "uuid"):
		return "uuid"
	case hasPrefixIgnoreCase(cassandraType, "timeuuid"):
		return "timeuuid"
	case hasPrefixIgnoreCase(cassandraType, "decimal"):
		return "decimal"
	case hasPrefixIgnoreCase(cassandraType, "varint"):
		return "bigint"
	case hasPrefixIgnoreCase(cassandraType, "blob"):
		return "blob"
	case hasPrefixIgnoreCase(cassandraType, "list"), hasPrefixIgnoreCase(cassandraType, "set"), hasPrefixIgnoreCase(cassandraType, "map"):
		return "json" // Complex types as JSON
	default:
		return cassandraType
	}
}

func hasPrefixIgnoreCase(s, prefix string) bool {
	return len(s) >= len(prefix) && s[:len(prefix)] == prefix
}

func (a *KeyspacesAdapter) getStringOption(key, defaultValue string) string {
	if val, ok := a.conn.Options[key]; ok {
		return val
	}
	return defaultValue
}

func (a *KeyspacesAdapter) getIntOption(key string, defaultValue int) int {
	if val, ok := a.conn.Options[key]; ok {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return defaultValue
}

func (a *KeyspacesAdapter) getBoolOption(key string, defaultValue bool) bool {
	if val, ok := a.conn.Options[key]; ok {
		if b, err := strconv.ParseBool(val); err == nil {
			return b
		}
	}
	return defaultValue
}

// KeyspacesTransaction implements a limited transaction interface
type KeyspacesTransaction struct {
	adapter *KeyspacesAdapter
}

func (t *KeyspacesTransaction) Commit() error {
	// Keyspaces doesn't support traditional transactions
	// This is a no-op for consistency with the interface
	return nil
}

func (t *KeyspacesTransaction) Rollback() error {
	// Keyspaces doesn't support traditional transactions
	return nil
}

func (t *KeyspacesTransaction) IsActive() bool {
	return false
}
