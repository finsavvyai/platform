package sql

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sirupsen/logrus"
)

// NeonAdapter handles Neon serverless PostgreSQL connections
type NeonAdapter struct {
	conn   *entities.Connection
	pool   *pgxpool.Pool
	mutex  sync.RWMutex
	logger *logrus.Logger
}

// Connect establishes a connection to Neon with serverless PostgreSQL configuration
func (n *NeonAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	n.mutex.Lock()
	defer n.mutex.Unlock()

	if n.pool != nil {
		return nil // Already connected
	}

	// Update connection info
	n.conn = conn

	connStr := n.buildConnectionString(conn)

	// Configure connection pool for serverless PostgreSQL
	config, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		return &types.AdapterError{
			Code:    "CONFIG_PARSE_ERROR",
			Message: "Failed to parse Neon connection configuration",
			Details: err.Error(),
		}
	}

	// Serverless PostgreSQL pool configuration
	// Neon handles connection pooling, so we use smaller pool
	config.MaxConns = 10
	config.MinConns = 2
	config.MaxConnLifetime = 5 * time.Minute // Shorter for serverless
	config.MaxConnIdleTime = 2 * time.Minute
	config.HealthCheckPeriod = 1 * time.Minute

	// Create connection pool
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_FAILED",
			Message: "Failed to create Neon connection pool",
			Details: err.Error(),
		}
	}

	// Test the connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Failed to ping Neon database",
			Details: err.Error(),
		}
	}

	// Verify Neon connection
	var version string
	err = pool.QueryRow(ctx, "SELECT version()").Scan(&version)
	if err != nil {
		pool.Close()
		return &types.AdapterError{
			Code:    "VERSION_CHECK_FAILED",
			Message: "Failed to verify Neon database version",
			Details: err.Error(),
		}
	}

	n.pool = pool
	n.logger.Infof("Successfully connected to Neon database: %s", conn.Name)

	return nil
}

// Disconnect closes the Neon connection
func (n *NeonAdapter) Disconnect(ctx context.Context) error {
	n.mutex.Lock()
	defer n.mutex.Unlock()

	if n.pool == nil {
		return nil // Already disconnected
	}

	n.pool.Close()
	n.pool = nil
	n.logger.Infof("Disconnected from Neon database: %s", n.conn.Name)

	return nil
}

// Shutdown closes the connection
func (n *NeonAdapter) Shutdown(ctx context.Context) error {
	return n.Disconnect(ctx)
}

// Ping checks the connection
func (n *NeonAdapter) Ping(ctx context.Context) error {
	return n.TestConnection(ctx)
}

// HealthCheck checks the health of the connection
func (n *NeonAdapter) HealthCheck(ctx context.Context) error {
	return n.Ping(ctx)
}

// GetMetrics returns connection metrics
func (n *NeonAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return &types.ConnectionMetrics{
		LastUpdated: time.Now(),
		DatabaseInfo: types.DatabaseInfo{
			Engine:  "neon",
			Version: "serverless",
		},
	}, nil
}

// BeginTransaction starts a new transaction
func (n *NeonAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	tx, err := n.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	return &NeonTransaction{tx: tx, ctx: ctx}, nil
}

type NeonTransaction struct {
	tx  pgx.Tx
	ctx context.Context
}

func (t *NeonTransaction) Commit() error {
	return t.tx.Commit(t.ctx)
}

func (t *NeonTransaction) Rollback() error {
	return t.tx.Rollback(t.ctx)
}

// GetColumns returns column information for a table
func (n *NeonAdapter) GetColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	info, err := n.GetTableInfo(ctx, tableName)
	if err != nil {
		return nil, err
	}
	return info.Columns, nil
}

// TestConnection tests the Neon connection
func (n *NeonAdapter) TestConnection(ctx context.Context) error {
	n.mutex.RLock()
	defer n.mutex.RUnlock()

	if n.pool == nil {
		return &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Neon",
		}
	}

	return n.pool.Ping(ctx)
}

// IsConnected returns whether the adapter is currently connected
func (n *NeonAdapter) IsConnected() bool {
	n.mutex.RLock()
	defer n.mutex.RUnlock()
	return n.pool != nil
}

// GetConnectionInfo returns the connection information
func (n *NeonAdapter) GetConnectionInfo() *entities.Connection {
	n.mutex.RLock()
	defer n.mutex.RUnlock()
	return n.conn
}

// buildConnectionString creates a Neon connection string
func (n *NeonAdapter) buildConnectionString(conn *entities.Connection) string {
	// Neon connection string format
	// postgresql://[user]:[password]@[endpoint]/[dbname]?sslmode=require

	var connStr string

	// Check if host contains neon.tech domain
	if strings.Contains(conn.Host, "neon.tech") || strings.Contains(conn.Host, "neon.cloud") {
		// Neon-specific format
		connStr = fmt.Sprintf("postgresql://%s:%s@%s/%s",
			conn.Username,
			conn.Password,
			conn.Host, // Neon host includes port
			conn.Database,
		)
	} else {
		// Standard PostgreSQL format
		connStr = fmt.Sprintf("postgresql://%s:%s@%s:%d/%s",
			conn.Username,
			conn.Password,
			conn.Host,
			conn.Port,
			conn.Database,
		)
	}

	// Neon requires SSL
	params := []string{"sslmode=require"}

	// Add connection pooling hint
	params = append(params, "application_name=queryflux")

	// Add pooler configuration for Neon
	if strings.Contains(conn.Host, "pooler") {
		params = append(params, "pool_mode=transaction")
	}

	return connStr + "?" + strings.Join(params, "&")
}

// ExecuteQuery executes a query on Neon
func (n *NeonAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	n.mutex.RLock()
	defer n.mutex.RUnlock()

	if n.pool == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Neon",
			Details: "Call Connect() before executing queries",
		}
	}

	trimmedQuery := strings.TrimSpace(strings.ToUpper(query))

	if strings.HasPrefix(trimmedQuery, "SELECT") || strings.HasPrefix(trimmedQuery, "SHOW") || strings.HasPrefix(trimmedQuery, "EXPLAIN") || strings.HasPrefix(trimmedQuery, "WITH") {
		return n.executeSelectQuery(ctx, query, params...)
	}

	return n.executeNonSelectQuery(ctx, query, params...)
}

// executeSelectQuery executes a SELECT query
func (n *NeonAdapter) executeSelectQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	rows, err := n.pool.Query(ctx, query, params...)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "QUERY_EXECUTION_FAILED",
			Message: "Failed to execute query",
			Details: err.Error(),
		}
	}
	defer rows.Close()

	// Get column descriptions
	fieldDescriptions := rows.FieldDescriptions()
	columns := make([]types.ColumnInfo, len(fieldDescriptions))
	colNames := make([]string, len(fieldDescriptions))

	for i, fd := range fieldDescriptions {
		name := string(fd.Name)
		colNames[i] = name
		columns[i] = types.ColumnInfo{
			Name: name,
			Type: fmt.Sprintf("%d", fd.DataTypeOID), // Use OID as type for now
		}
	}

	var resultRows []map[string]interface{}
	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return nil, &types.AdapterError{
				Code:    "ROW_SCAN_FAILED",
				Message: "Failed to scan row",
				Details: err.Error(),
			}
		}

		rowMap := make(map[string]interface{})
		for i, col := range colNames {
			rowMap[col] = n.convertValue(values[i])
		}
		resultRows = append(resultRows, rowMap)
	}

	if err := rows.Err(); err != nil {
		return nil, &types.AdapterError{
			Code:    "ROW_ITERATION_FAILED",
			Message: "Error iterating rows",
			Details: err.Error(),
		}
	}

	return &types.QueryResult{
		Columns: columns,
		Rows:    resultRows,
		Count:   int64(len(resultRows)),
	}, nil
}

// executeNonSelectQuery executes INSERT, UPDATE, DELETE queries
func (n *NeonAdapter) executeNonSelectQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	tag, err := n.pool.Exec(ctx, query, params...)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "QUERY_EXECUTION_FAILED",
			Message: "Failed to execute query",
			Details: err.Error(),
		}
	}

	rowsAffected := tag.RowsAffected()

	return &types.QueryResult{
		Columns: []types.ColumnInfo{{Name: "rows_affected", Type: "int64"}},
		Rows: []map[string]interface{}{
			{"rows_affected": rowsAffected},
		},
		Count: rowsAffected,
	}, nil
}

// GetSchema retrieves the database schema for Neon
func (n *NeonAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	n.mutex.RLock()
	defer n.mutex.RUnlock()

	if n.pool == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Neon",
			Details: "Call Connect() before retrieving schema",
		}
	}

	query := `
		SELECT table_name, table_schema
		FROM information_schema.tables
		WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
		  AND table_type = 'BASE TABLE'
		ORDER BY table_schema, table_name
	`

	rows, err := n.pool.Query(ctx, query)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_RETRIEVAL_FAILED",
			Message: "Failed to retrieve Neon schema",
			Details: err.Error(),
		}
	}
	defer rows.Close()

	var tables []types.TableInfo
	for rows.Next() {
		var tableName, schemaName string
		if err := rows.Scan(&tableName, &schemaName); err != nil {
			return nil, &types.AdapterError{
				Code:    "SCHEMA_SCAN_FAILED",
				Message: "Failed to scan schema rows",
				Details: err.Error(),
			}
		}

		tableInfo, err := n.GetTableInfo(ctx, tableName)
		if err != nil {
			n.logger.WithError(err).Warnf("Failed to get info for table %s", tableName)
			continue
		}

		tableInfo.Schema = schemaName
		tables = append(tables, *tableInfo)
	}

	if err := rows.Err(); err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_ITERATION_FAILED",
			Message: "Error iterating schema rows",
			Details: err.Error(),
		}
	}

	return &types.SchemaInfo{
		Tables: tables,
	}, nil
}

// GetTableInfo retrieves detailed information about a specific table
func (n *NeonAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	n.mutex.RLock()
	defer n.mutex.RUnlock()

	if n.pool == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Neon",
			Details: "Call Connect() before retrieving table info",
		}
	}

	// Get columns
	columnsQuery := `
		SELECT
			column_name,
			data_type,
			is_nullable,
			column_default
		FROM information_schema.columns
		WHERE table_name = $1
		  AND table_schema = 'public'
		ORDER BY ordinal_position
	`

	rows, err := n.pool.Query(ctx, columnsQuery, tableName)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "TABLE_INFO_FAILED",
			Message: fmt.Sprintf("Failed to get info for table %s", tableName),
			Details: err.Error(),
		}
	}
	defer rows.Close()

	var columns []types.ColumnInfo
	for rows.Next() {
		var colName, dataType, isNullable string
		var defaultValue *string

		if err := rows.Scan(&colName, &dataType, &isNullable, &defaultValue); err != nil {
			return nil, &types.AdapterError{
				Code:    "COLUMN_SCAN_FAILED",
				Message: "Failed to scan column information",
				Details: err.Error(),
			}
		}

		defVal := ""
		if defaultValue != nil {
			defVal = *defaultValue
		}

		columns = append(columns, types.ColumnInfo{
			Name:         colName,
			Type:         dataType,
			Nullable:     isNullable == "YES",
			DefaultValue: defVal,
		})
	}

	// Get indexes
	indexQuery := `
		SELECT
			i.relname AS index_name,
			a.attname AS column_name,
			ix.indisunique AS is_unique
		FROM pg_class t
		JOIN pg_index ix ON t.oid = ix.indrelid
		JOIN pg_class i ON i.oid = ix.indexrelid
		JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
		WHERE t.relname = $1
		ORDER BY i.relname, a.attnum
	`

	indexRows, err := n.pool.Query(ctx, indexQuery, tableName)
	if err != nil {
		n.logger.WithError(err).Warn("Failed to retrieve indexes")
	} else {
		defer indexRows.Close()

		indexMap := make(map[string]*types.IndexInfo)
		for indexRows.Next() {
			var indexName, columnName string
			var isUnique bool

			if err := indexRows.Scan(&indexName, &columnName, &isUnique); err != nil {
				continue
			}

			if idx, exists := indexMap[indexName]; exists {
				idx.Columns = append(idx.Columns, columnName)
			} else {
				indexMap[indexName] = &types.IndexInfo{
					Name:    indexName,
					Columns: []string{columnName},
					Unique:  isUnique,
				}
			}
		}

		var indexes []types.IndexInfo
		for _, idx := range indexMap {
			indexes = append(indexes, *idx)
		}

		return &types.TableInfo{
			Name:    tableName,
			Columns: columns,
			Indexes: indexes,
		}, nil
	}

	return &types.TableInfo{
		Name:    tableName,
		Columns: columns,
		Indexes: []types.IndexInfo{},
	}, nil
}

// convertValue converts database values to appropriate Go types
func (n *NeonAdapter) convertValue(value interface{}) interface{} {
	if value == nil {
		return nil
	}

	switch v := value.(type) {
	case []byte:
		return string(v)
	case time.Time:
		return v.Format(time.RFC3339)
	default:
		return v
	}
}
