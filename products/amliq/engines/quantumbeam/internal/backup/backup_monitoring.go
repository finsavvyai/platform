//go:build legacy_migrated
// +build legacy_migrated

package backup

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// BackupMonitoringManager monitors backup systems and provides alerting
type BackupMonitoringManager struct {
	logger       *log.Logger
	config       MonitoringConfig
	collectors   map[string]MetricCollector
	alertManager *AlertManager
	registry     *prometheus.Registry
	mu           sync.RWMutex
}

// MonitoringConfig holds monitoring configuration
type MonitoringConfig struct {
	Enabled                 bool          `json:"enabled"`
	MetricsInterval         time.Duration `json:"metrics_interval"`
	HealthCheckInterval     time.Duration `json:"health_check_interval"`
	AlertingEnabled         bool          `json:"alerting_enabled"`
	PrometheusPort          int           `json:"prometheus_port"`
	StorageUsageThreshold   float64       `json:"storage_usage_threshold"`
	BackupFailureThreshold  int           `json:"backup_failure_threshold"`
	ReplicationLagThreshold time.Duration `json:"replication_lag_threshold"`
	RestoreTestThreshold    time.Duration `json:"restore_test_threshold"`
	NotificationChannels    []string      `json:"notification_channels"`
	EnableDashboard         bool          `json:"enable_dashboard"`
	MetricRetention         time.Duration `json:"metric_retention"`
}

// MetricCollector interface for different metric collectors
type MetricCollector interface {
	Collect(ctx context.Context) (map[string]float64, error)
	GetName() string
	GetType() string
}

// AlertManager manages backup-related alerts
type AlertManager struct {
	logger   *log.Logger
	config   AlertConfig
	rules    map[string]AlertRule
	active   map[string]ActiveAlert
	notifier *NotificationManager
}

// AlertConfig holds alert configuration
type AlertConfig struct {
	Enabled          bool             `json:"enabled"`
	EvaluationPeriod time.Duration    `json:"evaluation_period"`
	CooldownPeriod   time.Duration    `json:"cooldown_period"`
	MaxAlertsPerRule int              `json:"max_alerts_per_rule"`
	SeverityLevels   []string         `json:"severity_levels"`
	DefaultChannels  []string         `json:"default_channels"`
	EscalationPolicy EscalationPolicy `json:"escalation_policy"`
}

// AlertRule defines an alert rule
type AlertRule struct {
	ID              string            `json:"id"`
	Name            string            `json:"name"`
	Description     string            `json:"description"`
	Metric          string            `json:"metric"`
	Condition       string            `json:"condition"` // ">", "<", "=", "!=", "absent"
	Threshold       float64           `json:"threshold"`
	Duration        time.Duration     `json:"duration"`
	Severity        string            `json:"severity"` // "critical", "warning", "info"
	Labels          map[string]string `json:"labels"`
	Annotations     map[string]string `json:"annotations"`
	Enabled         bool              `json:"enabled"`
	Channels        []string          `json:"channels"`
	EscalationSteps []EscalationStep  `json:"escalation_steps"`
}

// ActiveAlert represents an active alert
type ActiveAlert struct {
	ID              string             `json:"id"`
	RuleID          string             `json:"rule_id"`
	Name            string             `json:"name"`
	Status          string             `json:"status"` // "firing", "resolved"
	Severity        string             `json:"severity"`
	StartedAt       time.Time          `json:"started_at"`
	LastEvaluated   time.Time          `json:"last_evaluated"`
	Value           float64            `json:"value"`
	Labels          map[string]string  `json:"labels"`
	Annotations     map[string]string  `json:"annotations"`
	Notifications   []NotificationSent `json:"notifications"`
	EscalationLevel int                `json:"escalation_level"`
}

// NotificationSent represents a sent notification
type NotificationSent struct {
	Channel  string    `json:"channel"`
	SentAt   time.Time `json:"sent_at"`
	Status   string    `json:"status"` // "sent", "failed", "pending"
	Error    string    `json:"error,omitempty"`
	Response string    `json:"response,omitempty"`
}

// EscalationPolicy defines escalation behavior
type EscalationPolicy struct {
	Enabled         bool             `json:"enabled"`
	MaxLevel        int              `json:"max_level"`
	EscalationDelay time.Duration    `json:"escalation_delay"`
	DefaultSteps    []EscalationStep `json:"default_steps"`
}

// EscalationStep defines an escalation step
type EscalationStep struct {
	Level     int           `json:"level"`
	Delay     time.Duration `json:"delay"`
	Channels  []string      `json:"channels"`
	Message   string        `json:"message"`
	Condition string        `json:"condition"`
}

// NotificationManager handles sending notifications
type NotificationManager struct {
	logger   *log.Logger
	channels map[string]NotificationChannel
	config   NotificationConfig
}

// NotificationChannel interface for different notification channels
type NotificationChannel interface {
	Send(ctx context.Context, alert ActiveAlert, message string) error
	GetName() string
	GetType() string
	IsHealthy(ctx context.Context) bool
}

// NotificationConfig holds notification configuration
type NotificationConfig struct {
	Channels    map[string]ChannelConfig `json:"channels"`
	RetryPolicy RetryPolicy              `json:"retry_policy"`
	RateLimit   RateLimit                `json:"rate_limit"`
	Templates   map[string]string        `json:"templates"`
}

// ChannelConfig holds configuration for a notification channel
type ChannelConfig struct {
	Type        string                 `json:"type"` // "slack", "email", "pagerduty", "webhook"
	Enabled     bool                   `json:"enabled"`
	Config      map[string]interface{} `json:"config"`
	RetryPolicy RetryPolicy            `json:"retry_policy"`
	RateLimit   RateLimit              `json:"rate_limit"`
}

// RetryPolicy defines retry behavior
type RetryPolicy struct {
	MaxRetries    int           `json:"max_retries"`
	InitialDelay  time.Duration `json:"initial_delay"`
	MaxDelay      time.Duration `json:"max_delay"`
	BackoffFactor float64       `json:"backoff_factor"`
}

// RateLimit defines rate limiting
type RateLimit struct {
	RequestsPerSecond float64 `json:"requests_per_second"`
	BurstSize         int     `json:"burst_size"`
}

// BackupMetrics represents collected backup metrics
type BackupMetrics struct {
	Timestamp          time.Time                     `json:"timestamp"`
	BackupStatus       map[string]string             `json:"backup_status"`
	BackupSizes        map[string]int64              `json:"backup_sizes"`
	BackupDurations    map[string]time.Duration      `json:"backup_durations"`
	StorageUsage       StorageMetrics                `json:"storage_usage"`
	ReplicationStatus  map[string]ReplicationMetrics `json:"replication_status"`
	RestoreTestResults map[string]RestoreTestMetrics `json:"restore_test_results"`
	SystemHealth       SystemHealthMetrics           `json:"system_health"`
	PerformanceMetrics PerformanceMetrics            `json:"performance_metrics"`
}

// StorageMetrics represents storage-related metrics
type StorageMetrics struct {
	TotalUsed       int64            `json:"total_used"`
	TotalAvailable  int64            `json:"total_available"`
	UsagePercentage float64          `json:"usage_percentage"`
	ByStorageClass  map[string]int64 `json:"by_storage_class"`
	ByLocation      map[string]int64 `json:"by_location"`
	GrowthRate      float64          `json:"growth_rate"`
}

// ReplicationMetrics represents replication-related metrics
type ReplicationMetrics struct {
	Status          string        `json:"status"` // "healthy", "degraded", "failed"
	Lag             time.Duration `json:"lag"`
	SuccessRate     float64       `json:"success_rate"`
	LastReplication time.Time     `json:"last_replication"`
	Errors          int           `json:"errors"`
}

// RestoreTestMetrics represents restore test metrics
type RestoreTestMetrics struct {
	LastTestTime    time.Time     `json:"last_test_time"`
	LastTestStatus  string        `json:"last_test_status"`
	SuccessRate     float64       `json:"success_rate"`
	AverageDuration time.Duration `json:"average_duration"`
	FailureCount    int           `json:"failure_count"`
}

// SystemHealthMetrics represents system health metrics
type SystemHealthMetrics struct {
	OverallHealth   string             `json:"overall_health"` // "healthy", "warning", "critical"
	ComponentHealth map[string]string  `json:"component_health"`
	ResourceUsage   map[string]float64 `json:"resource_usage"`
	ActiveIncidents int                `json:"active_incidents"`
}

// PerformanceMetrics represents performance metrics
type PerformanceMetrics struct {
	AverageBackupSpeed  float64 `json:"average_backup_speed_mb_s"`
	AverageRestoreSpeed float64 `json:"average_restore_speed_mb_s"`
	DatabaseQueryTime   float64 `json:"database_query_time_ms"`
	NetworkLatency      float64 `json:"network_latency_ms"`
	CPUUsage            float64 `json:"cpu_usage_percent"`
	MemoryUsage         float64 `json:"memory_usage_percent"`
}

// NewBackupMonitoringManager creates a new backup monitoring manager
func NewBackupMonitoringManager(config MonitoringConfig) (*BackupMonitoringManager, error) {
	bmm := &BackupMonitoringManager{
		logger:     log.New(log.Writer(), "[BACKUP-MONITOR] ", log.LstdFlags|log.Lmsgprefix),
		config:     config,
		collectors: make(map[string]MetricCollector),
		registry:   prometheus.NewRegistry(),
	}

	// Initialize alert manager
	bmm.alertManager = &AlertManager{
		logger: log.New(log.Writer(), "[ALERT-MANAGER] ", log.LstdFlags|log.Lmsgprefix),
		config: AlertConfig{},
		rules:  make(map[string]AlertRule),
		active: make(map[string]ActiveAlert),
		notifier: &NotificationManager{
			logger:   log.New(log.Writer(), "[NOTIFICATION-MGR] ", log.LstdFlags|log.Lmsgprefix),
			channels: make(map[string]NotificationChannel),
			config:   NotificationConfig{},
		},
	}

	// Create default metric collectors
	bmm.createDefaultCollectors()

	// Create default alert rules
	bmm.createDefaultAlertRules()

	// Start monitoring if enabled
	if config.Enabled {
		go bmm.startMonitoring()
	}

	// Start Prometheus server if port is specified
	if config.PrometheusPort > 0 {
		go bmm.startPrometheusServer()
	}

	return bmm, nil
}

// createDefaultCollectors creates default metric collectors
func (bmm *BackupMonitoringManager) createDefaultCollectors() {
	collectors := []MetricCollector{
		&BackupStatusCollector{},
		&StorageUsageCollector{},
		&ReplicationCollector{},
		&RestoreTestCollector{},
		&SystemHealthCollector{},
		&PerformanceCollector{},
	}

	for _, collector := range collectors {
		bmm.collectors[collector.GetName()] = collector
		bmm.registry.MustRegister(prometheus.NewGaugeFunc(
			prometheus.GaugeOpts{
				Name: fmt.Sprintf("backup_%s", collector.GetName()),
				Help: fmt.Sprintf("Backup %s metrics", collector.GetName()),
			},
			func() float64 {
				metrics, _ := collector.Collect(context.Background())
				if len(metrics) > 0 {
					// Return first metric value for Prometheus gauge
					for _, value := range metrics {
						return value
					}
				}
				return 0
			},
		))
	}

	bmm.logger.Printf("Created %d metric collectors", len(collectors))
}

// createDefaultAlertRules creates default alert rules
func (bmm *BackupMonitoringManager) createDefaultAlertRules() {
	rules := []AlertRule{
		{
			ID:          "backup-failed",
			Name:        "Backup Failed",
			Description: "Alert when a backup fails",
			Metric:      "backup_status",
			Condition:   "!=",
			Threshold:   0, // success status
			Duration:    0, // immediate
			Severity:    "critical",
			Labels: map[string]string{
				"component": "backup",
				"type":      "failure",
			},
			Annotations: map[string]string{
				"summary":     "Backup operation failed",
				"description": "A backup operation has failed and requires immediate attention",
			},
			Enabled:  true,
			Channels: []string{"slack", "email", "pagerduty"},
		},
		{
			ID:          "storage-usage-high",
			Name:        "Storage Usage High",
			Description: "Alert when storage usage exceeds threshold",
			Metric:      "storage_usage_percentage",
			Condition:   ">",
			Threshold:   bmm.config.StorageUsageThreshold,
			Duration:    5 * time.Minute,
			Severity:    "warning",
			Labels: map[string]string{
				"component": "storage",
				"type":      "capacity",
			},
			Annotations: map[string]string{
				"summary":     "Storage usage is high",
				"description": fmt.Sprintf("Storage usage has exceeded %.1f%% threshold", bmm.config.StorageUsageThreshold),
			},
			Enabled:  true,
			Channels: []string{"slack", "email"},
		},
		{
			ID:          "replication-lag-high",
			Name:        "Replication Lag High",
			Description: "Alert when replication lag exceeds threshold",
			Metric:      "replication_lag_seconds",
			Condition:   ">",
			Threshold:   bmm.config.ReplicationLagThreshold.Seconds(),
			Duration:    10 * time.Minute,
			Severity:    "warning",
			Labels: map[string]string{
				"component": "replication",
				"type":      "lag",
			},
			Annotations: map[string]string{
				"summary":     "Replication lag is high",
				"description": fmt.Sprintf("Replication lag has exceeded %v threshold", bmm.config.ReplicationLagThreshold),
			},
			Enabled:  true,
			Channels: []string{"slack"},
		},
		{
			ID:          "restore-test-failed",
			Name:        "Restore Test Failed",
			Description: "Alert when restore test fails",
			Metric:      "restore_test_status",
			Condition:   "!=",
			Threshold:   0, // success status
			Duration:    0, // immediate
			Severity:    "critical",
			Labels: map[string]string{
				"component": "restore",
				"type":      "test_failure",
			},
			Annotations: map[string]string{
				"summary":     "Restore test failed",
				"description": "A restore test has failed, indicating potential backup corruption",
			},
			Enabled:  true,
			Channels: []string{"slack", "email", "pagerduty"},
		},
		{
			ID:          "backup-slow",
			Name:        "Backup Performance Slow",
			Description: "Alert when backup performance is degraded",
			Metric:      "backup_duration_seconds",
			Condition:   ">",
			Threshold:   3600, // 1 hour
			Duration:    15 * time.Minute,
			Severity:    "warning",
			Labels: map[string]string{
				"component": "backup",
				"type":      "performance",
			},
			Annotations: map[string]string{
				"summary":     "Backup performance is degraded",
				"description": "Backup duration has exceeded 1 hour, indicating performance issues",
			},
			Enabled:  true,
			Channels: []string{"slack"},
		},
		{
			ID:          "system-health-critical",
			Name:        "System Health Critical",
			Description: "Alert when system health is critical",
			Metric:      "system_health_score",
			Condition:   "<",
			Threshold:   50, // health score
			Duration:    2 * time.Minute,
			Severity:    "critical",
			Labels: map[string]string{
				"component": "system",
				"type":      "health",
			},
			Annotations: map[string]string{
				"summary":     "System health is critical",
				"description": "Overall system health score has dropped below 50%",
			},
			Enabled:  true,
			Channels: []string{"slack", "email", "pagerduty"},
		},
	}

	for _, rule := range rules {
		bmm.alertManager.rules[rule.ID] = rule
	}

	bmm.logger.Printf("Created %d alert rules", len(rules))
}

// CollectMetrics collects metrics from all collectors
func (bmm *BackupMonitoringManager) CollectMetrics(ctx context.Context) (*BackupMetrics, error) {
	bmm.mu.Lock()
	defer bmm.mu.Unlock()

	metrics := &BackupMetrics{
		Timestamp:          time.Now(),
		BackupStatus:       make(map[string]string),
		BackupSizes:        make(map[string]int64),
		BackupDurations:    make(map[string]time.Duration),
		ReplicationStatus:  make(map[string]ReplicationMetrics),
		RestoreTestResults: make(map[string]RestoreTestMetrics),
		SystemHealth: SystemHealthMetrics{
			ComponentHealth: make(map[string]string),
			ResourceUsage:   make(map[string]float64),
		},
		PerformanceMetrics: PerformanceMetrics{},
	}

	// Collect metrics from each collector
	for name, collector := range bmm.collectors {
		collectorMetrics, err := collector.Collect(ctx)
		if err != nil {
			bmm.logger.Printf("Failed to collect metrics from %s: %v", name, err)
			continue
		}

		// Process collected metrics based on collector type
		switch collector.GetType() {
		case "backup_status":
			bmm.processBackupStatusMetrics(metrics, collectorMetrics)
		case "storage_usage":
			bmm.processStorageUsageMetrics(metrics, collectorMetrics)
		case "replication":
			bmm.processReplicationMetrics(metrics, collectorMetrics)
		case "restore_test":
			bmm.processRestoreTestMetrics(metrics, collectorMetrics)
		case "system_health":
			bmm.processSystemHealthMetrics(metrics, collectorMetrics)
		case "performance":
			bmm.processPerformanceMetrics(metrics, collectorMetrics)
		}
	}

	return metrics, nil
}

// Process metrics from different collectors
func (bmm *BackupMonitoringManager) processBackupStatusMetrics(metrics *BackupMetrics, collectorMetrics map[string]float64) {
	for key, value := range collectorMetrics {
		if strings.HasSuffix(key, "_status") {
			backupName := strings.TrimSuffix(key, "_status")
			status := "unknown"
			if value == 1 {
				status = "success"
			} else if value == 0 {
				status = "failed"
			}
			metrics.BackupStatus[backupName] = status
		} else if strings.HasSuffix(key, "_size_bytes") {
			backupName := strings.TrimSuffix(key, "_size_bytes")
			metrics.BackupSizes[backupName] = int64(value)
		} else if strings.HasSuffix(key, "_duration_seconds") {
			backupName := strings.TrimSuffix(key, "_duration_seconds")
			metrics.BackupDurations[backupName] = time.Duration(value) * time.Second
		}
	}
}

func (bmm *BackupMonitoringManager) processStorageUsageMetrics(metrics *BackupMetrics, collectorMetrics map[string]float64) {
	storageMetrics := StorageMetrics{
		ByStorageClass: make(map[string]int64),
		ByLocation:     make(map[string]int64),
	}

	for key, value := range collectorMetrics {
		switch key {
		case "total_used_bytes":
			storageMetrics.TotalUsed = int64(value)
		case "total_available_bytes":
			storageMetrics.TotalAvailable = int64(value)
		case "usage_percentage":
			storageMetrics.UsagePercentage = value
		case "growth_rate_percent":
			storageMetrics.GrowthRate = value
		default:
			if strings.HasPrefix(key, "storage_class_") {
				className := strings.TrimPrefix(key, "storage_class_")
				storageMetrics.ByStorageClass[className] = int64(value)
			} else if strings.HasPrefix(key, "location_") {
				location := strings.TrimPrefix(key, "location_")
				storageMetrics.ByLocation[location] = int64(value)
			}
		}
	}

	metrics.StorageUsage = storageMetrics
}

func (bmm *BackupMonitoringManager) processReplicationMetrics(metrics *BackupMetrics, collectorMetrics map[string]float64) {
	for key, value := range collectorMetrics {
		if strings.HasPrefix(key, "replication_") {
			parts := strings.SplitN(key, "_", 3)
			if len(parts) >= 3 {
				region := parts[1]
				metric := parts[2]

				if _, exists := metrics.ReplicationStatus[region]; !exists {
					metrics.ReplicationStatus[region] = ReplicationMetrics{}
				}

				switch metric {
				case "lag_seconds":
					metrics.ReplicationStatus[region].Lag = time.Duration(value) * time.Second
				case "success_rate":
					metrics.ReplicationStatus[region].SuccessRate = value
				case "errors":
					metrics.ReplicationStatus[region].Errors = int(value)
				case "status":
					if value == 1 {
						metrics.ReplicationStatus[region].Status = "healthy"
					} else if value == 0.5 {
						metrics.ReplicationStatus[region].Status = "degraded"
					} else {
						metrics.ReplicationStatus[region].Status = "failed"
					}
				}
			}
		}
	}
}

func (bmm *BackupMonitoringManager) processRestoreTestMetrics(metrics *BackupMetrics, collectorMetrics map[string]float64) {
	for key, value := range collectorMetrics {
		if strings.HasPrefix(key, "restore_test_") {
			metric := strings.TrimPrefix(key, "restore_test_")

			switch metric {
			case "last_status":
				if value == 1 {
					metrics.RestoreTestResults["default"].LastTestStatus = "success"
				} else {
					metrics.RestoreTestResults["default"].LastTestStatus = "failed"
				}
			case "success_rate":
				metrics.RestoreTestResults["default"].SuccessRate = value
			case "average_duration_seconds":
				metrics.RestoreTestResults["default"].AverageDuration = time.Duration(value) * time.Second
			case "failure_count":
				metrics.RestoreTestResults["default"].FailureCount = int(value)
			}
		}
	}
}

func (bmm *BackupMonitoringManager) processSystemHealthMetrics(metrics *BackupMetrics, collectorMetrics map[string]float64) {
	healthMetrics := SystemHealthMetrics{
		ComponentHealth: make(map[string]string),
		ResourceUsage:   make(map[string]float64),
	}

	for key, value := range collectorMetrics {
		if strings.HasPrefix(key, "component_") {
			component := strings.TrimPrefix(key, "component_")
			if value >= 0.8 {
				healthMetrics.ComponentHealth[component] = "healthy"
			} else if value >= 0.5 {
				healthMetrics.ComponentHealth[component] = "warning"
			} else {
				healthMetrics.ComponentHealth[component] = "critical"
			}
		} else if strings.HasPrefix(key, "resource_") {
			resource := strings.TrimPrefix(key, "resource_")
			healthMetrics.ResourceUsage[resource] = value
		} else if key == "overall_health_score" {
			if value >= 0.8 {
				healthMetrics.OverallHealth = "healthy"
			} else if value >= 0.5 {
				healthMetrics.OverallHealth = "warning"
			} else {
				healthMetrics.OverallHealth = "critical"
			}
		} else if key == "active_incidents" {
			healthMetrics.ActiveIncidents = int(value)
		}
	}

	metrics.SystemHealth = healthMetrics
}

func (bmm *BackupMonitoringManager) processPerformanceMetrics(metrics *BackupMetrics, collectorMetrics map[string]float64) {
	perfMetrics := PerformanceMetrics{}

	for key, value := range collectorMetrics {
		switch key {
		case "backup_speed_mb_s":
			perfMetrics.AverageBackupSpeed = value
		case "restore_speed_mb_s":
			perfMetrics.AverageRestoreSpeed = value
		case "database_query_time_ms":
			perfMetrics.DatabaseQueryTime = value
		case "network_latency_ms":
			perfMetrics.NetworkLatency = value
		case "cpu_usage_percent":
			perfMetrics.CPUUsage = value
		case "memory_usage_percent":
			perfMetrics.MemoryUsage = value
		}
	}

	metrics.PerformanceMetrics = perfMetrics
}

// startMonitoring starts the monitoring loop
func (bmm *BackupMonitoringManager) startMonitoring() {
	ticker := time.NewTicker(bmm.config.MetricsInterval)
	defer ticker.Stop()

	for range ticker.C {
		ctx := context.Background()

		// Collect metrics
		metrics, err := bmm.CollectMetrics(ctx)
		if err != nil {
			bmm.logger.Printf("Failed to collect metrics: %v", err)
			continue
		}

		// Evaluate alert rules
		if bmm.config.AlertingEnabled {
			bmm.evaluateAlertRules(ctx, metrics)
		}

		// Store metrics (implementation would store in time series database)
		bmm.storeMetrics(metrics)
	}
}

// evaluateAlertRules evaluates all alert rules against current metrics
func (bmm *BackupMonitoringManager) evaluateAlertRules(ctx context.Context, metrics *BackupMetrics) {
	for _, rule := range bmm.alertManager.rules {
		if !rule.Enabled {
			continue
		}

		// Get metric value
		value := bmm.getMetricValue(metrics, rule.Metric)
		if value == nil {
			// Metric not found, check for absent condition
			if rule.Condition == "absent" {
				bmm.triggerAlert(ctx, rule, 0, metrics)
			}
			continue
		}

		// Evaluate condition
		shouldAlert := bmm.evaluateCondition(*value, rule.Condition, rule.Threshold)
		if shouldAlert {
			bmm.triggerAlert(ctx, rule, *value, metrics)
		} else {
			bmm.resolveAlert(ctx, rule.ID)
		}
	}
}

// getMetricValue extracts metric value from metrics struct
func (bmm *BackupMonitoringManager) getMetricValue(metrics *BackupMetrics, metricName string) *float64 {
	switch metricName {
	case "storage_usage_percentage":
		return &metrics.StorageUsage.UsagePercentage
	case "system_health_score":
		score := 0.0
		switch metrics.SystemHealth.OverallHealth {
		case "healthy":
			score = 100.0
		case "warning":
			score = 75.0
		case "critical":
			score = 25.0
		}
		return &score
	default:
		// Check other metrics
		return nil
	}
}

// evaluateCondition evaluates alert condition
func (bmm *BackupMonitoringManager) evaluateCondition(value float64, condition string, threshold float64) bool {
	switch condition {
	case ">":
		return value > threshold
	case "<":
		return value < threshold
	case "=":
		return value == threshold
	case "!=":
		return value != threshold
	case ">=":
		return value >= threshold
	case "<=":
		return value <= threshold
	default:
		return false
	}
}

// triggerAlert triggers an alert
func (bmm *BackupMonitoringManager) triggerAlert(ctx context.Context, rule AlertRule, value float64, metrics *BackupMetrics) {
	alertID := fmt.Sprintf("%s-%d", rule.ID, time.Now().Unix())

	// Check if alert is already active
	if _, exists := bmm.alertManager.active[rule.ID]; exists {
		return
	}

	// Create active alert
	alert := ActiveAlert{
		ID:            alertID,
		RuleID:        rule.ID,
		Name:          rule.Name,
		Status:        "firing",
		Severity:      rule.Severity,
		StartedAt:     time.Now(),
		LastEvaluated: time.Now(),
		Value:         value,
		Labels:        rule.Labels,
		Annotations:   rule.Annotations,
		Notifications: []NotificationSent{},
	}

	bmm.alertManager.active[rule.ID] = alert

	// Send notifications
	bmm.sendAlertNotifications(ctx, alert, rule)

	bmm.logger.Printf("Alert triggered: %s (value: %.2f)", rule.Name, value)
}

// resolveAlert resolves an alert
func (bmm *BackupMonitoringManager) resolveAlert(ctx context.Context, ruleID string) {
	if alert, exists := bmm.alertManager.active[ruleID]; exists {
		alert.Status = "resolved"
		delete(bmm.alertManager.active, ruleID)

		// Send resolved notification
		bmm.sendResolvedNotifications(ctx, alert)

		bmm.logger.Printf("Alert resolved: %s", alert.Name)
	}
}

// sendAlertNotifications sends alert notifications
func (bmm *BackupMonitoringManager) sendAlertNotifications(ctx context.Context, alert ActiveAlert, rule AlertRule) {
	channels := rule.Channels
	if len(channels) == 0 {
		channels = bmm.alertManager.config.DefaultChannels
	}

	message := bmm.formatAlertMessage(alert, rule)

	for _, channelName := range channels {
		if channel, exists := bmm.alertManager.notifier.channels[channelName]; exists {
			if err := channel.Send(ctx, alert, message); err != nil {
				bmm.logger.Printf("Failed to send alert to %s: %v", channelName, err)
			}
		}
	}
}

// sendResolvedNotifications sends resolved notifications
func (bmm *BackupMonitoringManager) sendResolvedNotifications(ctx context.Context, alert ActiveAlert) {
	message := fmt.Sprintf("✅ Resolved: %s", alert.Name)

	// Send to same channels as original alert
	for _, notification := range alert.Notifications {
		if channel, exists := bmm.alertManager.notifier.channels[notification.Channel]; exists {
			if err := channel.Send(ctx, alert, message); err != nil {
				bmm.logger.Printf("Failed to send resolved notification to %s: %v", notification.Channel, err)
			}
		}
	}
}

// formatAlertMessage formats alert message
func (bmm *BackupMonitoringManager) formatAlertMessage(alert ActiveAlert, rule AlertRule) string {
	severityEmoji := map[string]string{
		"critical": "🔴",
		"warning":  "🟡",
		"info":     "🔵",
	}

	emoji := severityEmoji[alert.Severity]
	message := fmt.Sprintf("%s **%s**\n\n", emoji, alert.Name)
	message += fmt.Sprintf("**Severity:** %s\n", alert.Severity)
	message += fmt.Sprintf("**Value:** %.2f\n", alert.Value)

	if description, exists := alert.Annotations["description"]; exists {
		message += fmt.Sprintf("**Description:** %s\n", description)
	}

	message += fmt.Sprintf("**Started:** %s\n", alert.StartedAt.Format(time.RFC3339))

	return message
}

// storeMetrics stores metrics (implementation would store in time series database)
func (bmm *BackupMonitoringManager) storeMetrics(metrics *BackupMetrics) {
	// Implementation would store metrics in Prometheus, InfluxDB, etc.
	bmm.logger.Printf("Stored metrics at %s", metrics.Timestamp.Format(time.RFC3339))
}

// startPrometheusServer starts the Prometheus metrics server
func (bmm *BackupMonitoringManager) startPrometheusServer() {
	http.Handle("/metrics", promhttp.HandlerFor(bmm.registry, promhttp.HandlerOpts{}))

	addr := fmt.Sprintf(":%d", bmm.config.PrometheusPort)
	bmm.logger.Printf("Starting Prometheus metrics server on %s", addr)

	if err := http.ListenAndServe(addr, nil); err != nil {
		bmm.logger.Printf("Prometheus server failed: %v", err)
	}
}

// GetMetricsHandler returns HTTP handler for metrics
func (bmm *BackupMonitoringManager) GetMetricsHandler() http.Handler {
	return promhttp.HandlerFor(bmm.registry, promhttp.HandlerOpts{})
}

// GetActiveAlerts returns currently active alerts
func (bmm *BackupMonitoringManager) GetActiveAlerts() []ActiveAlert {
	bmm.mu.RLock()
	defer bmm.mu.RUnlock()

	var alerts []ActiveAlert
	for _, alert := range bmm.alertManager.active {
		alerts = append(alerts, alert)
	}

	return alerts
}

// Concrete implementations of MetricCollector interfaces

type BackupStatusCollector struct{}

func (bsc *BackupStatusCollector) Collect(ctx context.Context) (map[string]float64, error) {
	// Implementation would check backup status
	return map[string]float64{
		"database_backup_status": 1, // success
		"files_backup_status":    1, // success
		"config_backup_status":   1, // success
	}, nil
}

func (bsc *BackupStatusCollector) GetName() string { return "backup_status" }
func (bsc *BackupStatusCollector) GetType() string { return "backup_status" }

type StorageUsageCollector struct{}

func (suc *StorageUsageCollector) Collect(ctx context.Context) (map[string]float64, error) {
	// Implementation would check storage usage
	return map[string]float64{
		"total_used_bytes":      1024 * 1024 * 1024 * 500, // 500GB
		"total_available_bytes": 1024 * 1024 * 1024 * 500, // 500GB
		"usage_percentage":      50.0,
		"growth_rate_percent":   5.0,
	}, nil
}

func (suc *StorageUsageCollector) GetName() string { return "storage_usage" }
func (suc *StorageUsageCollector) GetType() string { return "storage_usage" }

type ReplicationCollector struct{}

func (rc *ReplicationCollector) Collect(ctx context.Context) (map[string]float64, error) {
	// Implementation would check replication status
	return map[string]float64{
		"replication_us_west_2_lag_seconds":  300, // 5 minutes
		"replication_us_west_2_success_rate": 95.0,
		"replication_us_west_2_status":       1, // healthy
	}, nil
}

func (rc *ReplicationCollector) GetName() string { return "replication" }
func (rc *ReplicationCollector) GetType() string { return "replication" }

type RestoreTestCollector struct{}

func (rtc *RestoreTestCollector) Collect(ctx context.Context) (map[string]float64, error) {
	// Implementation would check restore test results
	return map[string]float64{
		"restore_test_last_status":              1, // success
		"restore_test_success_rate":             95.0,
		"restore_test_average_duration_seconds": 1800, // 30 minutes
		"restore_test_failure_count":            1,
	}, nil
}

func (rtc *RestoreTestCollector) GetName() string { return "restore_test" }
func (rtc *RestoreTestCollector) GetType() string { return "restore_test" }

type SystemHealthCollector struct{}

func (shc *SystemHealthCollector) Collect(ctx context.Context) (map[string]float64, error) {
	// Implementation would check system health
	return map[string]float64{
		"overall_health_score": 85.0,
		"component_database":   0.9,
		"component_storage":    0.8,
		"component_network":    0.95,
		"resource_cpu":         60.0,
		"resource_memory":      70.0,
		"active_incidents":     0,
	}, nil
}

func (shc *SystemHealthCollector) GetName() string { return "system_health" }
func (shc *SystemHealthCollector) GetType() string { return "system_health" }

type PerformanceCollector struct{}

func (pc *PerformanceCollector) Collect(ctx context.Context) (map[string]float64, error) {
	// Implementation would collect performance metrics
	return map[string]float64{
		"backup_speed_mb_s":      10.5,
		"restore_speed_mb_s":     15.2,
		"database_query_time_ms": 50.0,
		"network_latency_ms":     25.0,
		"cpu_usage_percent":      60.0,
		"memory_usage_percent":   70.0,
	}, nil
}

func (pc *PerformanceCollector) GetName() string { return "performance" }
func (pc *PerformanceCollector) GetType() string { return "performance" }