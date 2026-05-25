package ports

import (
	"context"
	"time"

	"github.com/queryflux/backend/internal/domain"
)

// MetricCollector interface for collecting metrics
type MetricCollector interface {
	CollectMetric(ctx context.Context, metric *domain.Metric) error
	CollectMetrics(ctx context.Context, metrics []*domain.Metric) error
	GetMetric(ctx context.Context, name string, labels map[string]string, timestamp time.Time) (*domain.Metric, error)
	GetMetricSeries(ctx context.Context, name string, labels map[string]string, from, to time.Time) (*domain.MetricSeries, error)
	DeleteMetric(ctx context.Context, name string, labels map[string]string) error
	FlushMetrics(ctx context.Context) error
}

// MetricsStorage interface for storing and retrieving metrics
type MetricsStorage interface {
	Store(ctx context.Context, metric *domain.Metric) error
	StoreBatch(ctx context.Context, metrics []*domain.Metric) error
	Query(ctx context.Context, query *MetricsQuery) ([]*domain.Metric, error)
	QuerySeries(ctx context.Context, query *MetricsQuery) ([]*domain.MetricSeries, error)
	Delete(ctx context.Context, name string, labels map[string]string, before time.Time) error
	Cleanup(ctx context.Context, retention time.Duration) error
	GetStats(ctx context.Context) (*StorageStats, error)
}

// MetricsQuery represents a metrics query
type MetricsQuery struct {
	Name         string            `json:"name"`
	MetricNames  []string          `json:"metric_names,omitempty"`
	Source       string            `json:"source,omitempty"`
	ConnectionID string            `json:"connection_id,omitempty"`
	Labels       map[string]string `json:"labels,omitempty"`
	From         time.Time         `json:"from"`
	To           time.Time         `json:"to"`
	StartTime    time.Time         `json:"start_time,omitempty"`
	EndTime      time.Time         `json:"end_time,omitempty"`
	Aggregation  string            `json:"aggregation,omitempty"` // avg, sum, min, max, count
	Step         time.Duration     `json:"step,omitempty"`
	Limit        int               `json:"limit,omitempty"`
}

// StorageStats represents storage statistics
type StorageStats struct {
	TotalMetrics    int64     `json:"total_metrics"`
	TotalSeries     int64     `json:"total_series"`
	StorageSize     int64     `json:"storage_size_bytes"`
	OldestTimestamp time.Time `json:"oldest_timestamp"`
	NewestTimestamp time.Time `json:"newest_timestamp"`
}

// AlertManager interface for managing alerts
type AlertManager interface {
	CreateAlert(ctx context.Context, alert *domain.Alert) error
	UpdateAlert(ctx context.Context, alert *domain.Alert) error
	GetAlert(ctx context.Context, id string) (*domain.Alert, error)
	GetAlerts(ctx context.Context, filters AlertFilters) ([]*domain.Alert, error)
	DeleteAlert(ctx context.Context, id string) error
	ResolveAlert(ctx context.Context, id string) error
	SilenceAlert(ctx context.Context, id string, duration time.Duration) error
	GetActiveAlerts(ctx context.Context) ([]*domain.Alert, error)
}

// AlertFilters represents filters for querying alerts
type AlertFilters struct {
	Status   []domain.AlertStatus   `json:"status,omitempty"`
	Severity []domain.AlertSeverity `json:"severity,omitempty"`
	Source   string                 `json:"source,omitempty"`
	From     time.Time              `json:"from,omitempty"`
	To       time.Time              `json:"to,omitempty"`
	Limit    int                    `json:"limit,omitempty"`
	Offset   int                    `json:"offset,omitempty"`
}

// AlertRuleManager interface for managing alert rules
type AlertRuleManager interface {
	CreateRule(ctx context.Context, rule *domain.AlertRule) error
	UpdateRule(ctx context.Context, rule *domain.AlertRule) error
	GetRule(ctx context.Context, id string) (*domain.AlertRule, error)
	GetRules(ctx context.Context, enabled *bool) ([]*domain.AlertRule, error)
	DeleteRule(ctx context.Context, id string) error
	EnableRule(ctx context.Context, id string) error
	DisableRule(ctx context.Context, id string) error
	EvaluateRules(ctx context.Context) ([]*domain.Alert, error)
}

// NotificationManager interface for sending notifications
type NotificationManager interface {
	SendNotification(ctx context.Context, notification *Notification) error
	SendBatch(ctx context.Context, notifications []*Notification) error
	GetNotificationHistory(ctx context.Context, filters NotificationFilters) ([]*Notification, error)
	TestNotification(ctx context.Context, config *domain.NotificationConfig) error
}

// Notification represents a notification to be sent
type Notification struct {
	ID         string                 `json:"id"`
	Type       string                 `json:"type"`
	Severity   domain.AlertSeverity   `json:"severity"`
	Title      string                 `json:"title"`
	Message    string                 `json:"message"`
	Recipients []string               `json:"recipients"`
	Data       map[string]interface{} `json:"data,omitempty"`
	CreatedAt  time.Time              `json:"created_at"`
	SentAt     *time.Time             `json:"sent_at,omitempty"`
	Status     string                 `json:"status"` // pending, sent, failed
	Error      string                 `json:"error,omitempty"`
}

// NotificationFilters represents filters for querying notifications
type NotificationFilters struct {
	Type   string    `json:"type,omitempty"`
	Status string    `json:"status,omitempty"`
	From   time.Time `json:"from,omitempty"`
	To     time.Time `json:"to,omitempty"`
	Limit  int       `json:"limit,omitempty"`
	Offset int       `json:"offset,omitempty"`
}

// DashboardManager interface for managing dashboards
type DashboardManager interface {
	CreateDashboard(ctx context.Context, dashboard *domain.MonitoringDashboard) error
	UpdateDashboard(ctx context.Context, dashboard *domain.MonitoringDashboard) error
	GetDashboard(ctx context.Context, id string) (*domain.MonitoringDashboard, error)
	GetDashboards(ctx context.Context, filters DashboardFilters) ([]*domain.MonitoringDashboard, error)
	DeleteDashboard(ctx context.Context, id string) error
	DuplicateDashboard(ctx context.Context, id string, newName string) (*domain.MonitoringDashboard, error)
}

// DashboardFilters represents filters for querying dashboards
type DashboardFilters struct {
	Tags    []string `json:"tags,omitempty"`
	Enabled *bool    `json:"enabled,omitempty"`
	Search  string   `json:"search,omitempty"`
	Limit   int      `json:"limit,omitempty"`
	Offset  int      `json:"offset,omitempty"`
}

// MetricsCollector interface for system metrics collection
type SystemMetricsCollector interface {
	CollectSystemMetrics(ctx context.Context) (*domain.SystemMetrics, error)
	CollectCPUMetrics(ctx context.Context) (*domain.CPUMetrics, error)
	CollectMemoryMetrics(ctx context.Context) (*domain.MemoryMetrics, error)
	CollectDiskMetrics(ctx context.Context) ([]*domain.DiskMetrics, error)
	CollectNetworkMetrics(ctx context.Context) ([]*domain.NetworkMetrics, error)
	CollectProcessMetrics(ctx context.Context) ([]*domain.ProcessMetrics, error)
	CollectTemperatureMetrics(ctx context.Context) ([]*domain.TemperatureMetric, error)
	StartCollection(ctx context.Context, interval time.Duration) error
	StopCollection(ctx context.Context) error
}

// DatabaseMetricsCollector interface for database metrics collection
type DatabaseMetricsCollector interface {
	CollectDatabaseMetrics(ctx context.Context, connectionID string) (*domain.DatabaseMetrics, error)
	CollectConnectionMetrics(ctx context.Context, connectionID string) (*ConnectionMetrics, error)
	CollectQueryMetrics(ctx context.Context, connectionID string, limit int) ([]*domain.QueryMetric, error)
	CollectTableMetrics(ctx context.Context, connectionID string) ([]*domain.TableMetric, error)
	CollectIndexMetrics(ctx context.Context, connectionID string) ([]*domain.IndexMetric, error)
	EnableCollection(ctx context.Context, connectionID string, interval time.Duration) error
	DisableCollection(ctx context.Context, connectionID string) error
}

// ConnectionMetrics represents database connection metrics
type ConnectionMetrics struct {
	ConnectionID  string        `json:"connection_id"`
	ActiveQueries int           `json:"active_queries"`
	QueuedQueries int           `json:"queued_queries"`
	AvgQueryTime  time.Duration `json:"avg_query_time"`
	MaxQueryTime  time.Duration `json:"max_query_time"`
	TotalQueries  int64         `json:"total_queries"`
	ErrorRate     float64       `json:"error_rate"`
	LastActivity  time.Time     `json:"last_activity"`
	IsHealthy     bool          `json:"is_healthy"`
}

// PrometheusExporter interface for Prometheus metrics export
type PrometheusExporter interface {
	RegisterMetric(ctx context.Context, metric *domain.Metric) error
	UnregisterMetric(ctx context.Context, name string) error
	ExportMetrics(ctx context.Context) (string, error)
	GetMetricsEndpoint(ctx context.Context) (string, error)
	EnableScraping(ctx context.Context, path string) error
	DisableScraping(ctx context.Context) error
}

// HealthChecker interface for health checks
type HealthChecker interface {
	RegisterCheck(ctx context.Context, name string, check HealthCheckFunc) error
	UnregisterCheck(ctx context.Context, name string) error
	RunCheck(ctx context.Context, name string) (*domain.HealthCheck, error)
	RunAllChecks(ctx context.Context) ([]*domain.HealthCheck, error)
	EnablePeriodicChecks(ctx context.Context, interval time.Duration) error
	DisablePeriodicChecks(ctx context.Context) error
}

// HealthCheckFunc represents a health check function
type HealthCheckFunc func(ctx context.Context) *domain.HealthCheck

// MetricsAggregator interface for aggregating metrics
type MetricsAggregator interface {
	AggregateMetrics(ctx context.Context, query *AggregationQuery) (*AggregatedMetrics, error)
	AggregateByTime(ctx context.Context, name string, labels map[string]string, from, to time.Time, interval time.Duration) ([]*domain.Metric, error)
	AggregateByLabels(ctx context.Context, name string, from, to time.Time, groupBy []string) ([]*domain.Metric, error)
	CalculateRate(ctx context.Context, name string, labels map[string]string, from, to time.Duration) ([]*domain.Metric, error)
	CalculatePercentile(ctx context.Context, name string, labels map[string]string, percentile float64, from, to time.Time) (*domain.Metric, error)
}

// AggregationQuery represents an aggregation query
type AggregationQuery struct {
	Name         string            `json:"name"`
	Labels       map[string]string `json:"labels,omitempty"`
	From         time.Time         `json:"from"`
	To           time.Time         `json:"to"`
	Aggregations []Aggregation     `json:"aggregations"`
	GroupBy      []string          `json:"group_by,omitempty"`
	Interval     time.Duration     `json:"interval,omitempty"`
	BaseQuery    *MetricsQuery     `json:"base_query,omitempty"`
	Aggregation  string            `json:"aggregation,omitempty"`
}

// Aggregation represents an aggregation operation
type Aggregation struct {
	Function string `json:"function"` // sum, avg, min, max, count, rate
	Label    string `json:"label,omitempty"`
}

// AggregatedMetrics represents aggregated metrics result
type AggregatedMetrics struct {
	Name     string                 `json:"name"`
	Labels   map[string]string      `json:"labels,omitempty"`
	Values   map[string]float64     `json:"values"`
	Times    []time.Time            `json:"times,omitempty"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// MonitoringConfigManager interface for managing monitoring configuration
type MonitoringConfigManager interface {
	GetConfig(ctx context.Context) (*domain.MonitoringConfig, error)
	UpdateConfig(ctx context.Context, config *domain.MonitoringConfig) error
	ReloadConfig(ctx context.Context) error
	ValidateConfig(ctx context.Context, config *domain.MonitoringConfig) error
	ResetToDefaults(ctx context.Context) error
}

// WebSocketManager interface for real-time metrics streaming
type WebSocketManager interface {
	SubscribeToMetrics(ctx context.Context, subscription *MetricsSubscription) error
	UnsubscribeFromMetrics(ctx context.Context, subscriptionID string) error
	SubscribeToAlerts(ctx context.Context, subscription *AlertsSubscription) error
	UnsubscribeFromAlerts(ctx context.Context, subscriptionID string) error
	BroadcastMetric(ctx context.Context, metric *domain.Metric) error
	BroadcastAlert(ctx context.Context, alert *domain.Alert) error
	GetActiveSubscriptions(ctx context.Context) ([]*Subscription, error)
}

// MetricsSubscription represents a metrics subscription
type MetricsSubscription struct {
	ID        string              `json:"id"`
	ClientID  string              `json:"client_id"`
	Filters   SubscriptionFilters `json:"filters"`
	Interval  time.Duration       `json:"interval"`
	CreatedAt time.Time           `json:"created_at"`
}

// AlertsSubscription represents an alerts subscription
type AlertsSubscription struct {
	ID        string                   `json:"id"`
	ClientID  string                   `json:"client_id"`
	Filters   AlertSubscriptionFilters `json:"filters"`
	CreatedAt time.Time                `json:"created_at"`
}

// SubscriptionFilters represents subscription filters for metrics
type SubscriptionFilters struct {
	Names   []string          `json:"names,omitempty"`
	Labels  map[string]string `json:"labels,omitempty"`
	Sources []string          `json:"sources,omitempty"`
}

// AlertSubscriptionFilters represents subscription filters for alerts
type AlertSubscriptionFilters struct {
	Severity []domain.AlertSeverity `json:"severity,omitempty"`
	Status   []domain.AlertStatus   `json:"status,omitempty"`
	Sources  []string               `json:"sources,omitempty"`
}

// Subscription represents a generic subscription
type Subscription struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"` // metrics, alerts
	ClientID  string                 `json:"client_id"`
	Filters   map[string]interface{} `json:"filters"`
	Interval  time.Duration          `json:"interval,omitempty"`
	CreatedAt time.Time              `json:"created_at"`
	LastSeen  time.Time              `json:"last_seen"`
}

// MetricsProcessor interface for processing metrics
type MetricsProcessor interface {
	ProcessMetrics(ctx context.Context, metrics []*domain.Metric) ([]*domain.Metric, error)
	ApplyTransformations(ctx context.Context, metrics []*domain.Metric, transformations []Transformation) ([]*domain.Metric, error)
	FilterMetrics(ctx context.Context, metrics []*domain.Metric, filters []Filter) ([]*domain.Metric, error)
	EnrichMetrics(ctx context.Context, metrics []*domain.Metric, enrichments []Enrichment) ([]*domain.Metric, error)
}

// Transformation represents a metric transformation
type Transformation struct {
	Type   string                 `json:"type"` // scale, offset, rename, etc.
	Config map[string]interface{} `json:"config"`
}

// Filter represents a metric filter
type Filter struct {
	Type   string                 `json:"type"` // include, exclude, regex, etc.
	Config map[string]interface{} `json:"config"`
}

// Enrichment represents metric enrichment
type Enrichment struct {
	Type   string                 `json:"type"` // add_label, add_metadata, etc.
	Config map[string]interface{} `json:"config"`
}

// MonitoringService interface for the main monitoring service
type MonitoringService interface {
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
	CollectMetric(ctx context.Context, metric *domain.Metric) error
	CollectMetrics(ctx context.Context, metrics []*domain.Metric) error
	GetMetrics(ctx context.Context, query *MetricsQuery) ([]*domain.Metric, error)
	GetMetricSeries(ctx context.Context, query *MetricsQuery) ([]*domain.MetricSeries, error)
	CreateAlert(ctx context.Context, alert *domain.Alert) error
	GetAlerts(ctx context.Context, filters AlertFilters) ([]*domain.Alert, error)
	ResolveAlert(ctx context.Context, alertID string) error
	CreateDashboard(ctx context.Context, dashboard *domain.MonitoringDashboard) error
	GetDashboard(ctx context.Context, id string) (*domain.MonitoringDashboard, error)
	GetDashboards(ctx context.Context, filters DashboardFilters) ([]*domain.MonitoringDashboard, error)
	GetHealthChecks(ctx context.Context) ([]*domain.HealthCheck, error)
	AggregateMetrics(ctx context.Context, query *AggregationQuery) (*AggregatedMetrics, error)
	ExportPrometheusMetrics(ctx context.Context) (string, error)

	// Recording methods
	RecordRequest(ctx context.Context, service domain.AIService, operation string, duration time.Duration, tokensUsed int, success bool)
	RecordError(ctx context.Context, service domain.AIService, operation string, error string)
	RecordLatency(ctx context.Context, service domain.AIService, operation string, latency time.Duration)
}
