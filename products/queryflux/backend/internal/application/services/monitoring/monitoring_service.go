package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
	"go.uber.org/zap"
)

// MonitoringService implements the main monitoring service
type MonitoringService struct {
	logger                 *zap.Logger
	collector              ports.MetricCollector
	storage                ports.MetricsStorage
	alertManager           ports.AlertManager
	alertRuleManager       ports.AlertRuleManager
	notificationManager    ports.NotificationManager
	dashboardManager       ports.DashboardManager
	systemCollector        ports.SystemMetricsCollector
	dbCollector            ports.DatabaseMetricsCollector
	prometheusExporter     ports.PrometheusExporter
	healthChecker          ports.HealthChecker
	aggregator             ports.MetricsAggregator
	configManager          ports.MonitoringConfigManager
	wsManager              ports.WebSocketManager
	processor              ports.MetricsProcessor

	config                *domain.MonitoringConfig
	mu                    sync.RWMutex
	ctx                   context.Context
	cancel                context.CancelFunc
	wg                    sync.WaitGroup
	metricBuffers         map[string][]*domain.Metric
	bufferMu              sync.Mutex
	alertEvaluationTicker *time.Ticker
	configReloadTicker    *time.Ticker
}

// NewMonitoringService creates a new monitoring service
func NewMonitoringService(
	logger *zap.Logger,
	collector ports.MetricCollector,
	storage ports.MetricsStorage,
	alertManager ports.AlertManager,
	alertRuleManager ports.AlertRuleManager,
	notificationManager ports.NotificationManager,
	dashboardManager ports.DashboardManager,
	systemCollector ports.SystemMetricsCollector,
	dbCollector ports.DatabaseMetricsCollector,
	prometheusExporter ports.PrometheusExporter,
	healthChecker ports.HealthChecker,
	aggregator ports.MetricsAggregator,
	configManager ports.MonitoringConfigManager,
	wsManager ports.WebSocketManager,
	processor ports.MetricsProcessor,
) *MonitoringService {
	ctx, cancel := context.WithCancel(context.Background())

	return &MonitoringService{
		logger:              logger,
		collector:           collector,
		storage:             storage,
		alertManager:        alertManager,
		alertRuleManager:    alertRuleManager,
		notificationManager: notificationManager,
		dashboardManager:    dashboardManager,
		systemCollector:     systemCollector,
		dbCollector:         dbCollector,
		prometheusExporter:  prometheusExporter,
		healthChecker:       healthChecker,
		aggregator:          aggregator,
		configManager:       configManager,
		wsManager:           wsManager,
		processor:           processor,
		ctx:                 ctx,
		cancel:              cancel,
		metricBuffers:       make(map[string][]*domain.Metric),
	}
}

// Start starts the monitoring service
func (s *MonitoringService) Start(ctx context.Context) error {
	s.logger.Info("Starting monitoring service")

	// Load configuration
	config, err := s.configManager.GetConfig(ctx)
	if err != nil {
		return fmt.Errorf("failed to load monitoring config: %w", err)
	}

	s.mu.Lock()
	s.config = config
	s.mu.Unlock()

	if !config.Enabled {
		s.logger.Info("Monitoring is disabled in configuration")
		return nil
	}

	// Start metrics collection
	if config.DatabaseMetrics {
		if err := s.startDatabaseMetricsCollection(ctx); err != nil {
			return fmt.Errorf("failed to start database metrics collection: %w", err)
		}
	}

	if config.SystemMetrics {
		if err := s.startSystemMetricsCollection(ctx); err != nil {
			return fmt.Errorf("failed to start system metrics collection: %w", err)
		}
	}

	// Start alert evaluation
	s.startAlertEvaluation(ctx)

	// Start configuration reload
	s.startConfigReload(ctx)

	// Start WebSocket streaming
	s.startWebSocketStreaming(ctx)

	// Start periodic health checks
	s.startHealthChecks(ctx)

	s.logger.Info("Monitoring service started successfully")
	return nil
}

// Stop stops the monitoring service
func (s *MonitoringService) Stop(ctx context.Context) error {
	s.logger.Info("Stopping monitoring service")

	s.cancel()

	if s.alertEvaluationTicker != nil {
		s.alertEvaluationTicker.Stop()
	}

	if s.configReloadTicker != nil {
		s.configReloadTicker.Stop()
	}

	s.wg.Wait()

	// Flush any remaining metrics
	if err := s.flushMetrics(ctx); err != nil {
		s.logger.Error("Failed to flush metrics during shutdown", zap.Error(err))
	}

	s.logger.Info("Monitoring service stopped")
	return nil
}

// CollectMetric collects a single metric
func (s *MonitoringService) CollectMetric(ctx context.Context, metric *domain.Metric) error {
	if !s.isMonitoringEnabled() {
		return nil
	}

	// Process the metric
	if s.processor != nil {
		processedMetrics, err := s.processor.ProcessMetrics(ctx, []*domain.Metric{metric})
		if err != nil {
			s.logger.Error("Failed to process metric", zap.Error(err), zap.String("metric", metric.Name))
		} else if len(processedMetrics) > 0 {
			metric = processedMetrics[0]
		}
	}

	// Store the metric
	if err := s.collector.CollectMetric(ctx, metric); err != nil {
		return fmt.Errorf("failed to collect metric %s: %w", metric.Name, err)
	}

	// Export to Prometheus if enabled
	if s.prometheusExporter != nil {
		if err := s.prometheusExporter.RegisterMetric(ctx, metric); err != nil {
			s.logger.Warn("Failed to register metric with Prometheus", zap.Error(err), zap.String("metric", metric.Name))
		}
	}

	// Broadcast via WebSocket
	if s.wsManager != nil {
		if err := s.wsManager.BroadcastMetric(ctx, metric); err != nil {
			s.logger.Debug("Failed to broadcast metric via WebSocket", zap.Error(err), zap.String("metric", metric.Name))
		}
	}

	return nil
}

// CollectMetrics collects multiple metrics
func (s *MonitoringService) CollectMetrics(ctx context.Context, metrics []*domain.Metric) error {
	if !s.isMonitoringEnabled() {
		return nil
	}

	if len(metrics) == 0 {
		return nil
	}

	// Process metrics
	if s.processor != nil {
		processedMetrics, err := s.processor.ProcessMetrics(ctx, metrics)
		if err != nil {
			s.logger.Error("Failed to process metrics", zap.Error(err))
		} else {
			metrics = processedMetrics
		}
	}

	// Store metrics in batch
	if err := s.collector.CollectMetrics(ctx, metrics); err != nil {
		return fmt.Errorf("failed to collect metrics batch: %w", err)
	}

	// Export to Prometheus
	if s.prometheusExporter != nil {
		for _, metric := range metrics {
			if err := s.prometheusExporter.RegisterMetric(ctx, metric); err != nil {
				s.logger.Warn("Failed to register metric with Prometheus", zap.Error(err), zap.String("metric", metric.Name))
			}
		}
	}

	// Broadcast via WebSocket
	if s.wsManager != nil {
		for _, metric := range metrics {
			if err := s.wsManager.BroadcastMetric(ctx, metric); err != nil {
				s.logger.Debug("Failed to broadcast metric via WebSocket", zap.Error(err), zap.String("metric", metric.Name))
			}
		}
	}

	return nil
}

// GetMetrics retrieves metrics based on query
func (s *MonitoringService) GetMetrics(ctx context.Context, query *ports.MetricsQuery) ([]*domain.Metric, error) {
	if s.storage == nil {
		return nil, fmt.Errorf("metrics storage not configured")
	}

	return s.storage.Query(ctx, query)
}

// GetMetricSeries retrieves a time series of metrics
func (s *MonitoringService) GetMetricSeries(ctx context.Context, query *ports.MetricsQuery) ([]*domain.MetricSeries, error) {
	if s.storage == nil {
		return nil, fmt.Errorf("metrics storage not configured")
	}

	return s.storage.QuerySeries(ctx, query)
}

// CreateAlert creates a new alert
func (s *MonitoringService) CreateAlert(ctx context.Context, alert *domain.Alert) error {
	if s.alertManager == nil {
		return fmt.Errorf("alert manager not configured")
	}

	if err := s.alertManager.CreateAlert(ctx, alert); err != nil {
		return fmt.Errorf("failed to create alert: %w", err)
	}

	// Send notification if alert is active
	if alert.Status == domain.AlertStatusActive && s.notificationManager != nil {
		notification := &ports.Notification{
			ID:       generateID(),
			Type:     "alert",
			Severity: alert.Severity,
			Title:    fmt.Sprintf("Alert: %s", alert.Name),
			Message:  alert.Description,
			Data: map[string]interface{}{
				"alert_id": alert.ID,
				"source":   alert.Source,
				"severity": alert.Severity,
				"value":    alert.CurrentValue,
			},
			CreatedAt: time.Now(),
			Status:    "pending",
		}

		if err := s.notificationManager.SendNotification(ctx, notification); err != nil {
			s.logger.Error("Failed to send alert notification", zap.Error(err), zap.String("alert_id", alert.ID))
		}
	}

	// Broadcast via WebSocket
	if s.wsManager != nil {
		if err := s.wsManager.BroadcastAlert(ctx, alert); err != nil {
			s.logger.Debug("Failed to broadcast alert via WebSocket", zap.Error(err), zap.String("alert_id", alert.ID))
		}
	}

	return nil
}

// GetAlerts retrieves alerts based on filters
func (s *MonitoringService) GetAlerts(ctx context.Context, filters ports.AlertFilters) ([]*domain.Alert, error) {
	if s.alertManager == nil {
		return nil, fmt.Errorf("alert manager not configured")
	}

	return s.alertManager.GetAlerts(ctx, filters)
}

// ResolveAlert resolves an alert
func (s *MonitoringService) ResolveAlert(ctx context.Context, alertID string) error {
	if s.alertManager == nil {
		return fmt.Errorf("alert manager not configured")
	}

	if err := s.alertManager.ResolveAlert(ctx, alertID); err != nil {
		return fmt.Errorf("failed to resolve alert: %w", err)
	}

	return nil
}

// CreateDashboard creates a new monitoring dashboard
func (s *MonitoringService) CreateDashboard(ctx context.Context, dashboard *domain.MonitoringDashboard) error {
	if s.dashboardManager == nil {
		return fmt.Errorf("dashboard manager not configured")
	}

	if err := s.dashboardManager.CreateDashboard(ctx, dashboard); err != nil {
		return fmt.Errorf("failed to create dashboard: %w", err)
	}

	return nil
}

// GetDashboard retrieves a dashboard by ID
func (s *MonitoringService) GetDashboard(ctx context.Context, id string) (*domain.MonitoringDashboard, error) {
	if s.dashboardManager == nil {
		return nil, fmt.Errorf("dashboard manager not configured")
	}

	return s.dashboardManager.GetDashboard(ctx, id)
}

// GetDashboards retrieves dashboards based on filters
func (s *MonitoringService) GetDashboards(ctx context.Context, filters ports.DashboardFilters) ([]*domain.MonitoringDashboard, error) {
	if s.dashboardManager == nil {
		return nil, fmt.Errorf("dashboard manager not configured")
	}

	return s.dashboardManager.GetDashboards(ctx, filters)
}

// GetHealthChecks runs all health checks
func (s *MonitoringService) GetHealthChecks(ctx context.Context) ([]*domain.HealthCheck, error) {
	if s.healthChecker == nil {
		return nil, fmt.Errorf("health checker not configured")
	}

	return s.healthChecker.RunAllChecks(ctx)
}

// AggregateMetrics aggregates metrics
func (s *MonitoringService) AggregateMetrics(ctx context.Context, query *ports.AggregationQuery) (*ports.AggregatedMetrics, error) {
	if s.aggregator == nil {
		return nil, fmt.Errorf("metrics aggregator not configured")
	}

	return s.aggregator.AggregateMetrics(ctx, query)
}

// ExportPrometheusMetrics exports metrics in Prometheus format
func (s *MonitoringService) ExportPrometheusMetrics(ctx context.Context) (string, error) {
	if s.prometheusExporter == nil {
		return "", fmt.Errorf("Prometheus exporter not configured")
	}

	return s.prometheusExporter.ExportMetrics(ctx)
}

// Private helper methods

func (s *MonitoringService) isMonitoringEnabled() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config != nil && s.config.Enabled
}

func (s *MonitoringService) startDatabaseMetricsCollection(ctx context.Context) error {
	if s.dbCollector == nil {
		s.logger.Warn("Database metrics collector not configured")
		return nil
	}

	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		ticker := time.NewTicker(s.config.ScrapeInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := s.collectDatabaseMetrics(ctx); err != nil {
					s.logger.Error("Failed to collect database metrics", zap.Error(err))
				}
			}
		}
	}()

	return nil
}

func (s *MonitoringService) startSystemMetricsCollection(ctx context.Context) error {
	if s.systemCollector == nil {
		s.logger.Warn("System metrics collector not configured")
		return nil
	}

	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		ticker := time.NewTicker(s.config.ScrapeInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := s.collectSystemMetrics(ctx); err != nil {
					s.logger.Error("Failed to collect system metrics", zap.Error(err))
				}
			}
		}
	}()

	return nil
}

func (s *MonitoringService) startAlertEvaluation(ctx context.Context) {
	if s.alertRuleManager == nil {
		s.logger.Warn("Alert rule manager not configured")
		return
	}

	s.alertEvaluationTicker = time.NewTicker(s.config.AlertEvaluationInterval)

	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		for {
			select {
			case <-ctx.Done():
				return
			case <-s.alertEvaluationTicker.C:
				if err := s.evaluateAlertRules(ctx); err != nil {
					s.logger.Error("Failed to evaluate alert rules", zap.Error(err))
				}
			}
		}
	}()
}

func (s *MonitoringService) startConfigReload(ctx context.Context) {
	s.configReloadTicker = time.NewTicker(5 * time.Minute) // Reload every 5 minutes

	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		for {
			select {
			case <-ctx.Done():
				return
			case <-s.configReloadTicker.C:
				if err := s.reloadConfig(ctx); err != nil {
					s.logger.Error("Failed to reload monitoring config", zap.Error(err))
				}
			}
		}
	}()
}

func (s *MonitoringService) startWebSocketStreaming(ctx context.Context) {
	if s.wsManager == nil {
		return
	}

	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.handleWebSocketSubscriptions(ctx)
			}
		}
	}()
}

func (s *MonitoringService) startHealthChecks(ctx context.Context) {
	if s.healthChecker == nil {
		return
	}

	// Enable periodic health checks
	if err := s.healthChecker.EnablePeriodicChecks(ctx, 30*time.Second); err != nil {
		s.logger.Error("Failed to enable periodic health checks", zap.Error(err))
	}
}

func (s *MonitoringService) collectDatabaseMetrics(ctx context.Context) error {
	// This would collect metrics from all active database connections
	// Implementation would depend on the database connection manager
	return nil
}

func (s *MonitoringService) collectSystemMetrics(ctx context.Context) error {
	metrics, err := s.systemCollector.CollectSystemMetrics(ctx)
	if err != nil {
		return fmt.Errorf("failed to collect system metrics: %w", err)
	}

	// Convert system metrics to domain metrics
	domainMetrics := s.systemMetricsToDomain(metrics)
	return s.CollectMetrics(ctx, domainMetrics)
}

func (s *MonitoringService) evaluateAlertRules(ctx context.Context) error {
	alerts, err := s.alertRuleManager.EvaluateRules(ctx)
	if err != nil {
		return fmt.Errorf("failed to evaluate alert rules: %w", err)
	}

	for _, alert := range alerts {
		if err := s.CreateAlert(ctx, alert); err != nil {
			s.logger.Error("Failed to create alert from rule evaluation", zap.Error(err), zap.String("alert_name", alert.Name))
		}
	}

	return nil
}

func (s *MonitoringService) reloadConfig(ctx context.Context) error {
	config, err := s.configManager.GetConfig(ctx)
	if err != nil {
		return fmt.Errorf("failed to get monitoring config: %w", err)
	}

	s.mu.Lock()
	s.config = config
	s.mu.Unlock()

	s.logger.Info("Monitoring configuration reloaded")
	return nil
}

func (s *MonitoringService) handleWebSocketSubscriptions(ctx context.Context) {
	// Handle active WebSocket subscriptions
	// This would involve checking for metrics that match subscription criteria
}

func (s *MonitoringService) flushMetrics(ctx context.Context) error {
	s.bufferMu.Lock()
	defer s.bufferMu.Unlock()

	for key, metrics := range s.metricBuffers {
		if len(metrics) > 0 {
			if err := s.CollectMetrics(ctx, metrics); err != nil {
				s.logger.Error("Failed to flush metrics buffer", zap.Error(err), zap.String("key", key))
			}
			s.metricBuffers[key] = s.metricBuffers[key][:0] // Clear buffer
		}
	}

	return nil
}

func (s *MonitoringService) systemMetricsToDomain(sysMetrics *domain.SystemMetrics) []*domain.Metric {
	metrics := make([]*domain.Metric, 0)
	timestamp := sysMetrics.Timestamp

	// CPU metrics
	metrics = append(metrics, &domain.Metric{
		ID:    generateID(),
		Name:  "system_cpu_usage_percent",
		Type:  domain.MetricTypeGauge,
		Value: sysMetrics.CPU.UsagePercent,
		Labels: map[string]string{
			"hostname": sysMetrics.Hostname,
		},
		Timestamp:   timestamp,
		Description: "System CPU usage percentage",
		Unit:        "percent",
	})

	// Memory metrics
	metrics = append(metrics, &domain.Metric{
		ID:    generateID(),
		Name:  "system_memory_usage_percent",
		Type:  domain.MetricTypeGauge,
		Value: sysMetrics.Memory.UsagePercent,
		Labels: map[string]string{
			"hostname": sysMetrics.Hostname,
		},
		Timestamp:   timestamp,
		Description: "System memory usage percentage",
		Unit:        "percent",
	})

	// Add more metric conversions as needed
	return metrics
}

func generateID() string {
	return fmt.Sprintf("metric_%d", time.Now().UnixNano())
}

// Helper functions for metric name conversion and formatting
func sanitizeMetricName(name string) string {
	// Replace spaces and special characters with underscores
	name = strings.ReplaceAll(name, " ", "_")
	name = strings.ReplaceAll(name, ".", "_")
	name = strings.ReplaceAll(name, "-", "_")
	return strings.ToLower(name)
}

func formatLabels(labels map[string]string) string {
	if len(labels) == 0 {
		return ""
	}

	var parts []string
	for k, v := range labels {
		parts = append(parts, fmt.Sprintf("%s=\"%s\"", k, v))
	}
	return "{" + strings.Join(parts, ",") + "}"
}

func parseFloatValue(value interface{}) (float64, error) {
	switch v := value.(type) {
	case float64:
		return v, nil
	case float32:
		return float64(v), nil
	case int:
		return float64(v), nil
	case int64:
		return float64(v), nil
	case string:
		return strconv.ParseFloat(v, 64)
	default:
		return 0, fmt.Errorf("cannot convert %T to float64", value)
	}
}

func jsonify(data interface{}) string {
	jsonData, _ := json.Marshal(data)
	return string(jsonData)
}