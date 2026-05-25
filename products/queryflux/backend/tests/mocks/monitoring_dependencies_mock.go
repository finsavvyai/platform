package mocks

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
)

// MockMetricCollector implements a mock metric collector
type MockMetricCollector struct {
	metrics map[string]*domain.Metric
	series  map[string]*domain.MetricSeries
}

func NewMockMetricCollector() *MockMetricCollector {
	return &MockMetricCollector{
		metrics: make(map[string]*domain.Metric),
		series:  make(map[string]*domain.MetricSeries),
	}
}

func (m *MockMetricCollector) CollectMetric(ctx context.Context, metric *domain.Metric) error {
	key := metric.Name + formatLabels(metric.Labels)
	m.metrics[key] = metric
	return nil
}

func (m *MockMetricCollector) CollectMetrics(ctx context.Context, metrics []*domain.Metric) error {
	for _, metric := range metrics {
		m.CollectMetric(ctx, metric)
	}
	return nil
}

func (m *MockMetricCollector) GetMetric(ctx context.Context, name string, labels map[string]string, timestamp time.Time) (*domain.Metric, error) {
	key := name + formatLabels(labels)
	if metric, exists := m.metrics[key]; exists {
		return metric, nil
	}
	return nil, fmt.Errorf("metric not found")
}

func (m *MockMetricCollector) GetMetricSeries(ctx context.Context, name string, labels map[string]string, from, to time.Time) (*domain.MetricSeries, error) {
	key := name + formatLabels(labels)
	if series, exists := m.series[key]; exists {
		return series, nil
	}
	return nil, fmt.Errorf("metric series not found")
}

func (m *MockMetricCollector) DeleteMetric(ctx context.Context, name string, labels map[string]string) error {
	key := name + formatLabels(labels)
	delete(m.metrics, key)
	delete(m.series, key)
	return nil
}

func (m *MockMetricCollector) FlushMetrics(ctx context.Context) error {
	return nil
}

// MockMetricsStorage implements a mock metrics storage
type MockMetricsStorage struct {
	metrics []*domain.Metric
}

func NewMockMetricsStorage() *MockMetricsStorage {
	return &MockMetricsStorage{
		metrics: make([]*domain.Metric, 0),
	}
}

func (m *MockMetricsStorage) Store(ctx context.Context, metric *domain.Metric) error {
	m.metrics = append(m.metrics, metric)
	return nil
}

func (m *MockMetricsStorage) StoreBatch(ctx context.Context, metrics []*domain.Metric) error {
	m.metrics = append(m.metrics, metrics...)
	return nil
}

func (m *MockMetricsStorage) Query(ctx context.Context, query *ports.MetricsQuery) ([]*domain.Metric, error) {
	var result []*domain.Metric
	for _, metric := range m.metrics {
		if metric.Name == query.Name && isTimeInRange(metric.Timestamp, query.From, query.To) {
			if labelsMatch(metric.Labels, query.Labels) {
				result = append(result, metric)
			}
		}
	}
	return result, nil
}

func (m *MockMetricsStorage) QuerySeries(ctx context.Context, query *ports.MetricsQuery) ([]*domain.MetricSeries, error) {
	// Simplified implementation
	return []*domain.MetricSeries{}, nil
}

func (m *MockMetricsStorage) Delete(ctx context.Context, name string, labels map[string]string, before time.Time) error {
	var filtered []*domain.Metric
	for _, metric := range m.metrics {
		if metric.Name == name && labelsMatch(metric.Labels, labels) && metric.Timestamp.Before(before) {
			continue
		}
		filtered = append(filtered, metric)
	}
	m.metrics = filtered
	return nil
}

func (m *MockMetricsStorage) Cleanup(ctx context.Context, retention time.Duration) error {
	cutoff := time.Now().Add(-retention)
	return m.Delete(ctx, "", nil, cutoff)
}

func (m *MockMetricsStorage) GetStats(ctx context.Context) (*ports.StorageStats, error) {
	return &ports.StorageStats{
		TotalMetrics: int64(len(m.metrics)),
		TotalSeries:  int64(1),
	}, nil
}

// MockAlertManager implements a mock alert manager
type MockAlertManager struct {
	alerts map[string]*domain.Alert
}

func NewMockAlertManager() *MockAlertManager {
	return &MockAlertManager{
		alerts: make(map[string]*domain.Alert),
	}
}

func (m *MockAlertManager) CreateAlert(ctx context.Context, alert *domain.Alert) error {
	m.alerts[alert.ID] = alert
	return nil
}

func (m *MockAlertManager) UpdateAlert(ctx context.Context, alert *domain.Alert) error {
	m.alerts[alert.ID] = alert
	return nil
}

func (m *MockAlertManager) GetAlert(ctx context.Context, id string) (*domain.Alert, error) {
	if alert, exists := m.alerts[id]; exists {
		return alert, nil
	}
	return nil, fmt.Errorf("alert not found")
}

func (m *MockAlertManager) GetAlerts(ctx context.Context, filters ports.AlertFilters) ([]*domain.Alert, error) {
	var result []*domain.Alert
	for _, alert := range m.alerts {
		if matchesFilters(alert, filters) {
			result = append(result, alert)
		}
	}
	return result, nil
}

func (m *MockAlertManager) DeleteAlert(ctx context.Context, id string) error {
	delete(m.alerts, id)
	return nil
}

func (m *MockAlertManager) ResolveAlert(ctx context.Context, id string) error {
	if alert, exists := m.alerts[id]; exists {
		alert.Status = domain.AlertStatusResolved
		now := time.Now()
		alert.ResolvedAt = &now
	}
	return nil
}

func (m *MockAlertManager) SilenceAlert(ctx context.Context, id string, duration time.Duration) error {
	if alert, exists := m.alerts[id]; exists {
		alert.Status = domain.AlertStatusSilenced
		silenceUntil := time.Now().Add(duration)
		alert.SilencedUntil = &silenceUntil
	}
	return nil
}

func (m *MockAlertManager) GetActiveAlerts(ctx context.Context) ([]*domain.Alert, error) {
	var result []*domain.Alert
	for _, alert := range m.alerts {
		if alert.Status == domain.AlertStatusActive {
			result = append(result, alert)
		}
	}
	return result, nil
}

// MockAlertRuleManager implements a mock alert rule manager
type MockAlertRuleManager struct {
	rules map[string]*domain.AlertRule
}

func NewMockAlertRuleManager() *MockAlertRuleManager {
	return &MockAlertRuleManager{
		rules: make(map[string]*domain.AlertRule),
	}
}

func (m *MockAlertRuleManager) CreateRule(ctx context.Context, rule *domain.AlertRule) error {
	m.rules[rule.ID] = rule
	return nil
}

func (m *MockAlertRuleManager) UpdateRule(ctx context.Context, rule *domain.AlertRule) error {
	m.rules[rule.ID] = rule
	return nil
}

func (m *MockAlertRuleManager) GetRule(ctx context.Context, id string) (*domain.AlertRule, error) {
	if rule, exists := m.rules[id]; exists {
		return rule, nil
	}
	return nil, fmt.Errorf("rule not found")
}

func (m *MockAlertRuleManager) GetRules(ctx context.Context, enabled *bool) ([]*domain.AlertRule, error) {
	var result []*domain.AlertRule
	for _, rule := range m.rules {
		if enabled == nil || rule.Enabled == *enabled {
			result = append(result, rule)
		}
	}
	return result, nil
}

func (m *MockAlertRuleManager) DeleteRule(ctx context.Context, id string) error {
	delete(m.rules, id)
	return nil
}

func (m *MockAlertRuleManager) EnableRule(ctx context.Context, id string) error {
	if rule, exists := m.rules[id]; exists {
		rule.Enabled = true
	}
	return nil
}

func (m *MockAlertRuleManager) DisableRule(ctx context.Context, id string) error {
	if rule, exists := m.rules[id]; exists {
		rule.Enabled = false
	}
	return nil
}

func (m *MockAlertRuleManager) EvaluateRules(ctx context.Context) ([]*domain.Alert, error) {
	return []*domain.Alert{}, nil
}

// MockNotificationManager implements a mock notification manager
type MockNotificationManager struct {
	notifications []*ports.Notification
}

func NewMockNotificationManager() *MockNotificationManager {
	return &MockNotificationManager{
		notifications: make([]*ports.Notification, 0),
	}
}

func (m *MockNotificationManager) SendNotification(ctx context.Context, notification *ports.Notification) error {
	notification.Status = "sent"
	notification.SentAt = &time.Time{}
	m.notifications = append(m.notifications, notification)
	return nil
}

func (m *MockNotificationManager) SendBatch(ctx context.Context, notifications []*ports.Notification) error {
	for _, notification := range notifications {
		m.SendNotification(ctx, notification)
	}
	return nil
}

func (m *MockNotificationManager) GetNotificationHistory(ctx context.Context, filters ports.NotificationFilters) ([]*ports.Notification, error) {
	var result []*ports.Notification
	for _, notification := range m.notifications {
		if matchesNotificationFilters(notification, filters) {
			result = append(result, notification)
		}
	}
	return result, nil
}

func (m *MockNotificationManager) TestNotification(ctx context.Context, config *domain.NotificationConfig) error {
	return nil
}

// MockDashboardManager implements a mock dashboard manager
type MockDashboardManager struct {
	dashboards map[string]*domain.MonitoringDashboard
}

func NewMockDashboardManager() *MockDashboardManager {
	return &MockDashboardManager{
		dashboards: make(map[string]*domain.MonitoringDashboard),
	}
}

func (m *MockDashboardManager) CreateDashboard(ctx context.Context, dashboard *domain.MonitoringDashboard) error {
	m.dashboards[dashboard.ID] = dashboard
	return nil
}

func (m *MockDashboardManager) UpdateDashboard(ctx context.Context, dashboard *domain.MonitoringDashboard) error {
	m.dashboards[dashboard.ID] = dashboard
	return nil
}

func (m *MockDashboardManager) GetDashboard(ctx context.Context, id string) (*domain.MonitoringDashboard, error) {
	if dashboard, exists := m.dashboards[id]; exists {
		return dashboard, nil
	}
	return nil, fmt.Errorf("dashboard not found")
}

func (m *MockDashboardManager) GetDashboards(ctx context.Context, filters ports.DashboardFilters) ([]*domain.MonitoringDashboard, error) {
	var result []*domain.MonitoringDashboard
	for _, dashboard := range m.dashboards {
		if matchesDashboardFilters(dashboard, filters) {
			result = append(result, dashboard)
		}
	}
	return result, nil
}

func (m *MockDashboardManager) DeleteDashboard(ctx context.Context, id string) error {
	delete(m.dashboards, id)
	return nil
}

func (m *MockDashboardManager) DuplicateDashboard(ctx context.Context, id string, newName string) (*domain.MonitoringDashboard, error) {
	if original, exists := m.dashboards[id]; exists {
		duplicate := *original
		duplicate.ID = generateID()
		duplicate.Name = newName
		m.dashboards[duplicate.ID] = &duplicate
		return &duplicate, nil
	}
	return nil, fmt.Errorf("dashboard not found")
}

// MockSystemMetricsCollector implements a mock system metrics collector
type MockSystemMetricsCollector struct {
	metrics *domain.SystemMetrics
}

func NewMockSystemMetricsCollector() *MockSystemMetricsCollector {
	return &MockSystemMetricsCollector{
		metrics: &domain.SystemMetrics{
			ID:       "mock_sys_metrics",
			Hostname: "mock-host",
			CPU: domain.CPUMetrics{
				UsagePercent: 45.5,
				Load1Min:    1.2,
				Load5Min:    1.1,
				Load15Min:   1.0,
				Cores:       4,
			},
			Memory: domain.MemoryMetrics{
				Total:        16 * 1024 * 1024 * 1024, // 16GB
				Available:    8 * 1024 * 1024 * 1024,  // 8GB
				UsagePercent: 50.0,
			},
			Disk: []domain.DiskMetrics{
				{
					Device:      "/dev/sda1",
					Mountpoint:  "/",
					Total:       100 * 1024 * 1024 * 1024, // 100GB
					Free:        50 * 1024 * 1024 * 1024,  // 50GB
					UsagePercent: 50.0,
				},
			},
			Timestamp: time.Now(),
		},
	}
}

func (m *MockSystemMetricsCollector) CollectSystemMetrics(ctx context.Context) (*domain.SystemMetrics, error) {
	return m.metrics, nil
}

func (m *MockSystemMetricsCollector) CollectCPUMetrics(ctx context.Context) (*domain.CPUMetrics, error) {
	return &m.metrics.CPU, nil
}

func (m *MockSystemMetricsCollector) CollectMemoryMetrics(ctx context.Context) (*domain.MemoryMetrics, error) {
	return &m.metrics.Memory, nil
}

func (m *MockSystemMetricsCollector) CollectDiskMetrics(ctx context.Context) ([]*domain.DiskMetrics, error) {
	result := make([]*domain.DiskMetrics, len(m.metrics.Disk))
	for i, disk := range m.metrics.Disk {
		diskCopy := disk
		result[i] = &diskCopy
	}
	return result, nil
}

func (m *MockSystemMetricsCollector) CollectNetworkMetrics(ctx context.Context) ([]*domain.NetworkMetrics, error) {
	return []*domain.NetworkMetrics{}, nil
}

func (m *MockSystemMetricsCollector) CollectProcessMetrics(ctx context.Context) ([]*domain.ProcessMetrics, error) {
	return []*domain.ProcessMetrics{}, nil
}

func (m *MockSystemMetricsCollector) CollectTemperatureMetrics(ctx context.Context) ([]*domain.TemperatureMetric, error) {
	return []*domain.TemperatureMetric{}, nil
}

func (m *MockSystemMetricsCollector) StartCollection(ctx context.Context, interval time.Duration) error {
	return nil
}

func (m *MockSystemMetricsCollector) StopCollection(ctx context.Context) error {
	return nil
}

// MockDatabaseMetricsCollector implements a mock database metrics collector
type MockDatabaseMetricsCollector struct {
	metrics *domain.DatabaseMetrics
}

func NewMockDatabaseMetricsCollector() *MockDatabaseMetricsCollector {
	return &MockDatabaseMetricsCollector{
		metrics: &domain.DatabaseMetrics{
			ID:           "mock_db_metrics",
			ConnectionID: "mock_connection",
			DatabaseType: "postgresql",
			ConnectionCount: 5,
			QueryCount:      1000,
			ErrorCount:      10,
			AvgResponseTime: 50 * time.Millisecond,
			SlowQueryCount:  5,
			CacheHitRatio:   95.5,
			CPUUsage:        25.5,
			MemoryUsage:     512 * 1024 * 1024, // 512MB
			Timestamp:       time.Now(),
		},
	}
}

func (m *MockDatabaseMetricsCollector) CollectDatabaseMetrics(ctx context.Context, connectionID string) (*domain.DatabaseMetrics, error) {
	return m.metrics, nil
}

func (m *MockDatabaseMetricsCollector) CollectConnectionMetrics(ctx context.Context, connectionID string) (*ports.ConnectionMetrics, error) {
	return &ports.ConnectionMetrics{
		ConnectionID: connectionID,
		IsHealthy:    true,
		LastActivity: time.Now(),
	}, nil
}

func (m *MockDatabaseMetricsCollector) CollectQueryMetrics(ctx context.Context, connectionID string, limit int) ([]*domain.QueryMetric, error) {
	return []*domain.QueryMetric{}, nil
}

func (m *MockDatabaseMetricsCollector) CollectTableMetrics(ctx context.Context, connectionID string) ([]*domain.TableMetric, error) {
	return []*domain.TableMetric{}, nil
}

func (m *MockDatabaseMetricsCollector) CollectIndexMetrics(ctx context.Context, connectionID string) ([]*domain.IndexMetric, error) {
	return []*domain.IndexMetric{}, nil
}

func (m *MockDatabaseMetricsCollector) EnableCollection(ctx context.Context, connectionID string, interval time.Duration) error {
	return nil
}

func (m *MockDatabaseMetricsCollector) DisableCollection(ctx context.Context, connectionID string) error {
	return nil
}

// MockPrometheusExporter implements a mock Prometheus exporter
type MockPrometheusExporter struct {
	metrics map[string]*domain.Metric
}

func NewMockPrometheusExporter() *MockPrometheusExporter {
	return &MockPrometheusExporter{
		metrics: make(map[string]*domain.Metric),
	}
}

func (m *MockPrometheusExporter) RegisterMetric(ctx context.Context, metric *domain.Metric) error {
	m.metrics[metric.Name] = metric
	return nil
}

func (m *MockPrometheusExporter) UnregisterMetric(ctx context.Context, name string) error {
	delete(m.metrics, name)
	return nil
}

func (m *MockPrometheusExporter) ExportMetrics(ctx context.Context) (string, error) {
	return "# Mock Prometheus Export", nil
}

func (m *MockPrometheusExporter) GetMetricsEndpoint(ctx context.Context) (string, error) {
	return "/metrics", nil
}

func (m *MockPrometheusExporter) EnableScraping(ctx context.Context, path string) error {
	return nil
}

func (m *MockPrometheusExporter) DisableScraping(ctx context.Context) error {
	return nil
}

// MockHealthChecker implements a mock health checker
type MockHealthChecker struct {
	checks map[string]ports.HealthCheckFunc
}

func NewMockHealthChecker() *MockHealthChecker {
	return &MockHealthChecker{
		checks: make(map[string]ports.HealthCheckFunc),
	}
}

func (m *MockHealthChecker) RegisterCheck(ctx context.Context, name string, check ports.HealthCheckFunc) error {
	m.checks[name] = check
	return nil
}

func (m *MockHealthChecker) UnregisterCheck(ctx context.Context, name string) error {
	delete(m.checks, name)
	return nil
}

func (m *MockHealthChecker) RunCheck(ctx context.Context, name string) (*domain.HealthCheck, error) {
	if check, exists := m.checks[name]; exists {
		return check(ctx), nil
	}
	return nil, fmt.Errorf("health check not found")
}

func (m *MockHealthChecker) RunAllChecks(ctx context.Context) ([]*domain.HealthCheck, error) {
	var results []*domain.HealthCheck
	for name, check := range m.checks {
		result := check(ctx)
		result.Component = name
		results = append(results, result)
	}
	return results, nil
}

func (m *MockHealthChecker) EnablePeriodicChecks(ctx context.Context, interval time.Duration) error {
	return nil
}

func (m *MockHealthChecker) DisablePeriodicChecks(ctx context.Context) error {
	return nil
}

// MockMetricsAggregator implements a mock metrics aggregator
type MockMetricsAggregator struct{}

func NewMockMetricsAggregator() *MockMetricsAggregator {
	return &MockMetricsAggregator{}
}

func (m *MockMetricsAggregator) AggregateMetrics(ctx context.Context, query *ports.AggregationQuery) (*ports.AggregatedMetrics, error) {
	return &ports.AggregatedMetrics{
		Name:   query.Name,
		Values: map[string]float64{"avg": 50.0},
	}, nil
}

func (m *MockMetricsAggregator) AggregateByTime(ctx context.Context, name string, labels map[string]string, from, to time.Time, interval time.Duration) ([]*domain.Metric, error) {
	return []*domain.Metric{}, nil
}

func (m *MockMetricsAggregator) AggregateByLabels(ctx context.Context, name string, from, to time.Time, groupBy []string) ([]*domain.Metric, error) {
	return []*domain.Metric{}, nil
}

func (m *MockMetricsAggregator) CalculateRate(ctx context.Context, name string, labels map[string]string, from, to time.Duration) ([]*domain.Metric, error) {
	return []*domain.Metric{}, nil
}

func (m *MockMetricsAggregator) CalculatePercentile(ctx context.Context, name string, labels map[string]string, percentile float64, from, to time.Time) (*domain.Metric, error) {
	return &domain.Metric{
		Name:  name,
		Value: percentile,
	}, nil
}

// MockMonitoringConfigManager implements a mock monitoring config manager
type MockMonitoringConfigManager struct {
	Config *domain.MonitoringConfig
}

func NewMockMonitoringConfigManager() *MockMonitoringConfigManager {
	return &MockMonitoringConfigManager{
		Config: &domain.MonitoringConfig{
			ID:                   "mock_config",
			Enabled:              true,
			ScrapeInterval:       30 * time.Second,
			MetricsRetention:     7 * 24 * time.Hour,
			AlertEvaluationInterval: 30 * time.Second,
			DatabaseMetrics:      true,
			SystemMetrics:        true,
			ApplicationMetrics:   true,
		},
	}
}

func (m *MockMonitoringConfigManager) GetConfig(ctx context.Context) (*domain.MonitoringConfig, error) {
	return m.Config, nil
}

func (m *MockMonitoringConfigManager) UpdateConfig(ctx context.Context, config *domain.MonitoringConfig) error {
	m.Config = config
	return nil
}

func (m *MockMonitoringConfigManager) ReloadConfig(ctx context.Context) error {
	return nil
}

func (m *MockMonitoringConfigManager) ValidateConfig(ctx context.Context, config *domain.MonitoringConfig) error {
	return nil
}

func (m *MockMonitoringConfigManager) ResetToDefaults(ctx context.Context) error {
	m.Config = &domain.MonitoringConfig{
		ID:                   "default_config",
		Enabled:              true,
		ScrapeInterval:       30 * time.Second,
		MetricsRetention:     7 * 24 * time.Hour,
		AlertEvaluationInterval: 30 * time.Second,
		DatabaseMetrics:      true,
		SystemMetrics:        true,
		ApplicationMetrics:   true,
	}
	return nil
}

// MockWebSocketManager implements a mock WebSocket manager
type MockWebSocketManager struct {
	subscriptions map[string]*ports.Subscription
}

func NewMockWebSocketManager() *MockWebSocketManager {
	return &MockWebSocketManager{
		subscriptions: make(map[string]*ports.Subscription),
	}
}

func (m *MockWebSocketManager) SubscribeToMetrics(ctx context.Context, subscription *ports.MetricsSubscription) error {
	m.subscriptions[subscription.ID] = &ports.Subscription{
		ID:        subscription.ID,
		Type:      "metrics",
		ClientID:  subscription.ClientID,
		Interval:  subscription.Interval,
		CreatedAt: time.Now(),
		LastSeen:  time.Now(),
	}
	return nil
}

func (m *MockWebSocketManager) UnsubscribeFromMetrics(ctx context.Context, subscriptionID string) error {
	delete(m.subscriptions, subscriptionID)
	return nil
}

func (m *MockWebSocketManager) SubscribeToAlerts(ctx context.Context, subscription *ports.AlertsSubscription) error {
	m.subscriptions[subscription.ID] = &ports.Subscription{
		ID:        subscription.ID,
		Type:      "alerts",
		ClientID:  subscription.ClientID,
		CreatedAt: time.Now(),
		LastSeen:  time.Now(),
	}
	return nil
}

func (m *MockWebSocketManager) UnsubscribeFromAlerts(ctx context.Context, subscriptionID string) error {
	delete(m.subscriptions, subscriptionID)
	return nil
}

func (m *MockWebSocketManager) BroadcastMetric(ctx context.Context, metric *domain.Metric) error {
	return nil
}

func (m *MockWebSocketManager) BroadcastAlert(ctx context.Context, alert *domain.Alert) error {
	return nil
}

func (m *MockWebSocketManager) GetActiveSubscriptions(ctx context.Context) ([]*ports.Subscription, error) {
	var result []*ports.Subscription
	for _, sub := range m.subscriptions {
		result = append(result, sub)
	}
	return result, nil
}

// MockMetricsProcessor implements a mock metrics processor
type MockMetricsProcessor struct{}

func NewMockMetricsProcessor() *MockMetricsProcessor {
	return &MockMetricsProcessor{}
}

func (m *MockMetricsProcessor) ProcessMetrics(ctx context.Context, metrics []*domain.Metric) ([]*domain.Metric, error) {
	return metrics, nil
}

func (m *MockMetricsProcessor) ApplyTransformations(ctx context.Context, metrics []*domain.Metric, transformations []ports.Transformation) ([]*domain.Metric, error) {
	return metrics, nil
}

func (m *MockMetricsProcessor) FilterMetrics(ctx context.Context, metrics []*domain.Metric, filters []ports.Filter) ([]*domain.Metric, error) {
	return metrics, nil
}

func (m *MockMetricsProcessor) EnrichMetrics(ctx context.Context, metrics []*domain.Metric, enrichments []ports.Enrichment) ([]*domain.Metric, error) {
	return metrics, nil
}

// Helper functions

func formatLabels(labels map[string]string) string {
	if len(labels) == 0 {
		return ""
	}
	return fmt.Sprintf("%v", labels)
}

func isTimeInRange(t, from, to time.Time) bool {
	return t.After(from) && t.Before(to)
}

func labelsMatch(metricLabels, queryLabels map[string]string) bool {
	for k, v := range queryLabels {
		if metricLabels[k] != v {
			return false
		}
	}
	return true
}

func matchesFilters(alert *domain.Alert, filters ports.AlertFilters) bool {
	if len(filters.Status) > 0 {
		statusMatch := false
		for _, status := range filters.Status {
			if alert.Status == status {
				statusMatch = true
				break
			}
		}
		if !statusMatch {
			return false
		}
	}

	if len(filters.Severity) > 0 {
		severityMatch := false
		for _, severity := range filters.Severity {
			if alert.Severity == severity {
				severityMatch = true
				break
			}
		}
		if !severityMatch {
			return false
		}
	}

	return true
}

func matchesNotificationFilters(notification *ports.Notification, filters ports.NotificationFilters) bool {
	if filters.Type != "" && notification.Type != filters.Type {
		return false
	}

	if filters.Status != "" && notification.Status != filters.Status {
		return false
	}

	return true
}

func matchesDashboardFilters(dashboard *domain.MonitoringDashboard, filters ports.DashboardFilters) bool {
	if filters.Enabled != nil && dashboard.Enabled != *filters.Enabled {
		return false
	}

	if filters.Search != "" {
		searchTerm := strings.ToLower(filters.Search)
		if !strings.Contains(strings.ToLower(dashboard.Name), searchTerm) &&
			!strings.Contains(strings.ToLower(dashboard.Description), searchTerm) {
			return false
		}
	}

	if len(filters.Tags) > 0 {
		tagMatch := false
		for _, filterTag := range filters.Tags {
			for _, dashboardTag := range dashboard.Tags {
				if filterTag == dashboardTag {
					tagMatch = true
					break
				}
			}
		}
		if !tagMatch {
			return false
		}
	}

	return true
}

func generateID() string {
	return fmt.Sprintf("id_%d", time.Now().UnixNano())
}