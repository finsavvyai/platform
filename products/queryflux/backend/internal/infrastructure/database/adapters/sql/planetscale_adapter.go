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

	_ "github.com/go-sql-driver/mysql"
	"github.com/sirupsen/logrus"
)

// PlanetScaleAdapter handles PlanetScale serverless MySQL connections
type PlanetScaleAdapter struct {
	conn   *entities.Connection
	db     *sql.DB
	mutex  sync.RWMutex
	logger *logrus.Logger
}

// Connect establishes a connection to PlanetScale with serverless configuration
func (p *PlanetScaleAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	if p.db != nil {
		return nil // Already connected
	}

	// Update connection info
	p.conn = conn

	connStr := p.buildConnectionString(conn)

	db, err := sql.Open("mysql", connStr)
	if err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_FAILED",
			Message: "Failed to connect to PlanetScale",
			Details: err.Error(),
		}
	}

	// Configure connection pool for serverless
	// PlanetScale has built-in connection pooling, so we use smaller pool
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute) // Shorter for serverless
	db.SetConnMaxIdleTime(1 * time.Minute)

	// Test the connection
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Failed to ping PlanetScale database",
			Details: err.Error(),
		}
	}

	p.db = db
	p.logger.Infof("Successfully connected to PlanetScale database: %s", conn.Name)

	return nil
}

// Disconnect closes the PlanetScale connection
func (p *PlanetScaleAdapter) Disconnect(ctx context.Context) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	if p.db == nil {
		return nil // Already disconnected
	}

	err := p.db.Close()
	p.db = nil
	if err != nil {
		return &types.AdapterError{
			Code:    "DISCONNECT_FAILED",
			Message: "Failed to disconnect from PlanetScale",
			Details: err.Error(),
		}
	}

	p.logger.Infof("Disconnected from PlanetScale database: %s", p.conn.Name)
	return nil
}

// Shutdown closes the connection
func (p *PlanetScaleAdapter) Shutdown(ctx context.Context) error {
	return p.Disconnect(ctx)
}

// Ping checks the connection
func (p *PlanetScaleAdapter) Ping(ctx context.Context) error {
	return p.TestConnection(ctx)
}

// HealthCheck checks the health of the connection
func (p *PlanetScaleAdapter) HealthCheck(ctx context.Context) error {
	return p.Ping(ctx)
}

// GetMetrics returns connection metrics
func (p *PlanetScaleAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return &types.ConnectionMetrics{
		LastUpdated: time.Now(),
		DatabaseInfo: types.DatabaseInfo{
			Engine:  "planetscale",
			Version: "serverless",
		},
	}, nil
}

// BeginTransaction starts a new transaction
func (p *PlanetScaleAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	if p.db == nil {
		return nil, fmt.Errorf("not connected to database")
	}
	return p.db.BeginTx(ctx, nil)
}

// GetColumns returns column information for a table
func (p *PlanetScaleAdapter) GetColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	info, err := p.GetTableInfo(ctx, tableName)
	if err != nil {
		return nil, err
	}
	return info.Columns, nil
}

// TestConnection tests the PlanetScale connection
func (p *PlanetScaleAdapter) TestConnection(ctx context.Context) error {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	if p.db == nil {
		return &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to PlanetScale",
		}
	}

	return p.db.PingContext(ctx)
}

// IsConnected returns whether the adapter is currently connected
func (p *PlanetScaleAdapter) IsConnected() bool {
	p.mutex.RLock()
	defer p.mutex.RUnlock()
	return p.db != nil
}

// GetConnectionInfo returns the connection information
func (p *PlanetScaleAdapter) GetConnectionInfo() *entities.Connection {
	p.mutex.RLock()
	defer p.mutex.RUnlock()
	return p.conn
}

// buildConnectionString creates a PlanetScale connection string
func (p *PlanetScaleAdapter) buildConnectionString(conn *entities.Connection) string {
	// PlanetScale connection string format
	// username:password@tcp(host:port)/database?params

	var connStr string

	// Check if connection string is already in PlanetScale format
	if strings.Contains(conn.Host, "psdb.cloud") || strings.Contains(conn.Host, "aws.connect.psdb.cloud") {
		// Use the host as-is for PlanetScale
		connStr = fmt.Sprintf("%s:%s@tcp(%s)/%s",
			conn.Username,
			conn.Password,
			conn.Host, // Already includes port for PlanetScale
			conn.Database,
		)
	} else {
		// Standard format
		connStr = fmt.Sprintf("%s:%s@tcp(%s:%d)/%s",
			conn.Username,
			conn.Password,
			conn.Host,
			conn.Port,
			conn.Database,
		)
	}

	// PlanetScale requires TLS
	params := []string{
		"tls=true",
		"interpolateParams=true",
		"parseTime=true",
		"charset=utf8mb4",
	}

	// Add SSL verification based on connection config
	if conn.SSL {
		params = append(params, "tls=true")
	} else {
		params = append(params, "tls=skip-verify")
	}

	return connStr + "?" + strings.Join(params, "&")
}

// ExecuteQuery executes a query on PlanetScale
func (p *PlanetScaleAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	if p.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to PlanetScale",
			Details: "Call Connect() before executing queries",
		}
	}

	trimmedQuery := strings.TrimSpace(strings.ToUpper(query))

	if strings.HasPrefix(trimmedQuery, "SELECT") || strings.HasPrefix(trimmedQuery, "SHOW") || strings.HasPrefix(trimmedQuery, "DESCRIBE") || strings.HasPrefix(trimmedQuery, "EXPLAIN") {
		return p.executeSelectQuery(ctx, query, params...)
	}

	return p.executeNonSelectQuery(ctx, query, params...)
}

// executeSelectQuery executes a SELECT query
func (p *PlanetScaleAdapter) executeSelectQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	rows, err := p.db.QueryContext(ctx, query, params...)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "QUERY_EXECUTION_FAILED",
			Message: "Failed to execute query",
			Details: err.Error(),
		}
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "COLUMN_RETRIEVAL_FAILED",
			Message: "Failed to retrieve columns",
			Details: err.Error(),
		}
	}

	var resultRows []map[string]interface{}
	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, &types.AdapterError{
				Code:    "ROW_SCAN_FAILED",
				Message: "Failed to scan row",
				Details: err.Error(),
			}
		}

		rowMap := make(map[string]interface{})
		for i, col := range columns {
			rowMap[col] = p.convertValue(values[i])
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

// executeNonSelectQuery executes INSERT, UPDATE, DELETE queries
func (p *PlanetScaleAdapter) executeNonSelectQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	result, err := p.db.ExecContext(ctx, query, params...)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "QUERY_EXECUTION_FAILED",
			Message: "Failed to execute query",
			Details: err.Error(),
		}
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "ROWS_AFFECTED_FAILED",
			Message: "Failed to get rows affected",
			Details: err.Error(),
		}
	}

	return &types.QueryResult{
		Columns: []types.ColumnInfo{{Name: "rows_affected", Type: "int64"}},
		Rows: []map[string]interface{}{
			{"rows_affected": rowsAffected},
		},
		Count: rowsAffected,
	}, nil
}

// GetSchema retrieves the database schema for PlanetScale
func (p *PlanetScaleAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	if p.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to PlanetScale",
			Details: "Call Connect() before retrieving schema",
		}
	}

	query := `
		SELECT TABLE_NAME
		FROM information_schema.TABLES
		WHERE TABLE_SCHEMA = DATABASE()
		  AND TABLE_TYPE = 'BASE TABLE'
		ORDER BY TABLE_NAME
	`

	rows, err := p.db.QueryContext(ctx, query)
	if err != nil {
		return nil, &types.AdapterError{
			Code:    "SCHEMA_RETRIEVAL_FAILED",
			Message: "Failed to retrieve PlanetScale schema",
			Details: err.Error(),
		}
	}
	defer rows.Close()

	var tables []types.TableInfo
	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			return nil, &types.AdapterError{
				Code:    "SCHEMA_SCAN_FAILED",
				Message: "Failed to scan schema rows",
				Details: err.Error(),
			}
		}

		tableInfo, err := p.GetTableInfo(ctx, tableName)
		if err != nil {
			p.logger.WithError(err).Warnf("Failed to get info for table %s", tableName)
			continue
		}

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
func (p *PlanetScaleAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	p.mutex.RLock()
	defer p.mutex.RUnlock()

	if p.db == nil {
		return nil, &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to PlanetScale",
			Details: "Call Connect() before retrieving table info",
		}
	}

	// Get columns
	columnsQuery := `
		SELECT
			COLUMN_NAME,
			COLUMN_TYPE,
			IS_NULLABLE,
			COLUMN_DEFAULT,
			COLUMN_KEY
		FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE()
		  AND TABLE_NAME = ?
		ORDER BY ORDINAL_POSITION
	`

	rows, err := p.db.QueryContext(ctx, columnsQuery, tableName)
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
		var colName, colType, isNullable, columnKey string
		var defaultValue sql.NullString

		if err := rows.Scan(&colName, &colType, &isNullable, &defaultValue, &columnKey); err != nil {
			return nil, &types.AdapterError{
				Code:    "COLUMN_SCAN_FAILED",
				Message: "Failed to scan column information",
				Details: err.Error(),
			}
		}

		defVal := ""
		if defaultValue.Valid {
			defVal = defaultValue.String
		}

		columns = append(columns, types.ColumnInfo{
			Name:         colName,
			Type:         colType,
			Nullable:     isNullable == "YES",
			DefaultValue: defVal,
			IsPrimaryKey: columnKey == "PRI",
		})
	}

	// Get indexes
	indexQuery := `
		SELECT
			INDEX_NAME,
			COLUMN_NAME,
			NON_UNIQUE
		FROM information_schema.STATISTICS
		WHERE TABLE_SCHEMA = DATABASE()
		  AND TABLE_NAME = ?
		ORDER BY INDEX_NAME, SEQ_IN_INDEX
	`

	indexRows, err := p.db.QueryContext(ctx, indexQuery, tableName)
	if err != nil {
		p.logger.WithError(err).Warn("Failed to retrieve indexes")
	} else {
		defer indexRows.Close()

		indexMap := make(map[string]*types.IndexInfo)
		for indexRows.Next() {
			var indexName, columnName string
			var nonUnique int

			if err := indexRows.Scan(&indexName, &columnName, &nonUnique); err != nil {
				continue
			}

			if idx, exists := indexMap[indexName]; exists {
				idx.Columns = append(idx.Columns, columnName)
			} else {
				indexMap[indexName] = &types.IndexInfo{
					Name:    indexName,
					Columns: []string{columnName},
					Unique:  nonUnique == 0,
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
func (p *PlanetScaleAdapter) convertValue(value interface{}) interface{} {
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
