package services

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/tests/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap/zaptest"
)

// TestAlertingService_CreateAlertRule tests alert rule creation
func TestAlertingService_CreateAlertRule(t *testing.T) {
	logger := zaptest.NewLogger(t)

	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	metricsStorage := mocks.NewMockMetricsStorage()
	wsManager := mocks.NewMockWebSocketManager()

	service := NewAlertingService(
		logger,
		alertManager,
		alertRuleManager,
		notificationManager,
		metricsStorage,
		wsManager,
	)

	ctx := context.Background()
	rule := &domain.AlertRule{
		ID:          "test-rule-1",
		Name:        "High CPU Usage",
		Description: "Alert when CPU usage exceeds 80%",
		MetricName:  "cpu_usage_percent",
		Condition:   "gt",
		Threshold:   80.0,
		Duration:    5 * time.Minute,
		Severity:    domain.AlertSeverityHigh,
		Labels:      map[string]string{"environment": "production"},
		Annotations: map[string]string{"summary": "CPU usage is high"},
		Enabled:     true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	err := service.CreateAlertRule(ctx, rule)
	require.NoError(t, err)

	// Verify rule was stored
	retrievedRule, err := alertRuleManager.GetRule(ctx, rule.ID)
	require.NoError(t, err)
	assert.Equal(t, rule.ID, retrievedRule.ID)
	assert.Equal(t, rule.Name, retrievedRule.Name)
	assert.Equal(t, rule.MetricName, retrievedRule.MetricName)
}

// TestAlertingService_UpdateAlertRule tests alert rule updates
func TestAlertingService_UpdateAlertRule(t *testing.T) {
	logger := zaptest.NewLogger(t)

	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	metricsStorage := mocks.NewMockMetricsStorage()
	wsManager := mocks.NewMockWebSocketManager()

	service := NewAlertingService(
		logger,
		alertManager,
		alertRuleManager,
		notificationManager,
		metricsStorage,
		wsManager,
	)

	ctx := context.Background()

	// Create initial rule
	rule := &domain.AlertRule{
		ID:          "test-rule-1",
		Name:        "High CPU Usage",
		Description: "Alert when CPU usage exceeds 80%",
		MetricName:  "cpu_usage_percent",
		Condition:   "gt",
		Threshold:   80.0,
		Duration:    5 * time.Minute,
		Severity:    domain.AlertSeverityHigh,
		Enabled:     true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	err := service.CreateAlertRule(ctx, rule)
	require.NoError(t, err)

	// Update rule
	rule.Threshold = 85.0
	rule.Description = "Alert when CPU usage exceeds 85%"
	rule.Severity = domain.AlertSeverityCritical

	err = service.UpdateAlertRule(ctx, rule)
	require.NoError(t, err)

	// Verify rule was updated
	retrievedRule, err := alertRuleManager.GetRule(ctx, rule.ID)
	require.NoError(t, err)
	assert.Equal(t, 85.0, retrievedRule.Threshold)
	assert.Equal(t, domain.AlertSeverityCritical, retrievedRule.Severity)
}

// TestAlertingService_DeleteAlertRule tests alert rule deletion
func TestAlertingService_DeleteAlertRule(t *testing.T) {
	logger := zaptest.NewLogger(t)

	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	metricsStorage := mocks.NewMockMetricsStorage()
	wsManager := mocks.NewMockWebSocketManager()

	service := NewAlertingService(
		logger,
		alertManager,
		alertRuleManager,
		notificationManager,
		metricsStorage,
		wsManager,
	)

	ctx := context.Background()

	// Create rule first
	rule := &domain.AlertRule{
		ID:          "test-rule-1",
		Name:        "High CPU Usage",
		MetricName:  "cpu_usage_percent",
		Condition:   "gt",
		Threshold:   80.0,
		Duration:    5 * time.Minute,
		Severity:    domain.AlertSeverityHigh,
		Enabled:     true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	err := service.CreateAlertRule(ctx, rule)
	require.NoError(t, err)

	// Delete rule
	err = service.DeleteAlertRule(ctx, rule.ID)
	require.NoError(t, err)

	// Verify rule was deleted
	_, err = alertRuleManager.GetRule(ctx, rule.ID)
	assert.Error(t, err)
}

// TestAlertingService_EvaluateRules tests rule evaluation
func TestAlertingService_EvaluateRules(t *testing.T) {
	logger := zaptest.NewLogger(t)

	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	metricsStorage := mocks.NewMockMetricsStorage()
	wsManager := mocks.NewMockWebSocketManager()

	service := NewAlertingService(
		logger,
		alertManager,
		alertRuleManager,
		notificationManager,
		metricsStorage,
		wsManager,
	)

	ctx := context.Background()

	// Store test metric
	metric := &domain.Metric{
		ID:      "test-metric-1",
		Name:    "cpu_usage_percent",
		Type:    domain.MetricTypeGauge,
		Value:   85.0, // Above threshold
		Labels:  map[string]string{"host": "test-host"},
		Timestamp: time.Now(),
	}

	err := metricsStorage.Store(ctx, metric)
	require.NoError(t, err)

	// Create rule that should fire
	rule := &domain.AlertRule{
		ID:          "test-rule-1",
		Name:        "High CPU Usage",
		Description: "Alert when CPU usage exceeds 80%",
		MetricName:  "cpu_usage_percent",
		Condition:   "gt",
		Threshold:   80.0,
		Duration:    5 * time.Minute,
		Severity:    domain.AlertSeverityHigh,
		Enabled:     true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	err = service.CreateAlertRule(ctx, rule)
	require.NoError(t, err)

	// Evaluate rules
	alerts, err := service.EvaluateRules(ctx)
	require.NoError(t, err)

	// Should create an alert
	assert.NotEmpty(t, alerts)
	assert.Equal(t, domain.AlertSeverityHigh, alerts[0].Severity)
}

// TestAlertingService_GetAlerts tests alert retrieval
func TestAlertingService_GetAlerts(t *testing.T) {
	logger := zaptest.NewLogger(t)

	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	metricsStorage := mocks.NewMockMetricsStorage()
	wsManager := mocks.NewMockWebSocketManager()

	service := NewAlertingService(
		logger,
		alertManager,
		alertRuleManager,
		notificationManager,
		metricsStorage,
		wsManager,
	)

	ctx := context.Background()

	// Create test alert
	alert := &domain.Alert{
		ID:          "test-alert-1",
		Name:        "High CPU Usage",
		Description: "CPU usage is above 80%",
		Severity:    domain.AlertSeverityHigh,
		Status:      domain.AlertStatusActive,
		Source:      "test-rule-1",
		Condition:   "gt",
		Threshold:   80.0,
		CurrentValue: 85.0,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	err := alertManager.CreateAlert(ctx, alert)
	require.NoError(t, err)

	// Test getting all alerts
	alerts, err := service.GetAlerts(ctx, ports.AlertFilters{})
	require.NoError(t, err)
	assert.NotEmpty(t, alerts)

	// Test filtering by severity
	filters := ports.AlertFilters{
		Severity: []domain.AlertSeverity{domain.AlertSeverityHigh},
	}
	alerts, err = service.GetAlerts(ctx, filters)
	require.NoError(t, err)
	assert.NotEmpty(t, alerts)
	for _, alert := range alerts {
		assert.Equal(t, domain.AlertSeverityHigh, alert.Severity)
	}

	// Test filtering by status
	filters = ports.AlertFilters{
		Status: []domain.AlertStatus{domain.AlertStatusActive},
	}
	alerts, err = service.GetAlerts(ctx, filters)
	require.NoError(t, err)
	assert.NotEmpty(t, alerts)
	for _, alert := range alerts {
		assert.Equal(t, domain.AlertStatusActive, alert.Status)
	}
}

// TestAlertingService_AcknowledgeAlert tests alert acknowledgment
func TestAlertingService_AcknowledgeAlert(t *testing.T) {
	logger := zaptest.NewLogger(t)

	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	metricsStorage := mocks.NewMockMetricsStorage()
	wsManager := mocks.NewMockWebSocketManager()

	service := NewAlertingService(
		logger,
		alertManager,
		alertRuleManager,
		notificationManager,
		metricsStorage,
		wsManager,
	)

	ctx := context.Background()

	// Create test alert
	alert := &domain.Alert{
		ID:          "test-alert-1",
		Name:        "High CPU Usage",
		Description: "CPU usage is above 80%",
		Severity:    domain.AlertSeverityHigh,
		Status:      domain.AlertStatusActive,
		Source:      "test-rule-1",
		Condition:   "gt",
		Threshold:   80.0,
		CurrentValue: 85.0,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	err := alertManager.CreateAlert(ctx, alert)
	require.NoError(t, err)

	// Acknowledge alert
	err = service.AcknowledgeAlert(ctx, alert.ID, "test-user")
	require.NoError(t, err)

	// Verify acknowledgment was added
	retrievedAlert, err := alertManager.GetAlert(ctx, alert.ID)
	require.NoError(t, err)
	assert.Contains(t, retrievedAlert.Annotations, "acknowledged_by")
	assert.Equal(t, "test-user", retrievedAlert.Annotations["acknowledged_by"])
	assert.Contains(t, retrievedAlert.Annotations, "acknowledged_at")
}

// TestAlertingService_SilenceAlert tests alert silencing
func TestAlertingService_SilenceAlert(t *testing.T) {
	logger := zaptest.NewLogger(t)

	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	metricsStorage := mocks.NewMockMetricsStorage()
	wsManager := mocks.NewMockWebSocketManager()

	service := NewAlertingService(
		logger,
		alertManager,
		alertRuleManager,
		notificationManager,
		metricsStorage,
		wsManager,
	)

	ctx := context.Background()

	// Create test alert
	alert := &domain.Alert{
		ID:          "test-alert-1",
		Name:        "High CPU Usage",
		Description: "CPU usage is above 80%",
		Severity:    domain.AlertSeverityHigh,
		Status:      domain.AlertStatusActive,
		Source:      "test-rule-1",
		Condition:   "gt",
		Threshold:   80.0,
		CurrentValue: 85.0,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	err := alertManager.CreateAlert(ctx, alert)
	require.NoError(t, err)

	// Silence alert for 1 hour
	duration := 1 * time.Hour
	err = service.SilenceAlert(ctx, alert.ID, duration, "test-user")
	require.NoError(t, err)

	// Verify silencing was applied
	retrievedAlert, err := alertManager.GetAlert(ctx, alert.ID)
	require.NoError(t, err)
	assert.Equal(t, domain.AlertStatusSilenced, retrievedAlert.Status)
	assert.NotNil(t, retrievedAlert.SilencedUntil)
	assert.Contains(t, retrievedAlert.Annotations, "silenced_by")
	assert.Equal(t, "test-user", retrievedAlert.Annotations["silenced_by"])
}

// TestAlertingService_ResolveAlert tests alert resolution
func TestAlertingService_ResolveAlert(t *testing.T) {
	logger := zaptest.NewLogger(t)

	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	metricsStorage := mocks.NewMockMetricsStorage()
	wsManager := mocks.NewMockWebSocketManager()

	service := NewAlertingService(
		logger,
		alertManager,
		alertRuleManager,
		notificationManager,
		metricsStorage,
		wsManager,
	)

	ctx := context.Background()

	// Create test alert
	alert := &domain.Alert{
		ID:          "test-alert-1",
		Name:        "High CPU Usage",
		Description: "CPU usage is above 80%",
		Severity:    domain.AlertSeverityHigh,
		Status:      domain.AlertStatusActive,
		Source:      "test-rule-1",
		Condition:   "gt",
		Threshold:   80.0,
		CurrentValue: 85.0,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	err := alertManager.CreateAlert(ctx, alert)
	require.NoError(t, err)

	// Resolve alert
	err = service.ResolveAlert(ctx, alert.ID, "test-user")
	require.NoError(t, err)

	// Verify resolution was applied
	retrievedAlert, err := alertManager.GetAlert(ctx, alert.ID)
	require.NoError(t, err)
	assert.Equal(t, domain.AlertStatusResolved, retrievedAlert.Status)
	assert.NotNil(t, retrievedAlert.ResolvedAt)
	assert.Contains(t, retrievedAlert.Annotations, "resolved_by")
	assert.Equal(t, "test-user", retrievedAlert.Annotations["resolved_by"])

	// Verify resolution notification was sent
	history, err := notificationManager.GetNotificationHistory(ctx, ports.NotificationFilters{})
	require.NoError(t, err)
	assert.NotEmpty(t, history)
	assert.Equal(t, "alert_resolved", history[len(history)-1].Type)
}

// TestAlertingService_TestAlertRule tests alert rule evaluation without creating alerts
func TestAlertingService_TestAlertRule(t *testing.T) {
	logger := zaptest.NewLogger(t)

	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	metricsStorage := mocks.NewMockMetricsStorage()
	wsManager := mocks.NewMockWebSocketManager()

	service := NewAlertingService(
		logger,
		alertManager,
		alertRuleManager,
		notificationManager,
		metricsStorage,
		wsManager,
	)

	ctx := context.Background()

	// Store test metric
	metric := &domain.Metric{
		ID:      "test-metric-1",
		Name:    "cpu_usage_percent",
		Type:    domain.MetricTypeGauge,
		Value:   85.0, // Above threshold
		Labels:  map[string]string{"host": "test-host"},
		Timestamp: time.Now(),
	}

	err := metricsStorage.Store(ctx, metric)
	require.NoError(t, err)

	// Create rule to test
	rule := &domain.AlertRule{
		ID:          "test-rule-1",
		Name:        "High CPU Usage",
		Description: "Alert when CPU usage exceeds 80%",
		MetricName:  "cpu_usage_percent",
		Condition:   "gt",
		Threshold:   80.0,
		Duration:    5 * time.Minute,
		Severity:    domain.AlertSeverityHigh,
		Enabled:     true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Test the rule
	alert, err := service.TestAlertRule(ctx, rule)
	require.NoError(t, err)
	assert.NotNil(t, alert)
	assert.Equal(t, rule.Name, alert.Name)
	assert.Equal(t, 85.0, alert.CurrentValue)
}

// TestAlertingService_InvalidAlertRule tests validation of invalid alert rules
func TestAlertingService_InvalidAlertRule(t *testing.T) {
	logger := zaptest.NewLogger(t)

	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	metricsStorage := mocks.NewMockMetricsStorage()
	wsManager := mocks.NewMockWebSocketManager()

	service := NewAlertingService(
		logger,
		alertManager,
		alertRuleManager,
		notificationManager,
		metricsStorage,
		wsManager,
	)

	ctx := context.Background()

	// Test rule with missing name
	rule := &domain.AlertRule{
		ID:          "test-rule-1",
		MetricName:  "cpu_usage_percent",
		Condition:   "gt",
		Threshold:   80.0,
		Duration:    5 * time.Minute,
		Enabled:     true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	err := service.CreateAlertRule(ctx, rule)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "rule name is required")

	// Test rule with missing metric name
	rule.Name = "High CPU Usage"
	rule.MetricName = ""

	err = service.CreateAlertRule(ctx, rule)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "metric name is required")

	// Test rule with missing condition
	rule.MetricName = "cpu_usage_percent"
	rule.Condition = ""

	err = service.CreateAlertRule(ctx, rule)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "condition is required")

	// Test rule with missing threshold
	rule.Condition = "gt"
	rule.Threshold = 0

	err = service.CreateAlertRule(ctx, rule)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "threshold is required")

	// Test rule with missing duration
	rule.Threshold = 80.0
	rule.Duration = 0

	err = service.CreateAlertRule(ctx, rule)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "duration is required")
}

// TestAlertingService_StartStop tests service lifecycle
func TestAlertingService_StartStop(t *testing.T) {
	logger := zaptest.NewLogger(t)

	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	metricsStorage := mocks.NewMockMetricsStorage()
	wsManager := mocks.NewMockWebSocketManager()

	service := NewAlertingService(
		logger,
		alertManager,
		alertRuleManager,
		notificationManager,
		metricsStorage,
		wsManager,
	)

	ctx := context.Background()

	// Test start
	err := service.Start(ctx)
	require.NoError(t, err)

	// Test stop
	err = service.Stop(ctx)
	require.NoError(t, err)
}

// TestAlertingService_DisabledConfiguration tests service behavior when disabled
func TestAlertingService_DisabledConfiguration(t *testing.T) {
	logger := zaptest.NewLogger(t)

	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	metricsStorage := mocks.NewMockMetricsStorage()
	wsManager := mocks.NewMockWebSocketManager()

	service := NewAlertingService(
		logger,
		alertManager,
		alertRuleManager,
		notificationManager,
		metricsStorage,
		wsManager,
	)

	ctx := context.Background()

	// Disable service
	service.config.Enabled = false

	err := service.Start(ctx)
	require.NoError(t, err)

	// Rule creation should still work but not trigger evaluation
	rule := &domain.AlertRule{
		ID:          "test-rule-1",
		Name:        "High CPU Usage",
		MetricName:  "cpu_usage_percent",
		Condition:   "gt",
		Threshold:   80.0,
		Duration:    5 * time.Minute,
		Severity:    domain.AlertSeverityHigh,
		Enabled:     true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	err = service.CreateAlertRule(ctx, rule)
	require.NoError(t, err)

	err = service.Stop(ctx)
	require.NoError(t, err)
}

// Benchmark tests
func BenchmarkAlertingService_EvaluateRules(b *testing.B) {
	logger := zaptest.NewLogger(b)

	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	metricsStorage := mocks.NewMockMetricsStorage()
	wsManager := mocks.NewMockWebSocketManager()

	service := NewAlertingService(
		logger,
		alertManager,
		alertRuleManager,
		notificationManager,
		metricsStorage,
		wsManager,
	)

	ctx := context.Background()

	// Store test metric
	metric := &domain.Metric{
		ID:      "test-metric-1",
		Name:    "cpu_usage_percent",
		Type:    domain.MetricTypeGauge,
		Value:   85.0,
		Timestamp: time.Now(),
	}

	metricsStorage.Store(ctx, metric)

	// Create rules
	for i := 0; i < 10; i++ {
		rule := &domain.AlertRule{
			ID:         fmt.Sprintf("test-rule-%d", i),
			Name:       fmt.Sprintf("High CPU Usage %d", i),
			MetricName: "cpu_usage_percent",
			Condition:  "gt",
			Threshold:  float64(80 + i),
			Duration:   5 * time.Minute,
			Severity:   domain.AlertSeverityHigh,
			Enabled:    true,
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		}
		service.CreateAlertRule(ctx, rule)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		service.EvaluateRules(ctx)
	}
}

func BenchmarkAlertingService_CollectMetric(b *testing.B) {
	logger := zaptest.NewLogger(b)

	alertManager := mocks.NewMockAlertManager()
	alertRuleManager := mocks.NewMockAlertRuleManager()
	notificationManager := mocks.NewMockNotificationManager()
	metricsStorage := mocks.NewMockMetricsStorage()
	wsManager := mocks.NewMockWebSocketManager()

	service := NewAlertingService(
		logger,
		alertManager,
		alertRuleManager,
		notificationManager,
		metricsStorage,
		wsManager,
	)

	ctx := context.Background()

	metric := &domain.Metric{
		ID:      "test-metric-1",
		Name:    "cpu_usage_percent",
		Type:    domain.MetricTypeGauge,
		Value:   85.0,
		Timestamp: time.Now(),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		metric.ID = fmt.Sprintf("test-metric-%d", i)
		metricsStorage.Store(ctx, metric)
		service.EvaluateRules(ctx)
	}
}