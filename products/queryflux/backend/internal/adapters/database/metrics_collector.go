package database

import (
	"context"
	"database/sql"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
	"go.uber.org/zap"
)

// validMetricsIdentifier matches safe SQL identifiers
var validMetricsIdentifier = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)

// sanitizeMetricsID validates and quotes a SQL identifier
func sanitizeMetricsID(name string) (string, error) {
	if !validMetricsIdentifier.MatchString(name) {
		return "", fmt.Errorf("invalid SQL identifier: %q", name)
	}
	return `"` + name + `"`, nil
}

// DatabaseMetricsCollector implements database metrics collection
type DatabaseMetricsCollector struct {
	logger      *zap.Logger
	db          *sql.DB
	dbType      string
	connectionID string
	enabled     bool
	lastMetrics *domain.DatabaseMetrics
}

// NewDatabaseMetricsCollector creates a new database metrics collector
func NewDatabaseMetricsCollector(logger *zap.Logger, db *sql.DB, dbType, connectionID string) *DatabaseMetricsCollector {
	return &DatabaseMetricsCollector{
		logger:      logger,
		db:          db,
		dbType:      strings.ToLower(dbType),
		connectionID: connectionID,
		enabled:     true,
	}
}

// CollectDatabaseMetrics collects comprehensive database metrics
func (c *DatabaseMetricsCollector) CollectDatabaseMetrics(ctx context.Context) (*domain.DatabaseMetrics, error) {
	if !c.enabled {
		return nil, fmt.Errorf("metrics collection is disabled for connection %s", c.connectionID)
	}

	metrics := &domain.DatabaseMetrics{
		ID:           generateMetricsID(c.connectionID),
		ConnectionID: c.connectionID,
		DatabaseType: c.dbType,
		Timestamp:    time.Now(),
		IndexUsage:   make([]domain.IndexMetric, 0),
		TableMetrics: make([]domain.TableMetric, 0),
		Queries:      make([]domain.QueryMetric, 0),
		Metadata:     make(map[string]interface{}),
	}

	// Collect connection metrics
	if err := c.collectConnectionMetrics(ctx, metrics); err != nil {
		c.logger.Warn("Failed to collect connection metrics", zap.Error(err), zap.String("connection_id", c.connectionID))
	}

	// Collect performance metrics based on database type
	switch c.dbType {
	case "postgresql", "postgres":
		if err := c.collectPostgreSQLMetrics(ctx, metrics); err != nil {
			c.logger.Warn("Failed to collect PostgreSQL metrics", zap.Error(err), zap.String("connection_id", c.connectionID))
		}
	case "mysql":
		if err := c.collectMySQLMetrics(ctx, metrics); err != nil {
			c.logger.Warn("Failed to collect MySQL metrics", zap.Error(err), zap.String("connection_id", c.connectionID))
		}
	case "sqlite":
		if err := c.collectSQLiteMetrics(ctx, metrics); err != nil {
			c.logger.Warn("Failed to collect SQLite metrics", zap.Error(err), zap.String("connection_id", c.connectionID))
		}
	default:
		c.logger.Warn("Unsupported database type for metrics collection", zap.String("db_type", c.dbType))
	}

	c.lastMetrics = metrics
	return metrics, nil
}

// CollectConnectionMetrics collects database connection metrics
func (c *DatabaseMetricsCollector) CollectConnectionMetrics(ctx context.Context) (*ports.ConnectionMetrics, error) {
	if c.db == nil {
		return nil, fmt.Errorf("database connection is nil")
	}

	stats := c.db.Stats()

	metrics := &ports.ConnectionMetrics{
		ConnectionID: c.connectionID,
		ActiveQueries: 0, // This would need to be populated by actual query tracking
		QueuedQueries: 0,
		TotalQueries:  int64(stats.MaxOpenConnections - stats.Idle),
		LastActivity:  time.Now(),
		IsHealthy:     c.db.PingContext(ctx) == nil,
	}

	// Calculate average query time (this would need actual query timing data)
	metrics.AvgQueryTime = 0
	metrics.MaxQueryTime = 0

	// Calculate error rate (this would need actual error tracking data)
	metrics.ErrorRate = 0.0

	return metrics, nil
}

// CollectQueryMetrics collects recent query execution metrics
func (c *DatabaseMetricsCollector) CollectQueryMetrics(ctx context.Context, limit int) ([]*domain.QueryMetric, error) {
	queries := make([]*domain.QueryMetric, 0)

	switch c.dbType {
	case "postgresql", "postgres":
		queries = append(queries, c.collectPostgreSQLQueryMetrics(ctx, limit)...)
	case "mysql":
		queries = append(queries, c.collectMySQLQueryMetrics(ctx, limit)...)
	default:
		c.logger.Warn("Query metrics collection not supported for database type", zap.String("db_type", c.dbType))
	}

	return queries, nil
}

// CollectTableMetrics collects table-level metrics
func (c *DatabaseMetricsCollector) CollectTableMetrics(ctx context.Context) ([]*domain.TableMetric, error) {
	tables := make([]*domain.TableMetric, 0)

	switch c.dbType {
	case "postgresql", "postgres":
		tables = append(tables, c.collectPostgreSQLTableMetrics(ctx)...)
	case "mysql":
		tables = append(tables, c.collectMySQLTableMetrics(ctx)...)
	case "sqlite":
		tables = append(tables, c.collectSQLiteTableMetrics(ctx)...)
	default:
		c.logger.Warn("Table metrics collection not supported for database type", zap.String("db_type", c.dbType))
	}

	return tables, nil
}

// CollectIndexMetrics collects index usage metrics
func (c *DatabaseMetricsCollector) CollectIndexMetrics(ctx context.Context) ([]*domain.IndexMetric, error) {
	indices := make([]*domain.IndexMetric, 0)

	switch c.dbType {
	case "postgresql", "postgres":
		indices = append(indices, c.collectPostgreSQLIndexMetrics(ctx)...)
	case "mysql":
		indices = append(indices, c.collectMySQLIndexMetrics(ctx)...)
	default:
		c.logger.Warn("Index metrics collection not supported for database type", zap.String("db_type", c.dbType))
	}

	return indices, nil
}

// EnableCollection enables metrics collection for this connection
func (c *DatabaseMetricsCollector) EnableCollection(ctx context.Context, interval time.Duration) error {
	c.enabled = true
	c.logger.Info("Database metrics collection enabled",
		zap.String("connection_id", c.connectionID),
		zap.Duration("interval", interval))
	return nil
}

// DisableCollection disables metrics collection for this connection
func (c *DatabaseMetricsCollector) DisableCollection(ctx context.Context) error {
	c.enabled = false
	c.logger.Info("Database metrics collection disabled", zap.String("connection_id", c.connectionID))
	return nil
}

// Database-specific metric collection methods

func (c *DatabaseMetricsCollector) collectConnectionMetrics(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	stats := c.db.Stats()

	metrics.ActiveConnections = int64(stats.OpenConnections)
	metrics.IdleConnections = int64(stats.Idle)
	metrics.TotalConnections = int64(stats.MaxOpenConnections)

	// Additional connection-specific metrics would be collected here
	return nil
}

func (c *DatabaseMetricsCollector) collectPostgreSQLMetrics(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	// Collect database size
	query := `
		SELECT pg_database_size(current_database()) as size,
			   pg_stat_database.datid,
			   pg_stat_database.datname,
			   pg_stat_database.numbackends,
			   pg_stat_database.xact_commit,
			   pg_stat_database.xact_rollback,
			   pg_stat_database.blks_read,
			   pg_stat_database.blks_hit,
			   pg_stat_database.tup_returned,
			   pg_stat_database.tup_fetched,
			   pg_stat_database.tup_inserted,
			   pg_stat_database.tup_updated,
			   pg_stat_database.tup_deleted
		FROM pg_stat_database
		WHERE pg_stat_database.datname = current_database()
	`

	var dbSize, numBackends, xactCommit, xactRollback, blksRead, blksHit int64
	var tupReturned, tupFetched, tupInserted, tupUpdated, tupDeleted int64

	err := c.db.QueryRowContext(ctx, query).Scan(
		&dbSize, nil, nil, &numBackends, &xactCommit, &xactRollback,
		&blksRead, &blksHit, &tupReturned, &tupFetched,
		&tupInserted, &tupUpdated, &tupDeleted,
	)

	if err != nil {
		return fmt.Errorf("failed to collect PostgreSQL database stats: %w", err)
	}

	metrics.ConnectionCount = numBackends
	metrics.QueryCount = xactCommit + xactRollback
	metrics.BytesReceived = blksRead * 8192 // Assuming 8KB block size
	metrics.BytesSent = blksHit * 8192

	// Calculate cache hit ratio
	if blksRead+blksHit > 0 {
		metrics.CacheHitRatio = float64(blksHit) / float64(blksRead+blksHit) * 100
	}

	// Get system metrics for CPU and memory usage (this would typically come from system monitoring)
	metrics.CPUUsage = 0.0 // Placeholder
	metrics.MemoryUsage = 0 // Placeholder

	// Collect slow queries
	if err := c.collectPostgreSQLSlowQueries(ctx, metrics); err != nil {
		c.logger.Warn("Failed to collect slow queries", zap.Error(err))
	}

	return nil
}

func (c *DatabaseMetricsCollector) collectPostgreSQLSlowQueries(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	// This is a simplified version - in practice you'd need to set up pg_stat_statements
	query := `
		SELECT COUNT(*) as slow_queries
		FROM pg_stat_statements
		WHERE mean_time > 1000 -- queries taking more than 1 second
	`

	var slowQueryCount int64
	err := c.db.QueryRowContext(ctx, query).Scan(&slowQueryCount)
	if err != nil {
		// pg_stat_statements might not be enabled
		c.logger.Debug("pg_stat_statements not available for slow query collection", zap.Error(err))
		return nil
	}

	metrics.SlowQueryCount = slowQueryCount
	return nil
}

func (c *DatabaseMetricsCollector) collectPostgreSQLQueryMetrics(ctx context.Context, limit int) []*domain.QueryMetric {
	query := `
		SELECT query, calls, total_time, mean_time, rows
		FROM pg_stat_statements
		ORDER BY total_time DESC
		LIMIT $1
	`

	rows, err := c.db.QueryContext(ctx, query, limit)
	if err != nil {
		c.logger.Warn("Failed to collect PostgreSQL query metrics", zap.Error(err))
		return nil
	}
	defer rows.Close()

	var queries []*domain.QueryMetric
	for rows.Next() {
		var queryText string
		var calls, totalExecTime, meanExecTime float64
		var rowsReturned int64

		if err := rows.Scan(&queryText, &calls, &totalExecTime, &meanExecTime, &rowsReturned); err != nil {
			c.logger.Warn("Failed to scan query metrics row", zap.Error(err))
			continue
		}

		metric := &domain.QueryMetric{
			ID:            generateQueryID(queryText),
			Query:         queryText,
			QueryHash:     generateQueryHash(queryText),
			Duration:      time.Duration(meanExecTime) * time.Millisecond,
			RowsReturned:  rowsReturned,
			RowsAffected:  rowsReturned, // PostgreSQL doesn't distinguish in pg_stat_statements
			Success:       true,
			Timestamp:     time.Now(),
		}

		queries = append(queries, metric)
	}

	return queries
}

func (c *DatabaseMetricsCollector) collectPostgreSQLTableMetrics(ctx context.Context) []*domain.TableMetric {
	query := `
		SELECT
			schemaname,
			tablename,
			n_tup_ins as inserts,
			n_tup_upd as updates,
			n_tup_del as deletes,
			n_live_tup as live_tuples,
			n_dead_tup as dead_tuples,
			seq_scan as sequential_scans,
			idx_scan as index_scans,
			last_vacuum,
			last_analyze
		FROM pg_stat_user_tables
		ORDER BY schemaname, tablename
	`

	rows, err := c.db.QueryContext(ctx, query)
	if err != nil {
		c.logger.Warn("Failed to collect PostgreSQL table metrics", zap.Error(err))
		return nil
	}
	defer rows.Close()

	var tables []*domain.TableMetric
	for rows.Next() {
		var schema, tableName string
		var inserts, updates, deletes, liveTuples, deadTuples, seqScans, idxScans int64
		var lastVacuum, lastAnalyze sql.NullTime

		if err := rows.Scan(&schema, &tableName, &inserts, &updates, &deletes,
			&liveTuples, &deadTuples, &seqScans, &idxScans, &lastVacuum, &lastAnalyze); err != nil {
			c.logger.Warn("Failed to scan table metrics row", zap.Error(err))
			continue
		}

		table := &domain.TableMetric{
			Name:            fmt.Sprintf("%s.%s", schema, tableName),
			RowCount:        liveTuples,
			InsertCount:     inserts,
			UpdateCount:     updates,
			DeleteCount:     deletes,
			SequentialScans: seqScans,
			IndexScans:      idxScans,
		}

		if lastAnalyze.Valid {
			table.LastAnalyzed = lastAnalyze.Time
		}

		tables = append(tables, table)
	}

	return tables
}

func (c *DatabaseMetricsCollector) collectPostgreSQLIndexMetrics(ctx context.Context) []*domain.IndexMetric {
	query := `
		SELECT
			schemaname,
			tablename,
			indexname,
			idx_scan as scans,
			idx_tup_read as tuples_read,
			idx_tup_fetch as tuples_fetched
		FROM pg_stat_user_indexes
		ORDER BY schemaname, tablename, indexname
	`

	rows, err := c.db.QueryContext(ctx, query)
	if err != nil {
		c.logger.Warn("Failed to collect PostgreSQL index metrics", zap.Error(err))
		return nil
	}
	defer rows.Close()

	var indices []*domain.IndexMetric
	for rows.Next() {
		var schema, tableName, indexName string
		var scans, tuplesRead, tuplesFetched int64

		if err := rows.Scan(&schema, &tableName, &indexName, &scans, &tuplesRead, &tuplesFetched); err != nil {
			c.logger.Warn("Failed to scan index metrics row", zap.Error(err))
			continue
		}

		index := &domain.IndexMetric{
			Name:      fmt.Sprintf("%s.%s.%s", schema, tableName, indexName),
			TableName: fmt.Sprintf("%s.%s", schema, tableName),
			Scans:     scans,
			UsageCount: scans,
			LastUsed:  time.Now(), // This would need to be tracked differently
		}

		indices = append(indices, index)
	}

	return indices
}

func (c *DatabaseMetricsCollector) collectMySQLMetrics(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	// Collect MySQL global status variables
	query := "SHOW GLOBAL STATUS"
	rows, err := c.db.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to collect MySQL global status: %w", err)
	}
	defer rows.Close()

	statusVars := make(map[string]string)
	for rows.Next() {
		var variableName, variableValue string
		if err := rows.Scan(&variableName, &variableValue); err != nil {
			continue
		}
		statusVars[variableName] = variableValue
	}

	// Parse relevant metrics
	if connections, ok := statusVars["Threads_connected"]; ok {
		if val, err := strconv.ParseInt(connections, 10, 64); err == nil {
			metrics.ActiveConnections = val
		}
	}

	if queries, ok := statusVars["Queries"]; ok {
		if val, err := strconv.ParseInt(queries, 10, 64); err == nil {
			metrics.QueryCount = val
		}
	}

	if slowQueries, ok := statusVars["Slow_queries"]; ok {
		if val, err := strconv.ParseInt(slowQueries, 10, 64); err == nil {
			metrics.SlowQueryCount = val
		}
	}

	// Calculate cache hit ratio
	if hits, ok := statusVars["Key_reads"]; ok {
		if misses, ok := statusVars["Key_read_requests"]; ok {
			if hitsVal, err := strconv.ParseInt(hits, 10, 64); err == nil {
				if missesVal, err := strconv.ParseInt(misses, 10, 64); err == nil && missesVal > 0 {
					metrics.CacheHitRatio = float64(missesVal-hitsVal) / float64(missesVal) * 100
				}
			}
		}
	}

	return nil
}

func (c *DatabaseMetricsCollector) collectMySQLQueryMetrics(ctx context.Context, limit int) []*domain.QueryMetric {
	// This would typically query the performance_schema or slow query log
	// For now, return empty slice as implementation would be complex
	return []*domain.QueryMetric{}
}

func (c *DatabaseMetricsCollector) collectMySQLTableMetrics(ctx context.Context) []*domain.TableMetric {
	query := `
		SELECT
			table_schema,
			table_name,
			table_rows,
			data_length,
			index_length,
			update_time
		FROM information_schema.tables
		WHERE table_schema NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
		ORDER BY table_schema, table_name
	`

	rows, err := c.db.QueryContext(ctx, query)
	if err != nil {
		c.logger.Warn("Failed to collect MySQL table metrics", zap.Error(err))
		return nil
	}
	defer rows.Close()

	var tables []*domain.TableMetric
	for rows.Next() {
		var schema, tableName string
		var rowCount, dataLength, indexLength sql.NullInt64
		var updateTime sql.NullTime

		if err := rows.Scan(&schema, &tableName, &rowCount, &dataLength, &indexLength, &updateTime); err != nil {
			c.logger.Warn("Failed to scan table metrics row", zap.Error(err))
			continue
		}

		table := &domain.TableMetric{
			Name: fmt.Sprintf("%s.%s", schema, tableName),
		}

		if rowCount.Valid {
			table.RowCount = rowCount.Int64
		}

		if dataLength.Valid {
			table.Size = dataLength.Int64
		}

		if indexLength.Valid {
			table.IndexSize = indexLength.Int64
		}

		tables = append(tables, table)
	}

	return tables
}

func (c *DatabaseMetricsCollector) collectMySQLIndexMetrics(ctx context.Context) []*domain.IndexMetric {
	// MySQL index metrics collection from information_schema.statistics
	return []*domain.IndexMetric{}
}

func (c *DatabaseMetricsCollector) collectSQLiteMetrics(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	// SQLite has limited system metrics available
	// This would typically involve PRAGMA statements
	return nil
}

func (c *DatabaseMetricsCollector) collectSQLiteTableMetrics(ctx context.Context) []*domain.TableMetric {
	query := `
		SELECT name, sql FROM sqlite_master
		WHERE type='table' AND name NOT LIKE 'sqlite_%'
		ORDER BY name
	`

	rows, err := c.db.QueryContext(ctx, query)
	if err != nil {
		c.logger.Warn("Failed to collect SQLite table metrics", zap.Error(err))
		return nil
	}
	defer rows.Close()

	var tables []*domain.TableMetric
	for rows.Next() {
		var tableName, createSQL string
		if err := rows.Scan(&tableName, &createSQL); err != nil {
			continue
		}

		// Get row count for each table — sanitize table name
		safeTable, sanitizeErr := sanitizeMetricsID(tableName)
		if sanitizeErr != nil {
			continue
		}
		var rowCount int64
		if err := c.db.QueryRowContext(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s", safeTable)).Scan(&rowCount); err == nil {
			table := &domain.TableMetric{
				Name:     tableName,
				RowCount: rowCount,
			}
			tables = append(tables, table)
		}
	}

	return tables
}

// Utility functions

func generateMetricsID(connectionID string) string {
	return fmt.Sprintf("db_metrics_%s_%d", connectionID, time.Now().UnixNano())
}

func generateQueryID(query string) string {
	return fmt.Sprintf("query_%d_%s", time.Now().UnixNano(), generateQueryHash(query))
}

func generateQueryHash(query string) string {
	// Simple hash function - in practice you'd use a proper hashing algorithm
	return fmt.Sprintf("%x", len(query)+int(time.Now().UnixNano()))
}