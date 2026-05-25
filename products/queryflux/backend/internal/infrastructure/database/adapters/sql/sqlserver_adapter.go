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

	_ "github.com/denisenkom/go-mssqldb"
	"github.com/sirupsen/logrus"
)

// SQLServerAdapter implements DatabaseAdapter for SQL Server
type SQLServerAdapter struct {
	conn   *entities.Connection
	db     *sql.DB
	mutex  sync.RWMutex
	logger *logrus.Logger
}

// Connect establishes a connection to SQL Server
func (s *SQLServerAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.db != nil {
		return nil // Already connected
	}

	// Update connection info
	s.conn = conn

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
	db, err := sql.Open("sqlserver", connStr)
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_FAILED",
			Message: "Failed to open SQL Server connection",
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
			Message: "Failed to ping SQL Server database",
			Details: err.Error(),
		}
	}

	s.db = db
	s.logger.Infof("Connected to SQL Server database: %s", conn.Name)

	return nil
}

// Disconnect closes the SQL Server connection
func (s *SQLServerAdapter) Disconnect(ctx context.Context) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.db == nil {
		return nil // Already disconnected
	}

	if err := s.db.Close(); err != nil {
		return &types.AdapterError{
			Code:    "DISCONNECT_FAILED",
			Message: "Failed to close SQL Server connection",
			Details: err.Error(),
		}
	}

	s.db = nil
	s.logger.Infof("Disconnected from SQL Server database: %s", s.conn.Name)

	return nil
}

// Shutdown closes the connection
func (s *SQLServerAdapter) Shutdown(ctx context.Context) error {
	return s.Disconnect(ctx)
}

// Ping checks the connection
func (s *SQLServerAdapter) Ping(ctx context.Context) error {
	return s.TestConnection(ctx)
}

// HealthCheck checks the health of the connection
func (s *SQLServerAdapter) HealthCheck(ctx context.Context) error {
	return s.Ping(ctx)
}

// GetMetrics returns connection metrics
func (s *SQLServerAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return &types.ConnectionMetrics{
		LastUpdated: time.Now(),
		DatabaseInfo: types.DatabaseInfo{
			Engine: "sqlserver",
		},
	}, nil
}

// BeginTransaction starts a new transaction
func (s *SQLServerAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	if s.db == nil {
		return nil, fmt.Errorf("not connected to database")
	}
	// SQL Server transaction options can be passed here if needed
	return s.db.BeginTx(ctx, nil)
}

// GetColumns returns column information for a table
func (s *SQLServerAdapter) GetColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	info, err := s.GetTableInfo(ctx, tableName)
	if err != nil {
		return nil, err
	}
	return info.Columns, nil
}

// TestConnection tests if the SQL Server connection is valid
func (s *SQLServerAdapter) TestConnection(ctx context.Context) error {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	if s.db == nil {
		return &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	if err := s.db.PingContext(ctx); err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Connection test failed",
			Details: err.Error(),
		}
	}

	return nil
}

// ExecuteQuery executes a SQL Server query and returns results
func (s *SQLServerAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	if s.db == nil {
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
	rows, err := s.db.QueryContext(ctx, query, params...)
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

			// Handle SQL Server-specific type conversions
			if val != nil {
				switch v := val.(type) {
				case []byte:
					// Convert byte arrays to strings for JSON compatibility
					row[col] = string(v)
				case time.Time:
					// Format time for JSON compatibility
					row[col] = v.Format(time.RFC3339)
				default:
					row[col] = val
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

	// Convert to ColumnInfo
	var tableColumns []types.ColumnInfo
	columnTypes, _ := rows.ColumnTypes() // Ignore error as we have columns

	for i, colName := range columns {
		colType := "unknown"
		if i < len(columnTypes) {
			colType = columnTypes[i].DatabaseTypeName()
		}

		tableColumns = append(tableColumns, types.ColumnInfo{
			Name: colName,
			Type: colType,
		})
	}

	return &types.QueryResult{
		Columns: tableColumns,
		Rows:    resultRows,
		Count:   int64(len(resultRows)),
	}, nil
}

// GetSchema retrieves SQL Server database schema information
func (s *SQLServerAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	if s.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to database",
		}
	}

	// Query to get all tables in SQL Server
	query := `
		SELECT 
			TABLE_SCHEMA,
			TABLE_NAME
		FROM INFORMATION_SCHEMA.TABLES
		WHERE TABLE_TYPE = 'BASE TABLE'
		ORDER BY TABLE_SCHEMA, TABLE_NAME
	`

	rows, err := s.db.QueryContext(ctx, query)
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
		tableInfo, err := s.GetTableInfo(ctx, fmt.Sprintf("%s.%s", schema, tableName))
		if err != nil {
			s.logger.Warnf("Failed to get table info for %s.%s: %v", schema, tableName, err)
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

// GetTableInfo retrieves information about a specific SQL Server table
func (s *SQLServerAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	if s.db == nil {
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
		schema = "dbo" // Default schema
		table = tableName
	}

	// Get column information
	columnQuery := `
		SELECT 
			c.COLUMN_NAME,
			c.DATA_TYPE,
			c.IS_NULLABLE,
			c.COLUMN_DEFAULT,
			CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as IS_PRIMARY_KEY
		FROM INFORMATION_SCHEMA.COLUMNS c
		LEFT JOIN (
			SELECT ku.COLUMN_NAME
			FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
			JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
				ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
				AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
			WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
				AND tc.TABLE_SCHEMA = ?
				AND tc.TABLE_NAME = ?
		) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
		WHERE c.TABLE_SCHEMA = ? AND c.TABLE_NAME = ?
		ORDER BY c.ORDINAL_POSITION
	`

	rows, err := s.db.QueryContext(ctx, columnQuery, schema, table, schema, table)
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
		var nullable string
		var defaultValue sql.NullString
		var isPrimaryKey int

		if err := rows.Scan(&col.Name, &col.Type, &nullable, &defaultValue, &isPrimaryKey); err != nil {
			return nil, &types.AdapterError{
				Code:    "COLUMN_SCAN_FAILED",
				Message: "Failed to scan column information",
				Details: err.Error(),
			}
		}

		col.Nullable = nullable == "YES"
		col.IsPrimaryKey = isPrimaryKey == 1
		if defaultValue.Valid {
			col.DefaultValue = defaultValue.String
		}

		columns = append(columns, col)
	}

	// Get index information
	indexQuery := `
		SELECT 
			i.name as index_name,
			c.name as column_name,
			i.is_unique
		FROM sys.indexes i
		JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
		JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
		JOIN sys.tables t ON i.object_id = t.object_id
		JOIN sys.schemas s ON t.schema_id = s.schema_id
		WHERE s.name = ? AND t.name = ?
		ORDER BY i.name, ic.key_ordinal
	`

	indexRows, err := s.db.QueryContext(ctx, indexQuery, schema, table)
	if err != nil {
		s.logger.Warnf("Failed to query indexes for table %s.%s: %v", schema, table, err)
	} else {
		defer indexRows.Close()

		indexMap := make(map[string]*types.IndexInfo)
		for indexRows.Next() {
			var indexName, columnName string
			var isUnique bool

			if err := indexRows.Scan(&indexName, &columnName, &isUnique); err != nil {
				s.logger.Warnf("Failed to scan index information: %v", err)
				continue
			}

			if index, exists := indexMap[indexName]; exists {
				index.Columns = append(index.Columns, columnName)
			} else {
				indexMap[indexName] = &types.IndexInfo{
					Name:    indexName,
					Columns: []string{columnName},
					Unique:  isUnique,
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

// IsConnected returns true if the adapter is connected to SQL Server
func (s *SQLServerAdapter) IsConnected() bool {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	return s.db != nil
}

// GetConnectionInfo returns the connection information
func (s *SQLServerAdapter) GetConnectionInfo() *entities.Connection {
	return s.conn
}
