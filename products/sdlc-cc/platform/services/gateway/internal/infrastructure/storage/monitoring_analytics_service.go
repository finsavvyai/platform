//go:build ignore

package storage

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

// MonitoringConfig holds configuration for monitoring and analytics
type MonitoringConfig struct {
	EnableMetrics            bool            `json:"enable_metrics"`
	MetricsInterval          time.Duration   `json:"metrics_interval"`
	EnableAnalytics          bool            `json:"enable_analytics"`
	AnalyticsInterval        time.Duration   `json:"analytics_interval"`
	EnableAlerts             bool            `json:"enable_alerts"`
	AlertThresholds          AlertThresholds `json:"alert_thresholds"`
	RetentionPeriod          time.Duration   `json:"retention_period"`
	MaxMetricsPerType        int             `json:"max_metrics_per_type"`
	EnableRealTimeMonitoring bool            `json:"enable_real_time_monitoring"`
	BatchSize                int             `json:"batch_size"`
	FlushInterval            time.Duration   `json:"flush_interval"`
}

// AlertThresholds defines thresholds for alerting
type AlertThresholds struct {
	UploadFailureRate  float64       `json:"upload_failure_rate"` // percentage
	StorageUtilization float64       `json:"storage_utilization"` // percentage
	ResponseTimeP95    time.Duration `json:"response_time_p95"`   // milliseconds
	ErrorRate          float64       `json:"error_rate"`          // percentage
	ConcurrentUploads  int           `json:"concurrent_uploads"`
	VirusDetectionRate float64       `json:"virus_detection_rate"` // percentage
}

// DefaultMonitoringConfig returns default configuration
func DefaultMonitoringConfig() *MonitoringConfig {
	return &MonitoringConfig{
		EnableMetrics:     true,
		MetricsInterval:   1 * time.Minute,
		EnableAnalytics:   true,
		AnalyticsInterval: 5 * time.Minute,
		EnableAlerts:      true,
		AlertThresholds: AlertThresholds{
			UploadFailureRate:  5.0,
			StorageUtilization: 80.0,
			ResponseTimeP95:    5 * time.Second,
			ErrorRate:          2.0,
			ConcurrentUploads:  100,
			VirusDetectionRate: 1.0,
		},
		RetentionPeriod:          30 * 24 * time.Hour, // 30 days
		MaxMetricsPerType:        10000,
		EnableRealTimeMonitoring: true,
		BatchSize:                1000,
		FlushInterval:            30 * time.Second,
	}
}

// MetricType represents different types of metrics
type MetricType string

const (
	MetricTypeUpload      MetricType = "upload"
	MetricTypeDownload    MetricType = "download"
	MetricTypeStorage     MetricType = "storage"
	MetricTypePerformance MetricType = "performance"
	MetricTypeSecurity    MetricType = "security"
	MetricTypeUser        MetricType = "user"
	MetricTypeSystem      MetricType = "system"
)

// Metric represents a single metric data point
type Metric struct {
	ID        uuid.UUID              `json:"id"`
	Type      MetricType             `json:"type"`
	Name      string                 `json:"name"`
	Value     float64                `json:"value"`
	Unit      string                 `json:"unit"`
	Tags      map[string]string      `json:"tags"`
	Timestamp time.Time              `json:"timestamp"`
	TenantID  uuid.UUID              `json:"tenant_id"`
	UserID    *uuid.UUID             `json:"user_id,omitempty"`
	Metadata  map[string]interface{} `json:"metadata"`
}

// AnalyticsEvent represents an analytics event
type AnalyticsEvent struct {
	ID        uuid.UUID              `json:"id"`
	Type      string                 `json:"type"`
	Name      string                 `json:"name"`
	Data      map[string]interface{} `json:"data"`
	Timestamp time.Time              `json:"timestamp"`
	TenantID  uuid.UUID              `json:"tenant_id"`
	UserID    *uuid.UUID             `json:"user_id,omitempty"`
	SessionID string                 `json:"session_id,omitempty"`
	Context   map[string]interface{} `json:"context"`
}

// Alert represents an alert
type Alert struct {
	ID           uuid.UUID              `json:"id"`
	Type         AlertType              `json:"type"`
	Severity     AlertSeverity          `json:"severity"`
	Title        string                 `json:"title"`
	Description  string                 `json:"description"`
	Source       string                 `json:"source"`
	Timestamp    time.Time              `json:"timestamp"`
	TenantID     uuid.UUID              `json:"tenant_id"`
	Data         map[string]interface{} `json:"data"`
	Resolved     bool                   `json:"resolved"`
	ResolvedAt   *time.Time             `json:"resolved_at,omitempty"`
	Acknowledged bool                   `json:"acknowledged"`
	AckedBy      *uuid.UUID             `json:"acknowledged_by,omitempty"`
	AckedAt      *time.Time             `json:"acknowledged_at,omitempty"`
}

// AlertType represents different types of alerts
type AlertType string

const (
	AlertTypeError       AlertType = "error"
	AlertTypeWarning     AlertType = "warning"
	AlertTypeInfo        AlertType = "info"
	AlertTypePerformance AlertType = "performance"
	AlertTypeSecurity    AlertType = "security"
	AlertTypeCapacity    AlertType = "capacity"
)

// AlertSeverity represents alert severity levels
type AlertSeverity string

const (
	AlertSeverityCritical AlertSeverity = "critical"
	AlertSeverityHigh     AlertSeverity = "high"
	AlertSeverityMedium   AlertSeverity = "medium"
	AlertSeverityLow      AlertSeverity = "low"
)

// MonitoringAnalyticsService provides comprehensive monitoring and analytics
type MonitoringAnalyticsService struct {
	config          *MonitoringConfig
	logger          *logrus.Logger
	metrics         map[MetricType][]*Metric
	events          []*AnalyticsEvent
	alerts          map[uuid.UUID]*Alert
	activeAlerts    map[string]*Alert
	metricsMutex    sync.RWMutex
	eventsMutex     sync.RWMutex
	alertsMutex     sync.RWMutex
	metricsChannel  chan *Metric
	eventsChannel   chan *AnalyticsEvent
	tracer          trace.Tracer
	flushTicker     *time.Ticker
	metricsTicker   *time.Ticker
	analyticsTicker *time.Ticker
}

// NewMonitoringAnalyticsService creates a new monitoring and analytics service
func NewMonitoringAnalyticsService(config *MonitoringConfig, logger *logrus.Logger) *MonitoringAnalyticsService {
	if config == nil {
		config = DefaultMonitoringConfig()
	}

	service := &MonitoringAnalyticsService{
		config:         config,
		logger:         logger,
		metrics:        make(map[MetricType][]*Metric),
		events:         make([]*AnalyticsEvent, 0),
		alerts:         make(map[uuid.UUID]*Alert),
		activeAlerts:   make(map[string]*Alert),
		metricsChannel: make(chan *Metric, config.BatchSize),
		eventsChannel:  make(chan *AnalyticsEvent, config.BatchSize),
		tracer:         otel.Tracer("monitoring-analytics-service"),
	}

	// Start background routines
	if config.EnableRealTimeMonitoring {
		go service.processMetrics()
		go service.processEvents()
	}

	if config.EnableMetrics {
		service.metricsTicker = time.NewTicker(config.MetricsInterval)
		go service.collectMetrics()
	}

	if config.EnableAnalytics {
		service.analyticsTicker = time.NewTicker(config.AnalyticsInterval)
		go service.performAnalytics()
	}

	service.flushTicker = time.NewTicker(config.FlushInterval)
	go service.flushRoutine()

	return service
}

// RecordMetric records a metric
func (mas *MonitoringAnalyticsService) RecordMetric(ctx context.Context, metric *Metric) error {
	if !mas.config.EnableMetrics {
		return nil
	}

	if metric.ID == uuid.Nil {
		metric.ID = uuid.New()
	}
	metric.Timestamp = time.Now()

	select {
	case mas.metricsChannel <- metric:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		// Channel is full, drop metric or handle overflow
		mas.logger.WithField("metric_type", metric.Type).Warn("Metrics channel full, dropping metric")
		return fmt.Errorf("metrics channel full")
	}
}

// RecordEvent records an analytics event
func (mas *MonitoringAnalyticsService) RecordEvent(ctx context.Context, event *AnalyticsEvent) error {
	if !mas.config.EnableAnalytics {
		return nil
	}

	if event.ID == uuid.Nil {
		event.ID = uuid.New()
	}
	event.Timestamp = time.Now()

	select {
	case mas.eventsChannel <- event:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		// Channel is full, drop event or handle overflow
		mas.logger.WithField("event_type", event.Type).Warn("Events channel full, dropping event")
		return fmt.Errorf("events channel full")
	}
}

// GetMetrics retrieves metrics for a time range
func (mas *MonitoringAnalyticsService) GetMetrics(ctx context.Context, metricType MetricType, tenantID *uuid.UUID, startTime, endTime *time.Time, limit int) ([]*Metric, error) {
	mas.metricsMutex.RLock()
	defer mas.metricsMutex.RUnlock()

	metrics := mas.metrics[metricType]
	var filtered []*Metric

	for _, metric := range metrics {
		// Filter by tenant
		if tenantID != nil && metric.TenantID != *tenantID {
			continue
		}

		// Filter by time range
		if startTime != nil && metric.Timestamp.Before(*startTime) {
			continue
		}
		if endTime != nil && metric.Timestamp.After(*endTime) {
			continue
		}

		filtered = append(filtered, metric)
	}

	// Apply limit
	if limit > 0 && len(filtered) > limit {
		filtered = filtered[:limit]
	}

	return filtered, nil
}

// GetEvents retrieves analytics events
func (mas *MonitoringAnalyticsService) GetEvents(ctx context.Context, tenantID *uuid.UUID, eventType *string, startTime, endTime *time.Time, limit int) ([]*AnalyticsEvent, error) {
	mas.eventsMutex.RLock()
	defer mas.eventsMutex.RUnlock()

	var filtered []*AnalyticsEvent

	for _, event := range mas.events {
		// Filter by tenant
		if tenantID != nil && event.TenantID != *tenantID {
			continue
		}

		// Filter by event type
		if eventType != nil && event.Type != *eventType {
			continue
		}

		// Filter by time range
		if startTime != nil && event.Timestamp.Before(*startTime) {
			continue
		}
		if endTime != nil && event.Timestamp.After(*endTime) {
			continue
		}

		filtered = append(filtered, event)
	}

	// Apply limit
	if limit > 0 && len(filtered) > limit {
		filtered = filtered[:limit]
	}

	return filtered, nil
}

// GetAlerts retrieves alerts
func (mas *MonitoringAnalyticsService) GetAlerts(ctx context.Context, tenantID *uuid.UUID, alertType *AlertType, severity *AlertSeverity, resolved *bool, limit int) ([]*Alert, error) {
	mas.alertsMutex.RLock()
	defer mas.alertsMutex.RUnlock()

	var filtered []*Alert

	for _, alert := range mas.alerts {
		// Filter by tenant
		if tenantID != nil && alert.TenantID != *tenantID {
			continue
		}

		// Filter by type
		if alertType != nil && alert.Type != *alertType {
			continue
		}

		// Filter by severity
		if severity != nil && alert.Severity != *severity {
			continue
		}

		// Filter by resolved status
		if resolved != nil && alert.Resolved != *resolved {
			continue
		}

		filtered = append(filtered, alert)
	}

	// Apply limit
	if limit > 0 && len(filtered) > limit {
		filtered = filtered[:limit]
	}

	return filtered, nil
}

// CreateAlert creates a new alert
func (mas *MonitoringAnalyticsService) CreateAlert(ctx context.Context, alert *Alert) error {
	if !mas.config.EnableAlerts {
		return nil
	}

	if alert.ID == uuid.Nil {
		alert.ID = uuid.New()
	}
	alert.Timestamp = time.Now()

	mas.alertsMutex.Lock()
	defer mas.alertsMutex.Unlock()

	mas.alerts[alert.ID] = alert

	// Add to active alerts if not resolved
	if !alert.Resolved {
		alertKey := mas.generateAlertKey(alert)
		mas.activeAlerts[alertKey] = alert
	}

	mas.logger.WithFields(logrus.Fields{
		"alert_id":  alert.ID,
		"type":      alert.Type,
		"severity":  alert.Severity,
		"tenant_id": alert.TenantID,
	}).Info("Alert created")

	return nil
}

// ResolveAlert resolves an alert
func (mas *MonitoringAnalyticsService) ResolveAlert(ctx context.Context, alertID uuid.UUID, resolvedBy *uuid.UUID) error {
	mas.alertsMutex.Lock()
	defer mas.alertsMutex.Unlock()

	alert, exists := mas.alerts[alertID]
	if !exists {
		return fmt.Errorf("alert not found: %s", alertID)
	}

	now := time.Now()
	alert.Resolved = true
	alert.ResolvedAt = &now

	if resolvedBy != nil {
		alert.Acknowledged = true
		alert.AckedBy = resolvedBy
		alert.AckedAt = &now
	}

	// Remove from active alerts
	alertKey := mas.generateAlertKey(alert)
	delete(mas.activeAlerts, alertKey)

	mas.logger.WithFields(logrus.Fields{
		"alert_id":    alertID,
		"resolved_by": resolvedBy,
	}).Info("Alert resolved")

	return nil
}

// GetSystemHealth returns system health information
func (mas *MonitoringAnalyticsService) GetSystemHealth(ctx context.Context) (*SystemHealth, error) {
	mas.metricsMutex.RLock()
	mas.alertsMutex.RLock()
	defer mas.metricsMutex.RUnlock()
	defer mas.alertsMutex.RUnlock()

	health := &SystemHealth{
		Timestamp: time.Now(),
		Status:    "healthy",
		Metrics:   make(map[string]interface{}),
	}

	// Calculate system metrics
	totalMetrics := 0
	for _, metrics := range mas.metrics {
		totalMetrics += len(metrics)
	}

	activeAlertsCount := len(mas.activeAlerts)

	health.Metrics = map[string]interface{}{
		"total_metrics":    totalMetrics,
		"total_events":     len(mas.events),
		"active_alerts":    activeAlertsCount,
		"total_alerts":     len(mas.alerts),
		"metrics_channels": len(mas.metricsChannel),
		"events_channels":  len(mas.eventsChannel),
	}

	// Determine overall status
	if activeAlertsCount > 0 {
		health.Status = "degraded"

		// Check for critical alerts
		for _, alert := range mas.activeAlerts {
			if alert.Severity == AlertSeverityCritical {
				health.Status = "unhealthy"
				break
			}
		}
	}

	return health, nil
}

// GetStorageAnalytics returns storage analytics
func (mas *MonitoringAnalyticsService) GetStorageAnalytics(ctx context.Context, tenantID uuid.UUID) (*StorageAnalytics, error) {
	mas.metricsMutex.RLock()
	defer mas.metricsMutex.RUnlock()

	analytics := &StorageAnalytics{
		TenantID:     tenantID,
		Timestamp:    time.Now(),
		StorageUsage: 0,
		FileCount:    0,
		AvgFileSize:  0,
		UploadRate:   0,
		DownloadRate: 0,
		ErrorRate:    0,
	}

	// Calculate storage metrics from recorded metrics
	storageMetrics := mas.metrics[MetricTypeStorage]
	uploadMetrics := mas.metrics[MetricTypeUpload]
	downloadMetrics := mas.metrics[MetricTypeDownload]

	// Calculate storage usage
	for _, metric := range storageMetrics {
		if metric.TenantID == tenantID {
			switch metric.Name {
			case "storage_usage_bytes":
				analytics.StorageUsage += int64(metric.Value)
			case "file_count":
				analytics.FileCount += int(metric.Value)
			case "avg_file_size_bytes":
				analytics.AvgFileSize += int64(metric.Value)
			}
		}
	}

	// Calculate rates (simplified calculation)
	recentTime := time.Now().Add(-1 * time.Hour)

	uploadCount := 0
	for _, metric := range uploadMetrics {
		if metric.TenantID == tenantID && metric.Timestamp.After(recentTime) {
			if metric.Name == "upload_count" {
				uploadCount += int(metric.Value)
			}
		}
	}
	analytics.UploadRate = float64(uploadCount) / 3600.0 // uploads per second

	downloadCount := 0
	for _, metric := range downloadMetrics {
		if metric.TenantID == tenantID && metric.Timestamp.After(recentTime) {
			if metric.Name == "download_count" {
				downloadCount += int(metric.Value)
			}
		}
	}
	analytics.DownloadRate = float64(downloadCount) / 3600.0 // downloads per second

	return analytics, nil
}

// GetPerformanceMetrics returns performance metrics
func (mas *MonitoringAnalyticsService) GetPerformanceMetrics(ctx context.Context, tenantID *uuid.UUID, timeRange time.Duration) (*PerformanceMetrics, error) {
	mas.metricsMutex.RLock()
	defer mas.metricsMutex.RUnlock()

	metrics := &PerformanceMetrics{
		Timestamp:    time.Now(),
		TimeRange:    timeRange,
		ResponseTime: make(map[string]time.Duration),
		Throughput:   make(map[string]float64),
		ErrorRate:    make(map[string]float64),
		Availability: make(map[string]float64),
	}

	// Calculate performance metrics from recorded data
	perfMetrics := mas.metrics[MetricTypePerformance]
	startTime := time.Now().Add(-timeRange)

	responseTimes := make(map[string][]time.Duration)
	requestCounts := make(map[string]int)
	errorCounts := make(map[string]int)

	for _, metric := range perfMetrics {
		if metric.Timestamp.Before(startTime) {
			continue
		}

		if tenantID != nil && metric.TenantID != *tenantID {
			continue
		}

		switch metric.Name {
		case "response_time_ms":
			operation := metric.Tags["operation"]
			responseTimes[operation] = append(responseTimes[operation], time.Duration(metric.Value)*time.Millisecond)
		case "request_count":
			operation := metric.Tags["operation"]
			requestCounts[operation] += int(metric.Value)
		case "error_count":
			operation := metric.Tags["operation"]
			errorCounts[operation] += int(metric.Value)
		}
	}

	// Calculate averages and rates
	for operation, times := range responseTimes {
		if len(times) > 0 {
			var total time.Duration
			for _, t := range times {
				total += t
			}
			metrics.ResponseTime[operation] = total / time.Duration(len(times))
		}
	}

	for operation, count := range requestCounts {
		metrics.Throughput[operation] = float64(count) / timeRange.Seconds()
	}

	for operation, errors := range errorCounts {
		total := requestCounts[operation]
		if total > 0 {
			metrics.ErrorRate[operation] = float64(errors) / float64(total) * 100
		}
	}

	return metrics, nil
}

// HealthCheck performs a health check on the monitoring service
func (mas *MonitoringAnalyticsService) HealthCheck(ctx context.Context) error {
	// Check if background routines are running
	if mas.config.EnableRealTimeMonitoring {
		// Test metric recording
		testMetric := &Metric{
			Type:  MetricTypeSystem,
			Name:  "health_check",
			Value: 1,
			Tags:  map[string]string{"test": "true"},
		}

		if err := mas.RecordMetric(ctx, testMetric); err != nil {
			return fmt.Errorf("metric recording failed: %w", err)
		}

		// Test event recording
		testEvent := &AnalyticsEvent{
			Type: "health_check",
			Name: "test_event",
			Data: map[string]interface{}{"test": true},
		}

		if err := mas.RecordEvent(ctx, testEvent); err != nil {
			return fmt.Errorf("event recording failed: %w", err)
		}
	}

	return nil
}

// Shutdown gracefully shuts down the monitoring service
func (mas *MonitoringAnalyticsService) Shutdown(ctx context.Context) error {
	mas.logger.Info("Shutting down monitoring and analytics service")

	// Stop tickers
	if mas.flushTicker != nil {
		mas.flushTicker.Stop()
	}
	if mas.metricsTicker != nil {
		mas.metricsTicker.Stop()
	}
	if mas.analyticsTicker != nil {
		mas.analyticsTicker.Stop()
	}

	// Process remaining metrics and events
	close(mas.metricsChannel)
	close(mas.eventsChannel)

	// Final flush
	mas.flushMetrics()
	mas.flushEvents()

	mas.logger.Info("Monitoring and analytics service shutdown complete")
	return nil
}

// Helper methods

func (mas *MonitoringAnalyticsService) processMetrics() {
	for metric := range mas.metricsChannel {
		mas.metricsMutex.Lock()

		// Check if we need to clean up old metrics
		if len(mas.metrics[metric.Type]) >= mas.config.MaxMetricsPerType {
			mas.cleanupOldMetrics(metric.Type)
		}

		mas.metrics[metric.Type] = append(mas.metrics[metric.Type], metric)
		mas.metricsMutex.Unlock()

		// Check for alert conditions
		if mas.config.EnableAlerts {
			mas.checkAlertConditions(metric)
		}
	}
}

func (mas *MonitoringAnalyticsService) processEvents() {
	for event := range mas.eventsChannel {
		mas.eventsMutex.Lock()
		mas.events = append(mas.events, event)
		mas.eventsMutex.Unlock()
	}
}

func (mas *MonitoringAnalyticsService) collectMetrics() {
	for range mas.metricsTicker.C {
		ctx := context.Background()

		// Collect system metrics
		mas.collectSystemMetrics(ctx)
	}
}

func (mas *MonitoringAnalyticsService) performAnalytics() {
	for range mas.analyticsTicker.C {
		ctx := context.Background()

		// Perform analytics calculations
		mas.calculateAnalytics(ctx)
	}
}

func (mas *MonitoringAnalyticsService) flushRoutine() {
	for range mas.flushTicker.C {
		mas.flushMetrics()
		mas.flushEvents()
	}
}

func (mas *MonitoringAnalyticsService) flushMetrics() {
	mas.metricsMutex.Lock()
	defer mas.metricsMutex.Unlock()

	// In a real implementation, this would flush metrics to external systems
	// like Prometheus, InfluxDB, etc.
	mas.logger.WithField("metrics_count", len(mas.metrics)).Debug("Flushing metrics")
}

func (mas *MonitoringAnalyticsService) flushEvents() {
	mas.eventsMutex.Lock()
	defer mas.eventsMutex.Unlock()

	// In a real implementation, this would flush events to analytics systems
	// like Elasticsearch, ClickHouse, etc.
	mas.logger.WithField("events_count", len(mas.events)).Debug("Flushing events")
}

func (mas *MonitoringAnalyticsService) cleanupOldMetrics(metricType MetricType) {
	metrics := mas.metrics[metricType]
	if len(metrics) == 0 {
		return
	}

	cutoff := time.Now().Add(-mas.config.RetentionPeriod)
	var filtered []*Metric

	for _, metric := range metrics {
		if metric.Timestamp.After(cutoff) {
			filtered = append(filtered, metric)
		}
	}

	mas.metrics[metricType] = filtered
}

func (mas *MonitoringAnalyticsService) checkAlertConditions(metric *Metric) {
	// Check various alert conditions based on metric type and value
	switch metric.Type {
	case MetricTypeUpload:
		mas.checkUploadAlerts(metric)
	case MetricTypeStorage:
		mas.checkStorageAlerts(metric)
	case MetricTypePerformance:
		mas.checkPerformanceAlerts(metric)
	case MetricTypeSecurity:
		mas.checkSecurityAlerts(metric)
	}
}

func (mas *MonitoringAnalyticsService) checkUploadAlerts(metric *Metric) {
	// Check upload failure rate
	if metric.Name == "upload_failure_rate" && metric.Value > mas.config.AlertThresholds.UploadFailureRate {
		mas.createAlertIfNeeded("upload_failure_rate", AlertTypeWarning, AlertSeverityMedium,
			metric.TenantID, "High upload failure rate detected",
			fmt.Sprintf("Upload failure rate is %.2f%% (threshold: %.2f%%)", metric.Value, mas.config.AlertThresholds.UploadFailureRate))
	}
}

func (mas *MonitoringAnalyticsService) checkStorageAlerts(metric *Metric) {
	// Check storage utilization
	if metric.Name == "storage_utilization_percent" && metric.Value > mas.config.AlertThresholds.StorageUtilization {
		severity := AlertSeverityMedium
		if metric.Value > 90 {
			severity = AlertSeverityHigh
		}
		if metric.Value > 95 {
			severity = AlertSeverityCritical
		}

		mas.createAlertIfNeeded("storage_utilization", AlertTypeCapacity, severity,
			metric.TenantID, "High storage utilization detected",
			fmt.Sprintf("Storage utilization is %.2f%% (threshold: %.2f%%)", metric.Value, mas.config.AlertThresholds.StorageUtilization))
	}
}

func (mas *MonitoringAnalyticsService) checkPerformanceAlerts(metric *Metric) {
	// Check response time
	if metric.Name == "response_time_p95_ms" && time.Duration(metric.Value)*time.Millisecond > mas.config.AlertThresholds.ResponseTimeP95 {
		mas.createAlertIfNeeded("response_time", AlertTypePerformance, AlertSeverityMedium,
			metric.TenantID, "High response time detected",
			fmt.Sprintf("P95 response time is %.2fms (threshold: %.2fms)", metric.Value, mas.config.AlertThresholds.ResponseTimeP95.Milliseconds()))
	}
}

func (mas *MonitoringAnalyticsService) checkSecurityAlerts(metric *Metric) {
	// Check virus detection rate
	if metric.Name == "virus_detection_rate" && metric.Value > mas.config.AlertThresholds.VirusDetectionRate {
		mas.createAlertIfNeeded("virus_detection", AlertTypeSecurity, AlertSeverityHigh,
			metric.TenantID, "High virus detection rate detected",
			fmt.Sprintf("Virus detection rate is %.2f%% (threshold: %.2f%%)", metric.Value, mas.config.AlertThresholds.VirusDetectionRate))
	}
}

func (mas *MonitoringAnalyticsService) createAlertIfNeeded(key, alertType string, severity AlertSeverity, tenantID uuid.UUID, title, description string) {
	alertKey := fmt.Sprintf("%s:%s", tenantID.String(), key)

	if existing, exists := mas.activeAlerts[alertKey]; exists {
		// Alert already exists, check if we need to update it
		if existing.Severity != severity {
			existing.Severity = severity
			existing.Timestamp = time.Now()
		}
		return
	}

	// Create new alert
	alert := &Alert{
		ID:          uuid.New(),
		Type:        AlertType(alertType),
		Severity:    severity,
		Title:       title,
		Description: description,
		Source:      "monitoring-service",
		Timestamp:   time.Now(),
		TenantID:    tenantID,
		Data: map[string]interface{}{
			"alert_key": key,
		},
		Resolved:     false,
		Acknowledged: false,
	}

	mas.CreateAlert(context.Background(), alert)
}

func (mas *MonitoringAnalyticsService) generateAlertKey(alert *Alert) string {
	return fmt.Sprintf("%s:%s:%s", alert.TenantID.String(), alert.Type, alert.Source)
}

func (mas *MonitoringAnalyticsService) collectSystemMetrics(ctx context.Context) {
	// Collect system-wide metrics
	// In a real implementation, this would collect actual system metrics

	metric := &Metric{
		Type:  MetricTypeSystem,
		Name:  "system_uptime",
		Value: float64(time.Since(time.Now().Truncate(24 * time.Hour)).Seconds()),
		Unit:  "seconds",
		Tags:  map[string]string{"component": "monitoring"},
	}

	mas.RecordMetric(ctx, metric)
}

func (mas *MonitoringAnalyticsService) calculateAnalytics(ctx context.Context) {
	// Perform analytics calculations
	// In a real implementation, this would run various analytics algorithms

	event := &AnalyticsEvent{
		Type: "analytics",
		Name: "periodic_calculation",
		Data: map[string]interface{}{
			"metrics_count": len(mas.metrics),
			"events_count":  len(mas.events),
			"alerts_count":  len(mas.alerts),
		},
	}

	mas.RecordEvent(ctx, event)
}

// Response types

type SystemHealth struct {
	Timestamp time.Time              `json:"timestamp"`
	Status    string                 `json:"status"`
	Metrics   map[string]interface{} `json:"metrics"`
}

type StorageAnalytics struct {
	TenantID     uuid.UUID `json:"tenant_id"`
	Timestamp    time.Time `json:"timestamp"`
	StorageUsage int64     `json:"storage_usage"`
	FileCount    int       `json:"file_count"`
	AvgFileSize  int64     `json:"avg_file_size"`
	UploadRate   float64   `json:"upload_rate"`
	DownloadRate float64   `json:"download_rate"`
	ErrorRate    float64   `json:"error_rate"`
}

type PerformanceMetrics struct {
	Timestamp    time.Time                `json:"timestamp"`
	TimeRange    time.Duration            `json:"time_range"`
	ResponseTime map[string]time.Duration `json:"response_time"`
	Throughput   map[string]float64       `json:"throughput"`
	ErrorRate    map[string]float64       `json:"error_rate"`
	Availability map[string]float64       `json:"availability"`
}
