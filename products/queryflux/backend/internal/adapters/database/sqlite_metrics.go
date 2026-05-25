package database

import (
	"context"
	"database/sql"
	"fmt"
	"regexp"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3" // SQLite driver
	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
	"go.uber.org/zap"
)

// validSQLiteIdentifier matches only safe SQL identifiers (letters, digits, underscores)
var validSQLiteIdentifier = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)

// sanitizeSQLiteID validates and quotes an identifier for safe use in SQLite queries
func sanitizeSQLiteID(name string) (string, error) {
	if !validSQLiteIdentifier.MatchString(name) {
		return "", fmt.Errorf("invalid SQL identifier: %q", name)
	}
	return `"` + name + `"`, nil
}

// SQLiteMetricsCollector implements SQLite-specific metrics collection
type SQLiteMetricsCollector struct {
	logger       *zap.Logger
	conn         *sql.DB
	connectionID string
	dbPath       string
}

// NewSQLiteMetricsCollector creates a new SQLite metrics collector
func NewSQLiteMetricsCollector(logger *zap.Logger, conn *sql.DB, connectionID string) (*SQLiteMetricsCollector, error) {
	// Get database path from pragma
	var dbPath string
	if err := conn.QueryRow("PRAGMA database_list").Scan(&dbPath); err != nil {
		// Try alternative method to get database info
		dbPath = "sqlite_database"
	}

	return &SQLiteMetricsCollector{
		logger:       logger,
		conn:         conn,
		connectionID: connectionID,
		dbPath:       dbPath,
	}, nil
}

// CollectDatabaseMetrics collects comprehensive SQLite metrics
func (s *SQLiteMetricsCollector) CollectDatabaseMetrics(ctx context.Context, connectionID string) (*domain.DatabaseMetrics, error) {
	metrics := &domain.DatabaseMetrics{
		ID:           fmt.Sprintf("sqlite_metrics_%s_%d", s.connectionID, time.Now().UnixNano()),
		ConnectionID: s.connectionID,
		DatabaseType: "sqlite",
		Timestamp:    time.Now(),
		IndexUsage:   make([]domain.IndexMetric, 0),
		TableMetrics: make([]domain.TableMetric, 0),
		Queries:      make([]domain.QueryMetric, 0),
		Metadata:     make(map[string]interface{}),
	}

	// Collect connection metrics
	if err := s.collectConnectionMetrics(ctx, metrics); err != nil {
		s.logger.Warn("Failed to collect connection metrics", zap.Error(err))
	}

	// Collect database file metrics
	if err := s.collectDatabaseFileMetrics(ctx, metrics); err != nil {
		s.logger.Warn("Failed to collect database file metrics", zap.Error(err))
	}

	// Collect table metrics
	if err := s.collectTableMetrics(ctx, metrics); err != nil {
		s.logger.Warn("Failed to collect table metrics", zap.Error(err))
	}

	// Collect index metrics
	if err := s.collectIndexMetrics(ctx, metrics); err != nil {
		s.logger.Warn("Failed to collect index metrics", zap.Error(err))
	}

	// Collect SQLite-specific metrics
	if err := s.collectSQLiteMetrics(ctx, metrics); err != nil {
		s.logger.Warn("Failed to collect SQLite metrics", zap.Error(err))
	}

	// Collect performance metrics
	if err := s.collectPerformanceMetrics(ctx, metrics); err != nil {
		s.logger.Warn("Failed to collect performance metrics", zap.Error(err))
	}

	return metrics, nil
}

// collectConnectionMetrics collects connection-related metrics
func (s *SQLiteMetricsCollector) collectConnectionMetrics(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	// SQLite doesn't have connection pooling in the same way as client-server databases
	// We can track if the connection is active and basic connection info
	err := s.conn.PingContext(ctx)
	if err != nil {
		return fmt.Errorf("database connection is not healthy: %w", err)
	}

	metrics.ActiveConnections = 1 // SQLite has one active connection per database file
	metrics.TotalConnections = 1
	metrics.Metadata["connection_healthy"] = true

	return nil
}

// collectDatabaseFileMetrics collects metrics about the database file
func (s *SQLiteMetricsCollector) collectDatabaseFileMetrics(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	// Get page size
	var pageSize int
	err := s.conn.QueryRowContext(ctx, "PRAGMA page_size").Scan(&pageSize)
	if err != nil {
		return fmt.Errorf("failed to get page size: %w", err)
	}

	// Get page count
	var pageCount int
	err = s.conn.QueryRowContext(ctx, "PRAGMA page_count").Scan(&pageCount)
	if err != nil {
		return fmt.Errorf("failed to get page count: %w", err)
	}

	// Calculate database size
	databaseSize := int64(pageSize * pageCount)
	metrics.Metadata["database_size_bytes"] = databaseSize

	// Get freelist count
	var freelistCount int
	err = s.conn.QueryRowContext(ctx, "PRAGMA freelist_count").Scan(&freelistCount)
	if err == nil {
		freeSize := int64(pageSize * freelistCount)
		metrics.Metadata["free_space_bytes"] = freeSize
		metrics.Metadata["utilization_percent"] = float64(databaseSize-freeSize) / float64(databaseSize) * 100
	}

	return nil
}

// collectTableMetrics collects table statistics
func (s *SQLiteMetricsCollector) collectTableMetrics(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	query := `
		SELECT
			name,
			sql
		FROM sqlite_master
		WHERE type = 'table'
		AND name NOT LIKE 'sqlite_%'
		ORDER BY name
	`

	rows, err := s.conn.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to query table list: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var tableName, createSQL string
		if err := rows.Scan(&tableName, &createSQL); err != nil {
			continue
		}

		tableMetric := domain.TableMetric{
			Name: tableName,
		}

		// Get row count — sanitize table name to prevent SQL injection
		safeTable, sanitizeErr := sanitizeSQLiteID(tableName)
		if sanitizeErr != nil {
			s.logger.Warn("Skipping table with invalid name", zap.Error(sanitizeErr), zap.String("table", tableName))
			continue
		}
		if err := s.conn.QueryRowContext(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s", safeTable)).Scan(&tableMetric.RowCount); err != nil {
			s.logger.Warn("Failed to get row count for table", zap.Error(err), zap.String("table", tableName))
		}

		// Get table size (approximate)
		if size, err := s.getTableSize(ctx, tableName); err == nil {
			tableMetric.Size = size
		}

		// Get DML operation counts if available (from WAL or other sources)
		s.collectTableDMLMetrics(ctx, tableName, &tableMetric)

		metrics.TableMetrics = append(metrics.TableMetrics, tableMetric)
	}

	return nil
}

// collectIndexMetrics collects index statistics
func (s *SQLiteMetricsCollector) collectIndexMetrics(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	query := `
		SELECT
			tbl_name,
			name,
			sql
		FROM sqlite_master
		WHERE type = 'index'
		AND name NOT LIKE 'sqlite_%'
		ORDER BY tbl_name, name
	`

	rows, err := s.conn.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to query index list: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var tableName, indexName, indexSQL string
		if err := rows.Scan(&tableName, &indexName, &indexSQL); err != nil {
			continue
		}

		indexMetric := domain.IndexMetric{
			Name:      fmt.Sprintf("%s.%s", tableName, indexName),
			TableName: tableName,
			LastUsed:  time.Now(), // SQLite doesn't track index usage easily
		}

		// Check if it's a primary key
		if strings.Contains(strings.ToUpper(indexSQL), "PRIMARY KEY") {
			indexMetric.Primary = true
			indexMetric.Unique = true
		} else if strings.Contains(strings.ToUpper(indexSQL), "UNIQUE") {
			indexMetric.Unique = true
		}

		// Get index size (approximate)
		if size, err := s.getIndexSize(ctx, tableName, indexName); err == nil {
			indexMetric.Size = size
		}

		// SQLite doesn't easily track index usage, so we'll set it to 0
		indexMetric.UsageCount = 0
		indexMetric.Scans = 0

		metrics.IndexUsage = append(metrics.IndexUsage, indexMetric)
	}

	return nil
}

// collectSQLiteMetrics collects SQLite-specific metrics
func (s *SQLiteMetricsCollector) collectSQLiteMetrics(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	// Get SQLite version
	var version string
	if err := s.conn.QueryRowContext(ctx, "SELECT sqlite_version()").Scan(&version); err == nil {
		metrics.Metadata["sqlite_version"] = version
	}

	// Get journal mode
	var journalMode string
	if err := s.conn.QueryRowContext(ctx, "PRAGMA journal_mode").Scan(&journalMode); err == nil {
		metrics.Metadata["journal_mode"] = journalMode
	}

	// Get synchronous mode
	var syncMode string
	if err := s.conn.QueryRowContext(ctx, "PRAGMA synchronous").Scan(&syncMode); err == nil {
		metrics.Metadata["synchronous_mode"] = syncMode
	}

	// Get cache size
	var cacheSize int
	if err := s.conn.QueryRowContext(ctx, "PRAGMA cache_size").Scan(&cacheSize); err == nil {
		metrics.Metadata["cache_size_pages"] = cacheSize
	}

	// Get temp store
	var tempStore int
	if err := s.conn.QueryRowContext(ctx, "PRAGMA temp_store").Scan(&tempStore); err == nil {
		metrics.Metadata["temp_store"] = tempStore
	}

	// Get mmap size
	var mmapSize int64
	if err := s.conn.QueryRowContext(ctx, "PRAGMA mmap_size").Scan(&mmapSize); err == nil {
		metrics.Metadata["mmap_size"] = mmapSize
	}

	// Get compile options
	rows, err := s.conn.QueryContext(ctx, "PRAGMA compile_options")
	if err == nil {
		defer rows.Close()
		var options []string
		for rows.Next() {
			var option string
			if rows.Scan(&option) == nil {
				options = append(options, option)
			}
		}
		metrics.Metadata["compile_options"] = options
	}

	return nil
}

// collectPerformanceMetrics collects performance-related metrics
func (s *SQLiteMetricsCollector) collectPerformanceMetrics(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	// SQLite performance is typically measured by query execution time
	// We can get some basic performance info from pragma settings

	// Check if foreign keys are enabled
	var foreignKeys int
	if err := s.conn.QueryRowContext(ctx, "PRAGMA foreign_keys").Scan(&foreignKeys); err == nil {
		metrics.Metadata["foreign_keys_enabled"] = foreignKeys == 1
	}

	// Check if WAL mode is enabled
	var journalMode string
	if err := s.conn.QueryRowContext(ctx, "PRAGMA journal_mode").Scan(&journalMode); err == nil {
		metrics.Metadata["wal_mode_enabled"] = strings.ToUpper(journalMode) == "WAL"
	}

	// Check query planner settings
	var queryOnly int
	if err := s.conn.QueryRowContext(ctx, "PRAGMA query_only").Scan(&queryOnly); err == nil {
		metrics.Metadata["query_only_mode"] = queryOnly == 1
	}

	// These would typically be collected from actual query execution times
	// For now, we'll use placeholder values
	metrics.AvgResponseTime = 10 * time.Millisecond
	metrics.Metadata["avg_query_time_ms"] = 10.0

	return nil
}

// collectTableDMLMetrics collects DML operation metrics for a table
func (s *SQLiteMetricsCollector) collectTableDMLMetrics(ctx context.Context, tableName string, tableMetric *domain.TableMetric) {
	// SQLite doesn't track DML statistics automatically like PostgreSQL or MySQL
	// We could implement triggers to track this, but for now, we'll use placeholder values

	// In a real implementation, you might:
	// 1. Create triggers to update a statistics table
	// 2. Use the WAL file to estimate activity
	// 3. Parse the SQLite statement journal for recent activity

	tableMetric.InsertCount = 0
	tableMetric.UpdateCount = 0
	tableMetric.DeleteCount = 0
}

// Helper methods

func (s *SQLiteMetricsCollector) getTableSize(ctx context.Context, tableName string) (int64, error) {
	safeTable, err := sanitizeSQLiteID(tableName)
	if err != nil {
		return 0, fmt.Errorf("invalid table name: %w", err)
	}
	// Estimate table size by summing page counts for all indexes and the table itself
	var totalPages int64

	// Get table page count
	var pageCount int
	err = s.conn.QueryRowContext(ctx, fmt.Sprintf("PRAGMA table_info(%s)", safeTable)).Scan(&pageCount)
	if err != nil {
		return 0, err
	}
	totalPages += int64(pageCount)

	// Get index page counts
	query := fmt.Sprintf("PRAGMA index_list(%s)", safeTable)
	rows, err := s.conn.QueryContext(ctx, query)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var indexName, tableName2, isPartial int
		if err := rows.Scan(&indexName, &tableName2, &isPartial); err != nil {
			continue
		}

		var indexPageCount int
		if err := s.conn.QueryRowContext(ctx, fmt.Sprintf("PRAGMA index_info(%d)", indexName)).Scan(&indexPageCount); err == nil {
			totalPages += int64(indexPageCount)
		}
	}

	// Get page size
	var pageSize int
	if err := s.conn.QueryRowContext(ctx, "PRAGMA page_size").Scan(&pageSize); err != nil {
		return 0, err
	}

	return totalPages * int64(pageSize), nil
}

func (s *SQLiteMetricsCollector) getIndexSize(ctx context.Context, tableName, indexName string) (int64, error) {
	safeTable, err := sanitizeSQLiteID(tableName)
	if err != nil {
		return 0, fmt.Errorf("invalid table name: %w", err)
	}
	safeIndex, err := sanitizeSQLiteID(indexName)
	if err != nil {
		return 0, fmt.Errorf("invalid index name: %w", err)
	}
	// Get index page count
	var pageCount int
	query := fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE %s IS NOT NULL", safeTable, safeIndex)
	err = s.conn.QueryRowContext(ctx, query).Scan(&pageCount)
	if err != nil {
		return 0, err
	}

	// This is a very rough estimate
	// In practice, you'd use PRAGMA index_info to get actual page usage
	var pageSize int
	if err := s.conn.QueryRowContext(ctx, "PRAGMA page_size").Scan(&pageSize); err != nil {
		return 0, err
	}

	return int64(pageCount) * int64(pageSize), nil
}

// CollectConnectionMetrics collects connection-specific metrics
func (s *SQLiteMetricsCollector) CollectConnectionMetrics(ctx context.Context, connectionID string) (*ports.ConnectionMetrics, error) {
	metrics := &domain.DatabaseMetrics{
		Metadata: make(map[string]interface{}),
	}
	if err := s.collectConnectionMetrics(ctx, metrics); err != nil {
		return nil, err
	}

	return &ports.ConnectionMetrics{
		ConnectionID:  connectionID,
		ActiveQueries: 0, // SQLite doesn't easily track active queries
		TotalQueries:  0,
		IsHealthy:     true,
		LastActivity:  time.Now(),
	}, nil
}

// CollectQueryMetrics collects query execution metrics
func (s *SQLiteMetricsCollector) CollectQueryMetrics(ctx context.Context, connectionID string, limit int) ([]*domain.QueryMetric, error) {
	// SQLite support for query metrics is limited without extensions
	// Returning empty list for now
	return []*domain.QueryMetric{}, nil
}

// CollectTableMetrics collects table-level metrics
func (s *SQLiteMetricsCollector) CollectTableMetrics(ctx context.Context, connectionID string) ([]*domain.TableMetric, error) {
	metrics := &domain.DatabaseMetrics{
		TableMetrics: make([]domain.TableMetric, 0),
	}
	if err := s.collectTableMetrics(ctx, metrics); err != nil {
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
func (s *SQLiteMetricsCollector) CollectIndexMetrics(ctx context.Context, connectionID string) ([]*domain.IndexMetric, error) {
	metrics := &domain.DatabaseMetrics{
		IndexUsage: make([]domain.IndexMetric, 0),
	}
	if err := s.collectIndexMetrics(ctx, metrics); err != nil {
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
func (s *SQLiteMetricsCollector) EnableCollection(ctx context.Context, connectionID string, interval time.Duration) error {
	return nil
}

// DisableCollection disables periodic collection (placeholder)
func (s *SQLiteMetricsCollector) DisableCollection(ctx context.Context, connectionID string) error {
	return nil
}
