package nosql

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/gocql/gocql"
	"github.com/sirupsen/logrus"
)

// CassandraAdapter implements DatabaseAdapter for Apache Cassandra
type CassandraAdapter struct {
	conn    *entities.Connection
	session *gocql.Session
	cluster *gocql.ClusterConfig
	mutex   sync.RWMutex
	logger  *logrus.Logger
}

// Connect establishes a connection to Cassandra
func (c *CassandraAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if c.session != nil {
		return nil // Already connected
	}

	// Update connection info
	c.conn = conn

	// Create cluster configuration
	cluster := gocql.NewCluster(conn.Host)
	cluster.Port = conn.Port
	cluster.Keyspace = conn.Database

	// Set authentication if provided
	if conn.Username != "" && conn.Password != "" {
		cluster.Authenticator = gocql.PasswordAuthenticator{
			Username: conn.Username,
			Password: conn.Password,
		}
	}

	// Configure SSL if enabled
	if conn.SSL {
		cluster.SslOpts = &gocql.SslOptions{
			EnableHostVerification: false, // Can be configured via options
		}
	}

	// Set consistency level from options
	if consistency := conn.Options["consistency"]; consistency != "" {
		switch strings.ToUpper(consistency) {
		case "ONE":
			cluster.Consistency = gocql.One
		case "TWO":
			cluster.Consistency = gocql.Two
		case "THREE":
			cluster.Consistency = gocql.Three
		case "QUORUM":
			cluster.Consistency = gocql.Quorum
		case "ALL":
			cluster.Consistency = gocql.All
		case "LOCAL_QUORUM":
			cluster.Consistency = gocql.LocalQuorum
		case "EACH_QUORUM":
			cluster.Consistency = gocql.EachQuorum
		case "LOCAL_ONE":
			cluster.Consistency = gocql.LocalOne
		default:
			cluster.Consistency = gocql.Quorum // Default
		}
	} else {
		cluster.Consistency = gocql.Quorum
	}

	// Set timeout from options
	if timeout := conn.Options["timeout"]; timeout != "" {
		if duration, err := time.ParseDuration(timeout); err == nil {
			cluster.Timeout = duration
		}
	} else {
		cluster.Timeout = 10 * time.Second
	}

	// Create session
	session, err := cluster.CreateSession()
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_FAILED",
			Message: "Failed to create Cassandra session",
			Details: err.Error(),
		}
	}

	c.cluster = cluster
	c.session = session
	c.logger.Infof("Connected to Cassandra: %s", conn.Name)

	return nil
}

// Disconnect closes the Cassandra connection
func (c *CassandraAdapter) Disconnect(ctx context.Context) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if c.session == nil {
		return nil // Already disconnected
	}

	c.session.Close()
	c.session = nil
	c.cluster = nil
	c.logger.Infof("Disconnected from Cassandra: %s", c.conn.Name)

	return nil
}

// IsConnected returns true if the adapter is connected to Cassandra
func (c *CassandraAdapter) IsConnected() bool {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	return c.session != nil && !c.session.Closed()
}

// TestConnection tests if the Cassandra connection is valid
func (c *CassandraAdapter) TestConnection(ctx context.Context) error {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	if c.session == nil {
		return &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Cassandra",
		}
	}

	if c.session.Closed() {
		return &types.AdapterError{
			Code:    "CONNECTION_CLOSED",
			Message: "Cassandra session is closed",
		}
	}

	// Test with a simple query
	query := "SELECT release_version FROM system.local"
	iter := c.session.Query(query).Iter()
	defer iter.Close()

	var version string
	if !iter.Scan(&version) {
		if err := iter.Close(); err != nil {
			return &types.AdapterError{
				Code:    "CONNECTION_TEST_FAILED",
				Message: "Connection test failed",
				Details: err.Error(),
			}
		}
	}

	return nil
}

// ExecuteQuery executes a CQL query
func (c *CassandraAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	if c.session == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Cassandra",
		}
	}

	// Trim and validate query
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, &types.AdapterError{
			Code:    "EMPTY_QUERY",
			Message: "Query cannot be empty",
		}
	}

	// Execute query
	iter := c.session.Query(query, params...).Iter()
	defer iter.Close()

	// Get column information
	iterColumns := iter.Columns()
	var columns []types.ColumnInfo
	for _, col := range iterColumns {
		columns = append(columns, types.ColumnInfo{
			Name: col.Name,
			Type: col.TypeInfo.Type().String(), // Use TypeInfo from gocql
		})
	}

	// Collect rows
	var rows []map[string]interface{}
	for {
		row := make(map[string]interface{})
		if !iter.MapScan(row) {
			break
		}
		rows = append(rows, row)
	}

	// Check for errors
	if err := iter.Close(); err != nil {
		return nil, &types.AdapterError{
			Code:    "QUERY_EXECUTION_FAILED",
			Message: "Failed to execute CQL query",
			Details: err.Error(),
		}
	}

	return &types.QueryResult{
		Columns: columns,
		Rows:    rows,
		Count:   int64(len(rows)),
	}, nil
}

// GetSchema retrieves Cassandra keyspace and table information
func (c *CassandraAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	if c.session == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Cassandra",
		}
	}

	// Query to get all tables in the current keyspace
	query := `
		SELECT table_name 
		FROM system_schema.tables 
		WHERE keyspace_name = ?
	`

	iter := c.session.Query(query, c.conn.Database).Iter()
	defer iter.Close()

	var tables []types.TableInfo
	var tableName string
	for iter.Scan(&tableName) {
		// Get detailed table information
		tableInfo, err := c.GetTableInfo(ctx, tableName)
		if err != nil {
			c.logger.Warnf("Failed to get table info for %s: %v", tableName, err)
			// Continue with basic info
			tableInfo = &types.TableInfo{
				Name:   tableName,
				Schema: c.conn.Database,
			}
		}

		tables = append(tables, *tableInfo)
	}

	if err := iter.Close(); err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_QUERY_FAILED",
			Message: "Failed to query Cassandra schema",
			Details: err.Error(),
		}
	}

	return &types.SchemaInfo{
		Tables: tables,
	}, nil
}

// GetTableInfo retrieves information about a specific Cassandra table
func (c *CassandraAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	if c.session == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Cassandra",
		}
	}

	// Get column information
	columns, err := c.getTableColumns(tableName)
	if err != nil {
		return nil, err
	}

	// Get index information
	indexes, err := c.getTableIndexes(tableName)
	if err != nil {
		c.logger.Warnf("Failed to get indexes for table %s: %v", tableName, err)
		indexes = []types.IndexInfo{} // Continue without indexes
	}

	return &types.TableInfo{
		Name:    tableName,
		Schema:  c.conn.Database,
		Columns: columns,
		Indexes: indexes,
	}, nil
}

// Shutdown closes the connection
func (c *CassandraAdapter) Shutdown(ctx context.Context) error {
	return c.Disconnect(ctx)
}

// Ping checks the connection
func (c *CassandraAdapter) Ping(ctx context.Context) error {
	return c.TestConnection(ctx)
}

// GetMetrics returns connection metrics
func (c *CassandraAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return &types.ConnectionMetrics{
		LastUpdated: time.Now(),
		DatabaseInfo: types.DatabaseInfo{
			Engine: "cassandra",
		},
	}, nil
}

// BeginTransaction starts a new transaction
func (c *CassandraAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	// Cassandra supports lightweight transactions (LWT) but they are restricted.
	// For general interface, we might say not supported broadly.
	return nil, fmt.Errorf("transactions not supported in Cassandra adapter")
}

// GetColumns returns a list of columns for a table
func (c *CassandraAdapter) GetColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	return c.getTableColumns(tableName)
}

// GetConnectionInfo returns the connection information
func (c *CassandraAdapter) GetConnectionInfo() *entities.Connection {
	return c.conn
}

// Helper methods

func (c *CassandraAdapter) getTableColumns(tableName string) ([]types.ColumnInfo, error) {
	query := `
		SELECT column_name, type, kind
		FROM system_schema.columns 
		WHERE keyspace_name = ? AND table_name = ?
		ORDER BY position
	`

	iter := c.session.Query(query, c.conn.Database, tableName).Iter()
	defer iter.Close()

	var columns []types.ColumnInfo
	var columnName, columnType, kind string

	for iter.Scan(&columnName, &columnType, &kind) {
		column := types.ColumnInfo{
			Name:         columnName,
			Type:         columnType,
			Nullable:     kind != "partition_key" && kind != "clustering", // Keys are not nullable
			IsPrimaryKey: kind == "partition_key",
		}

		columns = append(columns, column)
	}

	if err := iter.Close(); err != nil {
		return nil, &types.AdapterError{
			Code:    "COLUMN_QUERY_FAILED",
			Message: "Failed to query table columns",
			Details: err.Error(),
		}
	}

	return columns, nil
}

func (c *CassandraAdapter) getTableIndexes(tableName string) ([]types.IndexInfo, error) {
	query := `
		SELECT index_name, options
		FROM system_schema.indexes 
		WHERE keyspace_name = ? AND table_name = ?
	`

	iter := c.session.Query(query, c.conn.Database, tableName).Iter()
	defer iter.Close()

	var indexes []types.IndexInfo
	var indexName string
	var options map[string]string

	for iter.Scan(&indexName, &options) {
		// Extract target column from options
		var indexColumns []string
		if target, exists := options["target"]; exists {
			indexColumns = []string{target}
		}

		indexes = append(indexes, types.IndexInfo{
			Name:    indexName,
			Columns: indexColumns,
			Unique:  false, // Cassandra secondary indexes are not unique
		})
	}

	return indexes, iter.Close()
}

// HealthCheck checks the health of the connection (alias for TestConnection)
func (c *CassandraAdapter) HealthCheck(ctx context.Context) error {
	return c.TestConnection(ctx)
}
