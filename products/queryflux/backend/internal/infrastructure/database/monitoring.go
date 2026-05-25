package database

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

// DatabaseMonitor monitors database performance and health metrics
type DatabaseMonitor struct {
	pool       *PostgreSQLPoolManager
	logger     *zap.Logger
	mu         sync.RWMutex
	metrics    *DatabaseMetrics
	alertRules []AlertRule
	collectors map[string]MetricCollector
	interval   time.Duration
	ticker     *time.Ticker
	ctx        context.Context
	cancel     context.CancelFunc
}

// DatabaseMetrics contains comprehensive database performance metrics
type DatabaseMetrics struct {
	// Connection metrics
	TotalConnections  int64 `json:"total_connections"`
	ActiveConnections int64 `json:"active_connections"`
	IdleConnections   int64 `json:"idle_connections"`
	MaxConnections    int64 `json:"max_connections"`
	ConnectionErrors  int64 `json:"connection_errors"`

	// Query metrics
	TotalQueries     int64         `json:"total_queries"`
	SlowQueries      int64         `json:"slow_queries"`
	FailedQueries    int64         `json:"failed_queries"`
	AverageQueryTime time.Duration `json:"average_query_time"`
	TotalQueryTime   time.Duration `json:"total_query_time"`

	// Transaction metrics
	TotalTransactions      int64 `json:"total_transactions"`
	CommittedTransactions  int64 `json:"committed_transactions"`
	RolledBackTransactions int64 `json:"rolled_back_transactions"`
	Deadlocks              int64 `json:"deadlocks"`

	// Database size metrics
	DatabaseSize int64 `json:"database_size_bytes"`
	TableCount   int64 `json:"table_count"`
	IndexCount   int64 `json:"index_count"`

	// Performance metrics
	CPUUsage      float64 `json:"cpu_usage_percent"`
	MemoryUsage   int64   `json:"memory_usage_bytes"`
	DiskUsage     int64   `json:"disk_usage_bytes"`
	CacheHitRatio float64 `json:"cache_hit_ratio"`

	// Replication metrics (if applicable)
	ReplicationLag int64 `json:"replication_lag_seconds"`
	IsReplica      bool  `json:"is_replica"`

	// System metrics
	LockWaitTime       time.Duration `json:"lock_wait_time"`
	CheckpointDuration time.Duration `json:"checkpoint_duration"`
	WALSize            int64         `json:"wal_size_bytes"`

	// Timestamps
	LastUpdated     time.Time `json:"last_updated"`
	LastHealthCheck time.Time `json:"last_health_check"`
}

// MetricCollector defines the interface for collecting specific metrics
type MetricCollector interface {
	Collect(ctx context.Context, pool *pgxpool.Pool) (map[string]interface{}, error)
	Name() string
}

// AlertRule defines a rule for generating alerts based on metrics
type AlertRule struct {
	Name         string        `json:"name"`
	Metric       string        `json:"metric"`
	Operator     string        `json:"operator"` // ">", "<", ">=", "<=", "==", "!="
	Threshold    float64       `json:"threshold"`
	Duration     time.Duration `json:"duration"`
	Severity     string        `json:"severity"` // "critical", "warning", "info"
	Description  string        `json:"description"`
	Enabled      bool          `json:"enabled"`
	LastTrigger  *time.Time    `json:"last_triggered,omitempty"`
	TriggerCount int64         `json:"trigger_count"`
}

// Alert represents a triggered alert
type Alert struct {
	Rule      AlertRule `json:"rule"`
	Value     float64   `json:"value"`
	Timestamp time.Time `json:"timestamp"`
	Message   string    `json:"message"`
	Severity  string    `json:"severity"`
}

// MonitorConfig defines configuration for the database monitor
type MonitorConfig struct {
	// Collection settings
	Interval time.Duration `mapstructure:"interval"`
	Timeout  time.Duration `mapstructure:"timeout"`

	// Performance thresholds
	SlowQueryThreshold  time.Duration `mapstructure:"slow_query_threshold"`
	ConnectionThreshold float64       `mapstructure:"connection_threshold"`

	// Alert settings
	EnableAlerts  bool          `mapstructure:"enable_alerts"`
	AlertCooldown time.Duration `mapstructure:"alert_cooldown"`

	// Metrics collection
	CollectSystemMetrics    bool `mapstructure:"collect_system_metrics"`
	CollectQueryStats       bool `mapstructure:"collect_query_stats"`
	CollectReplicationStats bool `mapstructure:"collect_replication_stats"`
}

// DefaultMonitorConfig returns default monitor configuration
func DefaultMonitorConfig() *MonitorConfig {
	return &MonitorConfig{
		Interval:                30 * time.Second,
		Timeout:                 10 * time.Second,
		SlowQueryThreshold:      1 * time.Second,
		ConnectionThreshold:     0.8, // 80% of max connections
		EnableAlerts:            true,
		AlertCooldown:           5 * time.Minute,
		CollectSystemMetrics:    true,
		CollectQueryStats:       true,
		CollectReplicationStats: false,
	}
}

// NewDatabaseMonitor creates a new database monitor
func NewDatabaseMonitor(pool *PostgreSQLPoolManager, logger *zap.Logger, config *MonitorConfig) *DatabaseMonitor {
	if config == nil {
		config = DefaultMonitorConfig()
	}

	if logger == nil {
		logger = zap.NewNop()
	}

	monitor := &DatabaseMonitor{
		pool:       pool,
		logger:     logger,
		metrics:    &DatabaseMetrics{},
		collectors: make(map[string]MetricCollector),
		interval:   config.Interval,
	}

	// Initialize built-in collectors
	monitor.initializeCollectors(config)

	// Initialize default alert rules
	monitor.initializeAlertRules(config)

	return monitor
}

// Start begins the monitoring process
func (dm *DatabaseMonitor) Start(ctx context.Context) error {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	if dm.ticker != nil {
		return fmt.Errorf("monitor is already running")
	}

	dm.ctx, dm.cancel = context.WithCancel(ctx)
	dm.ticker = time.NewTicker(dm.interval)

	// Start monitoring goroutine
	go dm.monitorLoop()

	dm.logger.Info("Database monitor started",
		zap.Duration("interval", dm.interval))

	return nil
}

// Stop stops the monitoring process
func (dm *DatabaseMonitor) Stop() error {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	if dm.ticker == nil {
		return nil
	}

	dm.cancel()
	dm.ticker.Stop()
	dm.ticker = nil

	dm.logger.Info("Database monitor stopped")
	return nil
}

// GetMetrics returns the current database metrics
func (dm *DatabaseMonitor) GetMetrics() *DatabaseMetrics {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	// Return a copy to prevent concurrent modification
	metricsCopy := *dm.metrics
	return &metricsCopy
}

// AddAlertRule adds a new alert rule
func (dm *DatabaseMonitor) AddAlertRule(rule AlertRule) {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	dm.alertRules = append(dm.alertRules, rule)
	dm.logger.Info("Alert rule added",
		zap.String("name", rule.Name),
		zap.String("metric", rule.Metric),
		zap.Float64("threshold", rule.Threshold))
}

// GetAlertRules returns all alert rules
func (dm *DatabaseMonitor) GetAlertRules() []AlertRule {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	rulesCopy := make([]AlertRule, len(dm.alertRules))
	copy(rulesCopy, dm.alertRules)
	return rulesCopy
}

// CheckAlerts evaluates all alert rules against current metrics
func (dm *DatabaseMonitor) CheckAlerts() []Alert {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	var alerts []Alert
	now := time.Now()

	for i := range dm.alertRules {
		rule := &dm.alertRules[i]
		if !rule.Enabled {
			continue
		}

		// Check cooldown
		if rule.LastTrigger != nil && now.Sub(*rule.LastTrigger) < dm.interval {
			continue
		}

		alert := dm.evaluateRule(rule)
		if alert != nil {
			alerts = append(alerts, *alert)
			rule.LastTrigger = &now
			rule.TriggerCount++
		}
	}

	return alerts
}

// monitorLoop is the main monitoring loop
func (dm *DatabaseMonitor) monitorLoop() {
	for {
		select {
		case <-dm.ctx.Done():
			return
		case <-dm.ticker.C:
			dm.collectMetrics()
		}
	}
}

// collectMetrics gathers all database metrics
func (dm *DatabaseMonitor) collectMetrics() {
	ctx, cancel := context.WithTimeout(dm.ctx, 10*time.Second)
	defer cancel()

	// Collect connection pool metrics
	poolMetrics := dm.pool.GetMetrics()
	dm.metrics.TotalConnections = poolMetrics.TotalConnections
	dm.metrics.ActiveConnections = poolMetrics.ActiveConnections
	dm.metrics.IdleConnections = poolMetrics.IdleConnections
	dm.metrics.MaxConnections = poolMetrics.MaxConnections

	// Collect query metrics
	dm.metrics.TotalQueries = poolMetrics.TotalQueryCount
	dm.metrics.FailedQueries = poolMetrics.FailedQueries
	dm.metrics.TotalQueryTime = poolMetrics.TotalQueryTime
	if dm.metrics.TotalQueries > 0 {
		dm.metrics.AverageQueryTime = dm.metrics.TotalQueryTime / time.Duration(dm.metrics.TotalQueries)
	}

	// Collect metrics from all collectors
	for name, collector := range dm.collectors {
		metricData, err := collector.Collect(ctx, dm.pool.GetPool())
		if err != nil {
			dm.logger.Error("Failed to collect metrics",
				zap.String("collector", name),
				zap.Error(err))
			continue
		}

		dm.updateMetricsFromData(metricData)
	}

	// Update timestamp
	dm.metrics.LastUpdated = time.Now()

	// Check for alerts
	alerts := dm.CheckAlerts()
	for _, alert := range alerts {
		dm.handleAlert(alert)
	}
}

// updateMetricsFromData updates metrics from collected data
func (dm *DatabaseMonitor) updateMetricsFromData(data map[string]interface{}) {
	// Database size
	if size, ok := data["database_size"]; ok {
		if sizeBytes, ok := size.(int64); ok {
			dm.metrics.DatabaseSize = sizeBytes
		}
	}

	// Table count
	if tableCount, ok := data["table_count"]; ok {
		if count, ok := tableCount.(int64); ok {
			dm.metrics.TableCount = count
		}
	}

	// Index count
	if indexCount, ok := data["index_count"]; ok {
		if count, ok := indexCount.(int64); ok {
			dm.metrics.IndexCount = count
		}
	}

	// Cache hit ratio
	if cacheHitRatio, ok := data["cache_hit_ratio"]; ok {
		if ratio, ok := cacheHitRatio.(float64); ok {
			dm.metrics.CacheHitRatio = ratio
		}
	}

	// Replication lag
	if replLag, ok := data["replication_lag"]; ok {
		if lag, ok := replLag.(int64); ok {
			dm.metrics.ReplicationLag = lag
		}
	}

	// Is replica
	if isReplica, ok := data["is_replica"]; ok {
		if replica, ok := isReplica.(bool); ok {
			dm.metrics.IsReplica = replica
		}
	}

	// WAL size
	if walSize, ok := data["wal_size"]; ok {
		if size, ok := walSize.(int64); ok {
			dm.metrics.WALSize = size
		}
	}
}

// evaluateRule evaluates a single alert rule
func (dm *DatabaseMonitor) evaluateRule(rule *AlertRule) *Alert {
	var value float64
	var found bool

	// Get the metric value
	switch rule.Metric {
	case "connection_usage":
		if dm.metrics.MaxConnections > 0 {
			value = float64(dm.metrics.ActiveConnections) / float64(dm.metrics.MaxConnections)
			found = true
		}
	case "average_query_time":
		value = float64(dm.metrics.AverageQueryTime.Nanoseconds())
		found = true
	case "failed_query_rate":
		if dm.metrics.TotalQueries > 0 {
			value = float64(dm.metrics.FailedQueries) / float64(dm.metrics.TotalQueries)
			found = true
		}
	case "cache_hit_ratio":
		value = dm.metrics.CacheHitRatio
		found = true
	case "database_size_gb":
		value = float64(dm.metrics.DatabaseSize) / (1024 * 1024 * 1024)
		found = true
	}

	if !found {
		return nil
	}

	// Evaluate the condition
	var triggered bool
	switch rule.Operator {
	case ">":
		triggered = value > rule.Threshold
	case "<":
		triggered = value < rule.Threshold
	case ">=":
		triggered = value >= rule.Threshold
	case "<=":
		triggered = value <= rule.Threshold
	case "==":
		triggered = value == rule.Threshold
	case "!=":
		triggered = value != rule.Threshold
	default:
		return nil
	}

	if !triggered {
		return nil
	}

	// Create alert
	return &Alert{
		Rule:      *rule,
		Value:     value,
		Timestamp: time.Now(),
		Message: fmt.Sprintf("%s: %s %s %.2f (threshold: %.2f)",
			rule.Name, rule.Metric, rule.Operator, value, rule.Threshold),
		Severity: rule.Severity,
	}
}

// handleAlert processes a triggered alert
func (dm *DatabaseMonitor) handleAlert(alert Alert) {
	dm.logger.Warn("Database alert triggered",
		zap.String("rule", alert.Rule.Name),
		zap.String("message", alert.Message),
		zap.String("severity", alert.Severity),
		zap.Float64("value", alert.Value))

	// Here you could add additional alert handling:
	// - Send email notifications
	// - Send to Slack/Teams
	// - Store in database
	// - Trigger webhook
}

// initializeCollectors sets up built-in metric collectors
func (dm *DatabaseMonitor) initializeCollectors(config *MonitorConfig) {
	// System metrics collector
	if config.CollectSystemMetrics {
		dm.collectors["system"] = &SystemMetricsCollector{}
	}

	// Query statistics collector
	if config.CollectQueryStats {
		dm.collectors["query_stats"] = &QueryStatsCollector{}
	}

	// Replication metrics collector
	if config.CollectReplicationStats {
		dm.collectors["replication"] = &ReplicationMetricsCollector{}
	}

	// Database size collector
	dm.collectors["database_size"] = &DatabaseSizeCollector{}
}

// initializeAlertRules sets up default alert rules
func (dm *DatabaseMonitor) initializeAlertRules(config *MonitorConfig) {
	if !config.EnableAlerts {
		return
	}

	defaultRules := []AlertRule{
		{
			Name:        "High Connection Usage",
			Metric:      "connection_usage",
			Operator:    ">",
			Threshold:   config.ConnectionThreshold,
			Severity:    "warning",
			Description: "Database connection usage is high",
			Enabled:     true,
		},
		{
			Name:        "High Average Query Time",
			Metric:      "average_query_time",
			Operator:    ">",
			Threshold:   float64(config.SlowQueryThreshold.Nanoseconds()),
			Severity:    "warning",
			Description: "Average query time is above threshold",
			Enabled:     true,
		},
		{
			Name:        "High Failed Query Rate",
			Metric:      "failed_query_rate",
			Operator:    ">",
			Threshold:   0.05, // 5%
			Severity:    "critical",
			Description: "Failed query rate is above 5%",
			Enabled:     true,
		},
		{
			Name:        "Low Cache Hit Ratio",
			Metric:      "cache_hit_ratio",
			Operator:    "<",
			Threshold:   0.90, // 90%
			Severity:    "warning",
			Description: "Cache hit ratio is below 90%",
			Enabled:     true,
		},
	}

	dm.alertRules = append(dm.alertRules, defaultRules...)
}

// SystemMetricsCollector collects system-level database metrics
type SystemMetricsCollector struct{}

func (s *SystemMetricsCollector) Collect(ctx context.Context, pool *pgxpool.Pool) (map[string]interface{}, error) {
	metrics := make(map[string]interface{})

	// Get database size
	query := `
		SELECT pg_database_size(current_database()) as size
	`

	var size int64
	err := pool.QueryRow(ctx, query).Scan(&size)
	if err != nil {
		return nil, fmt.Errorf("failed to get database size: %w", err)
	}
	metrics["database_size"] = size

	// Get table and index counts
	query = `
		SELECT
			COUNT(*) as table_count
		FROM information_schema.tables
		WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
	`

	var tableCount int64
	err = pool.QueryRow(ctx, query).Scan(&tableCount)
	if err != nil {
		return nil, fmt.Errorf("failed to get table count: %w", err)
	}
	metrics["table_count"] = tableCount

	// Get cache hit ratio
	query = `
		SELECT
			SUM(heap_blks_hit) / (SUM(heap_blks_hit) + SUM(heap_blks_read)) as ratio
		FROM pg_stat_database
		WHERE datname = current_database()
	`

	var cacheHitRatio float64
	err = pool.QueryRow(ctx, query).Scan(&cacheHitRatio)
	if err != nil {
		return nil, fmt.Errorf("failed to get cache hit ratio: %w", err)
	}
	metrics["cache_hit_ratio"] = cacheHitRatio

	return metrics, nil
}

func (s *SystemMetricsCollector) Name() string {
	return "system"
}

// QueryStatsCollector collects query performance statistics
type QueryStatsCollector struct{}

func (q *QueryStatsCollector) Collect(ctx context.Context, pool *pgxpool.Pool) (map[string]interface{}, error) {
	metrics := make(map[string]interface{})

	// Get slow queries (simplified)
	query := `
		SELECT COUNT(*) as slow_queries
		FROM pg_stat_statements
		WHERE mean_exec_time > 1000
	`

	var slowQueries int64
	err := pool.QueryRow(ctx, query).Scan(&slowQueries)
	if err != nil {
		// pg_stat_statements might not be enabled
		metrics["slow_queries"] = int64(0)
	} else {
		metrics["slow_queries"] = slowQueries
	}

	return metrics, nil
}

func (q *QueryStatsCollector) Name() string {
	return "query_stats"
}

// ReplicationMetricsCollector collects replication metrics
type ReplicationMetricsCollector struct{}

func (r *ReplicationMetricsCollector) Collect(ctx context.Context, pool *pgxpool.Pool) (map[string]interface{}, error) {
	metrics := make(map[string]interface{})

	// Check if this is a replica
	query := `
		SELECT pg_is_in_recovery() as is_replica
	`

	var isReplica bool
	err := pool.QueryRow(ctx, query).Scan(&isReplica)
	if err != nil {
		return nil, fmt.Errorf("failed to check replica status: %w", err)
	}
	metrics["is_replica"] = isReplica

	// Get replication lag if this is a replica
	if isReplica {
		query = `
		SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) as lag
		`

		var lag float64
		err = pool.QueryRow(ctx, query).Scan(&lag)
		if err != nil {
			metrics["replication_lag"] = int64(0)
		} else {
			metrics["replication_lag"] = int64(lag)
		}
	} else {
		metrics["replication_lag"] = int64(0)
	}

	return metrics, nil
}

func (r *ReplicationMetricsCollector) Name() string {
	return "replication"
}

// DatabaseSizeCollector collects database size metrics
type DatabaseSizeCollector struct{}

func (d *DatabaseSizeCollector) Collect(ctx context.Context, pool *pgxpool.Pool) (map[string]interface{}, error) {
	metrics := make(map[string]interface{})

	// Get WAL size
	query := `
		SELECT pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0')) as wal_size
	`

	var walSizeStr string
	err := pool.QueryRow(ctx, query).Scan(&walSizeStr)
	if err != nil {
		return nil, fmt.Errorf("failed to get WAL size: %w", err)
	}

	// Parse size string to bytes (simplified)
	metrics["wal_size"] = int64(1024 * 1024 * 100) // Placeholder

	return metrics, nil
}

func (d *DatabaseSizeCollector) Name() string {
	return "database_size"
}
