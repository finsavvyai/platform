package metrics

import (
	"database/sql"
	"sync"
	"time"

	"quantumbeam/internal/ports"

	"github.com/prometheus/client_golang/prometheus"
)

// SQLiteMetricsCollector implements ports.DatabaseMetricsCollector for SQLite
type SQLiteMetricsCollector struct {
	enabled bool
	mu      sync.RWMutex

	// Prometheus metrics
	connectionsActive *prometheus.GaugeVec
	connectionsIdle   *prometheus.GaugeVec
	queryDuration     *prometheus.HistogramVec
	queryErrors       *prometheus.CounterVec
}

// NewSQLiteMetricsCollector creates a new SQLiteMetricsCollector
func NewSQLiteMetricsCollector(reg prometheus.Registerer, namespace string) *SQLiteMetricsCollector {
	c := &SQLiteMetricsCollector{
		enabled: true,
		connectionsActive: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: "sqlite",
			Name:      "connections_active",
			Help:      "Number of active SQLite connections",
		}, []string{"db_name"}),
		connectionsIdle: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: "sqlite",
			Name:      "connections_idle",
			Help:      "Number of idle SQLite connections",
		}, []string{"db_name"}),
		queryDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: "sqlite",
			Name:      "query_duration_seconds",
			Help:      "Duration of SQLite queries in seconds",
			Buckets:   prometheus.DefBuckets,
		}, []string{"query_type"}),
		queryErrors: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: "sqlite",
			Name:      "query_errors_total",
			Help:      "Total number of SQLite query errors",
		}, []string{"query_type"}),
	}

	if reg != nil {
		reg.MustRegister(
			c.connectionsActive,
			c.connectionsIdle,
			c.queryDuration,
			c.queryErrors,
		)
	}

	return c
}

// CollectConnectionMetrics records connection pool statistics
func (c *SQLiteMetricsCollector) CollectConnectionMetrics(db *sql.DB, name string) error {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if !c.enabled {
		return nil
	}

	stats := db.Stats()
	c.connectionsActive.WithLabelValues(name).Set(float64(stats.InUse))
	c.connectionsIdle.WithLabelValues(name).Set(float64(stats.Idle))
	return nil
}

// CollectQueryMetrics records execution time and errors for a query
func (c *SQLiteMetricsCollector) CollectQueryMetrics(query string, duration time.Duration, err error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if !c.enabled {
		return
	}

	queryType := "select" // Simplified
	c.queryDuration.WithLabelValues(queryType).Observe(duration.Seconds())
	if err != nil {
		c.queryErrors.WithLabelValues(queryType).Inc()
	}
}

// CollectTableMetrics records table-specific operations
func (c *SQLiteMetricsCollector) CollectTableMetrics(tableName string, operation string) {
	// SQLite table metrics implementation (simplified)
}

// CollectIndexMetrics records index usage statistics
func (c *SQLiteMetricsCollector) CollectIndexMetrics(tableName string, indexName string, hits int64) {
	// SQLite index metrics implementation (simplified)
}

// EnableCollection enables metrics gathering
func (c *SQLiteMetricsCollector) EnableCollection() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.enabled = true
}

// DisableCollection disables metrics gathering
func (c *SQLiteMetricsCollector) DisableCollection() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.enabled = false
}

// Ensure interface implementation
var _ ports.DatabaseMetricsCollector = (*SQLiteMetricsCollector)(nil)
