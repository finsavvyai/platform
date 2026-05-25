package ports

import (
	"database/sql"
	"time"
)

// DatabaseMetricsCollector defines the interface for database-specific metrics collection
type DatabaseMetricsCollector interface {
	// CollectConnectionMetrics records connection pool statistics
	CollectConnectionMetrics(db *sql.DB, name string) error

	// CollectQueryMetrics records execution time and errors for a query
	CollectQueryMetrics(query string, duration time.Duration, err error)

	// CollectTableMetrics records table-specific operations
	CollectTableMetrics(tableName string, operation string)

	// CollectIndexMetrics records index usage statistics
	CollectIndexMetrics(tableName string, indexName string, hits int64)

	// EnableCollection enables metrics gathering
	EnableCollection()

	// DisableCollection disables metrics gathering
	DisableCollection()
}
