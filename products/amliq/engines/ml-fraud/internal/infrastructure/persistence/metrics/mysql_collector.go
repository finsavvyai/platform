package metrics

import (
	"database/sql"
	"sync"
	"time"

	"quantumbeam/internal/ports"

	"github.com/prometheus/client_golang/prometheus"
)

// MySQLMetricsCollector implements ports.DatabaseMetricsCollector for MySQL
type MySQLMetricsCollector struct {
	enabled bool
	mu      sync.RWMutex

	// Prometheus metrics
	connectionsActive *prometheus.GaugeVec
	connectionsIdle   *prometheus.GaugeVec
	queryDuration     *prometheus.HistogramVec
	queryErrors       *prometheus.CounterVec
	tableOperations   *prometheus.CounterVec
	indexHits         *prometheus.CounterVec
}

// NewMySQLMetricsCollector creates a new MySQLMetricsCollector
func NewMySQLMetricsCollector(reg prometheus.Registerer, namespace string) *MySQLMetricsCollector {
	c := &MySQLMetricsCollector{
		enabled: true,
		connectionsActive: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: "mysql",
			Name:      "connections_active",
			Help:      "Number of active MySQL connections",
		}, []string{"db_name"}),
		connectionsIdle: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: "mysql",
			Name:      "connections_idle",
			Help:      "Number of idle MySQL connections",
		}, []string{"db_name"}),
		queryDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: namespace,
			Subsystem: "mysql",
			Name:      "query_duration_seconds",
			Help:      "Duration of MySQL queries in seconds",
			Buckets:   prometheus.DefBuckets,
		}, []string{"query_type"}),
		queryErrors: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: "mysql",
			Name:      "query_errors_total",
			Help:      "Total number of MySQL query errors",
		}, []string{"query_type"}),
		tableOperations: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: "mysql",
			Name:      "table_operations_total",
			Help:      "Total number of table operations",
		}, []string{"table", "operation"}),
		indexHits: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: "mysql",
			Name:      "index_hits_total",
			Help:      "Total number of index hits",
		}, []string{"table", "index"}),
	}

	if reg != nil {
		reg.MustRegister(
			c.connectionsActive,
			c.connectionsIdle,
			c.queryDuration,
			c.queryErrors,
			c.tableOperations,
			c.indexHits,
		)
	}

	return c
}

// CollectConnectionMetrics records connection pool statistics
func (c *MySQLMetricsCollector) CollectConnectionMetrics(db *sql.DB, name string) error {
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
func (c *MySQLMetricsCollector) CollectQueryMetrics(query string, duration time.Duration, err error) {
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
func (c *MySQLMetricsCollector) CollectTableMetrics(tableName string, operation string) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if !c.enabled {
		return
	}

	c.tableOperations.WithLabelValues(tableName, operation).Inc()
}

// CollectIndexMetrics records index usage statistics
func (c *MySQLMetricsCollector) CollectIndexMetrics(tableName string, indexName string, hits int64) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if !c.enabled {
		return
	}

	c.indexHits.WithLabelValues(tableName, indexName).Add(float64(hits))
}

// EnableCollection enables metrics gathering
func (c *MySQLMetricsCollector) EnableCollection() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.enabled = true
}

// DisableCollection disables metrics gathering
func (c *MySQLMetricsCollector) DisableCollection() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.enabled = false
}

// Ensure interface implementation
var _ ports.DatabaseMetricsCollector = (*MySQLMetricsCollector)(nil)
