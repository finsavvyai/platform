package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib" // PostgreSQL driver
	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
	"go.uber.org/zap"
)

// PostgreSQLMetricsCollector implements detailed PostgreSQL metrics collection
type PostgreSQLMetricsCollector struct {
	logger       *zap.Logger
	conn         *sql.DB
	connectionID string
	dbName       string
}

// NewPostgreSQLMetricsCollector creates a new PostgreSQL metrics collector
func NewPostgreSQLMetricsCollector(logger *zap.Logger, conn *sql.DB, connectionID string) (*PostgreSQLMetricsCollector, error) {
	// Get database name
	var dbName string
	if err := conn.QueryRow("SELECT current_database()").Scan(&dbName); err != nil {
		return nil, fmt.Errorf("failed to get database name: %w", err)
	}

	return &PostgreSQLMetricsCollector{
		logger:       logger,
		conn:         conn,
		connectionID: connectionID,
		dbName:       dbName,
	}, nil
}

// CollectDatabaseMetrics collects comprehensive PostgreSQL metrics
func (p *PostgreSQLMetricsCollector) CollectDatabaseMetrics(ctx context.Context, connectionID string) (*domain.DatabaseMetrics, error) {
	metrics := &domain.DatabaseMetrics{
		ID:           fmt.Sprintf("pg_metrics_%s_%d", p.connectionID, time.Now().UnixNano()),
		ConnectionID: p.connectionID,
		DatabaseType: "postgresql",
		Timestamp:    time.Now(),
		IndexUsage:   make([]domain.IndexMetric, 0),
		TableMetrics: make([]domain.TableMetric, 0),
		Queries:      make([]domain.QueryMetric, 0),
		Metadata:     make(map[string]interface{}),
	}

	// Collect connection and query statistics
	if err := p.collectConnectionStats(ctx, metrics); err != nil {
		p.logger.Warn("Failed to collect connection stats", zap.Error(err))
	}

	// Collect database size and storage metrics
	if err := p.collectStorageMetrics(ctx, metrics); err != nil {
		p.logger.Warn("Failed to collect storage metrics", zap.Error(err))
	}

	// Collect performance metrics
	if err := p.collectPerformanceMetrics(ctx, metrics); err != nil {
		p.logger.Warn("Failed to collect performance metrics", zap.Error(err))
	}

	// Collect table metrics
	if err := p.collectTableMetrics(ctx, metrics); err != nil {
		p.logger.Warn("Failed to collect table metrics", zap.Error(err))
	}

	// Collect index metrics
	if err := p.collectIndexMetrics(ctx, metrics); err != nil {
		p.logger.Warn("Failed to collect index metrics", zap.Error(err))
	}

	// Collect slow queries (if pg_stat_statements is available)
	if err := p.collectSlowQueries(ctx, metrics); err != nil {
		p.logger.Debug("Failed to collect slow queries", zap.Error(err))
	}

	// Collect system metrics for the database
	if err := p.collectSystemMetrics(ctx, metrics); err != nil {
		p.logger.Warn("Failed to collect system metrics", zap.Error(err))
	}

	return metrics, nil
}

// collectConnectionStats collects database connection statistics
func (p *PostgreSQLMetricsCollector) collectConnectionStats(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	query := `
		SELECT
			count(*) as total_connections,
			count(*) FILTER (WHERE state = 'active') as active_connections,
			count(*) FILTER (WHERE state = 'idle') as idle_connections,
			count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
		FROM pg_stat_activity
		WHERE datname = current_database()
	`

	var totalConnections, activeConnections, idleConnections, idleInTransaction int64
	err := p.conn.QueryRowContext(ctx, query).Scan(
		&totalConnections, &activeConnections, &idleConnections, &idleInTransaction,
	)
	if err != nil {
		return fmt.Errorf("failed to collect connection stats: %w", err)
	}

	metrics.ActiveConnections = activeConnections
	metrics.IdleConnections = idleConnections
	metrics.TotalConnections = totalConnections
	metrics.Metadata["idle_in_transaction"] = idleInTransaction

	return nil
}

// collectStorageMetrics collects storage-related metrics
func (p *PostgreSQLMetricsCollector) collectStorageMetrics(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	// Database size
	var dbSize int64
	err := p.conn.QueryRowContext(ctx, "SELECT pg_database_size(current_database())").Scan(&dbSize)
	if err != nil {
		return fmt.Errorf("failed to get database size: %w", err)
	}

	metrics.Metadata["database_size_bytes"] = dbSize

	// Get relation sizes for tables and indexes
	query := `
		SELECT
			schemaname,
			tablename,
			pg_total_relation_size(schemaname||'.'||tablename) as total_size,
			pg_relation_size(schemaname||'.'||tablename) as table_size,
			pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename) as index_size
		FROM pg_tables
		WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
		ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
		LIMIT 20
	`

	rows, err := p.conn.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to collect relation sizes: %w", err)
	}
	defer rows.Close()

	var totalTableSize, totalIndexSize int64
	for rows.Next() {
		var schema, table string
		var totalSize, tableSize, indexSize int64

		if err := rows.Scan(&schema, &table, &totalSize, &tableSize, &indexSize); err != nil {
			continue
		}

		totalTableSize += tableSize
		totalIndexSize += indexSize
	}

	metrics.Metadata["total_table_size_bytes"] = totalTableSize
	metrics.Metadata["total_index_size_bytes"] = totalIndexSize

	return nil
}

// collectPerformanceMetrics collects database performance statistics
func (p *PostgreSQLMetricsCollector) collectPerformanceMetrics(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	query := `
		SELECT
			sum(xact_commit) as commits,
			sum(xact_rollback) as rollbacks,
			sum(blks_read) as blocks_read,
			sum(blks_hit) as blocks_hit,
			sum(tup_returned) as tuples_returned,
			sum(tup_fetched) as tuples_fetched,
			sum(tup_inserted) as tuples_inserted,
			sum(tup_updated) as tuples_updated,
			sum(tup_deleted) as tuples_deleted,
			sum(deadlocks) as deadlocks
		FROM pg_stat_database
		WHERE datname = current_database()
	`

	var commits, rollbacks, blocksRead, blocksHit, tuplesReturned, tuplesFetched int64
	var tuplesInserted, tuplesUpdated, tuplesDeleted, deadlocks int64

	err := p.conn.QueryRowContext(ctx, query).Scan(
		&commits, &rollbacks, &blocksRead, &blocksHit,
		&tuplesReturned, &tuplesFetched, &tuplesInserted,
		&tuplesUpdated, &tuplesDeleted, &deadlocks,
	)
	if err != nil {
		return fmt.Errorf("failed to collect performance metrics: %w", err)
	}

	metrics.QueryCount = commits + rollbacks
	metrics.BytesReceived = blocksRead * 8192 // Assuming 8KB block size
	metrics.BytesSent = blocksHit * 8192

	// Calculate cache hit ratio
	if blocksRead+blocksHit > 0 {
		metrics.CacheHitRatio = float64(blocksHit) / float64(blocksRead+blocksHit) * 100
	}

	// Store additional metrics
	metrics.Metadata["commits"] = commits
	metrics.Metadata["rollbacks"] = rollbacks
	metrics.Metadata["deadlocks"] = deadlocks
	metrics.Metadata["tuples_returned"] = tuplesReturned
	metrics.Metadata["tuples_fetched"] = tuplesFetched
	metrics.Metadata["tuples_inserted"] = tuplesInserted
	metrics.Metadata["tuples_updated"] = tuplesUpdated
	metrics.Metadata["tuples_deleted"] = tuplesDeleted

	return nil
}

// collectTableMetrics collects table-level statistics
func (p *PostgreSQLMetricsCollector) collectTableMetrics(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	query := `
		SELECT
			schemaname,
			tablename,
			n_live_tup as live_tuples,
			n_dead_tup as dead_tuples,
			n_tup_ins as inserts,
			n_tup_upd as updates,
			n_tup_del as deletes,
			n_tup_hot_upd as hot_updates,
			seq_scan as sequential_scans,
			idx_scan as index_scans,
			vacuum_count,
			autovacuum_count,
			analyze_count,
			autoanalyze_count,
			last_vacuum,
			last_autovacuum,
			last_analyze,
			last_autoanalyze
		FROM pg_stat_user_tables
		ORDER BY schemaname, tablename
	`

	rows, err := p.conn.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to collect table metrics: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var schema, tableName string
		var liveTuples, deadTuples, inserts, updates, deletes, hotUpdates int64
		var seqScans, idxScans, vacuumCount, autovacuumCount, analyzeCount, autovacuumAnalyzeCount int64
		var lastVacuum, lastAutovacuum, lastAnalyze, lastAutoAnalyze sql.NullTime

		if err := rows.Scan(
			&schema, &tableName, &liveTuples, &deadTuples, &inserts, &updates, &deletes, &hotUpdates,
			&seqScans, &idxScans, &vacuumCount, &autovacuumCount, &analyzeCount, &autovacuumAnalyzeCount,
			&lastVacuum, &lastAutovacuum, &lastAnalyze, &lastAutoAnalyze,
		); err != nil {
			continue
		}

		tableMetric := domain.TableMetric{
			Name:            fmt.Sprintf("%s.%s", schema, tableName),
			RowCount:        liveTuples,
			InsertCount:     inserts,
			UpdateCount:     updates,
			DeleteCount:     deletes,
			SequentialScans: seqScans,
			IndexScans:      idxScans,
		}

		// Set last analyzed time
		if lastAnalyze.Valid {
			tableMetric.LastAnalyzed = lastAnalyze.Time
		} else if lastAutoAnalyze.Valid {
			tableMetric.LastAnalyzed = lastAutoAnalyze.Time
		}

		// Get table size
		tableMetric.Size, _ = p.getTableSize(ctx, schema, tableName)
		tableMetric.IndexSize, _ = p.getIndexSize(ctx, schema, tableName)

		metrics.TableMetrics = append(metrics.TableMetrics, tableMetric)
	}

	return nil
}

// collectIndexMetrics collects index usage statistics
func (p *PostgreSQLMetricsCollector) collectIndexMetrics(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	query := `
		SELECT
			schemaname,
			tablename,
			indexname,
			idx_scan as scans,
			idx_tup_read as tuples_read,
			idx_tup_fetch as tuples_fetched,
			pg_relation_size(schemaname||'.'||indexrelid) as size_bytes
		FROM pg_stat_user_indexes
		ORDER BY schemaname, tablename, indexname
	`

	rows, err := p.conn.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to collect index metrics: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var schema, tableName, indexName string
		var scans, tuplesRead, tuplesFetched, sizeBytes int64

		if err := rows.Scan(&schema, &tableName, &indexName, &scans, &tuplesRead, &tuplesFetched, &sizeBytes); err != nil {
			continue
		}

		indexMetric := domain.IndexMetric{
			Name:       fmt.Sprintf("%s.%s.%s", schema, tableName, indexName),
			TableName:  fmt.Sprintf("%s.%s", schema, tableName),
			UsageCount: scans,
			Scans:      scans,
			Size:       sizeBytes,
			LastUsed:   time.Now(), // This would need better tracking
		}

		// Check if it's a primary key or unique index
		isPrimary, unique := p.getIndexProperties(ctx, schema, tableName, indexName)
		if isPrimary {
			indexMetric.Primary = true
		}
		if unique {
			indexMetric.Unique = true
		}

		metrics.IndexUsage = append(metrics.IndexUsage, indexMetric)
	}

	return nil
}

// collectSlowQueries collects slow query statistics (requires pg_stat_statements)
func (p *PostgreSQLMetricsCollector) collectSlowQueries(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	// Check if pg_stat_statements is available
	var exists bool
	err := p.conn.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
		)
	`).Scan(&exists)
	if err != nil || !exists {
		return fmt.Errorf("pg_stat_statements extension not available")
	}

	query := `
		SELECT
			query,
			calls,
			total_time,
			mean_time,
			max_time,
			min_time,
			rows,
			100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
		FROM pg_stat_statements
		WHERE mean_time > 1000 -- queries with mean execution time > 1 second
		ORDER BY mean_time DESC
		LIMIT 10
	`

	rows, err := p.conn.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to collect slow queries: %w", err)
	}
	defer rows.Close()

	slowQueryCount := int64(0)
	for rows.Next() {
		var queryText string
		var calls int64
		var totalTime, meanTime, maxTime, minTime float64
		var rowsReturned int64
		var hitPercent float64

		if err := rows.Scan(&queryText, &calls, &totalTime, &meanTime, &maxTime, &minTime, &rowsReturned, &hitPercent); err != nil {
			continue
		}

		slowQueryCount += calls

		// Add to queries list (truncate long queries)
		if len(queryText) > 500 {
			queryText = queryText[:500] + "..."
		}

		queryMetric := domain.QueryMetric{
			ID:           fmt.Sprintf("slow_query_%d", time.Now().UnixNano()),
			Query:        queryText,
			QueryHash:    p.hashQuery(queryText),
			Duration:     time.Duration(meanTime) * time.Millisecond,
			RowsReturned: rowsReturned,
			Success:      true,
			Timestamp:    time.Now(),
		}

		metrics.Queries = append(metrics.Queries, queryMetric)
	}

	metrics.SlowQueryCount = slowQueryCount
	return nil
}

// collectSystemMetrics collects system metrics related to the database
func (p *PostgreSQLMetricsCollector) collectSystemMetrics(ctx context.Context, metrics *domain.DatabaseMetrics) error {
	// Get PostgreSQL version
	var version string
	if err := p.conn.QueryRowContext(ctx, "SELECT version()").Scan(&version); err == nil {
		metrics.Metadata["postgresql_version"] = version
	}

	// Get active settings
	var maxConnections int
	if err := p.conn.QueryRowContext(ctx, "SHOW max_connections").Scan(&maxConnections); err == nil {
		metrics.Metadata["max_connections"] = maxConnections
	}

	// Calculate connection usage percentage
	if maxConnections > 0 {
		metrics.Metadata["connection_usage_percent"] = float64(metrics.ActiveConnections) / float64(maxConnections) * 100
	}

	// Get checkpoint statistics
	query := `
		SELECT
			checkpoints_timed,
			checkpoints_req,
			checkpoint_write_time,
			checkpoint_sync_time,
			buffers_checkpoint,
			buffers_clean,
			maxwritten_clean,
			buffers_backend,
			buffers_backend_fsync,
			buffers_alloc
		FROM pg_stat_bgwriter
		LIMIT 1
	`

	var checkpointsTimed, checkpointsReq, checkpointWriteTime, checkpointSyncTime int64
	var buffersCheckpoint, buffersClean, maxwrittenClean, buffersBackend, buffersBackendFsync, buffersAlloc int64

	err := p.conn.QueryRowContext(ctx, query).Scan(
		&checkpointsTimed, &checkpointsReq, &checkpointWriteTime, &checkpointSyncTime,
		&buffersCheckpoint, &buffersClean, &maxwrittenClean,
		&buffersBackend, &buffersBackendFsync, &buffersAlloc,
	)
	if err == nil {
		metrics.Metadata["checkpoints_timed"] = checkpointsTimed
		metrics.Metadata["checkpoints_requested"] = checkpointsReq
		metrics.Metadata["buffers_checkpoint"] = buffersCheckpoint
		metrics.Metadata["buffers_clean"] = buffersClean
		metrics.Metadata["buffers_backend"] = buffersBackend
		metrics.Metadata["buffers_alloc"] = buffersAlloc
	}

	// These would typically be collected from system monitoring tools
	metrics.CPUUsage = 0.0  // Placeholder
	metrics.MemoryUsage = 0 // Placeholder

	return nil
}

// Helper methods

func (p *PostgreSQLMetricsCollector) getTableSize(ctx context.Context, schema, table string) (int64, error) {
	var size int64
	err := p.conn.QueryRowContext(ctx,
		"SELECT pg_total_relation_size($1::text)",
		fmt.Sprintf("%s.%s", schema, table),
	).Scan(&size)
	return size, err
}

func (p *PostgreSQLMetricsCollector) getIndexSize(ctx context.Context, schema, table string) (int64, error) {
	var size int64
	err := p.conn.QueryRowContext(ctx,
		"SELECT pg_indexes_size($1::text)",
		fmt.Sprintf("%s.%s", schema, table),
	).Scan(&size)
	return size, err
}

func (p *PostgreSQLMetricsCollector) getIndexProperties(ctx context.Context, schema, table, index string) (isPrimary, isUnique bool) {
	// Check if primary key
	var isPK bool
	err := p.conn.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM pg_constraint
			WHERE conrelid = $1::regclass
			AND conname = $2
			AND contype = 'p'
		)
	`, fmt.Sprintf("%s.%s", schema, table), index).Scan(&isPK)
	if err == nil {
		isPrimary = isPK
	}

	// Check if unique
	var isU bool
	err = p.conn.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM pg_constraint
			WHERE conrelid = $1::regclass
			AND conname = $2
			AND contype = 'u'
		)
	`, fmt.Sprintf("%s.%s", schema, table), index).Scan(&isU)
	if err == nil {
		isUnique = isU || isPrimary // Primary keys are also unique
	}

	return isPrimary, isUnique
}

func (p *PostgreSQLMetricsCollector) hashQuery(query string) string {
	// Simple hash function - in practice you'd use a proper hashing algorithm
	return fmt.Sprintf("%x", len(query)+int(time.Now().UnixNano()))
}

// CollectConnectionMetrics collects connection-specific metrics
func (p *PostgreSQLMetricsCollector) CollectConnectionMetrics(ctx context.Context, connectionID string) (*ports.ConnectionMetrics, error) {
	metrics := &domain.DatabaseMetrics{
		Metadata: make(map[string]interface{}),
	}
	if err := p.collectConnectionStats(ctx, metrics); err != nil {
		return nil, err
	}

	return &ports.ConnectionMetrics{
		ConnectionID:  connectionID,
		ActiveQueries: int(metrics.ActiveConnections), // Approximation
		TotalQueries:  metrics.TotalConnections,       // Reusing field for example
		IsHealthy:     true,
		LastActivity:  time.Now(),
	}, nil
}

// CollectQueryMetrics collects query execution metrics
func (p *PostgreSQLMetricsCollector) CollectQueryMetrics(ctx context.Context, connectionID string, limit int) ([]*domain.QueryMetric, error) {
	metrics := &domain.DatabaseMetrics{
		Queries: make([]domain.QueryMetric, 0),
	}
	if err := p.collectSlowQueries(ctx, metrics); err != nil {
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
func (p *PostgreSQLMetricsCollector) CollectTableMetrics(ctx context.Context, connectionID string) ([]*domain.TableMetric, error) {
	metrics := &domain.DatabaseMetrics{
		TableMetrics: make([]domain.TableMetric, 0),
	}
	if err := p.collectTableMetrics(ctx, metrics); err != nil {
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
func (p *PostgreSQLMetricsCollector) CollectIndexMetrics(ctx context.Context, connectionID string) ([]*domain.IndexMetric, error) {
	metrics := &domain.DatabaseMetrics{
		IndexUsage: make([]domain.IndexMetric, 0),
	}
	if err := p.collectIndexMetrics(ctx, metrics); err != nil {
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
func (p *PostgreSQLMetricsCollector) EnableCollection(ctx context.Context, connectionID string, interval time.Duration) error {
	return nil
}

// DisableCollection disables periodic collection (placeholder)
func (p *PostgreSQLMetricsCollector) DisableCollection(ctx context.Context, connectionID string) error {
	return nil
}
