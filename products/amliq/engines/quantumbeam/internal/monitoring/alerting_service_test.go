package monitoring

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewNotificationService(t *testing.T) {
	emailConfig := EmailConfig{
		SMTPHost:     "smtp.test.com",
		SMTPPort:     587,
		SMTPUsername: "test@test.com",
		SMTPPassword: "password",
		From:         "alerts@test.com",
		To:           []string{"admin@test.com"},
		UseTLS:       true,
	}

	slackConfig := SlackConfig{
		WebhookURL: "https://hooks.slack.com/test",
		Channel:    "#alerts",
		Username:   "QuantumBeam",
	}

	webhookConfig := WebhookConfig{
		URL:     "https://api.test.com/webhooks",
		Headers: map[string]string{"Authorization": "Bearer token"},
		Timeout: 30 * time.Second,
	}

	service := NewNotificationService(emailConfig, slackConfig, webhookConfig)

	assert.NotNil(t, service)
	assert.Equal(t, emailConfig, service.emailConfig)
	assert.Equal(t, slackConfig, service.slackConfig)
	assert.Equal(t, webhookConfig, service.webhookConfig)
}

func TestNotificationService_SendSlack(t *testing.T) {
	// Create test server to simulate Slack webhook
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "POST", r.Method)
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))

		var payload map[string]interface{}
		err := json.NewDecoder(r.Body).Decode(&payload)
		require.NoError(t, err)

		assert.Equal(t, "#alerts", payload["channel"])
		assert.Equal(t, "QuantumBeam", payload["username"])
		assert.Contains(t, payload["text"], "[CRITICAL]")

		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	slackConfig := SlackConfig{
		WebhookURL: server.URL,
		Channel:    "#alerts",
		Username:   "QuantumBeam",
	}

	service := NewNotificationService(EmailConfig{}, slackConfig, WebhookConfig{})

	alert := Alert{
		ID:          "test-alert",
		Name:        "Test Alert",
		Description: "This is a test alert",
		Severity:    SeverityCritical,
		Status:      StatusFiring,
		Labels: map[string]string{
			"service": "test",
		},
		StartsAt: time.Now(),
	}

	err := service.SendSlack(alert)
	assert.NoError(t, err)
}

func TestNotificationService_SendWebhook(t *testing.T) {
	// Create test server to simulate webhook endpoint
	var receivedPayload map[string]interface{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "POST", r.Method)
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
		assert.Equal(t, "Bearer token", r.Header.Get("Authorization"))

		err := json.NewDecoder(r.Body).Decode(&receivedPayload)
		require.NoError(t, err)

		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	webhookConfig := WebhookConfig{
		URL: server.URL,
		Headers: map[string]string{
			"Authorization": "Bearer token",
		},
		Timeout: 30 * time.Second,
	}

	service := NewNotificationService(EmailConfig{}, SlackConfig{}, webhookConfig)

	alert := Alert{
		ID:          "test-alert",
		Name:        "Test Alert",
		Description: "This is a test alert",
		Severity:    SeverityWarning,
		Status:      StatusFiring,
		StartsAt:    time.Now(),
	}

	err := service.SendWebhook(alert)
	assert.NoError(t, err)

	// Verify payload structure
	assert.Contains(t, receivedPayload, "alert")
	assert.Contains(t, receivedPayload, "timestamp")
	assert.Contains(t, receivedPayload, "service")
	assert.Equal(t, "quantumbeam-alerting", receivedPayload["service"])

	alertData := receivedPayload["alert"].(map[string]interface{})
	assert.Equal(t, "test-alert", alertData["id"])
	assert.Equal(t, "Test Alert", alertData["name"])
}

func TestNotificationService_SendWebhook_Error(t *testing.T) {
	// Test with invalid URL
	webhookConfig := WebhookConfig{
		URL:     "http://invalid-url-that-does-not-exist.com",
		Headers: map[string]string{},
		Timeout: 1 * time.Second,
	}

	service := NewNotificationService(EmailConfig{}, SlackConfig{}, webhookConfig)

	alert := Alert{
		ID:       "test-alert",
		Name:     "Test Alert",
		Severity: SeverityWarning,
		Status:   StatusFiring,
		StartsAt: time.Now(),
	}

	err := service.SendWebhook(alert)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to send webhook")
}

func TestNewAlertingService(t *testing.T) {
	config := AlertingConfig{
		PrometheusURL: "http://localhost:9090",
		EvalInterval:  30 * time.Second,
		EmailConfig: EmailConfig{
			SMTPHost: "smtp.test.com",
			From:     "alerts@test.com",
			To:       []string{"admin@test.com"},
		},
		SlackConfig: SlackConfig{
			WebhookURL: "https://hooks.slack.com/test",
			Channel:    "#alerts",
		},
		WebhookConfig: WebhookConfig{
			URL: "https://api.test.com/webhooks",
		},
		Enabled: true,
	}

	service, err := NewAlertingService(config)
	require.NoError(t, err)
	assert.NotNil(t, service)
	assert.Equal(t, config.EvalInterval, service.config.EvalInterval)
	assert.NotNil(t, service.notificationService)
	assert.Equal(t, 0, len(service.rules))
	assert.Equal(t, 0, len(service.activeAlerts))
}

func TestAlertingService_AddRule(t *testing.T) {
	config := AlertingConfig{Enabled: true}
	service, err := NewAlertingService(config)
	require.NoError(t, err)

	rule := AlertRule{
		ID:                   "test-rule",
		Name:                 "Test Rule",
		Query:                "up == 0",
		Severity:             SeverityCritical,
		For:                  1 * time.Minute,
		Labels:               map[string]string{"service": "test"},
		Annotations:          map[string]string{"description": "Test rule"},
		Enabled:              true,
		NotificationChannels: []NotificationChannel{ChannelEmail},
		EvalInterval:         30 * time.Second,
	}

	err = service.AddRule(rule)
	assert.NoError(t, err)

	// Verify rule was added
	rules := service.GetRules()
	assert.Len(t, rules, 1)
	assert.Equal(t, rule.ID, rules["test-rule"].ID)
	assert.Equal(t, rule.Name, rules["test-rule"].Name)
}

func TestAlertingService_AddRule_Validation(t *testing.T) {
	config := AlertingConfig{Enabled: true}
	service, err := NewAlertingService(config)
	require.NoError(t, err)

	// Test empty ID
	rule := AlertRule{
		Name:  "Test Rule",
		Query: "up == 0",
	}
	err = service.AddRule(rule)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "rule ID cannot be empty")

	// Test empty name
	rule = AlertRule{
		ID:    "test-rule",
		Query: "up == 0",
	}
	err = service.AddRule(rule)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "rule name cannot be empty")

	// Test empty query
	rule = AlertRule{
		ID:   "test-rule",
		Name: "Test Rule",
	}
	err = service.AddRule(rule)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "rule query cannot be empty")
}

func TestAlertingService_RemoveRule(t *testing.T) {
	config := AlertingConfig{Enabled: true}
	service, err := NewAlertingService(config)
	require.NoError(t, err)

	// Add a rule
	rule := AlertRule{
		ID:       "test-rule",
		Name:     "Test Rule",
		Query:    "up == 0",
		Severity: SeverityCritical,
		Enabled:  true,
	}
	err = service.AddRule(rule)
	assert.NoError(t, err)

	// Add an active alert for this rule
	alert := Alert{
		ID:       "test-rule",
		Name:     "Test Alert",
		Severity: SeverityCritical,
		Status:   StatusFiring,
		StartsAt: time.Now(),
	}
	service.activeAlerts["test-rule"] = &alert

	// Remove rule
	service.RemoveRule("test-rule")

	// Verify rule and alert were removed
	rules := service.GetRules()
	assert.Len(t, rules, 0)

	activeAlerts := service.GetActiveAlerts()
	assert.Len(t, activeAlerts, 0)
}

func TestAlertingService_AddPredefinedRules(t *testing.T) {
	config := AlertingConfig{Enabled: true}
	service, err := NewAlertingService(config)
	require.NoError(t, err)

	service.AddPredefinedRules()

	rules := service.GetRules()
	assert.Greater(t, len(rules), 0)

	// Check for specific predefined rules
	expectedRules := []string{
		"high_fraud_rate",
		"high_error_rate",
		"slow_response_times",
		"quantum_backend_down",
		"database_connection_issues",
	}

	for _, ruleID := range expectedRules {
		assert.Contains(t, rules, ruleID, "Expected rule %s not found", ruleID)
		assert.True(t, rules[ruleID].Enabled, "Rule %s should be enabled", ruleID)
		assert.NotEmpty(t, rules[ruleID].Name, "Rule %s should have a name", ruleID)
		assert.NotEmpty(t, rules[ruleID].Query, "Rule %s should have a query", ruleID)
	}
}

func TestAlertingService_GetActiveAlerts(t *testing.T) {
	config := AlertingConfig{Enabled: true}
	service, err := NewAlertingService(config)
	require.NoError(t, err)

	// Initially no active alerts
	activeAlerts := service.GetActiveAlerts()
	assert.Len(t, activeAlerts, 0)

	// Add an active alert
	alert := Alert{
		ID:                   "test-alert",
		Name:                 "Test Alert",
		Description:          "Test alert description",
		Severity:             SeverityWarning,
		Status:               StatusFiring,
		StartsAt:             time.Now(),
		NotificationChannels: []NotificationChannel{ChannelEmail},
	}
	service.activeAlerts["test-alert"] = &alert

	activeAlerts = service.GetActiveAlerts()
	assert.Len(t, activeAlerts, 1)
	assert.Equal(t, alert.ID, activeAlerts["test-alert"].ID)
	assert.Equal(t, alert.Name, activeAlerts["test-alert"].Name)
}

func TestAlertingService_GetAlertHistory(t *testing.T) {
	config := AlertingConfig{Enabled: true}
	service, err := NewAlertingService(config)
	require.NoError(t, err)

	// Initially empty history
	history := service.GetAlertHistory()
	assert.Len(t, history, 0)

	// Add alerts to history
	alert1 := Alert{
		ID:       "alert-1",
		Name:     "Alert 1",
		Severity: SeverityWarning,
		Status:   StatusFiring,
		StartsAt: time.Now().Add(-1 * time.Hour),
	}
	alert2 := Alert{
		ID:       "alert-2",
		Name:     "Alert 2",
		Severity: SeverityCritical,
		Status:   StatusResolved,
		StartsAt: time.Now().Add(-30 * time.Minute),
		EndsAt:   &[]time.Time{time.Now()}[0],
	}

	service.alertHistory = append(service.alertHistory, alert1, alert2)

	history = service.GetAlertHistory()
	assert.Len(t, history, 2)
	assert.Equal(t, "alert-1", history[0].ID)
	assert.Equal(t, "alert-2", history[1].ID)
}

func TestAlertingService_EvaluateRules_NoPrometheus(t *testing.T) {
	config := AlertingConfig{
		Enabled: true,
		// No PrometheusURL configured
	}
	service, err := NewAlertingService(config)
	require.NoError(t, err)

	// Add a rule
	rule := AlertRule{
		ID:       "test-rule",
		Name:     "Test Rule",
		Query:    "up == 0",
		Severity: SeverityCritical,
		Enabled:  true,
	}
	err = service.AddRule(rule)
	assert.NoError(t, err)

	// Evaluate rules should fail without Prometheus client
	err = service.EvaluateRules(context.Background())
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Prometheus client not configured")
}

func TestAlertingService_EvaluateRules_Disabled(t *testing.T) {
	config := AlertingConfig{Enabled: true}
	service, err := NewAlertingService(config)
	require.NoError(t, err)

	// Add a disabled rule
	rule := AlertRule{
		ID:       "disabled-rule",
		Name:     "Disabled Rule",
		Query:    "up == 0",
		Severity: SeverityCritical,
		Enabled:  false, // Disabled
	}
	err = service.AddRule(rule)
	assert.NoError(t, err)

	// Mock Prometheus client that returns nil
	service.prometheusAPI = nil

	// Should not evaluate disabled rules
	err = service.EvaluateRules(context.Background())
	assert.Error(t, err) // Still fails because no Prometheus client
	// But the failure shouldn't be related to the disabled rule
}

func TestAlertingService_Start_ContextCancellation(t *testing.T) {
	config := AlertingConfig{
		Enabled:      true,
		EvalInterval: 100 * time.Millisecond,
	}
	service, err := NewAlertingService(config)
	require.NoError(t, err)

	// Create a context that will be cancelled quickly
	ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
	defer cancel()

	// Start should return when context is cancelled
	errChan := make(chan error, 1)
	go func() {
		errChan <- service.Start(ctx)
	}()

	select {
	case err := <-errChan:
		assert.Error(t, err)
		assert.Equal(t, context.DeadlineExceeded, err)
	case <-time.After(1 * time.Second):
		t.Fatal("Start should have returned due to context cancellation")
	}
}

func TestAlertingService_Start_Disabled(t *testing.T) {
	config := AlertingConfig{
		Enabled: false, // Disabled
	}
	service, err := NewAlertingService(config)
	require.NoError(t, err)

	ctx := context.Background()

	// Should return immediately when disabled
	err = service.Start(ctx)
	assert.NoError(t, err)
}

func TestAlertSeverity_Colors(t *testing.T) {
	service := NewNotificationService(EmailConfig{}, SlackConfig{}, WebhookConfig{})

	// Test Slack color mapping
	assert.Equal(t, "danger", service.getSlackColor(SeverityCritical))
	assert.Equal(t, "warning", service.getSlackColor(SeverityWarning))
	assert.Equal(t, "good", service.getSlackColor(SeverityInfo))
}

func TestEmailFormatting(t *testing.T) {
	service := NewNotificationService(EmailConfig{}, SlackConfig{}, WebhookConfig{})

	alert := Alert{
		ID:          "test-alert",
		Name:        "Test Alert",
		Description: "This is a test alert for formatting",
		Severity:    SeverityCritical,
		Status:      StatusFiring,
		StartsAt:    time.Date(2023, 10, 15, 12, 30, 0, 0, time.UTC),
		Labels: map[string]string{
			"service": "test-service",
			"env":     "production",
		},
		Annotations: map[string]string{
			"runbook_url": "https://docs.test.com/runbooks/test-alert",
		},
		GeneratorURL: "http://prometheus.test.com/graph?g0.expr=up%3D0",
	}

	body := service.formatEmailBody(body)

	assert.Contains(t, body, "Alert: Test Alert")
	assert.Contains(t, body, "Severity: CRITICAL")
	assert.Contains(t, body, "Status: firing")
	assert.Contains(t, body, "This is a test alert for formatting")
	assert.Contains(t, body, "2023-10-15T12:30:00Z")
	assert.Contains(t, body, "service: test-service")
	assert.Contains(t, body, "env: production")
	assert.Contains(t, body, "runbook_url: https://docs.test.com/runbooks/test-alert")
	assert.Contains(t, body, "http://prometheus.test.com/graph")
}

func TestJoinEmailAddresses(t *testing.T) {
	// Test empty slice
	result := joinEmailAddresses([]string{})
	assert.Equal(t, "", result)

	// Test single address
	result = joinEmailAddresses([]string{"test@example.com"})
	assert.Equal(t, "test@example.com", result)

	// Test multiple addresses
	result = joinEmailAddresses([]string{"a@example.com", "b@example.com", "c@example.com"})
	assert.Equal(t, "a@example.com, b@example.com, c@example.com", result)
}

func TestAlertRule_EvalInterval(t *testing.T) {
	rule := AlertRule{
		ID:           "test-rule",
		Name:         "Test Rule",
		Query:        "up == 0",
		Severity:     SeverityCritical,
		For:          1 * time.Minute,
		Enabled:      true,
		EvalInterval: 30 * time.Second,
	}

	assert.Equal(t, 30*time.Second, rule.EvalInterval)
}

// Mock tests for notification channels with different configurations
func TestNotificationChannels_MissingConfig(t *testing.T) {
	service := NewNotificationService(EmailConfig{}, SlackConfig{}, WebhookConfig{})

	alert := Alert{
		ID:       "test-alert",
		Name:     "Test Alert",
		Severity: SeverityWarning,
		Status:   StatusFiring,
		StartsAt: time.Now(),
	}

	// All configurations should fail gracefully
	err := service.SendEmail(alert)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "email configuration not provided")

	err = service.SendSlack(alert)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Slack configuration not provided")

	err = service.SendWebhook(alert)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "webhook configuration not provided")
}

// Integration test for the complete alerting flow
func TestAlertingService_Integration(t *testing.T) {
	// Create a mock notification service that tracks calls
	var notifications []string

	mockService := &NotificationService{
		emailConfig:   EmailConfig{},
		slackConfig:   SlackConfig{},
		webhookConfig: WebhookConfig{},
	}

	// Override methods to track calls
	originalSendEmail := mockService.SendEmail
	mockService.SendEmail = func(alert Alert) error {
		notifications = append(notifications, "email:"+alert.ID)
		return originalSendEmail(alert)
	}

	originalSendSlack := mockService.SendSlack
	mockService.SendSlack = func(alert Alert) error {
		notifications = append(notifications, "slack:"+alert.ID)
		return originalSendSlack(alert)
	}

	config := AlertingConfig{
		Enabled:      true,
		EvalInterval: 100 * time.Millisecond,
	}

	service, err := NewAlertingService(config)
	require.NoError(t, err)
	service.notificationService = mockService

	// Add test rules
	rule1 := AlertRule{
		ID:                   "test-rule-1",
		Name:                 "Test Rule 1",
		Query:                "up == 0",
		Severity:             SeverityWarning,
		Enabled:              true,
		NotificationChannels: []NotificationChannel{ChannelEmail},
		EvalInterval:         50 * time.Millisecond,
	}

	rule2 := AlertRule{
		ID:                   "test-rule-2",
		Name:                 "Test Rule 2",
		Query:                "rate(errors_total[5m]) > 0.1",
		Severity:             SeverityCritical,
		Enabled:              true,
		NotificationChannels: []NotificationChannel{ChannelSlack},
		EvalInterval:         50 * time.Millisecond,
	}

	err = service.AddRule(rule1)
	assert.NoError(t, err)
	err = service.AddRule(rule2)
	assert.NoError(t, err)

	// Verify rules were added
	rules := service.GetRules()
	assert.Len(t, rules, 2)

	// Test rule management
	assert.Contains(t, rules, "test-rule-1")
	assert.Contains(t, rules, "test-rule-2")

	// Test removing rules
	service.RemoveRule("test-rule-1")
	rules = service.GetRules()
	assert.Len(t, rules, 1)
	assert.NotContains(t, rules, "test-rule-1")
	assert.Contains(t, rules, "test-rule-2")

	// Test alert history tracking
	alert := Alert{
		ID:       "history-test",
		Name:     "History Test Alert",
		Severity: SeverityInfo,
		Status:   StatusFiring,
		StartsAt: time.Now(),
	}
	service.alertHistory = append(service.alertHistory, alert)

	history := service.GetAlertHistory()
	assert.Len(t, history, 1)
	assert.Equal(t, "history-test", history[0].ID)
}
