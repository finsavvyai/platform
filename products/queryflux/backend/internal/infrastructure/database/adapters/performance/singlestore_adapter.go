package performance

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/go-sql-driver/mysql"
	"github.com/sirupsen/logrus"
)

// SingleStoreAdapter provides connectivity to SingleStore high-performance database
type SingleStoreAdapter struct {
	conn     *entities.Connection
	db       *sql.DB
	logger   *logrus.Logger
	settings map[string]string
}

// NewSingleStoreAdapter creates a new SingleStore adapter
func NewSingleStoreAdapter(conn *entities.Connection) *SingleStoreAdapter {
	return &SingleStoreAdapter{
		conn:     conn,
		settings: make(map[string]string),
		logger:   logrus.New(),
	}
}

// Connect establishes a connection to SingleStore
func (a *SingleStoreAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	a.conn = conn

	// Register SingleStore-specific driver configuration
	config := mysql.Config{
		User:                 conn.Username,
		Passwd:               conn.Password,
		Net:                  "tcp",
		Addr:                 fmt.Sprintf("%s:%d", conn.Host, conn.Port),
		DBName:               conn.Database,
		ParseTime:            true,
		Loc:                  time.UTC,
		MaxAllowedPacket:     64 << 20, // 64MB
		AllowNativePasswords: true,
		CheckConnLiveness:    true,
		Params:               make(map[string]string),
	}

	// Apply SingleStore-specific settings
	for key, value := range conn.Options {
		switch key {
		case "charset":
			config.Params["charset"] = value
		case "collation":
			config.Params["collation"] = value
		case "timeout":
			config.Timeout, _ = time.ParseDuration(value)
		case "readTimeout":
			config.ReadTimeout, _ = time.ParseDuration(value)
		case "writeTimeout":
			config.WriteTimeout, _ = time.ParseDuration(value)
		case "tls":
			if value == "true" || value == "skip-verify" {
				config.TLSConfig = "skip-verify"
			} else if value == "preferred" {
				config.TLSConfig = "preferred"
			}
		case "maxAllowedPacket":
			if size, err := strconv.ParseInt(value, 10, 64); err == nil {
				config.MaxAllowedPacket = int(size)
			}
		case "interpolateParams":
			if value == "false" {
				config.InterpolateParams = false
			}
		default:
			// Add as custom parameter
			config.Params[key] = value
		}
	}

	// Open connection
	db, err := sql.Open("mysql", config.FormatDSN())
	if err != nil {
		return fmt.Errorf("failed to open SingleStore connection: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(a.getIntOption("maxOpenConns", 20))
	db.SetMaxIdleConns(a.getIntOption("maxIdleConns", 10))
	db.SetConnMaxLifetime(a.getDurationOption("connMaxLifetime", time.Hour))
	db.SetConnMaxIdleTime(a.getDurationOption("connMaxIdleTime", 30*time.Minute))

	// Test connection
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return fmt.Errorf("SingleStore ping failed: %w", err)
	}

	a.db = db
	a.logger.WithFields(logrus.Fields{
		"host":     conn.Host,
		"port":     conn.Port,
		"database": conn.Database,
		"user":     conn.Username,
	}).Info("Successfully connected to SingleStore")

	return nil
}

// buildDSN constructs the SingleStore DSN
func (a *SingleStoreAdapter) buildDSN() string {
	var dsn strings.Builder

	dsn.WriteString(fmt.Sprintf("%s:%s@tcp(%s:%d)", a.conn.Username, a.conn.Password, a.conn.Host, a.conn.Port))

	if a.conn.Database != "" {
		dsn.WriteString(fmt.Sprintf("/%s", a.conn.Database))
	}

	// Add parameters
	params := []string{}

	// SingleStore-specific defaults
	params = append(params, "charset=utf8mb4")
	params = append(params, "collation=utf8mb4_unicode_ci")
	params = append(params, "parseTime=true")
	params = append(params, "loc=UTC")

	// Add custom options
	for key, value := range a.conn.Options {
		params = append(params, fmt.Sprintf("%s=%s", key, value))
	}

	if len(params) > 0 {
		dsn.WriteString("?")
		dsn.WriteString(strings.Join(params, "&"))
	}

	return dsn.String()
}

// Disconnect closes the SingleStore connection
func (a *SingleStoreAdapter) Disconnect(ctx context.Context) error {
	if a.db != nil {
		if err := a.db.Close(); err != nil {
			return fmt.Errorf("failed to close SingleStore connection: %w", err)
		}
		a.db = nil
		a.logger.Info("SingleStore connection closed")
	}
	return nil
}

// TestConnection tests if the SingleStore connection is valid
func (a *SingleStoreAdapter) TestConnection(ctx context.Context) error {
	if a.db == nil {
		return fmt.Errorf("not connected to SingleStore")
	}
	return a.db.PingContext(ctx)
}

// ExecuteQuery executes a SingleStore query and returns results
func (a *SingleStoreAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to SingleStore")
	}

	startTime := time.Now()

	// Execute query
	rows, err := a.db.QueryContext(ctx, query, params...)
	if err != nil {
		return nil, fmt.Errorf("SingleStore query failed: %w", err)
	}
	defer rows.Close()

	// Get column information
	colTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, fmt.Errorf("failed to get columns: %w", err)
	}

	var columns []types.ColumnInfo
	for _, ct := range colTypes {
		nullable, _ := ct.Nullable()
		columns = append(columns, types.ColumnInfo{
			Name:     ct.Name(),
			Type:     ct.DatabaseTypeName(),
			Nullable: nullable,
		})
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
			var val interface{}
			val = values[i]

			// Handle byte slices (common in SQL drivers)
			if b, ok := val.([]byte); ok {
				val = string(b)
			}

			row[col.Name] = val
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
	}).Debug("SingleStore query executed")

	return &types.QueryResult{
		Columns: columns,
		Rows:    results,
		Count:   int64(len(results)),
	}, nil
}

// GetSchema retrieves schema information from SingleStore
func (a *SingleStoreAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to SingleStore")
	}

	schema := &types.SchemaInfo{
		Tables: []types.TableInfo{},
	}

	// Get all tables in the database
	query := `
		SELECT TABLE_NAME, TABLE_TYPE
		FROM information_schema.TABLES
		WHERE TABLE_SCHEMA = ?
		ORDER BY TABLE_NAME
	`
	rows, err := a.db.QueryContext(ctx, query, a.conn.Database)
	if err != nil {
		return nil, fmt.Errorf("failed to query tables: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var tableName, tableType string
		if err := rows.Scan(&tableName, &tableType); err != nil {
			continue
		}

		// Get table columns
		columns, err := a.getTableColumns(ctx, tableName)
		if err != nil {
			a.logger.Warnf("Failed to get columns for table %s: %v", tableName, err)
			continue
		}

		// Get table indexes
		indexes, err := a.getTableIndexes(ctx, tableName)
		if err != nil {
			a.logger.Warnf("Failed to get indexes for table %s: %v", tableName, err)
		}

		tableInfo := types.TableInfo{
			Name:    tableName,
			Schema:  a.conn.Database,
			Columns: columns,
			Indexes: indexes,
		}

		schema.Tables = append(schema.Tables, tableInfo)
	}

	return schema, nil
}

// GetTableInfo retrieves information about a specific SingleStore table
func (a *SingleStoreAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to SingleStore")
	}

	columns, err := a.getTableColumns(ctx, tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to get table columns: %w", err)
	}

	indexes, err := a.getTableIndexes(ctx, tableName)
	if err != nil {
		a.logger.Warnf("Failed to get indexes for table %s: %v", tableName, err)
	}

	return &types.TableInfo{
		Name:    tableName,
		Schema:  a.conn.Database,
		Columns: columns,
		Indexes: indexes,
	}, nil
}

// IsConnected returns true if the adapter is connected
func (a *SingleStoreAdapter) IsConnected() bool {
	return a.db != nil
}

// GetConnectionInfo returns connection information
func (a *SingleStoreAdapter) GetConnectionInfo() *entities.Connection {
	return a.conn
}

// getTableColumns retrieves column information for a specific table
func (a *SingleStoreAdapter) getTableColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	query := `
		SELECT
			COLUMN_NAME,
			DATA_TYPE,
			IS_NULLABLE,
			COLUMN_DEFAULT,
			COLUMN_KEY,
			EXTRA
		FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
		ORDER BY ORDINAL_POSITION
	`

	rows, err := a.db.QueryContext(ctx, query, a.conn.Database, tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to query columns: %w", err)
	}
	defer rows.Close()

	var columns []types.ColumnInfo

	for rows.Next() {
		var name, dataType, nullable, defaultValue, columnKey, extra sql.NullString

		if err := rows.Scan(&name, &dataType, &nullable, &defaultValue, &columnKey, &extra); err != nil {
			continue
		}

		column := types.ColumnInfo{
			Name:         name.String,
			Type:         dataType.String,
			Nullable:     nullable.Valid && nullable.String == "YES",
			DefaultValue: defaultValue.String,
			IsPrimaryKey: columnKey.Valid && columnKey.String == "PRI",
		}

		columns = append(columns, column)
	}

	return columns, nil
}

// getTableIndexes retrieves index information for a specific table
func (a *SingleStoreAdapter) getTableIndexes(ctx context.Context, tableName string) ([]types.IndexInfo, error) {
	query := `
		SELECT
			INDEX_NAME,
			COLUMN_NAME,
			NON_UNIQUE
		FROM information_schema.STATISTICS
		WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
		ORDER BY INDEX_NAME, SEQ_IN_INDEX
	`

	rows, err := a.db.QueryContext(ctx, query, a.conn.Database, tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to query indexes: %w", err)
	}
	defer rows.Close()

	indexMap := make(map[string][]string)
	uniqueMap := make(map[string]bool)

	for rows.Next() {
		var indexName, columnName string
		var nonUnique int

		if err := rows.Scan(&indexName, &columnName, &nonUnique); err != nil {
			continue
		}

		if indexMap[indexName] == nil {
			indexMap[indexName] = []string{}
			uniqueMap[indexName] = nonUnique == 0
		}
		indexMap[indexName] = append(indexMap[indexName], columnName)
	}

	var indexes []types.IndexInfo
	for name, columns := range indexMap {
		indexes = append(indexes, types.IndexInfo{
			Name:    name,
			Columns: columns,
			Unique:  uniqueMap[name],
		})
	}

	return indexes, nil
}

// Helper functions
func (a *SingleStoreAdapter) getIntOption(key string, defaultValue int) int {
	if value, ok := a.conn.Options[key]; ok {
		if val, err := strconv.Atoi(value); err == nil {
			return val
		}
	}
	return defaultValue
}

func (a *SingleStoreAdapter) getDurationOption(key string, defaultValue time.Duration) time.Duration {
	if value, ok := a.conn.Options[key]; ok {
		if val, err := time.ParseDuration(value); err == nil {
			return val
		}
	}
	return defaultValue
}

func truncateQuery(query string, maxLen int) string {
	if len(query) <= maxLen {
		return query
	}
	return query[:maxLen] + "..."
}

// GetEngineType returns the SingleStore engine type
func (a *SingleStoreAdapter) GetEngineType() string {
	if a.db == nil {
		return ""
	}

	var engineType string
	query := "SELECT @@GLOBAL.version_comment"
	err := a.db.QueryRowContext(context.Background(), query).Scan(&engineType)
	if err != nil {
		return "SingleStore"
	}

	if strings.Contains(strings.ToLower(engineType), "memsql") {
		return "SingleStore (formerly MemSQL)"
	}
	return "SingleStore"
}

// GetClusterStatus returns cluster status information
func (a *SingleStoreAdapter) GetClusterStatus(ctx context.Context) (map[string]interface{}, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to SingleStore")
	}

	status := make(map[string]interface{})

	// Get basic cluster info
	queries := map[string]string{
		"cluster_nodes":    "SELECT COUNT(*) as node_count FROM information_schema.distributions",
		"database_size":    "SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb FROM information_schema.TABLES WHERE table_schema = DATABASE()",
		"total_tables":     "SELECT COUNT(*) as table_count FROM information_schema.TABLES WHERE table_schema = DATABASE()",
		"connection_count": "SHOW STATUS LIKE 'Threads_connected'",
		"version":          "SELECT VERSION() as version",
	}

	for key, query := range queries {
		var result interface{}
		err := a.db.QueryRowContext(ctx, query).Scan(&result)
		if err != nil {
			status[key] = fmt.Sprintf("Error: %v", err)
		} else {
			status[key] = result
		}
	}

	return status, nil
}

// BeginTransaction starts a new transaction
func (a *SingleStoreAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	if a.db == nil {
		return nil, fmt.Errorf("not connected to SingleStore")
	}
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	return &SingleStoreTransaction{tx: tx}, nil
}

// HealthCheck performs a health check
func (a *SingleStoreAdapter) HealthCheck(ctx context.Context) error {
	return a.Ping(ctx)
}

// Ping pings the database
func (a *SingleStoreAdapter) Ping(ctx context.Context) error {
	if a.db == nil {
		return fmt.Errorf("not connected to SingleStore")
	}
	return a.db.PingContext(ctx)
}

// GetMetrics returns connection metrics
func (a *SingleStoreAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return &types.ConnectionMetrics{
		LastUpdated: time.Now(),
		DatabaseInfo: types.DatabaseInfo{
			Engine:  "SingleStore",
			Version: "Unknown",
		},
	}, nil
}

// SingleStoreTransaction implements types.Transaction
type SingleStoreTransaction struct {
	tx *sql.Tx
}

func (t *SingleStoreTransaction) Commit() error {
	return t.tx.Commit()
}

func (t *SingleStoreTransaction) Rollback() error {
	return t.tx.Rollback()
}
