package monitoring

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/smtp"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
)

// AlertingSystem provides comprehensive alerting and notification capabilities
type AlertingSystem struct {
	logger               *log.Logger
	config               AlertingConfig
	prometheusClient     v1.API
	alertRules           map[string]AlertRule
	alertHistory         []Alert
	mu                   sync.RWMutex
	notificationChannels map[string]NotificationChannel
}

// AlertingConfig holds alerting configuration
type AlertingConfig struct {
	Enabled              bool          `json:"enabled"`
	PrometheusURL        string        `json:"prometheus_url"`
	EvaluationInterval   time.Duration `json:"evaluation_interval"`
	NotificationTimeout  time.Duration `json:"notification_timeout"`
	MaxAlertsPerRule     int           `json:"max_alerts_per_rule"`
	AlertRetentionPeriod time.Duration `json:"alert_retention_period"`
	SilenceDuration      time.Duration `json:"silence_duration"`
	DefaultSeverity      AlertSeverity `json:"default_severity"`
	EnableGrouping       bool          `json:"enable_grouping"`
	GroupWait            time.Duration `json:"group_wait"`
	GroupInterval        time.Duration `json:"group_interval"`
	RepeatInterval       time.Duration `json:"repeat_interval"`
}

// AlertRule represents an alert rule
type AlertRule struct {
	ID                   string            `json:"id"`
	Name                 string            `json:"name"`
	Description          string            `json:"description"`
	Query                string            `json:"query"`
	Condition            string            `json:"condition"`
	Threshold            float64           `json:"threshold"`
	Duration             time.Duration     `json:"duration"`
	Severity             AlertSeverity     `json:"severity"`
	Labels               map[string]string `json:"labels"`
	Annotations          map[string]string `json:"annotations"`
	Enabled              bool              `json:"enabled"`
	For                  time.Duration     `json:"for"`
	EvaluationInterval   time.Duration     `json:"evaluation_interval"`
	NotificationChannels []string          `json:"notification_channels"`
	SilenceLabels        map[string]string `json:"silence_labels"`
}

// Alert represents an active alert
type Alert struct {
	ID            string              `json:"id"`
	RuleID        string              `json:"rule_id"`
	RuleName      string              `json:"rule_name"`
	State         AlertState          `json:"state"`
	Severity      AlertSeverity       `json:"severity"`
	Message       string              `json:"message"`
	Labels        map[string]string   `json:"labels"`
	Annotations   map[string]string   `json:"annotations"`
	StartsAt      time.Time           `json:"starts_at"`
	EndsAt        *time.Time          `json:"ends_at,omitempty"`
	LastSentAt    *time.Time          `json:"last_sent_at,omitempty"`
	Value         float64             `json:"value"`
	Query         string              `json:"query"`
	Notifications []AlertNotification `json:"notifications"`
	Silenced      bool                `json:"silenced"`
	SilenceReason string              `json:"silence_reason,omitempty"`
}

// AlertState represents alert states
type AlertState string

const (
	AlertStateFiring   AlertState = "firing"
	AlertStateResolved AlertState = "resolved"
	AlertStateSilenced AlertState = "silenced"
	AlertStateInactive AlertState = "inactive"
)

// AlertSeverity represents alert severity levels
type AlertSeverity string

const (
	SeverityCritical AlertSeverity = "critical"
	SeverityMajor    AlertSeverity = "major"
	SeverityMinor    AlertSeverity = "minor"
	SeverityWarning  AlertSeverity = "warning"
	SeverityInfo     AlertSeverity = "info"
)

// NotificationChannel represents a notification channel
type NotificationChannel struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Type        ChannelType       `json:"type"`
	Enabled     bool              `json:"enabled"`
	Config      map[string]string `json:"config"`
	RateLimit   RateLimit         `json:"rate_limit"`
	RetryPolicy RetryPolicy       `json:"retry_policy"`
}

// ChannelType represents notification channel types
type ChannelType string

const (
	ChannelTypeEmail     ChannelType = "email"
	ChannelTypeSlack     ChannelType = "slack"
	ChannelTypeWebhook   ChannelType = "webhook"
	ChannelTypePagerDuty ChannelType = "pagerduty"
	ChannelTypeSMS       ChannelType = "sms"
	ChannelTypeTeams     ChannelType = "teams"
)

// RateLimit represents rate limiting configuration
type RateLimit struct {
	Enabled  bool          `json:"enabled"`
	Limit    int           `json:"limit"`
	Interval time.Duration `json:"interval"`
}

// RetryPolicy represents retry policy configuration
type RetryPolicy struct {
	Enabled      bool          `json:"enabled"`
	MaxAttempts  int           `json:"max_attempts"`
	InitialDelay time.Duration `json:"initial_delay"`
	MaxDelay     time.Duration `json:"max_delay"`
	Multiplier   float64       `json:"multiplier"`
}

// AlertNotification represents a notification sent
type AlertNotification struct {
	ChannelID    string                 `json:"channel_id"`
	ChannelName  string                 `json:"channel_name"`
	ChannelType  ChannelType            `json:"channel_type"`
	Status       NotificationStatus     `json:"status"`
	SentAt       time.Time              `json:"sent_at"`
	DeliveryTime time.Duration          `json:"delivery_time"`
	Error        string                 `json:"error,omitempty"`
	Response     map[string]interface{} `json:"response,omitempty"`
	AttemptCount int                    `json:"attempt_count"`
}

// NotificationStatus represents notification status
type NotificationStatus string

const (
	NotificationStatusPending   NotificationStatus = "pending"
	NotificationStatusSent      NotificationStatus = "sent"
	NotificationStatusFailed    NotificationStatus = "failed"
	NotificationStatusCancelled NotificationStatus = "cancelled"
)

// AlertGroup represents a group of related alerts
type AlertGroup struct {
	ID        string            `json:"id"`
	Labels    map[string]string `json:"labels"`
	Alerts    []Alert           `json:"alerts"`
	StartTime time.Time         `json:"start_time"`
	EndTime   *time.Time        `json:"end_time,omitempty"`
	Notified  bool              `json:"notified"`
}

// NewAlertingSystem creates a new alerting system
func NewAlertingSystem(config AlertingConfig) (*AlertingSystem, error) {
	as := &AlertingSystem{
		logger:               log.New(log.Writer(), "[ALERTING] ", log.LstdFlags|log.Lmsgprefix),
		config:               config,
		alertRules:           make(map[string]AlertRule),
		alertHistory:         make([]Alert, 0),
		notificationChannels: make(map[string]NotificationChannel),
	}

	// Initialize Prometheus client if URL is provided
	if config.PrometheusURL != "" {
		client, err := api.NewClient(api.Config{
			Address: config.PrometheusURL,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create Prometheus client: %w", err)
		}
		as.prometheusClient = v1.NewAPI(client)
	}

	// Load default alert rules
	as.loadDefaultAlertRules()

	// Load default notification channels
	as.loadDefaultNotificationChannels()

	// Start alert evaluation
	go as.runAlertEvaluation()

	return as, nil
}

// AddAlertRule adds a new alert rule
func (as *AlertingSystem) AddAlertRule(rule AlertRule) error {
	as.mu.Lock()
	defer as.mu.Unlock()

	// Validate rule
	if rule.Name == "" || rule.Query == "" {
		return fmt.Errorf("rule name and query are required")
	}

	as.alertRules[rule.ID] = rule
	as.logger.Printf("Added alert rule: %s", rule.Name)

	return nil
}

// RemoveAlertRule removes an alert rule
func (as *AlertingSystem) RemoveAlertRule(ruleID string) {
	as.mu.Lock()
	defer as.mu.Unlock()

	delete(as.alertRules, ruleID)
	as.logger.Printf("Removed alert rule: %s", ruleID)
}

// GetAlertRule retrieves an alert rule
func (as *AlertingSystem) GetAlertRule(ruleID string) (AlertRule, bool) {
	as.mu.RLock()
	defer as.mu.RUnlock()

	rule, exists := as.alertRules[ruleID]
	return rule, exists
}

// ListAlertRules returns all alert rules
func (as *AlertingSystem) ListAlertRules() []AlertRule {
	as.mu.RLock()
	defer as.mu.RUnlock()

	rules := make([]AlertRule, 0, len(as.alertRules))
	for _, rule := range as.alertRules {
		rules = append(rules, rule)
	}

	return rules
}

// AddNotificationChannel adds a notification channel
func (as *AlertingSystem) AddNotificationChannel(channel NotificationChannel) error {
	as.mu.Lock()
	defer as.mu.Unlock()

	// Validate channel
	if channel.Name == "" || channel.Type == "" {
		return fmt.Errorf("channel name and type are required")
	}

	as.notificationChannels[channel.ID] = channel
	as.logger.Printf("Added notification channel: %s (%s)", channel.Name, channel.Type)

	return nil
}

// GetActiveAlerts returns currently active alerts
func (as *AlertingSystem) GetActiveAlerts() []Alert {
	as.mu.RLock()
	defer as.mu.RUnlock()

	var activeAlerts []Alert
	for _, alert := range as.alertHistory {
		if alert.State == AlertStateFiring || alert.State == AlertStateSilenced {
			activeAlerts = append(activeAlerts, alert)
		}
	}

	return activeAlerts
}

// GetAlertHistory returns alert history
func (as *AlertingSystem) GetAlertHistory(since time.Time) []Alert {
	as.mu.RLock()
	defer as.mu.RUnlock()

	var history []Alert
	for _, alert := range as.alertHistory {
		if alert.StartsAt.After(since) {
			history = append(history, alert)
		}
	}

	return history
}

// runAlertEvaluation runs continuous alert evaluation
func (as *AlertingSystem) runAlertEvaluation() {
	ticker := time.NewTicker(as.config.EvaluationInterval)
	defer ticker.Stop()

	for range ticker.C {
		as.evaluateAllRules()
	}
}

// evaluateAllRules evaluates all enabled alert rules
func (as *AlertingSystem) evaluateAllRules() {
	as.mu.RLock()
	rules := make([]AlertRule, 0, len(as.alertRules))
	for _, rule := range as.alertRules {
		if rule.Enabled {
			rules = append(rules, rule)
		}
	}
	as.mu.RUnlock()

	for _, rule := range rules {
		go as.evaluateRule(rule)
	}
}

// evaluateRule evaluates a single alert rule
func (as *AlertingSystem) evaluateRule(rule AlertRule) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Query Prometheus
	result, _, err := as.prometheusClient.Query(ctx, rule.Query, time.Now())
	if err != nil {
		as.logger.Printf("Failed to query Prometheus for rule %s: %v", rule.Name, err)
		return
	}

	// Process query result
	alerts := as.processQueryResult(rule, result)

	// Update alert states
	as.updateAlertStates(alerts)

	// Send notifications for firing alerts
	for _, alert := range alerts {
		if alert.State == AlertStateFiring {
			go as.sendNotifications(alert)
		}
	}
}

// processQueryResult processes Prometheus query result
func (as *AlertingSystem) processQueryResult(rule AlertRule, result interface{}) []Alert {
	// This would parse the actual Prometheus query result
	// For demonstration, returning mock alerts
	alerts := []Alert{}

	// Check if result indicates alert condition
	// This is simplified - in reality would parse the actual result
	alert := Alert{
		ID:            fmt.Sprintf("%s-%d", rule.ID, time.Now().Unix()),
		RuleID:        rule.ID,
		RuleName:      rule.Name,
		State:         AlertStateFiring,
		Severity:      rule.Severity,
		Message:       fmt.Sprintf("Alert: %s", rule.Description),
		Labels:        make(map[string]string),
		Annotations:   make(map[string]string),
		StartsAt:      time.Now(),
		Value:         95.0, // Mock value
		Query:         rule.Query,
		Notifications: []AlertNotification{},
		Silenced:      false,
	}

	// Copy labels and annotations
	for k, v := range rule.Labels {
		alert.Labels[k] = v
	}
	for k, v := range rule.Annotations {
		alert.Annotations[k] = v
	}

	alerts = append(alerts, alert)
	return alerts
}

// updateAlertStates updates the states of alerts
func (as *AlertingSystem) updateAlertStates(newAlerts []Alert) {
	as.mu.Lock()
	defer as.mu.Unlock()

	for _, newAlert := range newAlerts {
		// Check if alert already exists
		existingAlert, exists := as.findAlertByRule(newAlert.RuleID)
		if exists {
			// Update existing alert
			if existingAlert.State == AlertStateResolved && newAlert.State == AlertStateFiring {
				// Alert is firing again
				existingAlert.State = AlertStateFiring
				existingAlert.StartsAt = time.Now()
				existingAlert.EndsAt = nil
			}
		} else {
			// Add new alert
			as.alertHistory = append(as.alertHistory, newAlert)
		}
	}

	// Clean up old alerts
	as.cleanupOldAlerts()
}

// findAlertByRule finds an alert by rule ID
func (as *AlertingSystem) findAlertByRule(ruleID string) (*Alert, bool) {
	for i := len(as.alertHistory) - 1; i >= 0; i-- {
		alert := as.alertHistory[i]
		if alert.RuleID == ruleID && alert.State == AlertStateFiring {
			return &alert, true
		}
	}
	return nil, false
}

// cleanupOldAlerts removes old resolved alerts
func (as *AlertingSystem) cleanupOldAlerts() {
	cutoff := time.Now().Add(-as.config.AlertRetentionPeriod)

	var filtered []Alert
	for _, alert := range as.alertHistory {
		if alert.StartsAt.After(cutoff) ||
			(alert.EndsAt != nil && alert.EndsAt.After(cutoff)) ||
			alert.State == AlertStateFiring {
			filtered = append(filtered, alert)
		}
	}

	as.alertHistory = filtered
}

// sendNotifications sends notifications for an alert
func (as *AlertingSystem) sendNotifications(alert Alert) {
	rule, exists := as.GetAlertRule(alert.RuleID)
	if !exists {
		return
	}

	// Get notification channels for this rule
	channels := rule.NotificationChannels
	if len(channels) == 0 {
		// Use default channels
		channels = []string{"email", "slack"}
	}

	for _, channelID := range channels {
		channel, exists := as.notificationChannels[channelID]
		if !exists || !channel.Enabled {
			continue
		}

		// Check rate limiting
		if channel.RateLimit.Enabled && as.isRateLimited(channel, alert) {
			as.logger.Printf("Alert notification rate limited for channel %s", channel.Name)
			continue
		}

		// Send notification
		notification := as.sendNotification(channel, alert)

		// Update alert with notification info
		as.mu.Lock()
		for i, existingAlert := range as.alertHistory {
			if existingAlert.ID == alert.ID {
				as.alertHistory[i].Notifications = append(as.alertHistory[i].Notifications, notification)
				break
			}
		}
		as.mu.Unlock()
	}
}

// sendNotification sends a notification to a channel
func (as *AlertingSystem) sendNotification(channel NotificationChannel, alert Alert) AlertNotification {
	startTime := time.Now()
	notification := AlertNotification{
		ChannelID:    channel.ID,
		ChannelName:  channel.Name,
		ChannelType:  channel.Type,
		Status:       NotificationStatusPending,
		SentAt:       startTime,
		AttemptCount: 1,
	}

	var err error
	switch channel.Type {
	case ChannelTypeEmail:
		err = as.sendEmailNotification(channel, alert)
	case ChannelTypeSlack:
		err = as.sendSlackNotification(channel, alert)
	case ChannelTypeWebhook:
		err = as.sendWebhookNotification(channel, alert)
	case ChannelTypePagerDuty:
		err = as.sendPagerDutyNotification(channel, alert)
	default:
		err = fmt.Errorf("unsupported channel type: %s", channel.Type)
	}

	notification.DeliveryTime = time.Since(startTime)

	if err != nil {
		notification.Status = NotificationStatusFailed
		notification.Error = err.Error()
		as.logger.Printf("Failed to send notification to %s: %v", channel.Name, err)
	} else {
		notification.Status = NotificationStatusSent
		as.logger.Printf("Sent notification to %s (%s)", channel.Name, channel.Type)
	}

	return notification
}

// sendEmailNotification sends email notification
func (as *AlertingSystem) sendEmailNotification(channel NotificationChannel, alert Alert) error {
	smtpHost := channel.Config["smtp_host"]
	smtpPort := channel.Config["smtp_port"]
	username := channel.Config["username"]
	password := channel.Config["password"]
	from := channel.Config["from"]
	to := channel.Config["to"]

	auth := smtp.PlainAuth("", username, password, smtpHost)

	subject := fmt.Sprintf("[%s] Alert: %s", strings.ToUpper(string(alert.Severity)), alert.RuleName)
	body := as.formatEmailAlert(alert)

	return smtp.SendMail(
		fmt.Sprintf("%s:%s", smtpHost, smtpPort),
		auth,
		from,
		[]string{to},
		[]byte(fmt.Sprintf("To: %s\r\nSubject: %s\r\n\r\n%s", to, subject, body)),
	)
}

// sendSlackNotification sends Slack notification
func (as *AlertingSystem) sendSlackNotification(channel NotificationChannel, alert Alert) error {
	webhookURL := channel.Config["webhook_url"]

	// Format Slack message
	message := map[string]interface{}{
		"text": fmt.Sprintf("[%s] %s", strings.ToUpper(string(alert.Severity)), alert.Message),
		"attachments": []map[string]interface{}{
			{
				"color": as.getSlackColor(alert.Severity),
				"fields": []map[string]interface{}{
					{
						"title": "Rule",
						"value": alert.RuleName,
						"short": true,
					},
					{
						"title": "Severity",
						"value": string(alert.Severity),
						"short": true,
					},
					{
						"title": "Value",
						"value": fmt.Sprintf("%.2f", alert.Value),
						"short": true,
					},
					{
						"title": "Started",
						"value": alert.StartsAt.Format(time.RFC3339),
						"short": true,
					},
				},
			},
		},
	}

	jsonData, err := json.Marshal(message)
	if err != nil {
		return err
	}

	resp, err := http.Post(webhookURL, "application/json", strings.NewReader(string(jsonData)))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Slack webhook returned status %d", resp.StatusCode)
	}

	return nil
}

// sendWebhookNotification sends webhook notification
func (as *AlertingSystem) sendWebhookNotification(channel NotificationChannel, alert Alert) error {
	webhookURL := channel.Config["url"]

	// Format webhook payload
	payload := map[string]interface{}{
		"alert_id":    alert.ID,
		"rule_name":   alert.RuleName,
		"severity":    string(alert.Severity),
		"message":     alert.Message,
		"value":       alert.Value,
		"starts_at":   alert.StartsAt,
		"labels":      alert.Labels,
		"annotations": alert.Annotations,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	resp, err := http.Post(webhookURL, "application/json", strings.NewReader(string(jsonData)))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("Webhook returned status %d", resp.StatusCode)
	}

	return nil
}

// sendPagerDutyNotification sends PagerDuty notification
func (as *AlertingSystem) sendPagerDutyNotification(channel NotificationChannel, alert Alert) error {
	integrationKey := channel.Config["integration_key"]

	// Format PagerDuty payload
	payload := map[string]interface{}{
		"routing_key":  integrationKey,
		"event_action": "trigger",
		"payload": map[string]interface{}{
			"summary":   alert.Message,
			"severity":  as.getPagerDutySeverity(alert.Severity),
			"source":    "quantumbeam",
			"component": alert.RuleName,
			"group":     "fraud-detection",
			"class":     "alert",
			"custom_details": map[string]interface{}{
				"rule_id": alert.RuleID,
				"value":   alert.Value,
				"query":   alert.Query,
				"labels":  alert.Labels,
			},
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	resp, err := http.Post("https://events.pagerduty.com/v2/enqueue", "application/json", strings.NewReader(string(jsonData)))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted {
		return fmt.Errorf("PagerDuty returned status %d", resp.StatusCode)
	}

	return nil
}

// Helper methods

// isRateLimited checks if a notification is rate limited
func (as *AlertingSystem) isRateLimited(channel NotificationChannel, alert Alert) bool {
	if !channel.RateLimit.Enabled {
		return false
	}

	// This would implement actual rate limiting logic
	// For now, return false
	return false
}

// formatEmailAlert formats an alert for email
func (as *AlertingSystem) formatEmailAlert(alert Alert) string {
	return fmt.Sprintf(`
Alert: %s
Severity: %s
Message: %s
Value: %.2f
Started: %s
Query: %s

Labels:
%s

Annotations:
%s
`, alert.RuleName, alert.Severity, alert.Message, alert.Value,
		alert.StartsAt.Format(time.RFC3339), alert.Query,
		as.formatMap(alert.Labels), as.formatMap(alert.Annotations))
}

// formatMap formats a map as a string
func (as *AlertingSystem) formatMap(m map[string]string) string {
	var parts []string
	for k, v := range m {
		parts = append(parts, fmt.Sprintf("  %s: %s", k, v))
	}
	return strings.Join(parts, "\n")
}

// getSlackColor returns Slack color for severity
func (as *AlertingSystem) getSlackColor(severity AlertSeverity) string {
	switch severity {
	case SeverityCritical:
		return "danger"
	case SeverityMajor:
		return "warning"
	case SeverityMinor:
		return "good"
	case SeverityWarning:
		return "warning"
	default:
		return "#36a64f" // green
	}
}

// getPagerDutySeverity returns PagerDuty severity
func (as *AlertingSystem) getPagerDutySeverity(severity AlertSeverity) string {
	switch severity {
	case SeverityCritical:
		return "critical"
	case SeverityMajor:
		return "error"
	case SeverityMinor:
		return "warning"
	case SeverityWarning:
		return "warning"
	default:
		return "info"
	}
}

// loadDefaultAlertRules loads default alert rules
func (as *AlertingSystem) loadDefaultAlertRules() {
	rules := []AlertRule{
		{
			ID:                   "api-high-error-rate",
			Name:                 "High API Error Rate",
			Description:          "API error rate is above threshold",
			Query:                "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m]) > 0.05",
			Condition:            ">",
			Threshold:            0.05,
			Duration:             2 * time.Minute,
			Severity:             SeverityCritical,
			Enabled:              true,
			For:                  2 * time.Minute,
			NotificationChannels: []string{"email", "slack"},
		},
		{
			ID:                   "api-high-latency",
			Name:                 "High API Latency",
			Description:          "API response time is above threshold",
			Query:                "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5",
			Condition:            ">",
			Threshold:            0.5,
			Duration:             5 * time.Minute,
			Severity:             SeverityWarning,
			Enabled:              true,
			For:                  5 * time.Minute,
			NotificationChannels: []string{"email"},
		},
		{
			ID:                   "quantum-service-down",
			Name:                 "Quantum Service Down",
			Description:          "Quantum processing service is down",
			Query:                "up{job=\"quantum-service\"} == 0",
			Condition:            "==",
			Threshold:            0,
			Duration:             1 * time.Minute,
			Severity:             SeverityCritical,
			Enabled:              true,
			For:                  1 * time.Minute,
			NotificationChannels: []string{"email", "slack", "pagerduty"},
		},
	}

	for _, rule := range rules {
		as.AddAlertRule(rule)
	}
}

// loadDefaultNotificationChannels loads default notification channels
func (as *AlertingSystem) loadDefaultNotificationChannels() {
	// Email channel
	emailChannel := NotificationChannel{
		ID:      "email",
		Name:    "Email Notifications",
		Type:    ChannelTypeEmail,
		Enabled: true,
		Config: map[string]string{
			"smtp_host": "smtp.gmail.com",
			"smtp_port": "587",
			"username":  "alerts@quantumbeam.io",
			"password":  "your-password",
			"from":      "alerts@quantumbeam.io",
			"to":        "ops@quantumbeam.io",
		},
		RateLimit: RateLimit{
			Enabled:  true,
			Limit:    10,
			Interval: time.Hour,
		},
	}

	// Slack channel
	slackChannel := NotificationChannel{
		ID:      "slack",
		Name:    "Slack Notifications",
		Type:    ChannelTypeSlack,
		Enabled: true,
		Config: map[string]string{
			"webhook_url": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK",
		},
		RateLimit: RateLimit{
			Enabled:  true,
			Limit:    50,
			Interval: time.Hour,
		},
	}

	// PagerDuty channel
	pagerDutyChannel := NotificationChannel{
		ID:      "pagerduty",
		Name:    "PagerDuty Notifications",
		Type:    ChannelTypePagerDuty,
		Enabled: true,
		Config: map[string]string{
			"integration_key": "your-integration-key",
		},
		RateLimit: RateLimit{
			Enabled:  true,
			Limit:    5,
			Interval: time.Hour,
		},
	}

	as.AddNotificationChannel(emailChannel)
	as.AddNotificationChannel(slackChannel)
	as.AddNotificationChannel(pagerDutyChannel)
}
