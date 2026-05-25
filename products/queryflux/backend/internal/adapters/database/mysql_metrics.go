package database

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql" // MySQL driver
	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
	"go.uber.org/zap"
)

// MySQLMetricsCollector implements detailed MySQL metrics collection
type MySQLMetricsCollector struct {
	logger       *zap.Logger
	conn         *sql.DB
	connectionID string
	dbName       string
}

// NewMySQLMetricsCollector creates a new MySQL metrics collector
func NewMySQLMetricsCollector(logger *zap.Logger, conn *sql.DB, connectionID string) (*MySQLMetricsCollector, error) {
	// Get database name
	var dbName string
	if err := conn.QueryRow("SELECT DATABASE()").Scan(&dbName); err != nil {
		return nil, fmt.Errorf("failed to get database name: %w", err)
	}

	return &MySQLMetricsCollector{
		logger:       logger,
		conn:         conn,
		connectionID: connectionID,
		dbName:       dbName,
	}, nil
}

// CollectDatabaseMetrics collects comprehensive MySQL metrics
func (m *MySQLMetricsCollector) CollectDatabaseMetrics(ctx context.Context, connectionID string) (*domain.DatabaseMetrics, error) {
	metrics := &domain.DatabaseMetrics{
		ID:           fmt.Sprintf("mysql_metrics_%s_%d", m.connectionID, time.Now().UnixNano()),
		ConnectionID: m.connectionID,
		DatabaseType: "mysql",
		Timestamp:    time.Now(),
		IndexUsage:   make([]domain.IndexMetric, 0),
		TableMetrics: make([]domain.TableMetric, 0),
		Queries:      make([]domain.QueryMetric, 0),
		Metadata:     make(map[string]interface{}),
	}

	// Collect global status variables
	if err := m.collectGlobalStatus(ctx, metrics); err != nil {
		m.logger.Warn("Failed to collect global status", zap.Error(err))
	}

	// Collect global variables
	if err := m.collectGlobalVariables(ctx, metrics); err != nil {
		m.logger.Warn("Failed to collect global variables", zap.Error(err))
	}

	// Collect connection metrics
	if err := m.collectConnectionMetrics(ctx, metrics); err != nil {
		m.logger.Warn("Failed to collect connection metrics", zap.Error(err))
	}

	// Collect table metrics
	if err := m.collectTableMetrics(ctx, metrics); err != nil {
		m.logger.Warn("Failed to collect table metrics", zap.Error(err))
	}

	// Collect index metrics
	if err := m.collectIndexMetrics(ctx, metrics); err != nil {
		m.logger.Warn("Failed to collect index metrics", zap.Error(err))
	}

	// Collect slow queries
	if err := m.collectSlowQueries(ctx, metrics); err != nil {
		m.logger.Warn("Failed to collect slow queries", zap.Error(err))
	}

	// Collect InnoDB metrics if available
	if err := m.collectInnoDBMetrics(ctx, metrics); err != nil {
		m.logger.Debug("Failed to collect InnoDB metrics", zap.Error(err))
	}

	// Collect performance schema metrics if available
	if err := m.collectPerformanceSchemaMetrics(ctx, metrics); err != nil {
		m.logger.Debug("Failed to collect performance schema metrics", zap.Error(err))
	}

	return metrics, nil
}

// collectGlobalStatus collects MySQL global status variables
func (m *MySQLMetricsCollector) collectGlobalStatus(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	query := "SHOW GLOBAL STATUS"
	rows, err := m.conn.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to get global status: %w", err)
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

	// Parse important metrics
	if connections, err := strconv.ParseInt(statusVars["Threads_connected"], 10, 64); err == nil {
		metrics.ActiveConnections = connections
	}

	if queries, err := strconv.ParseInt(statusVars["Questions"], 10, 64); err == nil {
		metrics.QueryCount = queries
	}

	if slowQueries, err := strconv.ParseInt(statusVars["Slow_queries"], 10, 64); err == nil {
		metrics.SlowQueryCount = slowQueries
	}

	// Calculate cache hit ratio
	if keyReads, err := strconv.ParseInt(statusVars["Key_reads"], 10, 64); err == nil {
		if keyRequests, err := strconv.ParseInt(statusVars["Key_read_requests"], 10, 64); err == nil && keyRequests > 0 {
			metrics.CacheHitRatio = float64(keyRequests-keyReads) / float64(keyRequests) * 100
		}
	}

	// Additional important metrics
	metrics.Metadata["uptime"] = parseInt(statusVars["Uptime"])
	metrics.Metadata["bytes_received"] = parseInt(statusVars["Bytes_received"])
	metrics.Metadata["bytes_sent"] = parseInt(statusVars["Bytes_sent"])
	metrics.Metadata["aborted_connects"] = parseInt(statusVars["Aborted_connects"])
	metrics.Metadata["aborted_clients"] = parseInt(statusVars["Aborted_clients"])
	metrics.Metadata["connection_errors_max_connections"] = parseInt(statusVars["Connection_errors_max_connections"])
	metrics.Metadata["max_used_connections"] = parseInt(statusVars["Max_used_connections"])
	metrics.Metadata["select_full_join"] = parseInt(statusVars["Select_full_join"])
	metrics.Metadata["select_scan"] = parseInt(statusVars["Select_scan"])
	metrics.Metadata["created_tmp_disk_tables"] = parseInt(statusVars["Created_tmp_disk_tables"])
	metrics.Metadata["created_tmp_tables"] = parseInt(statusVars["Created_tmp_tables"])

	// Store raw status vars for analysis
	for k, v := range statusVars {
		metrics.Metadata["status_"+strings.ToLower(k)] = v
	}

	return nil
}

// collectGlobalVariables collects MySQL global variables
func (m *MySQLMetricsCollector) collectGlobalVariables(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	query := "SHOW GLOBAL VARIABLES"
	rows, err := m.conn.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to get global variables: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var variableName, variableValue string
		if err := rows.Scan(&variableName, &variableValue); err != nil {
			continue
		}

		// Store important configuration variables
		switch variableName {
		case "max_connections":
			metrics.Metadata["max_connections"] = parseInt(variableValue)
		case "innodb_buffer_pool_size":
			metrics.Metadata["innodb_buffer_pool_size"] = parseInt(variableValue)
		case "query_cache_size":
			metrics.Metadata["query_cache_size"] = parseInt(variableValue)
		case "innodb_log_file_size":
			metrics.Metadata["innodb_log_file_size"] = parseInt(variableValue)
		case "innodb_log_buffer_size":
			metrics.Metadata["innodb_log_buffer_size"] = parseInt(variableValue)
		case "sort_buffer_size":
			metrics.Metadata["sort_buffer_size"] = parseInt(variableValue)
		case "join_buffer_size":
			metrics.Metadata["join_buffer_size"] = parseInt(variableValue)
		}

		metrics.Metadata["variable_"+strings.ToLower(variableName)] = variableValue
	}

	return nil
}

// collectConnectionMetrics collects detailed connection metrics
func (m *MySQLMetricsCollector) collectConnectionMetrics(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	query := `
		SELECT
			COUNT(*) as total_connections,
			SUM(CASE WHEN Command = 'Sleep' THEN 1 ELSE 0 END) as sleeping,
			SUM(CASE WHEN Command = 'Query' THEN 1 ELSE 0 END) as querying,
			SUM(CASE WHEN Command = 'Connect' THEN 1 ELSE 0 END) as connecting,
			SUM(CASE WHEN State = 'Locked' THEN 1 ELSE 0 END) as locked,
			SUM(CASE WHEN Time > 60 THEN 1 ELSE 0 END) as long_running
		FROM INFORMATION_SCHEMA.PROCESSLIST
		WHERE DB = DATABASE()
	`

	var totalConnections, sleeping, querying, connecting, locked, longRunning int64
	err := m.conn.QueryRowContext(ctx, query).Scan(
		&totalConnections, &sleeping, &querying, &connecting, &locked, &longRunning,
	)
	if err != nil {
		return fmt.Errorf("failed to collect connection metrics: %w", err)
	}

	metrics.TotalConnections = totalConnections
	metrics.Metadata["sleeping_connections"] = sleeping
	metrics.Metadata["querying_connections"] = querying
	metrics.Metadata["connecting_connections"] = connecting
	metrics.Metadata["locked_connections"] = locked
	metrics.Metadata["long_running_queries"] = longRunning

	return nil
}

// collectTableMetrics collects table-level statistics
func (m *MySQLMetricsCollector) collectTableMetrics(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	query := `
		SELECT
			TABLE_NAME,
			TABLE_ROWS,
			DATA_LENGTH,
			INDEX_LENGTH,
			DATA_FREE,
			TABLE_COLLATION,
			ENGINE,
			CREATE_TIME,
			UPDATE_TIME,
			CHECK_TIME
		FROM INFORMATION_SCHEMA.TABLES
		WHERE TABLE_SCHEMA = DATABASE()
		ORDER BY DATA_LENGTH DESC
	`

	rows, err := m.conn.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to collect table metrics: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var tableName, collation, engine string
		var tableRows, dataLength, indexLength, dataFree sql.NullInt64
		var createTime, updateTime, checkTime sql.NullTime

		if err := rows.Scan(
			&tableName, &tableRows, &dataLength, &indexLength, &dataFree,
			&collation, &engine, &createTime, &updateTime, &checkTime,
		); err != nil {
			continue
		}

		tableMetric := domain.TableMetric{
			Name: tableName,
		}

		if tableRows.Valid {
			tableMetric.RowCount = tableRows.Int64
		}
		if dataLength.Valid {
			tableMetric.Size = dataLength.Int64
		}
		if indexLength.Valid {
			tableMetric.IndexSize = indexLength.Int64
		}
		if updateTime.Valid {
			tableMetric.LastAnalyzed = updateTime.Time
		}

		// Get DML operation counts from performance schema if available
		if m.hasPerformanceSchema(ctx) {
			if err := m.collectTableDMLMetrics(ctx, tableName, &tableMetric); err != nil {
				m.logger.Debug("Failed to collect table DML metrics", zap.Error(err), zap.String("table", tableName))
			}
		}

		metrics.TableMetrics = append(metrics.TableMetrics, tableMetric)
	}

	return nil
}

// collectIndexMetrics collects index usage statistics
func (m *MySQLMetricsCollector) collectIndexMetrics(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	if !m.hasPerformanceSchema(ctx) {
		return nil // Skip if performance schema is not available
	}

	query := `
		SELECT
			TABLE_NAME,
			INDEX_NAME,
			COUNT_READ,
			COUNT_FETCH,
			SUM_TIMER_WAIT,
			SUM_TIMER_INSERT,
			SUM_TIMER_UPDATE,
			SUM_TIMER_DELETE
		FROM performance_schema.table_io_waits_summary_by_index_usage
		WHERE OBJECT_SCHEMA = DATABASE()
		AND INDEX_NAME IS NOT NULL
		ORDER BY COUNT_READ DESC
		LIMIT 100
	`

	rows, err := m.conn.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to collect index metrics: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var tableName, indexName string
		var countRead, countFetch, timerRead, timerInsert, timerUpdate, timerDelete int64

		if err := rows.Scan(
			&tableName, &indexName, &countRead, &countFetch,
			&timerRead, &timerInsert, &timerUpdate, &timerDelete,
		); err != nil {
			continue
		}

		indexMetric := domain.IndexMetric{
			Name:       fmt.Sprintf("%s.%s", tableName, indexName),
			TableName:  tableName,
			UsageCount: countRead,
			Scans:      countRead,
			LastUsed:   time.Now(), // This would need better tracking
		}

		// Get index size and properties
		size, unique, primary := m.getIndexProperties(ctx, tableName, indexName)
		if size > 0 {
			indexMetric.Size = size
		}
		indexMetric.Unique = unique
		indexMetric.Primary = primary

		metrics.IndexUsage = append(metrics.IndexUsage, indexMetric)
	}

	return nil
}

// collectSlowQueries collects slow query information
func (m *MySQLMetricsCollector) collectSlowQueries(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	// Check if slow query log is enabled
	var slowQueryLog string
	err := m.conn.QueryRowContext(ctx, "SHOW VARIABLES LIKE 'slow_query_log'").Scan(new(string), &slowQueryLog)
	if err != nil {
		return fmt.Errorf("failed to check slow query log: %w", err)
	}

	if slowQueryLog != "ON" {
		return nil // Slow query log is not enabled
	}

	// This is a simplified version - in practice you'd query the slow query log file
	// or use the performance schema events_statements_summary_by_digest table
	query := `
		SELECT
			DIGEST_TEXT,
			COUNT_STAR,
			SUM_TIMER_WAIT,
			AVG_TIMER_WAIT,
			MAX_TIMER_WAIT,
			SUM_ROWS_AFFECTED,
			SUM_ROWS_SENT,
			SUM_ROWS_EXAMINED,
			FIRST_SEEN,
			LAST_SEEN
		FROM performance_schema.events_statements_summary_by_digest
		WHERE AVG_TIMER_WAIT > 1000000000 -- 1 second in nanoseconds
		ORDER BY AVG_TIMER_WAIT DESC
		LIMIT 10
	`

	rows, err := m.conn.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to collect slow queries: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var digestText string
		var countStar, sumTimer, avgTimer, maxTimer int64
		var rowsAffected, rowsSent, rowsExamined int64
		var firstSeen, lastSeen time.Time

		if err := rows.Scan(
			&digestText, &countStar, &sumTimer, &avgTimer, &maxTimer,
			&rowsAffected, &rowsSent, &rowsExamined, &firstSeen, &lastSeen,
		); err != nil {
			continue
		}

		// Convert nanoseconds to milliseconds
		avgDuration := time.Duration(avgTimer/1000000) * time.Millisecond

		queryMetric := domain.QueryMetric{
			ID:           fmt.Sprintf("slow_query_%d", time.Now().UnixNano()),
			Query:        digestText,
			QueryHash:    m.hashQuery(digestText),
			Duration:     avgDuration,
			RowsAffected: rowsAffected,
			RowsReturned: rowsSent,
			BytesScanned: rowsExamined, // Use BytesScanned instead of RowsScanned
			Success:      true,
			Timestamp:    lastSeen,
		}

		metrics.Queries = append(metrics.Queries, queryMetric)
	}

	return nil
}

// collectInnoDBMetrics collects InnoDB-specific metrics
func (m *MySQLMetricsCollector) collectInnoDBMetrics(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	// Get InnoDB status
	rows, err := m.conn.QueryContext(ctx, "SHOW ENGINE INNODB STATUS")
	if err != nil {
		return fmt.Errorf("failed to get InnoDB status: %w", err)
	}
	defer rows.Close()

	var engineType, statusText, comment sql.NullString
	if rows.Next() {
		if err := rows.Scan(&engineType, &statusText, &comment); err == nil && statusText.Valid {
			m.parseInnoDBStatus(statusText.String, metrics)
		}
	}

	// Get InnoDB metrics from information_schema
	query := `
		SELECT
			SUM(data_length) as total_data,
			SUM(index_length) as total_index,
			SUM(data_free) as total_free,
			COUNT(*) as table_count
		FROM information_schema.innodb_table_stats
		WHERE database_name = DATABASE()
	`

	var totalData, totalIndex, totalFree, tableCount sql.NullInt64
	err = m.conn.QueryRowContext(ctx, query).Scan(&totalData, &totalIndex, &totalFree, &tableCount)
	if err == nil {
		metrics.Metadata["innodb_data_size"] = totalData.Int64
		metrics.Metadata["innodb_index_size"] = totalIndex.Int64
		metrics.Metadata["innodb_free_space"] = totalFree.Int64
		metrics.Metadata["innodb_table_count"] = tableCount.Int64
	}

	return nil
}

// collectPerformanceSchemaMetrics collects metrics from performance schema
func (m *MySQLMetricsCollector) collectPerformanceSchemaMetrics(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	if !m.hasPerformanceSchema(ctx) {
		return nil
	}

	// Get table I/O metrics
	query := `
		SELECT
			SUM(COUNT_READ) as total_reads,
			SUM(COUNT_WRITE) as total_writes,
			SUM(SUM_TIMER_READ) as total_read_time,
			SUM(SUM_TIMER_WRITE) as total_write_time,
			SUM(COUNT_FETCH) as total_fetches
		FROM performance_schema.table_io_waits_summary_by_table
		WHERE OBJECT_SCHEMA = DATABASE()
	`

	var totalReads, totalWrites, totalReadTime, totalWriteTime, totalFetches sql.NullInt64
	err := m.conn.QueryRowContext(ctx, query).Scan(&totalReads, &totalWrites, &totalReadTime, &totalWriteTime, &totalFetches)
	if err == nil {
		metrics.Metadata["performance_schema_reads"] = totalReads.Int64
		metrics.Metadata["performance_schema_writes"] = totalWrites.Int64
		metrics.Metadata["performance_schema_fetches"] = totalFetches.Int64
	}

	return nil
}

// Helper methods

func (m *MySQLMetricsCollector) collectTableDMLMetrics(ctx context.Context, tableName string, tableMetric *domain.TableMetric) error {
	query := `
		SELECT
			COUNT_INSERT,
			COUNT_UPDATE,
			COUNT_DELETE,
			SUM_TIMER_INSERT,
			SUM_TIMER_UPDATE,
			SUM_TIMER_DELETE
		FROM performance_schema.table_io_waits_summary_by_table
		WHERE OBJECT_SCHEMA = DATABASE() AND OBJECT_NAME = ?
	`

	var countInsert, countUpdate, countDelete int64
	var timerInsert, timerUpdate, timerDelete sql.NullInt64

	err := m.conn.QueryRowContext(ctx, query, tableName).Scan(
		&countInsert, &countUpdate, &countDelete,
		&timerInsert, &timerUpdate, &timerDelete,
	)
	if err != nil {
		return err
	}

	tableMetric.InsertCount = countInsert
	tableMetric.UpdateCount = countUpdate
	tableMetric.DeleteCount = countDelete

	return nil
}

func (m *MySQLMetricsCollector) getIndexProperties(ctx context.Context, table, index string) (size int64, unique, primary bool) {
	query := `
		SELECT
			SUB_PART,
			NON_UNIQUE,
			INDEX_TYPE
		FROM information_schema.statistics
		WHERE table_schema = DATABASE()
		AND table_name = ?
		AND index_name = ?
		LIMIT 1
	`

	var subPart sql.NullInt64
	var nonUnique int
	var indexType string

	err := m.conn.QueryRowContext(ctx, query, table, index).Scan(&subPart, &nonUnique, &indexType)
	if err != nil {
		return
	}

	unique = nonUnique == 0
	primary = index == "PRIMARY"

	// Get index size
	sizeQuery := `
		SELECT
			SUM(STAT_LENGTH) as size
		FROM information_schema.statistics
		WHERE table_schema = DATABASE()
		AND table_name = ?
		AND index_name = ?
	`

	if err := m.conn.QueryRowContext(ctx, sizeQuery, table, index).Scan(&size); err != nil {
		size = 0
	}

	return
}

func (m *MySQLMetricsCollector) parseInnoDBStatus(status string, metrics *domain.DatabaseMetrics) {
	// This is a simplified version - you'd need a proper parser for InnoDB status
	lines := strings.Split(status, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.Contains(line, "Buffer pool size") {
			// Parse buffer pool information
			metrics.Metadata["innodb_buffer_pool_info"] = line
		} else if strings.Contains(line, "Total memory allocated") {
			metrics.Metadata["innodb_total_memory"] = line
		} else if strings.Contains(line, "Buffer pool hit rate") {
			metrics.Metadata["innodb_buffer_pool_hit_rate"] = line
		}
	}
}

func (m *MySQLMetricsCollector) hasPerformanceSchema(ctx context.Context) bool {
	var enabled string
	err := m.conn.QueryRowContext(ctx, "SHOW VARIABLES LIKE 'performance_schema'").Scan(new(string), &enabled)
	return err == nil && enabled == "ON"
}

func (m *MySQLMetricsCollector) hashQuery(query string) string {
	// Simple hash function - in practice you'd use a proper hashing algorithm
	return fmt.Sprintf("%x", len(query)+int(time.Now().UnixNano()))
}

func parseInt(s string) int64 {
	if val, err := strconv.ParseInt(s, 10, 64); err == nil {
		return val
	}
	return 0
}

// CollectConnectionMetrics collects connection-specific metrics
func (m *MySQLMetricsCollector) CollectConnectionMetrics(ctx context.Context, connectionID string) (*ports.ConnectionMetrics, error) {
	metrics := &domain.DatabaseMetrics{
		Metadata: make(map[string]interface{}),
	}
	if err := m.collectConnectionMetrics(ctx, metrics); err != nil {
		return nil, err
	}

	// Safe nil checks for metadata values
	var activeQueries int
	if val, ok := metrics.Metadata["querying_connections"].(int64); ok {
		activeQueries = int(val)
	}

	return &ports.ConnectionMetrics{
		ConnectionID:  connectionID,
		ActiveQueries: activeQueries,
		TotalQueries:  metrics.TotalConnections,
		IsHealthy:     true,
		LastActivity:  time.Now(),
	}, nil
}

// CollectQueryMetrics collects query execution metrics
func (m *MySQLMetricsCollector) CollectQueryMetrics(ctx context.Context, connectionID string, limit int) ([]*domain.QueryMetric, error) {
	metrics := &domain.DatabaseMetrics{
		Queries: make([]domain.QueryMetric, 0),
	}
	if err := m.collectSlowQueries(ctx, metrics); err != nil {
		return nil, err
	}

	// Filter to limit if needed
	var queryMetrics []domain.QueryMetric
	if limit > 0 && len(metrics.Queries) > limit {
		queryMetrics = metrics.Queries[:limit]
	} else {
		queryMetrics = metrics.Queries
	}

	// Convert slice of values to slice of pointers
	result := make([]*domain.QueryMetric, len(queryMetrics))
	for i := range queryMetrics {
		result[i] = &queryMetrics[i]
	}

	return result, nil
}

// CollectTableMetrics collects table-level metrics
func (m *MySQLMetricsCollector) CollectTableMetrics(ctx context.Context, connectionID string) ([]*domain.TableMetric, error) {
	metrics := &domain.DatabaseMetrics{
		TableMetrics: make([]domain.TableMetric, 0),
	}
	if err := m.collectTableMetrics(ctx, metrics); err != nil {
		return nil, err
	}

	// Convert slice of values to slice of pointers
	result := make([]*domain.TableMetric, len(metrics.TableMetrics))
	for i := range metrics.TableMetrics {
		result[i] = &metrics.TableMetrics[i]
	}
	return result, nil
}

// CollectIndexMetrics collects index usage metrics
func (m *MySQLMetricsCollector) CollectIndexMetrics(ctx context.Context, connectionID string) ([]*domain.IndexMetric, error) {
	metrics := &domain.DatabaseMetrics{
		IndexUsage: make([]domain.IndexMetric, 0),
	}
	if err := m.collectIndexMetrics(ctx, metrics); err != nil {
		return nil, err
	}

	// Convert slice of values to slice of pointers
	result := make([]*domain.IndexMetric, len(metrics.IndexUsage))
	for i := range metrics.IndexUsage {
		result[i] = &metrics.IndexUsage[i]
	}
	return result, nil
}

// EnableCollection enables periodic collection (placeholder)
func (m *MySQLMetricsCollector) EnableCollection(ctx context.Context, connectionID string, interval time.Duration) error {
	return nil
}

// DisableCollection disables periodic collection (placeholder)
func (m *MySQLMetricsCollector) DisableCollection(ctx context.Context, connectionID string) error {
	return nil
}
