package types

import "time"

// HealthStatus represents the health status of a database connection at a
// point in time. Returned by adapter health-check helpers.
type HealthStatus struct {
	Healthy           bool          `json:"healthy"`
	LastChecked       time.Time     `json:"last_checked"`
	ResponseTime      time.Duration `json:"response_time"`
	ErrorMessage      string        `json:"error_message,omitempty"`
	ConnectionsActive int           `json:"connections_active"`
	ConnectionsIdle   int           `json:"connections_idle"`
}

// ConnectionMetrics aggregates pool, query, and database-level metrics for a
// single adapter instance. Returned by DatabaseAdapter.GetMetrics.
type ConnectionMetrics struct {
	ConnectionPoolStats ConnectionPoolStats `json:"connection_pool_stats"`
	QueryPerformance    QueryPerformance    `json:"query_performance"`
	DatabaseInfo        DatabaseInfo        `json:"database_info"`
	LastUpdated         time.Time           `json:"last_updated"`
}

// ConnectionPoolStats captures driver-level pool statistics.
type ConnectionPoolStats struct {
	MaxOpenConnections     int           `json:"max_open_connections"`
	OpenConnections        int           `json:"open_connections"`
	InUseConnections       int           `json:"in_use_connections"`
	IdleConnections        int           `json:"idle_connections"`
	WaitCount              int64         `json:"wait_count"`
	WaitDuration           time.Duration `json:"wait_duration"`
	MaxIdleConnections     int           `json:"max_idle_connections"`
	MaxLifetimeConnections time.Duration `json:"max_lifetime_connections"`
}

// QueryPerformance captures rolling aggregate query metrics.
type QueryPerformance struct {
	QueriesPerSecond   float64       `json:"queries_per_second"`
	AverageQueryTime   time.Duration `json:"average_query_time"`
	SlowQueriesCount   int64         `json:"slow_queries_count"`
	FailedQueriesCount int64         `json:"failed_queries_count"`
	TotalQueriesCount  int64         `json:"total_queries_count"`
}

// DatabaseInfo captures general information about the underlying database.
type DatabaseInfo struct {
	Version    string `json:"version"`
	Engine     string `json:"engine"`
	Charset    string `json:"charset,omitempty"`
	Collation  string `json:"collation,omitempty"`
	SizeBytes  int64  `json:"size_bytes,omitempty"`
	TableCount int    `json:"table_count,omitempty"`
	IndexCount int    `json:"index_count,omitempty"`
}
