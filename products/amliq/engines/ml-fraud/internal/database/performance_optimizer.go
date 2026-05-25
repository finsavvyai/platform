package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// PerformanceOptimizer provides database performance optimization capabilities
type PerformanceOptimizer struct {
	db            *sqlx.DB
	logger        *log.Logger
	config        PerformanceConfig
	queryAnalyzer *QueryAnalyzer
	indexManager  *IndexManager
	poolManager   *PoolManager
	profiler      *QueryProfiler
	metrics       *PerformanceMetrics
}

// PerformanceConfig holds performance optimization configuration
type PerformanceConfig struct {
	EnableQueryAnalyzer      bool          `json:"enable_query_analyzer"`
	EnableIndexManager       bool          `json:"enable_index_manager"`
	EnablePoolManager        bool          `json:"enable_pool_manager"`
	EnableQueryProfiler      bool          `json:"enable_query_profiler"`
	SlowQueryThreshold       time.Duration `json:"slow_query_threshold"`
	MaxOpenConnections       int           `json:"max_open_connections"`
	MaxIdleConnections       int           `json:"max_idle_connections"`
	MaxLifetime              time.Duration `json:"max_lifetime"`
	IdleTimeout              time.Duration `json:"idle_timeout"`
	ConnectionTimeout        time.Duration `json:"connection_timeout"`
	EnablePreparedStatements bool          `json:"enable_prepared_statements"`
	EnableBatchOperations    bool          `json:"enable_batch_operations"`
	EnableParallelQueries    bool          `json:"enable_parallel_queries"`
	QueryCacheEnabled        bool          `json:"query_cache_enabled"`
	StatementTimeout         time.Duration `json:"statement_timeout"`
}

// QueryAnalyzer analyzes SQL queries for performance issues
type QueryAnalyzer struct {
	logger    *log.Logger
	queries   map[string]*QueryStats
	mu        sync.RWMutex
	threshold time.Duration
}

// QueryStats tracks query statistics
type QueryStats struct {
	Query          string        `json:"query"`
	ExecutionCount int64         `json:"execution_count"`
	TotalTime      time.Duration `json:"total_time"`
	AverageTime    time.Duration `json:"average_time"`
	MinTime        time.Duration `json:"min_time"`
	MaxTime        time.Duration `json:"max_time"`
	LastExecuted   time.Time     `json:"last_executed"`
	ErrorCount     int64         `json:"error_count"`
	SlowCount      int64         `json:"slow_count"`
	Plan           *QueryPlan    `json:"plan,omitempty"`
}

// QueryPlan represents an execution plan
type QueryPlan struct {
	NodeType    string      `json:"node_type"`
	Relation    string      `json:"relation"`
	Alias       string      `json:"alias"`
	StartupCost float64     `json:"startup_cost"`
	TotalCost   float64     `json:"total_cost"`
	Rows        int64       `json:"rows"`
	Width       int64       `json:"width"`
	ActualRows  int64       `json:"actual_rows"`
	ActualLoops int64       `json:"actual_loops"`
	Plans       []QueryPlan `json:"plans"`
}

// IndexManager manages database indexes for optimal performance
type IndexManager struct {
	db     *sqlx.DB
	logger *log.Logger
	config PerformanceConfig
}

// PoolManager manages database connection pool
type PoolManager struct {
	db     *sqlx.DB
	logger *log.Logger
	config PerformanceConfig
}

// QueryProfiler profiles SQL queries
type QueryProfiler struct {
	logger  *log.Logger
	queries map[string]*QueryProfile
	mu      sync.RWMutex
}

// QueryProfile represents a query profile
type QueryProfile struct {
	Query        string                 `json:"query"`
	Duration     time.Duration          `json:"duration"`
	Plan         *QueryPlan             `json:"plan"`
	Bindings     map[string]interface{} `json:"bindings"`
	MemoryUsage  int64                  `json:"memory_usage"`
	CPUUsage     float64                `json:"cpu_usage"`
	IOOperations int64                  `json:"io_operations"`
	Timestamp    time.Time              `json:"timestamp"`
}

// PerformanceMetrics tracks database performance metrics
type PerformanceMetrics struct {
	ConnectionsActive    int64              `json:"connections_active"`
	ConnectionsIdle      int64              `json:"connections_idle"`
	ConnectionsTotal     int64              `json:"connections_total"`
	ConnectionsCreated   int64              `json:"connections_created"`
	ConnectionsDestroyed int64              `json:"connections_destroyed"`
	QueriesTotal         int64              `json:"queries_total"`
	QueriesSlow          int64              `json:"queries_slow"`
	QueriesFailed        int64              `json:"queries_failed"`
	AverageResponseTime  time.Duration      `json:"average_response_time"`
	DatabaseSize         int64              `json:"database_size"`
	TableSizes           map[string]int64   `json:"table_sizes"`
	IndexUsage           map[string]float64 `json:"index_usage"`
	LastUpdated          time.Time          `json:"last_updated"`
}

// NewPerformanceOptimizer creates a new performance optimizer
func NewPerformanceOptimizer(db *sqlx.DB, config PerformanceConfig) (*PerformanceOptimizer, error) {
	po := &PerformanceOptimizer{
		db:     db,
		logger: log.New(log.Writer(), "[DB-PERF] ", log.LstdFlags|log.Lmsgprefix),
		config: config,
		metrics: &PerformanceMetrics{
			TableSizes: make(map[string]int64),
			IndexUsage: make(map[string]float64),
		},
	}

	// Initialize components
	po.queryAnalyzer = &QueryAnalyzer{
		logger:    po.logger,
		queries:   make(map[string]*QueryStats),
		threshold: config.SlowQueryThreshold,
	}

	po.indexManager = &IndexManager{
		db:     db,
		logger: po.logger,
		config: config,
	}

	po.poolManager = &PoolManager{
		db:     db,
		logger: po.logger,
		config: config,
	}

	po.profiler = &QueryProfiler{
		logger:  po.logger,
		queries: make(map[string]*QueryProfile),
	}

	// Start background collection
	if config.EnableQueryAnalyzer {
		go po.startCollection()
	}

	return po, nil
}

// ExecuteQuery executes a query with performance monitoring
func (po *PerformanceOptimizer) ExecuteQuery(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	startTime := time.Now()
	defer func() {
		duration := time.Since(startTime)
		po.recordQuery(query, duration, nil)
	}()

	rows, err := po.db.QueryContext(ctx, query, args...)
	if err != nil {
		po.recordQuery(query, time.Since(startTime), err)
		return nil, err
	}

	return rows, nil
}

// ExecuteQueryRow executes a query that returns a single row
func (po *PerformanceOptimizer) ExecuteQueryRow(ctx context.Context, query string, args ...interface{}) *sql.Row {
	startTime := time.Now()
	defer func() {
		duration := time.Since(startTime)
		po.recordQuery(query, duration, nil)
	}()

	return po.db.QueryRowContext(ctx, query, args...)
}

// Exec executes a query that doesn't return rows
func (po *PerformanceOptimizer) Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	startTime := time.Now()
	defer func() {
		duration := time.Since(startTime)
		po.recordQuery(query, duration, nil)
	}()

	result, err := po.db.ExecContext(ctx, query, args...)
	if err != nil {
		po.recordQuery(query, time.Since(startTime), err)
		return nil, err
	}

	return result, nil
}

// BatchInsert performs batch insert operation
func (po *PerformanceOptimizer) BatchInsert(ctx context.Context, tableName string, columns []string, data []map[string]interface{}) error {
	if !po.config.EnableBatchOperations {
		return fmt.Errorf("batch operations are disabled")
	}

	if len(data) == 0 {
		return nil
	}

	// Build INSERT query
	valuePlaceholders := make([]string, len(data))
	args := make([]interface{}, 0, len(data)*len(columns))

	for i, row := range data {
		placeholders := make([]string, len(columns))
		for j, col := range columns {
			placeholders[j] = fmt.Sprintf("$%d", i*len(columns)+j+1)
			args = append(args, row[col])
		}
		valuePlaceholders[i] = fmt.Sprintf("(%s)", strings.Join(placeholders, ", "))
	}

	query := fmt.Sprintf("INSERT INTO %s (%s) VALUES %s",
		tableName,
		strings.Join(columns, ", "),
		strings.Join(valuePlaceholders, ", "))

	startTime := time.Now()
	defer func() {
		duration := time.Since(startTime)
		po.recordQuery(query, duration, nil)
	}()

	_, err := po.db.ExecContext(ctx, query, args...)
	return err
}

// GetTableIndexes returns information about table indexes
func (po *PerformanceOptimizer) GetTableIndexes(ctx context.Context, tableName string) ([]IndexInfo, error) {
	query := `
		SELECT
			indexname,
			indexdef,
			indisunique,
			indisprimary,
			amname
		FROM pg_indexes
		WHERE tablename = $1
		ORDER BY indexname
	`

	rows, err := po.db.QueryContext(ctx, query, tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to get table indexes: %w", err)
	}
	defer rows.Close()

	var indexes []IndexInfo
	for rows.Next() {
		var index IndexInfo

		err := rows.Scan(
			&index.Name,
			&index.Definition,
			&index.Unique,
			&index.Primary,
			&index.AccessMethod,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan index info: %w", err)
		}

		// Parse column names from definition
		index.Columns = parseIndexDefinition(index.Definition)
		indexes = append(indexes, index)
	}

	return indexes, nil
}

// IndexInfo represents database index information
type IndexInfo struct {
	Name         string   `json:"name"`
	Definition   string   `json:"definition"`
	Columns      []string `json:"columns"`
	Unique       bool     `json:"unique"`
	Primary      bool     `json:"primary"`
	AccessMethod string   `json:"access_method"`
}

// parseIndexDefinition parses index definition to extract column names
func parseIndexDefinition(def string) []string {
	// Remove surrounding quotes and split by comma
	def = strings.Trim(def, "()")
	columns := strings.Split(def, ",")

	var result []string
	for _, col := range columns {
		col = strings.TrimSpace(col)
		col = strings.Trim(col, `"`)
		if col != "" {
			result = append(result, col)
		}
	}

	return result
}

// AnalyzeSlowQueries returns analysis of slow queries
func (po *PerformanceOptimizer) AnalyzeSlowQueries() ([]SlowQueryAnalysis, error) {
	po.queryAnalyzer.mu.RLock()
	defer po.queryAnalyzer.mu.RUnlock()

	var analyses []SlowQueryAnalysis

	for _, stats := range po.queryAnalyzer.queries {
		if stats.AverageTime > po.queryAnalyzer.threshold {
			analysis := SlowQueryAnalysis{
				Query:           stats.Query,
				AverageTime:     stats.AverageTime,
				ExecutionCount:  stats.ExecutionCount,
				Recommendations: po.generateRecommendations(stats),
			}
			analyses = append(analyses, analysis)
		}
	}

	return analyses, nil
}

// SlowQueryAnalysis represents analysis of a slow query
type SlowQueryAnalysis struct {
	Query           string        `json:"query"`
	AverageTime     time.Duration `json:"average_time"`
	ExecutionCount  int64         `json:"execution_count"`
	Recommendations []string      `json:"recommendations"`
}

// generateRecommendations generates optimization recommendations
func (po *PerformanceOptimizer) generateRecommendations(stats *QueryStats) []string {
	var recommendations []string

	// Check if query is using proper indexes
	if strings.Contains(strings.ToLower(stats.Query), " where ") {
		recommendations = append(recommendations, "Ensure WHERE clause columns are indexed")
	}

	// Check for ORDER BY without index
	if strings.Contains(strings.ToUpper(stats.Query), " ORDER BY") {
		recommendations = append(recommendations, "Consider adding index for ORDER BY columns")
	}

	// Check for JOIN without proper indexes
	if strings.Contains(strings.ToUpper(stats.Query), " JOIN ") {
		recommendations = append(recommendations, "Ensure JOIN columns are properly indexed")
	}

	// Check for table scans
	if strings.Contains(strings.ToUpper(stats.Query), "SELECT *") {
		recommendations = append(recommendations, "Avoid SELECT * - specify only required columns")
	}

	// Check for subqueries
	if strings.Contains(strings.ToUpper(stats.Query), "SELECT") &&
		(strings.Contains(stats.Query, "(") || strings.Contains(stats.Query, ")")) {
		recommendations = append(recommendations, "Consider optimizing subqueries or using JOINs")
	}

	// Check for functions in WHERE clause
	if strings.Contains(strings.ToUpper(stats.Query), " WHERE ") {
		if strings.Contains(strings.ToUpper(stats.Query), "FUNCTION(") ||
			strings.Contains(strings.ToUpper(stats.Query), "CAST(") ||
			strings.Contains(strings.ToUpper(stats.Query), "CONVERT(") {
			recommendations = append(recommendations, "Avoid functions in WHERE clause - use indexed expressions")
		}
	}

	return recommendations
}

// OptimizeTable optimizes a table for better performance
func (po *PerformanceOptimizer) OptimizeTable(ctx context.Context, tableName string) error {
	// Analyze table
	_, err := po.db.ExecContext(ctx, fmt.Sprintf("ANALYZE TABLE %s", tableName))
	if err != nil {
		return fmt.Errorf("failed to analyze table %s: %w", tableName, err)
	}

	// Update statistics
	_, err = po.db.ExecContext(ctx, fmt.Sprintf("VACUUM ANALYZE %s", tableName))
	if err != nil {
		return fmt.Errorf("failed to vacuum analyze table %s: %w", tableName, err)
	}

	po.logger.Printf("Optimized table: %s", tableName)
	return nil
}

// CreateMissingIndexes creates indexes that are missing for performance
func (po *PerformanceOptimizer) CreateMissingIndexes(ctx context.Context, recommendations []IndexRecommendation) error {
	for _, rec := range recommendations {
		if rec.Type == "create" {
			_, err := po.db.ExecContext(ctx, rec.SQL)
			if err != nil {
				po.logger.Printf("Failed to create index %s: %v", rec.Name, err)
				continue
			}
			po.logger.Printf("Created index: %s", rec.Name)
		}
	}

	return nil
}

// IndexRecommendation represents an index recommendation
type IndexRecommendation struct {
	Name   string `json:"name"`
	Type   string `json:"type"` // "create", "drop", "rebuild"
	SQL    string `json:"sql"`
	Reason string `json:"reason"`
}

// recordQuery records query execution statistics
func (po *PerformanceOptimizer) recordQuery(query string, duration time.Duration, err error) {
	if !po.config.EnableQueryAnalyzer {
		return
	}

	po.queryAnalyzer.mu.Lock()
	defer po.queryAnalyzer.mu.Unlock()

	// Generate query hash for identification
	queryHash := generateQueryHash(query)

	stats, exists := po.queryAnalyzer.queries[queryHash]
	if !exists {
		stats = &QueryStats{
			Query:      query,
			MinTime:    duration,
			MaxTime:    duration,
			TotalTime:  0,
			ErrorCount: 0,
			SlowCount:  0,
		}
		po.queryAnalyzer.queries[queryHash] = stats
	}

	stats.ExecutionCount++
	stats.TotalTime += duration
	stats.LastExecuted = time.Now()

	// Update min/max times
	if duration < stats.MinTime {
		stats.MinTime = duration
	}
	if duration > stats.MaxTime {
		stats.MaxTime = duration
	}

	// Update average time
	stats.AverageTime = stats.TotalTime / time.Duration(stats.ExecutionCount)

	// Track slow queries
	if duration > po.queryAnalyzer.threshold {
		stats.SlowCount++
	}

	// Track errors
	if err != nil {
		stats.ErrorCount++
	}
}

// startCollection starts background collection of metrics
func (po *PerformanceOptimizer) startCollection() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		po.collectMetrics()
	}
}

// collectMetrics collects database performance metrics
func (po *PerformanceOptimizer) collectMetrics() {
	ctx := context.Background()

	// Collect connection pool stats
	var maxConns, currentConns int64
	row := po.db.QueryRowContext(ctx, "SELECT max_conn, current_conn FROM pg_stat_database WHERE datname = current_database()")
	err := row.Scan(&maxConns, &currentConns)
	if err != nil {
		po.logger.Printf("Failed to collect connection stats: %v", err)
	} else {
		po.metrics.ConnectionsActive = currentConns
		po.metrics.ConnectionsIdle = maxConns - currentConns
		po.metrics.ConnectionsTotal = maxConns
	}

	// Collect table sizes
	tables := []string{"transactions", "users", "api_keys", "fraud_results", "audit_logs"}
	for _, table := range tables {
		var size int64
		err := po.db.QueryRowContext(ctx,
			fmt.Sprintf("SELECT pg_total_relation_size(%s)", table)).Scan(&size)
		if err != nil {
			po.logger.Printf("Failed to collect size for table %s: %v", table, err)
		} else {
			po.metrics.TableSizes[table] = size
		}
	}

	// Collect index usage
	err = po.collectIndexUsage(ctx)
	if err != nil {
		po.logger.Printf("Failed to collect index usage: %v", err)
	}

	po.metrics.LastUpdated = time.Now()
}

// collectIndexUsage collects index usage statistics
func (po *PerformanceOptimizer) collectIndexUsage(ctx context.Context) error {
	query := `
		SELECT
			schemaname,
			tablename,
			indexname,
			idx_scan,
			idx_tup_read,
			idx_tup_fetch
		FROM pg_stat_user_indexes
		WHERE schemaname = 'public'
	`

	rows, err := po.db.QueryContext(ctx, query)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var schema, table, index string
		var scans, reads, fetches int64

		err := rows.Scan(&schema, &table, &index, &scans, &reads, &fetches)
		if err != nil {
			continue
		}

		// Calculate usage percentage
		if reads > 0 {
			usage := float64(fetches) / float64(reads) * 100
			po.metrics.IndexUsage[fmt.Sprintf("%s.%s.%s", schema, table, index)] = usage
		}
	}

	return nil
}

// GetMetrics returns current performance metrics
func (po *PerformanceOptimizer) GetMetrics() *PerformanceMetrics {
	// Update average response time
	if po.metrics.QueriesTotal > 0 {
		// This would need to be tracked properly in recordQuery
		po.metrics.AverageResponseTime = 100 * time.Millisecond
	}

	return po.metrics
}

// ResetMetrics resets performance metrics
func (po *PerformanceOptimizer) ResetMetrics() {
	po.metrics = &PerformanceMetrics{
		TableSizes: make(map[string]int64),
		IndexUsage: make(map[string]float64),
	}
}

// generateQueryHash generates a hash for query identification
func generateQueryHash(query string) string {
	// Normalize query by removing extra whitespace
	query = strings.Join(strings.Fields(query), " ")

	// In a real implementation, you would use a proper hash function
	// For now, return a simple hash
	return fmt.Sprintf("%x", len(query)*17%1000000007)
}

// Close closes the performance optimizer
func (po *PerformanceOptimizer) Close() error {
	return po.db.Close()
}
