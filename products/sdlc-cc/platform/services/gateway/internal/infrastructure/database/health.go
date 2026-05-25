package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/sirupsen/logrus"
)

// HealthChecker provides database health checking capabilities
type HealthChecker struct {
	db     *Database
	logger *logrus.Logger
}

// NewHealthChecker creates a new health checker
func NewHealthChecker(db *Database, logger *logrus.Logger) *HealthChecker {
	if logger == nil {
		logger = logrus.New()
	}
	return &HealthChecker{
		db:     db,
		logger: logger,
	}
}

// DBHealthStatus represents the health status of the database
type DBHealthStatus struct {
	Status       string                   `json:"status"`
	Timestamp    time.Time                `json:"timestamp"`
	ResponseTime time.Duration            `json:"response_time_ms"`
	Details      map[string]interface{}   `json:"details"`
	Checks       map[string]DBCheckResult `json:"checks"`
}

// DBCheckResult represents the result of a health check
type DBCheckResult struct {
	Status       string        `json:"status"`
	ResponseTime time.Duration `json:"response_time_ms"`
	ErrorMessage string        `json:"error_message,omitempty"`
	LastChecked  time.Time     `json:"last_checked"`
	Metadata     interface{}   `json:"metadata,omitempty"`
}

// DBHealthCheck defines a health check function
type DBHealthCheck func(ctx context.Context) DBCheckResult

// CheckHealth performs a comprehensive health check
func (hc *HealthChecker) CheckHealth(ctx context.Context) DBHealthStatus {
	start := time.Now()

	health := DBHealthStatus{
		Status:    "unhealthy",
		Timestamp: start,
		Details:   make(map[string]interface{}),
		Checks:    make(map[string]DBCheckResult),
	}

	// Perform basic connectivity check
	connectivityCheck := hc.checkConnectivity(ctx)
	health.Checks["connectivity"] = connectivityCheck

	if connectivityCheck.Status != "healthy" {
		health.ResponseTime = time.Since(start)
		return health
	}

	// Perform additional checks in parallel
	checks := map[string]DBHealthCheck{
		"query_performance": hc.checkQueryPerformance,
		"connection_pool":   hc.checkConnectionPool,
		"table_health":      hc.checkTableHealth,
		"replication_lag":   hc.checkReplicationLag,
		"disk_space":        hc.checkDiskSpace,
		"index_health":      hc.checkIndexHealth,
	}

	for name, check := range checks {
		result := check(ctx)
		health.Checks[name] = result

		// If any critical check fails, mark as unhealthy
		if hc.isCriticalCheck(name) && result.Status != "healthy" {
			health.Status = "unhealthy"
		}
	}

	// Get overall database stats
	if stats := hc.getDatabaseStats(ctx); stats != nil {
		health.Details["database_stats"] = stats
	}

	// Determine overall status
	if hc.allChecksHealthy(health.Checks) {
		health.Status = "healthy"
	} else if hc.someChecksHealthy(health.Checks) {
		health.Status = "degraded"
	}

	health.ResponseTime = time.Since(start)

	hc.logger.WithFields(logrus.Fields{
		"status":         health.Status,
		"response_time":  health.ResponseTime,
		"total_checks":   len(health.Checks),
		"healthy_checks": hc.countHealthyChecks(health.Checks),
	}).Info("Database health check completed")

	return health
}

// checkConnectivity performs basic connectivity test
func (hc *HealthChecker) checkConnectivity(ctx context.Context) DBCheckResult {
	start := time.Now()

	result := DBCheckResult{
		LastChecked: start,
	}

	if err := hc.db.Ping(ctx); err != nil {
		result.Status = "unhealthy"
		result.ErrorMessage = err.Error()
	} else {
		result.Status = "healthy"
	}

	result.ResponseTime = time.Since(start)
	return result
}

// checkQueryPerformance checks query performance
func (hc *HealthChecker) checkQueryPerformance(ctx context.Context) DBCheckResult {
	start := time.Now()

	result := DBCheckResult{
		LastChecked: start,
	}

	// Perform a simple query
	var resultCount int
	query := "SELECT COUNT(*) FROM tenants"

	err := hc.db.WithRetry(ctx, func(ctx context.Context) error {
		return hc.db.Pool.QueryRow(ctx, query).Scan(&resultCount)
	})

	if err != nil {
		result.Status = "unhealthy"
		result.ErrorMessage = err.Error()
	} else {
		result.Status = "healthy"
		result.Metadata = map[string]interface{}{
			"query":        query,
			"tenant_count": resultCount,
		}
	}

	result.ResponseTime = time.Since(start)
	return result
}

// checkConnectionPool checks connection pool health
func (hc *HealthChecker) checkConnectionPool(ctx context.Context) DBCheckResult {
	start := time.Now()

	result := DBCheckResult{
		LastChecked: start,
	}

	stats := hc.db.GetStats()

	// Calculate health metrics
	totalConns := stats.TotalConns()
	idleConns := stats.IdleConns()
	maxConns := stats.MaxConns()

	utilization := float64(totalConns-idleConns) / float64(maxConns)

	var status string
	switch {
	case utilization > 0.9:
		status = "unhealthy"
	case utilization > 0.8:
		status = "degraded"
	default:
		status = "healthy"
	}

	result.Status = status
	result.Metadata = map[string]interface{}{
		"total_connections":      totalConns,
		"idle_connections":       idleConns,
		"max_connections":        maxConns,
		"acquire_count":          stats.AcquireCount(),
		"canceled_acquire_count": stats.CanceledAcquireCount(),
		"constructing_conns":     stats.ConstructingConns(),
		"utilization_percent":    utilization * 100,
	}

	result.ResponseTime = time.Since(start)
	return result
}

// checkTableHealth checks the health of critical tables
func (hc *HealthChecker) checkTableHealth(ctx context.Context) DBCheckResult {
	start := time.Now()

	result := DBCheckResult{
		LastChecked: start,
	}

	criticalTables := []string{
		"tenants", "users", "documents", "document_chunks",
		"api_keys", "policies", "audit_logs", "token_usage",
	}

	tableResults := make(map[string]interface{})
	healthyCount := 0

	for _, table := range criticalTables {
		var exists bool
		var rowCount int64

		// Check if table exists
		err := hc.db.Pool.QueryRow(ctx,
			"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)",
			table).Scan(&exists)

		if err != nil {
			tableResults[table] = map[string]interface{}{
				"exists": false,
				"error":  err.Error(),
			}
			continue
		}

		if !exists {
			tableResults[table] = map[string]interface{}{
				"exists": false,
			}
			continue
		}

		// Get row count
		err = hc.db.Pool.QueryRow(ctx,
			fmt.Sprintf("SELECT COUNT(*) FROM %s", pgx.Identifier{table}.Sanitize())).
			Scan(&rowCount)

		if err != nil {
			tableResults[table] = map[string]interface{}{
				"exists":    true,
				"row_count": 0,
				"error":     err.Error(),
			}
		} else {
			tableResults[table] = map[string]interface{}{
				"exists":    true,
				"row_count": rowCount,
			}
			healthyCount++
		}
	}

	// Determine status based on table health
	healthPercentage := float64(healthyCount) / float64(len(criticalTables))
	var status string
	switch {
	case healthPercentage < 0.5:
		status = "unhealthy"
	case healthPercentage < 0.8:
		status = "degraded"
	default:
		status = "healthy"
	}

	result.Status = status
	result.Metadata = map[string]interface{}{
		"total_tables":      len(criticalTables),
		"healthy_tables":    healthyCount,
		"health_percentage": healthPercentage * 100,
		"table_details":     tableResults,
	}

	result.ResponseTime = time.Since(start)
	return result
}

// checkReplicationLag checks database replication lag (if applicable)
func (hc *HealthChecker) checkReplicationLag(ctx context.Context) DBCheckResult {
	start := time.Now()

	result := DBCheckResult{
		LastChecked: start,
		Status:      "healthy", // Default to healthy if not applicable
	}

	// Check if replication is enabled
	var replicationExists bool
	err := hc.db.Pool.QueryRow(ctx,
		"SELECT EXISTS (SELECT 1 FROM pg_stat_replication LIMIT 1)").
		Scan(&replicationExists)

	if err != nil {
		result.Status = "degraded"
		result.ErrorMessage = fmt.Sprintf("Failed to check replication status: %v", err)
		result.ResponseTime = time.Since(start)
		return result
	}

	if !replicationExists {
		result.Status = "healthy"
		result.Metadata = map[string]interface{}{
			"replication_enabled": false,
		}
	} else {
		// Get replication lag
		var maxLagSeconds int
		err := hc.db.Pool.QueryRow(ctx,
			"SELECT COALESCE(GREATEST(EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())), 0), 0)::int").
			Scan(&maxLagSeconds)

		if err != nil {
			result.Status = "degraded"
			result.ErrorMessage = fmt.Sprintf("Failed to get replication lag: %v", err)
		} else {
			var status string
			switch {
			case maxLagSeconds > 300: // 5 minutes
				status = "unhealthy"
			case maxLagSeconds > 60: // 1 minute
				status = "degraded"
			default:
				status = "healthy"
			}

			result.Status = status
			result.Metadata = map[string]interface{}{
				"replication_enabled": true,
				"max_lag_seconds":     maxLagSeconds,
			}
		}
	}

	result.ResponseTime = time.Since(start)
	return result
}

// checkDiskSpace checks available disk space
func (hc *HealthChecker) checkDiskSpace(ctx context.Context) DBCheckResult {
	start := time.Now()

	result := DBCheckResult{
		LastChecked: start,
	}

	// Get database name and size
	var dbName, dbSize string
	err := hc.db.Pool.QueryRow(ctx, "SELECT current_database(), pg_size_pretty(pg_database_size(current_database()))").
		Scan(&dbName, &dbSize)

	if err != nil {
		result.Status = "degraded"
		result.ErrorMessage = fmt.Sprintf("Failed to get database size: %v", err)
		result.ResponseTime = time.Since(start)
		return result
	}

	// For now, just report database size since detailed disk space checks
	// require superuser privileges
	result.Status = "healthy"
	result.Metadata = map[string]interface{}{
		"database_name":       dbName,
		"database_size":       dbSize,
		"disk_check_detailed": false,
		"note":                "Detailed disk space check requires superuser privileges",
	}

	result.ResponseTime = time.Since(start)
	return result
}

// checkIndexHealth checks the health of database indexes
func (hc *HealthChecker) checkIndexHealth(ctx context.Context) DBCheckResult {
	start := time.Now()

	result := DBCheckResult{
		LastChecked: start,
	}

	// Get basic index statistics
	rows, err := hc.db.Pool.Query(ctx, `
		SELECT
			schemaname,
			tablename,
			indexname,
			idx_scan,
			idx_tup_read,
			idx_tup_fetch
		FROM pg_stat_user_indexes
		WHERE schemaname = 'public'
		ORDER BY idx_scan DESC
		LIMIT 20
	`)

	if err != nil {
		result.Status = "degraded"
		result.ErrorMessage = fmt.Sprintf("Failed to get index statistics: %v", err)
		result.ResponseTime = time.Since(start)
		return result
	}
	defer rows.Close()

	var indexes []map[string]interface{}
	totalScans := int64(0)

	for rows.Next() {
		var schemaName, tableName, indexName string
		var idxScan, idxTupRead, idxTupFetch int64

		if err := rows.Scan(&schemaName, &tableName, &indexName, &idxScan, &idxTupRead, &idxTupFetch); err != nil {
			continue
		}

		indexes = append(indexes, map[string]interface{}{
			"schema_name":    schemaName,
			"table_name":     tableName,
			"index_name":     indexName,
			"index_scans":    idxScan,
			"tuples_read":    idxTupRead,
			"tuples_fetched": idxTupFetch,
		})

		totalScans += idxScan
	}

	result.Status = "healthy"
	result.Metadata = map[string]interface{}{
		"total_indexes": len(indexes),
		"total_scans":   totalScans,
		"top_indexes":   indexes,
	}

	result.ResponseTime = time.Since(start)
	return result
}

// getDatabaseStats collects overall database statistics
func (hc *HealthChecker) getDatabaseStats(ctx context.Context) map[string]interface{} {
	stats := make(map[string]interface{})

	// Get connection pool stats
	poolStats := hc.db.GetStats()
	stats["connection_pool"] = map[string]interface{}{
		"total_connections":      poolStats.TotalConns(),
		"idle_connections":       poolStats.IdleConns(),
		"max_connections":        poolStats.MaxConns(),
		"acquire_count":          poolStats.AcquireCount(),
		"canceled_acquire_count": poolStats.CanceledAcquireCount(),
	}

	// Get database version
	var version string
	if err := hc.db.Pool.QueryRow(ctx, "SELECT version()").Scan(&version); err == nil {
		stats["database_version"] = version
	}

	// Get uptime
	var uptime time.Time
	if err := hc.db.Pool.QueryRow(ctx, "SELECT pg_postmaster_start_time()").Scan(&uptime); err == nil {
		stats["uptime"] = uptime.Format(time.RFC3339)
		stats["uptime_seconds"] = time.Since(uptime).Seconds()
	}

	return stats
}

// isCriticalCheck determines if a health check is critical
func (hc *HealthChecker) isCriticalCheck(name string) bool {
	criticalChecks := []string{
		"connectivity",
		"query_performance",
		"connection_pool",
	}

	for _, critical := range criticalChecks {
		if name == critical {
			return true
		}
	}
	return false
}

// allChecksHealthy checks if all health checks passed
func (hc *HealthChecker) allChecksHealthy(checks map[string]DBCheckResult) bool {
	for _, check := range checks {
		if check.Status != "healthy" {
			return false
		}
	}
	return true
}

// someChecksHealthy checks if at least some health checks passed
func (hc *HealthChecker) someChecksHealthy(checks map[string]DBCheckResult) bool {
	for _, check := range checks {
		if check.Status == "healthy" {
			return true
		}
	}
	return false
}

// countHealthyChecks counts the number of healthy checks
func (hc *HealthChecker) countHealthyChecks(checks map[string]DBCheckResult) int {
	count := 0
	for _, check := range checks {
		if check.Status == "healthy" {
			count++
		}
	}
	return count
}

// StartHealthCheckMonitoring starts continuous health monitoring
func (hc *HealthChecker) StartHealthCheckMonitoring(ctx context.Context, interval time.Duration, healthChan chan<- DBHealthStatus) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	hc.logger.WithField("interval", interval).Info("Starting database health monitoring")

	for {
		select {
		case <-ctx.Done():
			hc.logger.Info("Stopping database health monitoring")
			return
		case <-ticker.C:
			health := hc.CheckHealth(ctx)
			select {
			case healthChan <- health:
			case <-ctx.Done():
				return
			default:
				// Channel is full, skip this health check
				hc.logger.Warn("Health check channel is full, skipping health check")
			}
		}
	}
}
