package sdln

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// MonitoringService handles monitoring and alerting operations
type MonitoringService struct {
	*BaseService
}

// NewMonitoringService creates a new monitoring service
func NewMonitoringService(client *Client) *MonitoringService {
	return &MonitoringService{
		BaseService: NewBaseService(client, "monitoring", "api/v1/monitoring"),
	}
}

// Metric represents a monitoring metric
type Metric struct {
	Name      string            `json:"name"`
	Value     float64           `json:"value"`
	Timestamp Timestamp              `json:"timestamp"`
	Labels    map[string]string `json:"labels,omitempty"`
	Unit      string            `json:"unit,omitempty"`
	Type      string            `json:"type"` // counter, gauge, histogram, summary
}

// MetricQuery represents a query for metrics
type MetricQuery struct {
	Name        string            `json:"name"`
	Query       string            `json:"query"`
	StartTime   *Timestamp             `json:"start_time,omitempty"`
	EndTime     *Timestamp             `json:"end_time,omitempty"`
	Step        *time.Duration    `json:"step,omitempty"`
	Labels      map[string]string `json:"labels,omitempty"`
	Aggregation string            `json:"aggregation,omitempty"` // avg, sum, min, max, count
}

// MetricSeries represents a time series of metrics
type MetricSeries struct {
	Name   string            `json:"name"`
	Labels map[string]string `json:"labels,omitempty"`
	Points []MetricPoint     `json:"points"`
}

// MetricPoint represents a single metric data point
type MetricPoint struct {
	Timestamp Timestamp    `json:"timestamp"`
	Value     float64 `json:"value"`
}

// Alert represents an alert
type Alert struct {
	ID          string            `json:"id"`
	TenantID    string            `json:"tenant_id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Status      string            `json:"status"`   // active, resolved, suppressed
	Severity    string            `json:"severity"` // critical, warning, info
	Source      string            `json:"source"`
	Labels      map[string]string `json:"labels,omitempty"`
	Annotations map[string]string `json:"annotations,omitempty"`
	StartsAt    Timestamp              `json:"starts_at"`
	EndsAt      *Timestamp             `json:"ends_at,omitempty"`
	UpdatedAt   Timestamp              `json:"updated_at"`
}

// AlertRule represents an alert rule
type AlertRule struct {
	ID          string                 `json:"id"`
	TenantID    string                 `json:"tenant_id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Query       string                 `json:"query"`
	Condition   string                 `json:"condition"`
	Threshold   float64                `json:"threshold"`
	Severity    string                 `json:"severity"`
	For         *time.Duration         `json:"for,omitempty"`
	Labels      map[string]string      `json:"labels,omitempty"`
	Annotations map[string]string      `json:"annotations,omitempty"`
	Enabled     bool                   `json:"enabled"`
	Muted       bool                   `json:"muted"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt   Timestamp                   `json:"created_at"`
	UpdatedAt   Timestamp                   `json:"updated_at"`
}

// CreateAlertRuleRequest represents a request to create an alert rule
type CreateAlertRuleRequest struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	Query       string                 `json:"query"`
	Condition   string                 `json:"condition"`
	Threshold   float64                `json:"threshold"`
	Severity    string                 `json:"severity"`
	For         *time.Duration         `json:"for,omitempty"`
	Labels      map[string]string      `json:"labels,omitempty"`
	Annotations map[string]string      `json:"annotations,omitempty"`
	Enabled     *bool                  `json:"enabled,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// UpdateAlertRuleRequest represents a request to update an alert rule
type UpdateAlertRuleRequest struct {
	Name        *string                `json:"name,omitempty"`
	Description *string                `json:"description,omitempty"`
	Query       *string                `json:"query,omitempty"`
	Condition   *string                `json:"condition,omitempty"`
	Threshold   *float64               `json:"threshold,omitempty"`
	Severity    *string                `json:"severity,omitempty"`
	For         *time.Duration         `json:"for,omitempty"`
	Labels      map[string]string      `json:"labels,omitempty"`
	Annotations map[string]string      `json:"annotations,omitempty"`
	Enabled     *bool                  `json:"enabled,omitempty"`
	Muted       *bool                  `json:"muted,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// Dashboard represents a monitoring dashboard
type Dashboard struct {
	ID          string              `json:"id"`
	TenantID    string              `json:"tenant_id"`
	Name        string              `json:"name"`
	Description string              `json:"description"`
	Tags        []string            `json:"tags,omitempty"`
	Panels      []DashboardPanel    `json:"panels"`
	TimeRange   TimeRange           `json:"time_range"`
	Refresh     *time.Duration      `json:"refresh,omitempty"`
	Variables   []DashboardVariable `json:"variables,omitempty"`
	Shared      bool                `json:"shared"`
	Public      bool                `json:"public"`
	CreatedBy   string              `json:"created_by"`
	UpdatedBy   string              `json:"updated_by"`
	CreatedAt   Timestamp                `json:"created_at"`
	UpdatedAt   Timestamp                `json:"updated_at"`
}

// DashboardPanel represents a panel in a dashboard
type DashboardPanel struct {
	ID         string                 `json:"id"`
	Title      string                 `json:"title"`
	Type       string                 `json:"type"` // graph, stat, table, heatmap, etc.
	Query      string                 `json:"query"`
	Position   PanelPosition          `json:"position"`
	Options    map[string]interface{} `json:"options,omitempty"`
	DataSource string                 `json:"data_source"`
}

// PanelPosition represents panel position and size
type PanelPosition struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

// DashboardVariable represents a dashboard variable
type DashboardVariable struct {
	Name    string      `json:"name"`
	Type    string      `json:"type"` // query, constant, custom
	Query   string      `json:"query,omitempty"`
	Options []string    `json:"options,omitempty"`
	Default interface{} `json:"default,omitempty"`
}

// HealthStatus represents system health status
type HealthStatus struct {
	Status    string                 `json:"status"` // healthy, degraded, unhealthy
	Timestamp Timestamp                   `json:"timestamp"`
	Checks    []HealthCheck          `json:"checks"`
	Summary   map[string]interface{} `json:"summary"`
}

// HealthCheck represents a single health check
type HealthCheck struct {
	Name      string                 `json:"name"`
	Status    string                 `json:"status"` // pass, warn, fail
	Message   string                 `json:"message,omitempty"`
	Details   map[string]interface{} `json:"details,omitempty"`
	Duration  time.Duration          `json:"duration"`
	LastCheck Timestamp                   `json:"last_check"`
}

// LogEntry represents a log entry
type LogEntry struct {
	ID        string                 `json:"id"`
	Timestamp Timestamp                   `json:"timestamp"`
	Level     string                 `json:"level"` // debug, info, warn, error, fatal
	Message   string                 `json:"message"`
	Source    string                 `json:"source"`
	Service   string                 `json:"service"`
	TenantID  string                 `json:"tenant_id,omitempty"`
	UserID    string                 `json:"user_id,omitempty"`
	RequestID string                 `json:"request_id,omitempty"`
	TraceID   string                 `json:"trace_id,omitempty"`
	SpanID    string                 `json:"span_id,omitempty"`
	Labels    map[string]string      `json:"labels,omitempty"`
	Fields    map[string]interface{} `json:"fields,omitempty"`
	Error     *ErrorInfo             `json:"error,omitempty"`
}

// ErrorInfo represents error information in logs
type ErrorInfo struct {
	Type       string                 `json:"type"`
	Message    string                 `json:"message"`
	StackTrace string                 `json:"stack_trace,omitempty"`
	Context    map[string]interface{} `json:"context,omitempty"`
}

// LogQuery represents a query for logs
type LogQuery struct {
	Query     string            `json:"query"`
	StartTime *Timestamp             `json:"start_time,omitempty"`
	EndTime   *Timestamp             `json:"end_time,omitempty"`
	Level     string            `json:"level,omitempty"`
	Source    string            `json:"source,omitempty"`
	Service   string            `json:"service,omitempty"`
	TenantID  string            `json:"tenant_id,omitempty"`
	UserID    string            `json:"user_id,omitempty"`
	Labels    map[string]string `json:"labels,omitempty"`
	Limit     *int              `json:"limit,omitempty"`
	Offset    *int              `json:"offset,omitempty"`
	OrderBy   string            `json:"order_by,omitempty"` // timestamp, level
	OrderDesc bool              `json:"order_desc,omitempty"`
}

// LogResponse represents a log query response
type LogResponse struct {
	Entries    []LogEntry    `json:"entries"`
	Total      int64         `json:"total"`
	HasMore    bool          `json:"has_more"`
	NextOffset *int          `json:"next_offset,omitempty"`
	Took       time.Duration `json:"took"`
}

// Trace represents a distributed trace
type Trace struct {
	ID        string            `json:"id"`
	TraceID   string            `json:"trace_id"`
	Name      string            `json:"name"`
	Service   string            `json:"service"`
	Duration  time.Duration     `json:"duration"`
	StartTime Timestamp              `json:"start_time"`
	EndTime   Timestamp              `json:"end_time"`
	Status    string            `json:"status"` // success, error, timeout
	Tags      map[string]string `json:"tags,omitempty"`
	Spans     []TraceSpan       `json:"spans"`
}

// TraceSpan represents a span in a trace
type TraceSpan struct {
	ID         string            `json:"id"`
	TraceID    string            `json:"trace_id"`
	ParentID   *string           `json:"parent_id,omitempty"`
	Name       string            `json:"name"`
	Service    string            `json:"service"`
	Duration   time.Duration     `json:"duration"`
	StartTime  Timestamp              `json:"start_time"`
	EndTime    Timestamp              `json:"end_time"`
	Status     string            `json:"status"`
	Tags       map[string]string `json:"tags,omitempty"`
	Logs       []TraceLog        `json:"logs,omitempty"`
	References []TraceReference  `json:"references,omitempty"`
}

// TraceLog represents a log entry within a span
type TraceLog struct {
	Timestamp Timestamp                   `json:"timestamp"`
	Level     string                 `json:"level"`
	Message   string                 `json:"message"`
	Fields    map[string]interface{} `json:"fields,omitempty"`
}

// TraceReference represents a reference to another trace or span
type TraceReference struct {
	TraceID string `json:"trace_id"`
	SpanID  string `json:"span_id"`
	Type    string `json:"type"` // child_of, follows_from
}

// PushMetrics pushes metrics to the monitoring system
func (s *MonitoringService) PushMetrics(ctx context.Context, tenantID string, metrics []Metric) error {
	req := map[string]interface{}{
		"tenant_id": tenantID,
		"metrics":   metrics,
	}

	err := s.doPost(ctx, "/metrics/push", req, nil)
	if err != nil {
		return fmt.Errorf("failed to push metrics: %w", err)
	}
	return nil
}

// QueryMetrics queries metrics
func (s *MonitoringService) QueryMetrics(ctx context.Context, queries []MetricQuery) ([]MetricSeries, error) {
	req := map[string]interface{}{
		"queries": queries,
	}

	var response struct {
		Series []MetricSeries `json:"series"`
	}

	err := s.doPost(ctx, "/metrics/query", req, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to query metrics: %w", err)
	}
	return response.Series, nil
}

// GetMetrics retrieves metrics for a tenant
func (s *MonitoringService) GetMetrics(ctx context.Context, tenantID string, timeRange *TimestampRange, metricNames []string) (map[string][]MetricSeries, error) {
	path := fmt.Sprintf("/tenants/%s/metrics", tenantID)

	queryParams := make(map[string]interface{})
	if timeRange != nil {
		queryParams["from"] = timeRange.From
		queryParams["to"] = timeRange.To
	}
	if len(metricNames) > 0 {
		queryParams["metrics"] = metricNames
	}

	if len(queryParams) > 0 {
		path += s.buildQuery(queryParams)
	}

	var response map[string][]MetricSeries
	err := s.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get metrics: %w", err)
	}
	return response, nil
}

// CreateAlertRule creates an alert rule
func (s *MonitoringService) CreateAlertRule(ctx context.Context, tenantID string, req *CreateAlertRuleRequest) (*AlertRule, error) {
	var rule AlertRule
	err := s.doPost(ctx, fmt.Sprintf("/tenants/%s/alert-rules", tenantID), req, &rule)
	if err != nil {
		return nil, fmt.Errorf("failed to create alert rule: %w", err)
	}
	return &rule, nil
}

// GetAlertRule retrieves an alert rule
func (s *MonitoringService) GetAlertRule(ctx context.Context, tenantID, ruleID string) (*AlertRule, error) {
	var rule AlertRule
	err := s.doGet(ctx, fmt.Sprintf("/tenants/%s/alert-rules/%s", tenantID, ruleID), &rule)
	if err != nil {
		return nil, fmt.Errorf("failed to get alert rule: %w", err)
	}
	return &rule, nil
}

// ListAlertRules retrieves alert rules for a tenant
func (s *MonitoringService) ListAlertRules(ctx context.Context, tenantID string, opts *ListOptions) (*PaginatedResponse[AlertRule], error) {
	path := fmt.Sprintf("/tenants/%s/alert-rules", tenantID)
	if opts != nil {
		path += s.buildQuery(map[string]interface{}{
			"page":      opts.Page,
			"page_size": opts.PageSize,
			"sort_by":   opts.SortBy,
			"sort_desc": opts.SortDesc,
		})
	}

	var response PaginatedResponse[AlertRule]
	err := s.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list alert rules: %w", err)
	}
	return &response, nil
}

// UpdateAlertRule updates an alert rule
func (s *MonitoringService) UpdateAlertRule(ctx context.Context, tenantID, ruleID string, req *UpdateAlertRuleRequest) (*AlertRule, error) {
	var rule AlertRule
	err := s.doPatch(ctx, fmt.Sprintf("/tenants/%s/alert-rules/%s", tenantID, ruleID), req, &rule)
	if err != nil {
		return nil, fmt.Errorf("failed to update alert rule: %w", err)
	}
	return &rule, nil
}

// DeleteAlertRule deletes an alert rule
func (s *MonitoringService) DeleteAlertRule(ctx context.Context, tenantID, ruleID string) error {
	err := s.doDelete(ctx, fmt.Sprintf("/tenants/%s/alert-rules/%s", tenantID, ruleID))
	if err != nil {
		return fmt.Errorf("failed to delete alert rule: %w", err)
	}
	return nil
}

// ListAlerts retrieves alerts for a tenant
func (s *MonitoringService) ListAlerts(ctx context.Context, tenantID string, opts *AlertListOptions) (*PaginatedResponse[Alert], error) {
	path := fmt.Sprintf("/tenants/%s/alerts", tenantID)

	queryParams := make(map[string]interface{})
	if opts != nil {
		if opts.Page != 0 {
			queryParams["page"] = opts.Page
		}
		if opts.PageSize != 0 {
			queryParams["page_size"] = opts.PageSize
		}
		if opts.SortBy != "" {
			queryParams["sort_by"] = opts.SortBy
		}
		if opts.SortDesc {
			queryParams["sort_desc"] = opts.SortDesc
		}
		if opts.Status != "" {
			queryParams["status"] = opts.Status
		}
		if opts.Severity != "" {
			queryParams["severity"] = opts.Severity
		}
		if opts.Source != "" {
			queryParams["source"] = opts.Source
		}
		if opts.TimeRange != nil {
			queryParams["from"] = opts.TimeRange.From
			queryParams["to"] = opts.TimeRange.To
		}
	}

	if len(queryParams) > 0 {
		path += s.buildQuery(queryParams)
	}

	var response PaginatedResponse[Alert]
	err := s.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list alerts: %w", err)
	}
	return &response, nil
}

// AcknowledgeAlert acknowledges an alert
func (s *MonitoringService) AcknowledgeAlert(ctx context.Context, tenantID, alertID string, comment string) error {
	req := map[string]interface{}{
		"comment": comment,
	}

	err := s.doPost(ctx, fmt.Sprintf("/tenants/%s/alerts/%s/acknowledge", tenantID, alertID), req, nil)
	if err != nil {
		return fmt.Errorf("failed to acknowledge alert: %w", err)
	}
	return nil
}

// ResolveAlert resolves an alert
func (s *MonitoringService) ResolveAlert(ctx context.Context, tenantID, alertID string, comment string) error {
	req := map[string]interface{}{
		"comment": comment,
	}

	err := s.doPost(ctx, fmt.Sprintf("/tenants/%s/alerts/%s/resolve", tenantID, alertID), req, nil)
	if err != nil {
		return fmt.Errorf("failed to resolve alert: %w", err)
	}
	return nil
}

// CreateDashboard creates a dashboard
func (s *MonitoringService) CreateDashboard(ctx context.Context, tenantID string, dashboard *Dashboard) (*Dashboard, error) {
	var result Dashboard
	err := s.doPost(ctx, fmt.Sprintf("/tenants/%s/dashboards", tenantID), dashboard, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to create dashboard: %w", err)
	}
	return &result, nil
}

// GetDashboard retrieves a dashboard
func (s *MonitoringService) GetDashboard(ctx context.Context, tenantID, dashboardID string) (*Dashboard, error) {
	var dashboard Dashboard
	err := s.doGet(ctx, fmt.Sprintf("/tenants/%s/dashboards/%s", tenantID, dashboardID), &dashboard)
	if err != nil {
		return nil, fmt.Errorf("failed to get dashboard: %w", err)
	}
	return &dashboard, nil
}

// ListDashboards retrieves dashboards for a tenant
func (s *MonitoringService) ListDashboards(ctx context.Context, tenantID string, opts *DashboardListOptions) (*PaginatedResponse[Dashboard], error) {
	path := fmt.Sprintf("/tenants/%s/dashboards", tenantID)

	queryParams := make(map[string]interface{})
	if opts != nil {
		if opts.Page != 0 {
			queryParams["page"] = opts.Page
		}
		if opts.PageSize != 0 {
			queryParams["page_size"] = opts.PageSize
		}
		if opts.SortBy != "" {
			queryParams["sort_by"] = opts.SortBy
		}
		if opts.SortDesc {
			queryParams["sort_desc"] = opts.SortDesc
		}
		if opts.Search != "" {
			queryParams["search"] = opts.Search
		}
		if len(opts.Tags) > 0 {
			queryParams["tags"] = opts.Tags
		}
		if opts.Shared != nil {
			queryParams["shared"] = *opts.Shared
		}
		if opts.Public != nil {
			queryParams["public"] = *opts.Public
		}
	}

	if len(queryParams) > 0 {
		path += s.buildQuery(queryParams)
	}

	var response PaginatedResponse[Dashboard]
	err := s.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list dashboards: %w", err)
	}
	return &response, nil
}

// UpdateDashboard updates a dashboard
func (s *MonitoringService) UpdateDashboard(ctx context.Context, tenantID, dashboardID string, dashboard *Dashboard) (*Dashboard, error) {
	var result Dashboard
	err := s.doPatch(ctx, fmt.Sprintf("/tenants/%s/dashboards/%s", tenantID, dashboardID), dashboard, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to update dashboard: %w", err)
	}
	return &result, nil
}

// DeleteDashboard deletes a dashboard
func (s *MonitoringService) DeleteDashboard(ctx context.Context, tenantID, dashboardID string) error {
	err := s.doDelete(ctx, fmt.Sprintf("/tenants/%s/dashboards/%s", tenantID, dashboardID))
	if err != nil {
		return fmt.Errorf("failed to delete dashboard: %w", err)
	}
	return nil
}

// GetHealth retrieves system health status
func (s *MonitoringService) GetHealth(ctx context.Context, tenantID string, checks []string) (*HealthStatus, error) {
	path := fmt.Sprintf("/tenants/%s/health", tenantID)
	if len(checks) > 0 {
		path += s.buildQuery(map[string]interface{}{
			"checks": checks,
		})
	}

	var health HealthStatus
	err := s.doGet(ctx, path, &health)
	if err != nil {
		return nil, fmt.Errorf("failed to get health status: %w", err)
	}
	return &health, nil
}

// QueryLogs queries logs
func (s *MonitoringService) QueryLogs(ctx context.Context, tenantID string, query *LogQuery) (*LogResponse, error) {
	path := fmt.Sprintf("/tenants/%s/logs/query", tenantID)

	jsonData, err := json.Marshal(query)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal log query: %w", err)
	}

	var response LogResponse
	err = s.doPost(ctx, path, bytes.NewReader(jsonData), &response)
	if err != nil {
		return nil, fmt.Errorf("failed to query logs: %w", err)
	}
	return &response, nil
}

// GetTrace retrieves a specific trace
func (s *MonitoringService) GetTrace(ctx context.Context, tenantID, traceID string) (*Trace, error) {
	var trace Trace
	err := s.doGet(ctx, fmt.Sprintf("/tenants/%s/traces/%s", tenantID, traceID), &trace)
	if err != nil {
		return nil, fmt.Errorf("failed to get trace: %w", err)
	}
	return &trace, nil
}

// SearchTraces searches for traces
func (s *MonitoringService) SearchTraces(ctx context.Context, tenantID string, opts *TraceSearchOptions) (*PaginatedResponse[Trace], error) {
	path := fmt.Sprintf("/tenants/%s/traces/search", tenantID)

	queryParams := make(map[string]interface{})
	if opts != nil {
		if opts.Page != 0 {
			queryParams["page"] = opts.Page
		}
		if opts.PageSize != 0 {
			queryParams["page_size"] = opts.PageSize
		}
		if opts.Service != "" {
			queryParams["service"] = opts.Service
		}
		if opts.Status != "" {
			queryParams["status"] = opts.Status
		}
		if opts.MinDuration != nil {
			queryParams["min_duration"] = opts.MinDuration
		}
		if opts.MaxDuration != nil {
			queryParams["max_duration"] = opts.MaxDuration
		}
		if opts.TimeRange != nil {
			queryParams["from"] = opts.TimeRange.From
			queryParams["to"] = opts.TimeRange.To
		}
		if opts.Query != "" {
			queryParams["query"] = opts.Query
		}
	}

	if len(queryParams) > 0 {
		path += s.buildQuery(queryParams)
	}

	var response PaginatedResponse[Trace]
	err := s.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to search traces: %w", err)
	}
	return &response, nil
}

// GetSystemMetrics retrieves system-wide metrics
func (s *MonitoringService) GetSystemMetrics(ctx context.Context, timeRange *TimestampRange) (*SystemMetrics, error) {
	path := "/system/metrics"
	if timeRange != nil {
		path += s.buildQuery(map[string]interface{}{
			"from": timeRange.From,
			"to":   timeRange.To,
		})
	}

	var metrics SystemMetrics
	err := s.doGet(ctx, path, &metrics)
	if err != nil {
		return nil, fmt.Errorf("failed to get system metrics: %w", err)
	}
	return &metrics, nil
}

// AlertListOptions represents options for listing alerts
type AlertListOptions struct {
	Page      int        `json:"page,omitempty"`
	PageSize  int        `json:"page_size,omitempty"`
	SortBy    string     `json:"sort_by,omitempty"`
	SortDesc  bool       `json:"sort_desc,omitempty"`
	Status    string     `json:"status,omitempty"`
	Severity  string     `json:"severity,omitempty"`
	Source    string     `json:"source,omitempty"`
	TimeRange *TimestampRange `json:"time_range,omitempty"`
}

// DashboardListOptions represents options for listing dashboards
type DashboardListOptions struct {
	Page     int      `json:"page,omitempty"`
	PageSize int      `json:"page_size,omitempty"`
	SortBy   string   `json:"sort_by,omitempty"`
	SortDesc bool     `json:"sort_desc,omitempty"`
	Search   string   `json:"search,omitempty"`
	Tags     []string `json:"tags,omitempty"`
	Shared   *bool    `json:"shared,omitempty"`
	Public   *bool    `json:"public,omitempty"`
}

// TraceSearchOptions represents options for searching traces
type TraceSearchOptions struct {
	Page        int            `json:"page,omitempty"`
	PageSize    int            `json:"page_size,omitempty"`
	Service     string         `json:"service,omitempty"`
	Status      string         `json:"status,omitempty"`
	MinDuration *time.Duration `json:"min_duration,omitempty"`
	MaxDuration *time.Duration `json:"max_duration,omitempty"`
	TimeRange   *TimestampRange     `json:"time_range,omitempty"`
	Query       string         `json:"query,omitempty"`
}

// SystemMetrics represents system-wide metrics
type SystemMetrics struct {
	Timestamp     Timestamp                   `json:"timestamp"`
	APIGateway    SystemComponentMetrics `json:"api_gateway"`
	Database      SystemComponentMetrics `json:"database"`
	Cache         SystemComponentMetrics `json:"cache"`
	VectorStore   SystemComponentMetrics `json:"vector_store"`
	LLMService    SystemComponentMetrics `json:"llm_service"`
	DocumentStore SystemComponentMetrics `json:"document_store"`
	RAGService    SystemComponentMetrics `json:"rag_service"`
}

// SystemComponentMetrics represents metrics for a system component
type SystemComponentMetrics struct {
	Status       string                 `json:"status"` // healthy, degraded, unhealthy
	ResponseTime time.Duration          `json:"response_time"`
	ErrorRate    float64                `json:"error_rate"`
	Throughput   float64                `json:"throughput"`
	CPUUsage     float64                `json:"cpu_usage"`
	MemoryUsage  float64                `json:"memory_usage"`
	DiskUsage    float64                `json:"disk_usage"`
	NetworkIO    NetworkIOMetrics       `json:"network_io"`
	Metrics      map[string]interface{} `json:"metrics"`
}

// NetworkIOMetrics represents network I/O metrics
type NetworkIOMetrics struct {
	BytesIn    int64 `json:"bytes_in"`
	BytesOut   int64 `json:"bytes_out"`
	PacketsIn  int64 `json:"packets_in"`
	PacketsOut int64 `json:"packets_out"`
}
