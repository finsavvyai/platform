package domain

import (
	"time"
)

// MetricType represents different types of metrics
type MetricType string

const (
	MetricTypeCounter   MetricType = "counter"
	MetricTypeGauge     MetricType = "gauge"
	MetricTypeHistogram MetricType = "histogram"
	MetricTypeSummary   MetricType = "summary"
)

// Metric represents a monitoring metric
type Metric struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Type        MetricType             `json:"type"`
	Value       float64                `json:"value"`
	Labels      map[string]string      `json:"labels,omitempty"`
	Timestamp   time.Time              `json:"timestamp"`
	Description string                 `json:"description,omitempty"`
	Unit        string                 `json:"unit,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// MetricSeries represents a time series of metrics
type MetricSeries struct {
	Name      string            `json:"name"`
	Type      MetricType        `json:"type"`
	Labels    map[string]string `json:"labels,omitempty"`
	Points    []MetricPoint     `json:"points"`
	Unit      string            `json:"unit,omitempty"`
	CreatedAt time.Time         `json:"created_at"`
	UpdatedAt time.Time         `json:"updated_at"`
}

// MetricPoint represents a single data point in a time series
type MetricPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
}

// AlertSeverity represents the severity level of an alert
type AlertSeverity string

const (
	AlertSeverityCritical AlertSeverity = "critical"
	AlertSeverityHigh     AlertSeverity = "high"
	AlertSeverityMedium   AlertSeverity = "medium"
	AlertSeverityLow      AlertSeverity = "low"
	AlertSeverityInfo     AlertSeverity = "info"
)

// AlertStatus represents the status of an alert
type AlertStatus string

const (
	AlertStatusActive   AlertStatus = "active"
	AlertStatusResolved AlertStatus = "resolved"
	AlertStatusSilenced AlertStatus = "silenced"
	AlertStatusPending  AlertStatus = "pending"
)

// Alert represents a monitoring alert
type Alert struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Severity    AlertSeverity          `json:"severity"`
	Status      AlertStatus            `json:"status"`
	Source      string                 `json:"source"`
	Condition   string                 `json:"condition"`
	Threshold   float64                `json:"threshold"`
	CurrentValue float64               `json:"current_value"`
	Labels      map[string]string      `json:"labels,omitempty"`
	Annotations map[string]string      `json:"annotations,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
	ResolvedAt  *time.Time             `json:"resolved_at,omitempty"`
	SilencedUntil *time.Time           `json:"silenced_until,omitempty"`
}

// AlertRule represents a rule for generating alerts
type AlertRule struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	MetricName  string                 `json:"metric_name"`
	Condition   string                 `json:"condition"` // gt, lt, eq, gte, lte
	Threshold   float64                `json:"threshold"`
	Duration    time.Duration          `json:"duration"`
	Severity    AlertSeverity          `json:"severity"`
	Labels      map[string]string      `json:"labels,omitempty"`
	Annotations map[string]string      `json:"annotations,omitempty"`
	Enabled     bool                   `json:"enabled"`
	Filters     map[string]interface{} `json:"filters,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// MonitoringDashboard represents a monitoring dashboard
type MonitoringDashboard struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Tags        []string               `json:"tags,omitempty"`
	Panels      []DashboardPanel       `json:"panels"`
	Variables   []DashboardVariable    `json:"variables,omitempty"`
	Refresh     time.Duration          `json:"refresh"`
	TimeRange   TimeRange              `json:"time_range"`
	Enabled     bool                   `json:"enabled"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// DashboardPanel represents a panel in a dashboard
type DashboardPanel struct {
	ID          string                 `json:"id"`
	Title       string                 `json:"title"`
	Type        string                 `json:"type"` // graph, table, stat, heatmap, etc.
	Position    PanelPosition          `json:"position"`
	Queries     []PanelQuery           `json:"queries"`
	Options     map[string]interface{} `json:"options,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// PanelPosition represents the position and size of a panel
type PanelPosition struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

// PanelQuery represents a query for a panel
type PanelQuery struct {
	RefID     string                 `json:"ref_id"`
	Query     string                 `json:"query"`
	DataSource string                `json:"data_source"`
	Options   map[string]interface{} `json:"options,omitempty"`
}

// DashboardVariable represents a variable in a dashboard
type DashboardVariable struct {
	Name        string      `json:"name"`
	Type        string      `json:"type"` // query, custom, interval, etc.
	Label       string      `json:"label,omitempty"`
	Query       string      `json:"query,omitempty"`
	Options     []string    `json:"options,omitempty"`
	Current     interface{} `json:"current"`
	Multi       bool        `json:"multi"`
	IncludeAll  bool        `json:"include_all"`
	AllValue    string      `json:"all_value,omitempty"`
}

// TimeRange represents a time range for queries
type TimeRange struct {
	From time.Time `json:"from"`
	To   time.Time `json:"to"`
}

// DatabaseMetrics represents database-specific metrics
type DatabaseMetrics struct {
	ID               string                 `json:"id"`
	ConnectionID     string                 `json:"connection_id"`
	DatabaseType     string                 `json:"database_type"`
	ConnectionCount  int64                  `json:"connection_count"`
	QueryCount       int64                  `json:"query_count"`
	ErrorCount       int64                  `json:"error_count"`
	AvgResponseTime  time.Duration          `json:"avg_response_time"`
	SlowQueryCount   int64                  `json:"slow_query_count"`
	ActiveConnections int64                 `json:"active_connections"`
	IdleConnections  int64                  `json:"idle_connections"`
	TotalConnections int64                  `json:"total_connections"`
	BytesReceived    int64                  `json:"bytes_received"`
	BytesSent        int64                  `json:"bytes_sent"`
	CPUUsage         float64                `json:"cpu_usage"`
	MemoryUsage      int64                  `json:"memory_usage"`
	DiskUsage        int64                  `json:"disk_usage"`
	CacheHitRatio    float64                `json:"cache_hit_ratio"`
	IndexUsage       []IndexMetric          `json:"index_usage,omitempty"`
	TableMetrics     []TableMetric          `json:"table_metrics,omitempty"`
	Queries          []QueryMetric          `json:"queries,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
	Timestamp        time.Time              `json:"timestamp"`
}

// IndexMetric represents index usage metrics
type IndexMetric struct {
	Name        string    `json:"name"`
	TableName   string    `json:"table_name"`
	UsageCount  int64     `json:"usage_count"`
	Size        int64     `json:"size"`
	Scans       int64     `json:"scans"`
	LastUsed    time.Time `json:"last_used"`
	Unique      bool      `json:"unique"`
	Primary     bool      `json:"primary"`
}

// TableMetric represents table-level metrics
type TableMetric struct {
	Name         string    `json:"name"`
	RowCount     int64     `json:"row_count"`
	Size         int64     `json:"size"`
	IndexSize    int64     `json:"index_size"`
	LastAnalyzed time.Time `json:"last_analyzed"`
	InsertCount  int64     `json:"insert_count"`
	UpdateCount  int64     `json:"update_count"`
	DeleteCount  int64     `json:"delete_count"`
	SequentialScans int64  `json:"sequential_scans"`
	IndexScans   int64     `json:"index_scans"`
}

// QueryMetric represents query execution metrics
type QueryMetric struct {
	ID           string        `json:"id"`
	Query        string        `json:"query"`
	QueryHash    string        `json:"query_hash"`
	Duration     time.Duration `json:"duration"`
	RowsAffected int64         `json:"rows_affected"`
	RowsReturned int64         `json:"rows_returned"`
	BytesScanned int64         `json:"bytes_scanned"`
	CPUUsage     float64       `json:"cpu_usage"`
	MemoryUsage  int64         `json:"memory_usage"`
	Success      bool          `json:"success"`
	ErrorCode    string        `json:"error_code,omitempty"`
	ErrorMessage string        `json:"error_message,omitempty"`
	Timestamp    time.Time     `json:"timestamp"`
}

// SystemMetrics represents system-level metrics
type SystemMetrics struct {
	ID             string                 `json:"id"`
	Hostname       string                 `json:"hostname"`
	CPU            CPUMetrics             `json:"cpu"`
	Memory         MemoryMetrics          `json:"memory"`
	Disk           []DiskMetrics          `json:"disk"`
	Network        []NetworkMetrics       `json:"network"`
	Processes      []ProcessMetrics       `json:"processes"`
	Uptime         time.Duration          `json:"uptime"`
	LoadAverage    []float64              `json:"load_average"`
	Temperature    []TemperatureMetric    `json:"temperature,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	Timestamp      time.Time              `json:"timestamp"`
}

// CPUMetrics represents CPU metrics
type CPUMetrics struct {
	UsagePercent    float64 `json:"usage_percent"`
	UserPercent     float64 `json:"user_percent"`
	SystemPercent   float64 `json:"system_percent"`
	IdlePercent     float64 `json:"idle_percent"`
	IowaitPercent   float64 `json:"iowait_percent"`
	StealPercent    float64 `json:"steal_percent"`
	Load1Min        float64 `json:"load_1min"`
	Load5Min        float64 `json:"load_5min"`
	Load15Min       float64 `json:"load_15min"`
	Cores           int     `json:"cores"`
	Frequency       int64   `json:"frequency_mhz"`
}

// MemoryMetrics represents memory metrics
type MemoryMetrics struct {
	Total        int64   `json:"total"`
	Available    int64   `json:"available"`
	Used         int64   `json:"used"`
	Free         int64   `json:"free"`
	Buffers      int64   `json:"buffers"`
	Cached       int64   `json:"cached"`
	SwapTotal    int64   `json:"swap_total"`
	SwapUsed     int64   `json:"swap_used"`
	SwapFree     int64   `json:"swap_free"`
	UsagePercent float64 `json:"usage_percent"`
}

// DiskMetrics represents disk metrics
type DiskMetrics struct {
	Device      string    `json:"device"`
	Mountpoint  string    `json:"mountpoint"`
	Total       int64     `json:"total"`
	Free        int64     `json:"free"`
	Used        int64     `json:"used"`
	UsagePercent float64  `json:"usage_percent"`
	FilesTotal  int64     `json:"files_total"`
	FilesFree   int64     `json:"files_free"`
	InodesTotal int64     `json:"inodes_total"`
	InodesFree  int64     `json:"inodes_free"`
	ReadBytes   int64     `json:"read_bytes"`
	WriteBytes  int64     `json:"write_bytes"`
	ReadOps     int64     `json:"read_ops"`
	WriteOps    int64     `json:"write_ops"`
	IoTime      int64     `json:"io_time_ms"`
	Timestamp   time.Time `json:"timestamp"`
}

// NetworkMetrics represents network metrics
type NetworkMetrics struct {
	Interface   string    `json:"interface"`
	BytesSent   int64     `json:"bytes_sent"`
	BytesRecv   int64     `json:"bytes_recv"`
	PacketsSent int64     `json:"packets_sent"`
	PacketsRecv int64     `json:"packets_recv"`
	ErrorsIn    int64     `json:"errors_in"`
	ErrorsOut   int64     `json:"errors_out"`
	DroppedIn   int64     `json:"dropped_in"`
	DroppedOut  int64     `json:"dropped_out"`
	Timestamp   time.Time `json:"timestamp"`
}

// ProcessMetrics represents process metrics
type ProcessMetrics struct {
	PID        int       `json:"pid"`
	Name       string    `json:"name"`
	Cmdline    string    `json:"cmdline"`
	CPUUsage   float64   `json:"cpu_usage"`
	MemoryRSS  int64     `json:"memory_rss"`
	MemoryVMS  int64     `json:"memory_vms"`
	NumThreads int       `json:"num_threads"`
	NumFDs     int       `json:"num_fds"`
	State      string    `json:"state"`
	CreateTime time.Time `json:"create_time"`
	Timestamp  time.Time `json:"timestamp"`
}

// TemperatureMetric represents temperature metrics
type TemperatureMetric struct {
	Name       string    `json:"name"`
	Device     string    `json:"device"`
	TempC      float64   `json:"temp_celsius"`
	TempF      float64   `json:"temp_fahrenheit"`
	Critical   float64   `json:"critical_celsius"`
	High       float64   `json:"high_celsius"`
	Timestamp  time.Time `json:"timestamp"`
}

// MonitoringConfig represents monitoring system configuration
type MonitoringConfig struct {
	ID                   string                 `json:"id"`
	Enabled              bool                   `json:"enabled"`
	ScrapeInterval       time.Duration          `json:"scrape_interval"`
	MetricsRetention     time.Duration          `json:"metrics_retention"`
	AlertEvaluationInterval time.Duration       `json:"alert_evaluation_interval"`
	DatabaseMetrics      bool                   `json:"database_metrics"`
	SystemMetrics        bool                   `json:"system_metrics"`
	ApplicationMetrics   bool                   `json:"application_metrics"`
	CustomMetrics        []CustomMetricConfig   `json:"custom_metrics,omitempty"`
	AlertRules           []AlertRule            `json:"alert_rules,omitempty"`
	Notifications        []NotificationConfig   `json:"notifications,omitempty"`
	StorageConfig        StorageConfig          `json:"storage_config"`
	Metadata             map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt            time.Time              `json:"created_at"`
	UpdatedAt            time.Time              `json:"updated_at"`
}

// CustomMetricConfig represents configuration for custom metrics
type CustomMetricConfig struct {
	Name        string                 `json:"name"`
	Type        MetricType             `json:"type"`
	Query       string                 `json:"query"`
	Interval    time.Duration          `json:"interval"`
	Labels      map[string]string      `json:"labels,omitempty"`
	Enabled     bool                   `json:"enabled"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// NotificationConfig represents notification configuration
type NotificationConfig struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"` // email, slack, webhook, sms, etc.
	Enabled     bool                   `json:"enabled"`
	Config      map[string]interface{} `json:"config"`
	Recipients  []string               `json:"recipients"`
	Severity    []AlertSeverity        `json:"severity"`
	RateLimit   time.Duration          `json:"rate_limit"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// StorageConfig represents storage configuration for metrics
type StorageConfig struct {
	Type         string                 `json:"type"` // memory, file, database, prometheus
	Retention    time.Duration          `json:"retention"`
	Compression  bool                   `json:"compression"`
	ChunkSize    int64                  `json:"chunk_size"`
	MaxSize      int64                  `json:"max_size"`
	Config       map[string]interface{} `json:"config"`
}

// HealthCheck represents a health check result
type HealthCheck struct {
	Name        string                 `json:"name"`
	Status      string                 `json:"status"` // healthy, unhealthy, unknown
	Message     string                 `json:"message,omitempty"`
	Details     map[string]interface{} `json:"details,omitempty"`
	Duration    time.Duration          `json:"duration"`
	Timestamp   time.Time              `json:"timestamp"`
	Component   string                 `json:"component"`
}