package services_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/queryflux/backend/internal/application/ports"
	services "github.com/queryflux/backend/internal/application/services/monitoring"
	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/tests/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap/zaptest"
)

// TestMonitoringService_CollectMetric tests single metric collection
func TestMonitoringService_CollectMetric(t *testing.T) {
	logger := zaptest.NewLogger(t)

	collector := mocks.NewMockMetricCollector()
	storage := mocks.NewMockMetricsStorage()
	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	dashboardManager := mocks.NewMockDashboardManager()
	systemCollector := mocks.NewMockSystemMetricsCollector()
	dbCollector := mocks.NewMockDatabaseMetricsCollector()
	prometheusExporter := mocks.NewMockPrometheusExporter()
	healthChecker := mocks.NewMockHealthChecker()
	aggregator := mocks.NewMockMetricsAggregator()
	configManager := mocks.NewMockMonitoringConfigManager()
	wsManager := mocks.NewMockWebSocketManager()
	processor := mocks.NewMockMetricsProcessor()

	service := services.NewMonitoringService(
		logger,
		collector,
		storage,
		alertManager,
		alertRuleManager,
		notificationManager,
		dashboardManager,
		systemCollector,
		dbCollector,
		prometheusExporter,
		healthChecker,
		aggregator,
		configManager,
		wsManager,
		processor,
	)

	// Start service with disabled monitoring
	ctx := context.Background()
	config := &domain.MonitoringConfig{
		ID:                      "test-config",
		Enabled:                 true,
		ScrapeInterval:          30 * time.Second,
		MetricsRetention:        24 * time.Hour,
		AlertEvaluationInterval: 30 * time.Second,
		DatabaseMetrics:         true,
		SystemMetrics:           true,
		ApplicationMetrics:      true,
	}

	configManager.Config = config

	metric := &domain.Metric{
		ID:          "test-metric-1",
		Name:        "cpu_usage_percent",
		Type:        domain.MetricTypeGauge,
		Value:       75.5,
		Labels:      map[string]string{"host": "test-host"},
		Timestamp:   time.Now(),
		Description: "CPU usage percentage",
		Unit:        "percent",
	}

	err := service.CollectMetric(ctx, metric)
	require.NoError(t, err)
}

// TestMonitoringService_CollectMetrics tests batch metric collection
func TestMonitoringService_CollectMetrics(t *testing.T) {
	logger := zaptest.NewLogger(t)

	collector := mocks.NewMockMetricCollector()
	storage := mocks.NewMockMetricsStorage()
	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	dashboardManager := mocks.NewMockDashboardManager()
	systemCollector := mocks.NewMockSystemMetricsCollector()
	dbCollector := mocks.NewMockDatabaseMetricsCollector()
	prometheusExporter := mocks.NewMockPrometheusExporter()
	healthChecker := mocks.NewMockHealthChecker()
	aggregator := mocks.NewMockMetricsAggregator()
	configManager := mocks.NewMockMonitoringConfigManager()
	wsManager := mocks.NewMockWebSocketManager()
	processor := mocks.NewMockMetricsProcessor()

	service := services.NewMonitoringService(
		logger,
		collector,
		storage,
		alertManager,
		alertRuleManager,
		notificationManager,
		dashboardManager,
		systemCollector,
		dbCollector,
		prometheusExporter,
		healthChecker,
		aggregator,
		configManager,
		wsManager,
		processor,
	)

	ctx := context.Background()
	config := &domain.MonitoringConfig{
		ID:                      "test-config",
		Enabled:                 true,
		ScrapeInterval:          30 * time.Second,
		MetricsRetention:        24 * time.Hour,
		AlertEvaluationInterval: 30 * time.Second,
		DatabaseMetrics:         true,
		SystemMetrics:           true,
		ApplicationMetrics:      true,
	}

	configManager.Config = config

	metrics := []*domain.Metric{
		{
			ID:        "test-metric-1",
			Name:      "cpu_usage_percent",
			Type:      domain.MetricTypeGauge,
			Value:     75.5,
			Labels:    map[string]string{"host": "test-host-1"},
			Timestamp: time.Now(),
		},
		{
			ID:        "test-metric-2",
			Name:      "memory_usage_percent",
			Type:      domain.MetricTypeGauge,
			Value:     60.2,
			Labels:    map[string]string{"host": "test-host-2"},
			Timestamp: time.Now(),
		},
	}

	err := service.CollectMetrics(ctx, metrics)
	require.NoError(t, err)
}

// TestMonitoringService_GetMetrics tests metric retrieval
func TestMonitoringService_GetMetrics(t *testing.T) {
	logger := zaptest.NewLogger(t)

	collector := mocks.NewMockMetricCollector()
	storage := mocks.NewMockMetricsStorage()
	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	dashboardManager := mocks.NewMockDashboardManager()
	systemCollector := mocks.NewMockSystemMetricsCollector()
	dbCollector := mocks.NewMockDatabaseMetricsCollector()
	prometheusExporter := mocks.NewMockPrometheusExporter()
	healthChecker := mocks.NewMockHealthChecker()
	aggregator := mocks.NewMockMetricsAggregator()
	configManager := mocks.NewMockMonitoringConfigManager()
	wsManager := mocks.NewMockWebSocketManager()
	processor := mocks.NewMockMetricsProcessor()

	service := services.NewMonitoringService(
		logger,
		collector,
		storage,
		alertManager,
		alertRuleManager,
		notificationManager,
		dashboardManager,
		systemCollector,
		dbCollector,
		prometheusExporter,
		healthChecker,
		aggregator,
		configManager,
		wsManager,
		processor,
	)

	ctx := context.Background()

	// Setup test data
	metric := &domain.Metric{
		ID:        "test-metric-1",
		Name:      "cpu_usage_percent",
		Type:      domain.MetricTypeGauge,
		Value:     75.5,
		Labels:    map[string]string{"host": "test-host"},
		Timestamp: time.Now(),
	}

	storage.Store(ctx, metric)

	query := &ports.MetricsQuery{
		Name:  "cpu_usage_percent",
		From:  time.Now().Add(-1 * time.Hour),
		To:    time.Now(),
		Limit: 100,
	}

	metrics, err := service.GetMetrics(ctx, query)
	require.NoError(t, err)
	assert.NotEmpty(t, metrics)
}

// TestMonitoringService_CreateAlert tests alert creation
func TestMonitoringService_CreateAlert(t *testing.T) {
	logger := zaptest.NewLogger(t)

	collector := mocks.NewMockMetricCollector()
	storage := mocks.NewMockMetricsStorage()
	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	dashboardManager := mocks.NewMockDashboardManager()
	systemCollector := mocks.NewMockSystemMetricsCollector()
	dbCollector := mocks.NewMockDatabaseMetricsCollector()
	prometheusExporter := mocks.NewMockPrometheusExporter()
	healthChecker := mocks.NewMockHealthChecker()
	aggregator := mocks.NewMockMetricsAggregator()
	configManager := mocks.NewMockMonitoringConfigManager()
	wsManager := mocks.NewMockWebSocketManager()
	processor := mocks.NewMockMetricsProcessor()

	service := services.NewMonitoringService(
		logger,
		collector,
		storage,
		alertManager,
		alertRuleManager,
		notificationManager,
		dashboardManager,
		systemCollector,
		dbCollector,
		prometheusExporter,
		healthChecker,
		aggregator,
		configManager,
		wsManager,
		processor,
	)

	ctx := context.Background()
	alert := &domain.Alert{
		ID:           "test-alert-1",
		Name:         "High CPU Usage",
		Description:  "CPU usage is above 80%",
		Severity:     domain.AlertSeverityHigh,
		Status:       domain.AlertStatusActive,
		Source:       "cpu-monitor",
		Condition:    "gt",
		Threshold:    80.0,
		CurrentValue: 85.5,
		Labels: map[string]string{
			"host": "test-host",
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	err := service.CreateAlert(ctx, alert)
	require.NoError(t, err)

	// Verify alert was stored
	retrievedAlert, err := alertManager.GetAlert(ctx, alert.ID)
	require.NoError(t, err)
	assert.Equal(t, alert.ID, retrievedAlert.ID)
	assert.Equal(t, alert.Name, retrievedAlert.Name)
}

// TestMonitoringService_CreateDashboard tests dashboard creation
func TestMonitoringService_CreateDashboard(t *testing.T) {
	logger := zaptest.NewLogger(t)

	collector := mocks.NewMockMetricCollector()
	storage := mocks.NewMockMetricsStorage()
	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	dashboardManager := mocks.NewMockDashboardManager()
	systemCollector := mocks.NewMockSystemMetricsCollector()
	dbCollector := mocks.NewMockDatabaseMetricsCollector()
	prometheusExporter := mocks.NewMockPrometheusExporter()
	healthChecker := mocks.NewMockHealthChecker()
	aggregator := mocks.NewMockMetricsAggregator()
	configManager := mocks.NewMockMonitoringConfigManager()
	wsManager := mocks.NewMockWebSocketManager()
	processor := mocks.NewMockMetricsProcessor()

	service := services.NewMonitoringService(
		logger,
		collector,
		storage,
		alertManager,
		alertRuleManager,
		notificationManager,
		dashboardManager,
		systemCollector,
		dbCollector,
		prometheusExporter,
		healthChecker,
		aggregator,
		configManager,
		wsManager,
		processor,
	)

	ctx := context.Background()
	dashboard := &domain.MonitoringDashboard{
		ID:          "test-dashboard-1",
		Name:        "System Overview",
		Description: "System monitoring dashboard",
		Tags:        []string{"system", "overview"},
		Panels: []domain.DashboardPanel{
			{
				ID:    "panel-1",
				Title: "CPU Usage",
				Type:  "graph",
				Position: domain.PanelPosition{
					X:      0,
					Y:      0,
					Width:  12,
					Height: 6,
				},
				Queries: []domain.PanelQuery{
					{
						RefID:      "A",
						Query:      "cpu_usage_percent",
						DataSource: "prometheus",
					},
				},
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
		},
		Refresh: 30 * time.Second,
		TimeRange: domain.TimeRange{
			From: time.Now().Add(-1 * time.Hour),
			To:   time.Now(),
		},
		Enabled:   true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	err := service.CreateDashboard(ctx, dashboard)
	require.NoError(t, err)

	// Verify dashboard was stored
	retrievedDashboard, err := dashboardManager.GetDashboard(ctx, dashboard.ID)
	require.NoError(t, err)
	assert.Equal(t, dashboard.ID, retrievedDashboard.ID)
	assert.Equal(t, dashboard.Name, retrievedDashboard.Name)
}

// TestMonitoringService_GetHealthChecks tests health check functionality
func TestMonitoringService_GetHealthChecks(t *testing.T) {
	logger := zaptest.NewLogger(t)

	collector := mocks.NewMockMetricCollector()
	storage := mocks.NewMockMetricsStorage()
	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	dashboardManager := mocks.NewMockDashboardManager()
	systemCollector := mocks.NewMockSystemMetricsCollector()
	dbCollector := mocks.NewMockDatabaseMetricsCollector()
	prometheusExporter := mocks.NewMockPrometheusExporter()
	healthChecker := mocks.NewMockHealthChecker()
	aggregator := mocks.NewMockMetricsAggregator()
	configManager := mocks.NewMockMonitoringConfigManager()
	wsManager := mocks.NewMockWebSocketManager()
	processor := mocks.NewMockMetricsProcessor()

	service := services.NewMonitoringService(
		logger,
		collector,
		storage,
		alertManager,
		alertRuleManager,
		notificationManager,
		dashboardManager,
		systemCollector,
		dbCollector,
		prometheusExporter,
		healthChecker,
		aggregator,
		configManager,
		wsManager,
		processor,
	)

	ctx := context.Background()

	// Register a health check
	healthChecker.RegisterCheck(ctx, "database", func(ctx context.Context) *domain.HealthCheck {
		return &domain.HealthCheck{
			Name:      "database",
			Status:    "healthy",
			Message:   "Database connection is healthy",
			Duration:  10 * time.Millisecond,
			Timestamp: time.Now(),
			Component: "database",
		}
	})

	healthChecks, err := service.GetHealthChecks(ctx)
	require.NoError(t, err)
	assert.NotEmpty(t, healthChecks)
	assert.Equal(t, "database", healthChecks[0].Name)
}

// TestMonitoringService_AggregateMetrics tests metrics aggregation
func TestMonitoringService_AggregateMetrics(t *testing.T) {
	logger := zaptest.NewLogger(t)

	collector := mocks.NewMockMetricCollector()
	storage := mocks.NewMockMetricsStorage()
	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	dashboardManager := mocks.NewMockDashboardManager()
	systemCollector := mocks.NewMockSystemMetricsCollector()
	dbCollector := mocks.NewMockDatabaseMetricsCollector()
	prometheusExporter := mocks.NewMockPrometheusExporter()
	healthChecker := mocks.NewMockHealthChecker()
	aggregator := mocks.NewMockMetricsAggregator()
	configManager := mocks.NewMockMonitoringConfigManager()
	wsManager := mocks.NewMockWebSocketManager()
	processor := mocks.NewMockMetricsProcessor()

	service := services.NewMonitoringService(
		logger,
		collector,
		storage,
		alertManager,
		alertRuleManager,
		notificationManager,
		dashboardManager,
		systemCollector,
		dbCollector,
		prometheusExporter,
		healthChecker,
		aggregator,
		configManager,
		wsManager,
		processor,
	)

	ctx := context.Background()
	query := &ports.AggregationQuery{
		Name: "cpu_usage_percent",
		From: time.Now().Add(-1 * time.Hour),
		To:   time.Now(),
		Aggregations: []ports.Aggregation{
			{
				Function: "avg",
			},
		},
	}

	aggregated, err := service.AggregateMetrics(ctx, query)
	require.NoError(t, err)
	assert.Equal(t, "cpu_usage_percent", aggregated.Name)
	assert.Contains(t, aggregated.Values, "avg")
}

// TestMonitoringService_ExportPrometheusMetrics tests Prometheus metrics export
func TestMonitoringService_ExportPrometheusMetrics(t *testing.T) {
	logger := zaptest.NewLogger(t)

	collector := mocks.NewMockMetricCollector()
	storage := mocks.NewMockMetricsStorage()
	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	dashboardManager := mocks.NewMockDashboardManager()
	systemCollector := mocks.NewMockSystemMetricsCollector()
	dbCollector := mocks.NewMockDatabaseMetricsCollector()
	prometheusExporter := mocks.NewMockPrometheusExporter()
	healthChecker := mocks.NewMockHealthChecker()
	aggregator := mocks.NewMockMetricsAggregator()
	configManager := mocks.NewMockMonitoringConfigManager()
	wsManager := mocks.NewMockWebSocketManager()
	processor := mocks.NewMockMetricsProcessor()

	service := services.NewMonitoringService(
		logger,
		collector,
		storage,
		alertManager,
		alertRuleManager,
		notificationManager,
		dashboardManager,
		systemCollector,
		dbCollector,
		prometheusExporter,
		healthChecker,
		aggregator,
		configManager,
		wsManager,
		processor,
	)

	ctx := context.Background()

	// Register a test metric
	metric := &domain.Metric{
		ID:        "test-metric-1",
		Name:      "cpu_usage_percent",
		Type:      domain.MetricTypeGauge,
		Value:     75.5,
		Labels:    map[string]string{"host": "test-host"},
		Timestamp: time.Now(),
	}

	prometheusExporter.RegisterMetric(ctx, metric)

	exported, err := service.ExportPrometheusMetrics(ctx)
	require.NoError(t, err)
	assert.NotEmpty(t, exported)
}

// TestMonitoringService_StartStop tests service lifecycle
func TestMonitoringService_StartStop(t *testing.T) {
	logger := zaptest.NewLogger(t)

	collector := mocks.NewMockMetricCollector()
	storage := mocks.NewMockMetricsStorage()
	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	dashboardManager := mocks.NewMockDashboardManager()
	systemCollector := mocks.NewMockSystemMetricsCollector()
	dbCollector := mocks.NewMockDatabaseMetricsCollector()
	prometheusExporter := mocks.NewMockPrometheusExporter()
	healthChecker := mocks.NewMockHealthChecker()
	aggregator := mocks.NewMockMetricsAggregator()
	configManager := mocks.NewMockMonitoringConfigManager()
	wsManager := mocks.NewMockWebSocketManager()
	processor := mocks.NewMockMetricsProcessor()

	service := services.NewMonitoringService(
		logger,
		collector,
		storage,
		alertManager,
		alertRuleManager,
		notificationManager,
		dashboardManager,
		systemCollector,
		dbCollector,
		prometheusExporter,
		healthChecker,
		aggregator,
		configManager,
		wsManager,
		processor,
	)

	ctx := context.Background()

	// Test start
	err := service.Start(ctx)
	require.NoError(t, err)

	// Test stop
	err = service.Stop(ctx)
	require.NoError(t, err)
}

// TestMonitoringService_DisabledConfiguration tests service behavior when disabled
func TestMonitoringService_DisabledConfiguration(t *testing.T) {
	logger := zaptest.NewLogger(t)

	collector := mocks.NewMockMetricCollector()
	storage := mocks.NewMockMetricsStorage()
	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	dashboardManager := mocks.NewMockDashboardManager()
	systemCollector := mocks.NewMockSystemMetricsCollector()
	dbCollector := mocks.NewMockDatabaseMetricsCollector()
	prometheusExporter := mocks.NewMockPrometheusExporter()
	healthChecker := mocks.NewMockHealthChecker()
	aggregator := mocks.NewMockMetricsAggregator()
	configManager := mocks.NewMockMonitoringConfigManager()
	wsManager := mocks.NewMockWebSocketManager()
	processor := mocks.NewMockMetricsProcessor()

	service := services.NewMonitoringService(
		logger,
		collector,
		storage,
		alertManager,
		alertRuleManager,
		notificationManager,
		dashboardManager,
		systemCollector,
		dbCollector,
		prometheusExporter,
		healthChecker,
		aggregator,
		configManager,
		wsManager,
		processor,
	)

	ctx := context.Background()

	// Configure with disabled monitoring
	config := &domain.MonitoringConfig{
		ID:      "test-config",
		Enabled: false,
	}

	configManager.Config = config

	err := service.Start(ctx)
	require.NoError(t, err)

	// Metrics should not be collected when disabled
	metric := &domain.Metric{
		ID:        "test-metric-1",
		Name:      "cpu_usage_percent",
		Type:      domain.MetricTypeGauge,
		Value:     75.5,
		Timestamp: time.Now(),
	}

	err = service.CollectMetric(ctx, metric)
	require.NoError(t, err) // Should not error, but should not collect

	err = service.Stop(ctx)
	require.NoError(t, err)
}

// Benchmark tests
func BenchmarkMonitoringService_CollectMetric(b *testing.B) {
	logger := zaptest.NewLogger(b)

	collector := mocks.NewMockMetricCollector()
	storage := mocks.NewMockMetricsStorage()
	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	dashboardManager := mocks.NewMockDashboardManager()
	systemCollector := mocks.NewMockSystemMetricsCollector()
	dbCollector := mocks.NewMockDatabaseMetricsCollector()
	prometheusExporter := mocks.NewMockPrometheusExporter()
	healthChecker := mocks.NewMockHealthChecker()
	aggregator := mocks.NewMockMetricsAggregator()
	configManager := mocks.NewMockMonitoringConfigManager()
	wsManager := mocks.NewMockWebSocketManager()
	processor := mocks.NewMockMetricsProcessor()

	service := services.NewMonitoringService(
		logger,
		collector,
		storage,
		alertManager,
		alertRuleManager,
		notificationManager,
		dashboardManager,
		systemCollector,
		dbCollector,
		prometheusExporter,
		healthChecker,
		aggregator,
		configManager,
		wsManager,
		processor,
	)

	ctx := context.Background()
	config := &domain.MonitoringConfig{
		ID:      "test-config",
		Enabled: true,
	}

	configManager.Config = config

	metric := &domain.Metric{
		ID:        "test-metric-1",
		Name:      "cpu_usage_percent",
		Type:      domain.MetricTypeGauge,
		Value:     75.5,
		Timestamp: time.Now(),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		metric.ID = fmt.Sprintf("test-metric-%d", i)
		service.CollectMetric(ctx, metric)
	}
}

func BenchmarkMonitoringService_CollectMetrics(b *testing.B) {
	logger := zaptest.NewLogger(b)

	collector := mocks.NewMockMetricCollector()
	storage := mocks.NewMockMetricsStorage()
	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	dashboardManager := mocks.NewMockDashboardManager()
	systemCollector := mocks.NewMockSystemMetricsCollector()
	dbCollector := mocks.NewMockDatabaseMetricsCollector()
	prometheusExporter := mocks.NewMockPrometheusExporter()
	healthChecker := mocks.NewMockHealthChecker()
	aggregator := mocks.NewMockMetricsAggregator()
	configManager := mocks.NewMockMonitoringConfigManager()
	wsManager := mocks.NewMockWebSocketManager()
	processor := mocks.NewMockMetricsProcessor()

	service := services.NewMonitoringService(
		logger,
		collector,
		storage,
		alertManager,
		alertRuleManager,
		notificationManager,
		dashboardManager,
		systemCollector,
		dbCollector,
		prometheusExporter,
		healthChecker,
		aggregator,
		configManager,
		wsManager,
		processor,
	)

	ctx := context.Background()
	config := &domain.MonitoringConfig{
		ID:      "test-config",
		Enabled: true,
	}

	configManager.Config = config

	metrics := make([]*domain.Metric, 100)
	for i := 0; i < 100; i++ {
		metrics[i] = &domain.Metric{
			ID:        fmt.Sprintf("test-metric-%d", i),
			Name:      "cpu_usage_percent",
			Type:      domain.MetricTypeGauge,
			Value:     float64(i),
			Timestamp: time.Now(),
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		service.CollectMetrics(ctx, metrics)
	}
}
