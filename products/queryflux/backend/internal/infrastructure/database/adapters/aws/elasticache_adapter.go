package aws

import (
	"context"
	"crypto/tls"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/redis/go-redis/v9"
	"github.com/sirupsen/logrus"
)

// ElastiCacheAdapter implements DatabaseAdapter for AWS ElastiCache
// ElastiCache is Redis-compatible and uses the Redis protocol
type ElastiCacheAdapter struct {
	conn   *entities.Connection
	client redis.UniversalClient
	mutex  sync.RWMutex
	logger *logrus.Logger
}

// Connect establishes a connection to AWS ElastiCache
func (e *ElastiCacheAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	e.mutex.Lock()
	defer e.mutex.Unlock()

	if e.client != nil {
		return nil // Already connected
	}

	// Update connection info
	e.conn = conn

	// Parse database number
	db := 0
	if conn.Database != "" {
		if dbNum, err := strconv.Atoi(conn.Database); err == nil {
			db = dbNum
		}
	}

	// Check if this is a cluster mode enabled configuration
	if e.isClusterMode(conn) {
		// Create cluster client for ElastiCache Cluster Mode
		clusterOptions := &redis.ClusterOptions{
			Addrs:    []string{fmt.Sprintf("%s:%d", conn.Host, conn.Port)},
			Password: conn.Password,
		}

		// ElastiCache supports TLS/SSL in transit encryption
		if conn.SSL {
			clusterOptions.TLSConfig = &tls.Config{
				MinVersion: tls.VersionTLS12,
			}
		}

		// Set connection pool options
		clusterOptions.PoolSize = 10
		clusterOptions.MinIdleConns = 2
		clusterOptions.ConnMaxIdleTime = 30 * time.Minute
		clusterOptions.DialTimeout = 10 * time.Second
		clusterOptions.ReadTimeout = 5 * time.Second
		clusterOptions.WriteTimeout = 5 * time.Second

		e.client = redis.NewClusterClient(clusterOptions)
	} else {
		// Create single-node client for ElastiCache (non-cluster mode)
		options := &redis.Options{
			Addr:     fmt.Sprintf("%s:%d", conn.Host, conn.Port),
			Password: conn.Password,
			DB:       db,
		}

		// ElastiCache supports TLS/SSL in transit encryption
		if conn.SSL {
			options.TLSConfig = &tls.Config{
				MinVersion: tls.VersionTLS12,
			}
		}

		// Set connection pool options
		options.PoolSize = 10
		options.MinIdleConns = 2
		options.ConnMaxIdleTime = 30 * time.Minute
		options.DialTimeout = 10 * time.Second
		options.ReadTimeout = 5 * time.Second
		options.WriteTimeout = 5 * time.Second

		e.client = redis.NewClient(options)
	}

	// Test the connection
	if err := e.client.Ping(ctx).Err(); err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_FAILED",
			Message: "Failed to connect to AWS ElastiCache",
			Details: err.Error(),
		}
	}

	e.logger.Infof("Connected to AWS ElastiCache: %s", conn.Name)

	return nil
}

// Disconnect closes the ElastiCache connection
func (e *ElastiCacheAdapter) Disconnect(ctx context.Context) error {
	e.mutex.Lock()
	defer e.mutex.Unlock()

	if e.client == nil {
		return nil // Already disconnected
	}

	if err := e.client.Close(); err != nil {
		return &types.AdapterError{
			Code:    "DISCONNECT_FAILED",
			Message: "Failed to disconnect from AWS ElastiCache",
			Details: err.Error(),
		}
	}

	e.client = nil
	e.logger.Infof("Disconnected from AWS ElastiCache: %s", e.conn.Name)

	return nil
}

// TestConnection tests if the ElastiCache connection is valid
func (e *ElastiCacheAdapter) TestConnection(ctx context.Context) error {
	e.mutex.RLock()
	defer e.mutex.RUnlock()

	if e.client == nil {
		return &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	if err := e.client.Ping(ctx).Err(); err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Connection test failed",
			Details: err.Error(),
		}
	}

	return nil
}

// ExecuteQuery executes an ElastiCache command (Redis-compatible)
func (e *ElastiCacheAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	e.mutex.RLock()
	defer e.mutex.RUnlock()

	if e.client == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// Trim and validate command
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, &types.AdapterError{
			Code:    "EMPTY_QUERY",
			Message: "Query cannot be empty",
		}
	}

	// Parse Redis command
	parts := strings.Fields(query)
	if len(parts) == 0 {
		return nil, &types.AdapterError{
			Code:    "INVALID_COMMAND",
			Message: "Invalid Redis command",
		}
	}

	command := strings.ToUpper(parts[0])
	args := parts[1:]

	// Convert args to interface{} slice
	cmdArgs := make([]interface{}, len(args))
	for i, arg := range args {
		cmdArgs[i] = arg
	}

	// Execute Redis command
	result, err := e.client.Do(ctx, append([]interface{}{command}, cmdArgs...)...).Result()
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "COMMAND_EXECUTION_FAILED",
			Message: "Failed to execute ElastiCache command",
			Details: err.Error(),
		}
	}

	// Format result
	return e.formatResult(command, result), nil
}

// GetSchema retrieves ElastiCache schema information
func (e *ElastiCacheAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	e.mutex.RLock()
	defer e.mutex.RUnlock()

	if e.client == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// Get keyspace info
	info, err := e.client.Info(ctx, "keyspace").Result()
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_QUERY_FAILED",
			Message: "Failed to get ElastiCache keyspace info",
			Details: err.Error(),
		}
	}

	// Parse database info
	var tables []types.TableInfo
	lines := strings.Split(info, "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "db") {
			parts := strings.Split(line, ":")
			if len(parts) == 2 {
				dbName := parts[0]
				tables = append(tables, types.TableInfo{
					Name:   dbName,
					Schema: "ElastiCache",
				})
			}
		}
	}

	return &types.SchemaInfo{
		Tables: tables,
	}, nil
}

// GetTableInfo retrieves information about a specific ElastiCache database
func (e *ElastiCacheAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	e.mutex.RLock()
	defer e.mutex.RUnlock()

	if e.client == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// Get database size
	_, err := e.client.DBSize(ctx).Result()
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "TABLE_INFO_FAILED",
			Message: "Failed to get ElastiCache database info",
			Details: err.Error(),
		}
	}

	return &types.TableInfo{
		Name:   tableName,
		Schema: "ElastiCache",
		Columns: []types.ColumnInfo{
			{
				Name: "keys",
				Type: "integer",
			},
		},
	}, nil
}

// IsConnected returns true if the adapter is connected to ElastiCache
func (e *ElastiCacheAdapter) IsConnected() bool {
	e.mutex.RLock()
	defer e.mutex.RUnlock()

	return e.client != nil
}

// GetConnectionInfo returns the connection information
func (e *ElastiCacheAdapter) GetConnectionInfo() *entities.Connection {
	return e.conn
}

// isClusterMode checks if the connection is configured for cluster mode
func (e *ElastiCacheAdapter) isClusterMode(conn *entities.Connection) bool {
	// Check connection options for cluster mode indicator
	if mode, ok := conn.Options["cluster_mode"]; ok {
		return mode == "enabled" || mode == "true"
	}
	return false
}

// formatResult formats Redis command result into QueryResult
func (e *ElastiCacheAdapter) formatResult(command string, result interface{}) *types.QueryResult {
	switch v := result.(type) {
	case string:
		return &types.QueryResult{
			Columns: e.toColumnInfo([]string{"result"}),
			Rows: []map[string]interface{}{
				{"result": v},
			},
			Count: 1,
		}
	case int64:
		return &types.QueryResult{
			Columns: e.toColumnInfo([]string{"result"}),
			Rows: []map[string]interface{}{
				{"result": v},
			},
			Count: 1,
		}
	case []interface{}:
		rows := make([]map[string]interface{}, len(v))
		for i, item := range v {
			rows[i] = map[string]interface{}{
				"value": item,
			}
		}
		return &types.QueryResult{
			Columns: e.toColumnInfo([]string{"value"}),
			Rows:    rows,
			Count:   int64(len(rows)),
		}
	default:
		return &types.QueryResult{
			Columns: e.toColumnInfo([]string{"result"}),
			Rows: []map[string]interface{}{
				{"result": fmt.Sprintf("%v", v)},
			},
			Count: 1,
		}
	}
}
func (e *ElastiCacheAdapter) toColumnInfo(names []string) []types.ColumnInfo {
	columns := make([]types.ColumnInfo, len(names))
	for i, name := range names {
		columns[i] = types.ColumnInfo{
			Name: name,
			Type: "string", // Default to string
		}
	}
	return columns
}

// HealthCheck checks the health of the connection
func (e *ElastiCacheAdapter) HealthCheck(ctx context.Context) error {
	return e.TestConnection(ctx)
}

// Ping pings the database
func (e *ElastiCacheAdapter) Ping(ctx context.Context) error {
	return e.TestConnection(ctx)
}

// GetMetrics retrieves connection metrics
func (e *ElastiCacheAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	if e.client == nil {
		return nil, &types.AdapterError{Code: "NOT_CONNECTED", Message: "Not connected"}
	}

	poolStats := e.client.PoolStats()
	return &types.ConnectionMetrics{
		ConnectionPoolStats: types.ConnectionPoolStats{
			OpenConnections:    int(poolStats.TotalConns),
			IdleConnections:    int(poolStats.IdleConns),
			InUseConnections:   int(poolStats.TotalConns - poolStats.IdleConns),
			WaitCount:          int64(poolStats.Misses),
			WaitDuration:       0,
			MaxOpenConnections: 0,
		},
	}, nil
}

// BeginTransaction starts a new transaction
func (e *ElastiCacheAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	return nil, fmt.Errorf("transactions not supported yet for ElastiCache adapter")
}
