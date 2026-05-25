//go:build cgo

package sql

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	_ "github.com/godror/godror"
	"github.com/sirupsen/logrus"
)

// OracleAdapter implements DatabaseAdapter for Oracle Database
type OracleAdapter struct {
	conn   *entities.Connection
	db     *sql.DB
	mutex  sync.RWMutex
	logger *logrus.Logger
}

// Connect establishes a connection to Oracle Database
func (o *OracleAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	o.mutex.Lock()
	defer o.mutex.Unlock()

	if o.db != nil {
		return nil // Already connected
	}

	// Update connection info
	o.conn = conn

	// Build connection string
	connStr, err := conn.GetConnectionString()
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_STRING_ERROR",
			Message: "Failed to build connection string",
			Details: err.Error(),
		}
	}

	// Open database connection
	db, err := sql.Open("godror", connStr)
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_FAILED",
			Message: "Failed to open Oracle connection",
			Details: err.Error(),
		}
	}

	// Configure connection pool
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(time.Hour)
	db.SetConnMaxIdleTime(time.Minute * 30)

	// Test the connection
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Failed to ping Oracle database",
			Details: err.Error(),
		}
	}

	o.db = db
	o.logger.Infof("Connected to Oracle database: %s", conn.Name)

	return nil
}

// Disconnect closes the Oracle connection
func (o *OracleAdapter) Disconnect(ctx context.Context) error {
	o.mutex.Lock()
	defer o.mutex.Unlock()

	if o.db == nil {
		return nil // Already disconnected
	}

	if err := o.db.Close(); err != nil {
		return &types.AdapterError{
			Code:    "DISCONNECT_FAILED",
			Message: "Failed to close Oracle connection",
			Details: err.Error(),
		}
	}

	o.db = nil
	o.logger.Infof("Disconnected from Oracle database: %s", o.conn.Name)

	return nil
}

// Shutdown closes the connection
func (o *OracleAdapter) Shutdown(ctx context.Context) error {
	return o.Disconnect(ctx)
}

// Ping checks the connection
func (o *OracleAdapter) Ping(ctx context.Context) error {
	return o.TestConnection(ctx)
}

// HealthCheck checks the health of the connection
func (o *OracleAdapter) HealthCheck(ctx context.Context) error {
	return o.Ping(ctx)
}

// GetMetrics returns connection metrics
func (o *OracleAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return &types.ConnectionMetrics{
		LastUpdated: time.Now(),
		DatabaseInfo: types.DatabaseInfo{
			Engine: "oracle",
		},
	}, nil
}

// BeginTransaction starts a new transaction
func (o *OracleAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	if o.db == nil {
		return nil, fmt.Errorf("not connected to database")
	}
	return o.db.BeginTx(ctx, nil)
}

// GetColumns returns column information for a table
func (o *OracleAdapter) GetColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	info, err := o.GetTableInfo(ctx, tableName)
	if err != nil {
		return nil, err
	}
	return info.Columns, nil
}

// TestConnection tests if the Oracle connection is valid
func (o *OracleAdapter) TestConnection(ctx context.Context) error {
	o.mutex.RLock()
	defer o.mutex.RUnlock()

	if o.db == nil {
		return &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	if err := o.db.PingContext(ctx); err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Connection test failed",
			Details: err.Error(),
		}
	}

	return nil
}

// ExecuteQuery executes an Oracle query and returns results
func (o *OracleAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	o.mutex.RLock()
	defer o.mutex.RUnlock()

	if o.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
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
	rows, err := o.db.QueryContext(ctx, query, params...)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "QUERY_EXECUTION_FAILED",
			Message: "Failed to execute query",
			Details: err.Error(),
		}
	}
	defer rows.Close()

	// Get column names
	columns, err := rows.Columns()
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "COLUMN_INFO_FAILED",
			Message: "Failed to get column information",
			Details: err.Error(),
		}
	}

	// Get column types for Oracle-specific handling
	columnTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "COLUMN_TYPE_FAILED",
			Message: "Failed to get column types",
			Details: err.Error(),
		}
	}

	// Prepare value containers
	values := make([]interface{}, len(columns))
	valuePtrs := make([]interface{}, len(columns))
	for i := range values {
		valuePtrs[i] = &values[i]
	}

	// Collect rows
	var resultRows []map[string]interface{}
	for rows.Next() {
		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, &types.AdapterError{
				Code:    "ROW_SCAN_FAILED",
				Message: "Failed to scan row",
				Details: err.Error(),
			}
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			val := values[i]

			// Handle Oracle-specific type conversions
			if val != nil {
				switch v := val.(type) {
				case []byte:
					// Convert byte arrays to strings for JSON compatibility
					row[col] = string(v)
				case time.Time:
					// Format time for JSON compatibility
					row[col] = v.Format(time.RFC3339)
				default:
					// Handle Oracle NUMBER type which can be returned as various Go types
					if columnTypes[i].DatabaseTypeName() == "NUMBER" {
						row[col] = o.convertOracleNumber(val)
					} else {
						row[col] = val
					}
				}
			} else {
				row[col] = nil
			}
		}
		resultRows = append(resultRows, row)
	}

	if err := rows.Err(); err != nil {
		return nil, &types.AdapterError{
			Code:    "ROWS_ITERATION_FAILED",
			Message: "Error during rows iteration",
			Details: err.Error(),
		}
	}

	// Collect column info
	var columnInfos []types.ColumnInfo
	for i, name := range columns {
		colType := "unknown"
		if i < len(columnTypes) {
			colType = columnTypes[i].DatabaseTypeName()
		}
		columnInfos = append(columnInfos, types.ColumnInfo{
			Name: name,
			Type: colType,
		})
	}

	return &types.QueryResult{
		Columns: columnInfos,
		Rows:    resultRows,
		Count:   int64(len(resultRows)),
	}, nil
}

// convertOracleNumber handles Oracle NUMBER type conversion
func (o *OracleAdapter) convertOracleNumber(val interface{}) interface{} {
	switch v := val.(type) {
	case int64:
		return v
	case float64:
		// Check if it's actually an integer
		if v == float64(int64(v)) {
			return int64(v)
		}
		return v
	default:
		return val
	}
}

// GetSchema retrieves Oracle database schema information
func (o *OracleAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	o.mutex.RLock()
	defer o.mutex.RUnlock()

	if o.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// Query to get all tables accessible to the current user
	query := `
		SELECT 
			OWNER as table_schema,
			TABLE_NAME as table_name
		FROM ALL_TABLES
		WHERE OWNER NOT IN ('SYS', 'SYSTEM', 'CTXSYS', 'MDSYS', 'OLAPSYS', 'ORDSYS', 'OUTLN', 'WMSYS', 'XDB')
		ORDER BY OWNER, TABLE_NAME
	`

	rows, err := o.db.QueryContext(ctx, query)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_QUERY_FAILED",
			Message: "Failed to query schema information",
			Details: err.Error(),
		}
	}
	defer rows.Close()

	var tables []types.TableInfo
	for rows.Next() {
		var schema, tableName string
		if err := rows.Scan(&schema, &tableName); err != nil {
			return nil, &types.AdapterError{
				Code:    "SCHEMA_SCAN_FAILED",
				Message: "Failed to scan schema row",
				Details: err.Error(),
			}
		}

		// Get detailed table information
		tableInfo, err := o.GetTableInfo(ctx, fmt.Sprintf("%s.%s", schema, tableName))
		if err != nil {
			o.logger.Warnf("Failed to get table info for %s.%s: %v", schema, tableName, err)
			// Continue with basic info
			tableInfo = &types.TableInfo{
				Name:   tableName,
				Schema: schema,
			}
		}

		tables = append(tables, *tableInfo)
	}

	if err := rows.Err(); err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_ITERATION_FAILED",
			Message: "Error during schema iteration",
			Details: err.Error(),
		}
	}

	return &types.SchemaInfo{
		Tables: tables,
	}, nil
}

// GetTableInfo retrieves information about a specific Oracle table
func (o *OracleAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	o.mutex.RLock()
	defer o.mutex.RUnlock()

	if o.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// Parse schema and table name
	parts := strings.Split(tableName, ".")
	var schema, table string
	if len(parts) == 2 {
		schema = parts[0]
		table = parts[1]
	} else {
		// Get current user as default schema
		var currentUser string
		if err := o.db.QueryRowContext(ctx, "SELECT USER FROM DUAL").Scan(&currentUser); err != nil {
			return nil, &types.AdapterError{
				Code:    "CURRENT_USER_FAILED",
				Message: "Failed to get current user",
				Details: err.Error(),
			}
		}
		schema = currentUser
		table = tableName
	}

	// Get column information
	columnQuery := `
		SELECT 
			c.COLUMN_NAME,
			c.DATA_TYPE,
			c.NULLABLE,
			c.DATA_DEFAULT,
			CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'Y' ELSE 'N' END as IS_PRIMARY_KEY
		FROM ALL_TAB_COLUMNS c
		LEFT JOIN (
			SELECT cc.COLUMN_NAME, cc.TABLE_NAME, cc.OWNER
			FROM ALL_CONSTRAINTS cons
			JOIN ALL_CONS_COLUMNS cc ON cons.CONSTRAINT_NAME = cc.CONSTRAINT_NAME 
				AND cons.OWNER = cc.OWNER
			WHERE cons.CONSTRAINT_TYPE = 'P'
				AND cons.OWNER = :1
				AND cons.TABLE_NAME = :2
		) pk ON c.COLUMN_NAME = pk.COLUMN_NAME 
			AND c.TABLE_NAME = pk.TABLE_NAME 
			AND c.OWNER = pk.OWNER
		WHERE c.OWNER = :3 AND c.TABLE_NAME = :4
		ORDER BY c.COLUMN_ID
	`

	rows, err := o.db.QueryContext(ctx, columnQuery, schema, table, schema, table)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "TABLE_COLUMN_QUERY_FAILED",
			Message: "Failed to query table columns",
			Details: err.Error(),
		}
	}
	defer rows.Close()

	var columns []types.ColumnInfo
	for rows.Next() {
		var col types.ColumnInfo
		var nullable, isPrimaryKey string
		var defaultValue sql.NullString

		if err := rows.Scan(&col.Name, &col.Type, &nullable, &defaultValue, &isPrimaryKey); err != nil {
			return nil, &types.AdapterError{
				Code:    "COLUMN_SCAN_FAILED",
				Message: "Failed to scan column information",
				Details: err.Error(),
			}
		}

		col.Nullable = nullable == "Y"
		col.IsPrimaryKey = isPrimaryKey == "Y"
		if defaultValue.Valid {
			col.DefaultValue = defaultValue.String
		}

		columns = append(columns, col)
	}

	// Get index information
	indexQuery := `
		SELECT 
			i.INDEX_NAME,
			ic.COLUMN_NAME,
			CASE WHEN i.UNIQUENESS = 'UNIQUE' THEN 1 ELSE 0 END as IS_UNIQUE
		FROM ALL_INDEXES i
		JOIN ALL_IND_COLUMNS ic ON i.INDEX_NAME = ic.INDEX_NAME 
			AND i.OWNER = ic.INDEX_OWNER
		WHERE i.OWNER = :1 AND i.TABLE_NAME = :2
		ORDER BY i.INDEX_NAME, ic.COLUMN_POSITION
	`

	indexRows, err := o.db.QueryContext(ctx, indexQuery, schema, table)
	if err != nil {
		o.logger.Warnf("Failed to query indexes for table %s.%s: %v", schema, table, err)
	} else {
		defer indexRows.Close()

		indexMap := make(map[string]*types.IndexInfo)
		for indexRows.Next() {
			var indexName, columnName string
			var isUnique int

			if err := indexRows.Scan(&indexName, &columnName, &isUnique); err != nil {
				o.logger.Warnf("Failed to scan index information: %v", err)
				continue
			}

			if index, exists := indexMap[indexName]; exists {
				index.Columns = append(index.Columns, columnName)
			} else {
				indexMap[indexName] = &types.IndexInfo{
					Name:    indexName,
					Columns: []string{columnName},
					Unique:  isUnique == 1,
				}
			}
		}

		var indexes []types.IndexInfo
		for _, index := range indexMap {
			indexes = append(indexes, *index)
		}

		return &types.TableInfo{
			Name:    table,
			Schema:  schema,
			Columns: columns,
			Indexes: indexes,
		}, nil
	}

	return &types.TableInfo{
		Name:    table,
		Schema:  schema,
		Columns: columns,
	}, nil
}

// IsConnected returns true if the adapter is connected to Oracle
func (o *OracleAdapter) IsConnected() bool {
	o.mutex.RLock()
	defer o.mutex.RUnlock()

	return o.db != nil
}

// GetConnectionInfo returns the connection information
func (o *OracleAdapter) GetConnectionInfo() *entities.Connection {
	return o.conn
}
