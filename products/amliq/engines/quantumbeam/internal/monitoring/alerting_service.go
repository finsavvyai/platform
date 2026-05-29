//go:build legacy_migrated
// +build legacy_migrated

package monitoring

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/smtp"
	"time"

	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
)

// AlertSeverity represents the severity level of an alert
type AlertSeverity string

const (
	SeverityInfo     AlertSeverity = "info"
	SeverityWarning  AlertSeverity = "warning"
	SeverityCritical AlertSeverity = "critical"
)

// AlertStatus represents the current status of an alert
type AlertStatus string

const (
	StatusFiring   AlertStatus = "firing"
	StatusResolved AlertStatus = "resolved"
)

// NotificationChannel represents different notification channels
type NotificationChannel string

const (
	ChannelEmail   NotificationChannel = "email"
	ChannelSlack   NotificationChannel = "slack"
	ChannelWebhook NotificationChannel = "webhook"
)

// Alert represents a monitoring alert
type Alert struct {
	ID                   string                 `json:"id"`
	Name                 string                 `json:"name"`
	Description          string                 `json:"description"`
	Severity             AlertSeverity          `json:"severity"`
	Status               AlertStatus            `json:"status"`
	Labels               map[string]string      `json:"labels"`
	Annotations          map[string]string      `json:"annotations"`
	StartsAt             time.Time              `json:"starts_at"`
	EndsAt               *time.Time             `json:"ends_at,omitempty"`
	GeneratorURL         string                 `json:"generator_url"`
	NotificationChannels []NotificationChannel  `json:"notification_channels"`
	Metadata             map[string]interface{} `json:"metadata,omitempty"`
}

// AlertRule represents a rule for generating alerts
type AlertRule struct {
	ID                   string                `json:"id"`
	Name                 string                `json:"name"`
	Query                string                `json:"query"`
	Severity             AlertSeverity         `json:"severity"`
	For                  time.Duration         `json:"for"`
	Labels               map[string]string     `json:"labels"`
	Annotations          map[string]string     `json:"annotations"`
	Enabled              bool                  `json:"enabled"`
	NotificationChannels []NotificationChannel `json:"notification_channels"`
	EvalInterval         time.Duration         `json:"eval_interval"`
}

// EmailConfig holds configuration for email notifications
type EmailConfig struct {
	SMTPHost     string   `json:"smtp_host"`
	SMTPPort     int      `json:"smtp_port"`
	SMTPUsername string   `json:"smtp_username"`
	SMTPPassword string   `json:"smtp_password"`
	From         string   `json:"from"`
	To           []string `json:"to"`
	UseTLS       bool     `json:"use_tls"`
}

// SlackConfig holds configuration for Slack notifications
type SlackConfig struct {
	WebhookURL string `json:"webhook_url"`
	Channel    string `json:"channel"`
	Username   string `json:"username"`
}

// WebhookConfig holds configuration for webhook notifications
type WebhookConfig struct {
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
	Timeout time.Duration     `json:"timeout"`
}

// AlertingConfig holds configuration for the alerting service
type AlertingConfig struct {
	PrometheusURL string        `json:"prometheus_url"`
	EvalInterval  time.Duration `json:"eval_interval"`
	EmailConfig   EmailConfig   `json:"email_config"`
	SlackConfig   SlackConfig   `json:"slack_config"`
	WebhookConfig WebhookConfig `json:"webhook_config"`
	Enabled       bool          `json:"enabled"`
}

// AlertingService provides intelligent alerting and notification management
type AlertingService struct {
	config              AlertingConfig
	prometheusAPI       v1.API
	rules               map[string]*AlertRule
	activeAlerts        map[string]*Alert
	alertHistory        []Alert
	notificationService *NotificationService
}

// NotificationService handles sending notifications through different channels
type NotificationService struct {
	emailConfig   EmailConfig
	slackConfig   SlackConfig
	webhookConfig WebhookConfig
}

// NewNotificationService creates a new notification service
func NewNotificationService(emailConfig EmailConfig, slackConfig SlackConfig, webhookConfig WebhookConfig) *NotificationService {
	return &NotificationService{
		emailConfig:   emailConfig,
		slackConfig:   slackConfig,
		webhookConfig: webhookConfig,
	}
}

// SendEmail sends an email notification
func (ns *NotificationService) SendEmail(alert Alert) error {
	if ns.emailConfig.SMTPHost == "" {
		return fmt.Errorf("email configuration not provided")
	}

	// Create email content
	subject := fmt.Sprintf("[%s] %s", string(alert.Severity), alert.Name)
	body := ns.formatEmailBody(alert)

	// Set up SMTP connection
	auth := smtp.PlainAuth("", ns.emailConfig.SMTPUsername, ns.emailConfig.SMTPPassword, ns.emailConfig.SMTPHost)

	// Construct message
	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%s",
		ns.emailConfig.From,
		joinEmailAddresses(ns.emailConfig.To),
		subject,
		body,
	)

	// Send email
	addr := fmt.Sprintf("%s:%d", ns.emailConfig.SMTPHost, ns.emailConfig.SMTPPort)
	err := smtp.SendMail(addr, auth, ns.emailConfig.From, ns.emailConfig.To, []byte(msg))
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	return nil
}

// SendSlack sends a Slack notification
func (ns *NotificationService) SendSlack(alert Alert) error {
	if ns.slackConfig.WebhookURL == "" {
		return fmt.Errorf("Slack configuration not provided")
	}

	// Create Slack payload
	payload := map[string]interface{}{
		"channel":  ns.slackConfig.Channel,
		"username": ns.slackConfig.Username,
		"text":     fmt.Sprintf("[%s] %s", string(alert.Severity), alert.Name),
		"attachments": []map[string]interface{}{
			{
				"color": ns.getSlackColor(alert.Severity),
				"fields": []map[string]interface{}{
					{
						"title": "Description",
						"value": alert.Description,
						"short": false,
					},
					{
						"title": "Status",
						"value": string(alert.Status),
						"short": true,
					},
					{
						"title": "Started",
						"value": alert.StartsAt.Format(time.RFC3339),
						"short": true,
					},
				},
				"footer": "QuantumBeam Alerting",
				"ts":     alert.StartsAt.Unix(),
			},
		},
	}

	// Add labels and annotations
	if len(alert.Labels) > 0 {
		for k, v := range alert.Labels {
			payload["attachments"] = append(payload["attachments"].([]map[string]interface{}), map[string]interface{}{
				"title": fmt.Sprintf("Label: %s", k),
				"value": v,
				"short": true,
			})
		}
	}

	// Send to Slack
	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal Slack payload: %w", err)
	}

	resp, err := http.Post(ns.slackConfig.WebhookURL, "application/json", bytes.NewBuffer(jsonPayload))
	if err != nil {
		return fmt.Errorf("failed to send Slack notification: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Slack webhook returned status %d", resp.StatusCode)
	}

	return nil
}

// SendWebhook sends a webhook notification
func (ns *NotificationService) SendWebhook(alert Alert) error {
	if ns.webhookConfig.URL == "" {
		return fmt.Errorf("webhook configuration not provided")
	}

	// Create webhook payload
	payload := map[string]interface{}{
		"alert":     alert,
		"timestamp": time.Now().UTC(),
		"service":   "quantumbeam-alerting",
	}

	// Convert to JSON
	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook payload: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", ns.webhookConfig.URL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return fmt.Errorf("failed to create webhook request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	for k, v := range ns.webhookConfig.Headers {
		req.Header.Set(k, v)
	}

	// Set timeout
	client := &http.Client{
		Timeout: ns.webhookConfig.Timeout,
	}

	// Send request
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send webhook: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}

	return nil
}

// getSlackColor returns the appropriate color for Slack messages based on severity
func (ns *NotificationService) getSlackColor(severity AlertSeverity) string {
	switch severity {
	case SeverityCritical:
		return "danger"
	case SeverityWarning:
		return "warning"
	default:
		return "good"
	}
}

// formatEmailBody formats the alert for email
func (ns *NotificationService) formatEmailBody(alert Alert) string {
	body := fmt.Sprintf("Alert: %s\n\n", alert.Name)
	body += fmt.Sprintf("Severity: %s\n", string(alert.Severity))
	body += fmt.Sprintf("Status: %s\n", string(alert.Status))
	body += fmt.Sprintf("Description: %s\n", alert.Description)
	body += fmt.Sprintf("Started: %s\n", alert.StartsAt.Format(time.RFC3339))

	if len(alert.Labels) > 0 {
		body += "\nLabels:\n"
		for k, v := range alert.Labels {
			body += fmt.Sprintf("  %s: %s\n", k, v)
		}
	}

	if len(alert.Annotations) > 0 {
		body += "\nAnnotations:\n"
		for k, v := range alert.Annotations {
			body += fmt.Sprintf("  %s: %s\n", k, v)
		}
	}

	if alert.GeneratorURL != "" {
		body += fmt.Sprintf("\nMore info: %s\n", alert.GeneratorURL)
	}

	return body
}

// joinEmailAddresses joins email addresses with commas
func joinEmailAddresses(addresses []string) string {
	if len(addresses) == 0 {
		return ""
	}
	result := addresses[0]
	for i := 1; i < len(addresses); i++ {
		result += ", " + addresses[i]
	}
	return result
}

// NewAlertingService creates a new alerting service
func NewAlertingService(config AlertingConfig) (*AlertingService, error) {
	var prometheusAPI v1.API
	var err error

	if config.PrometheusURL != "" {
		client, err := api.NewClient(api.Config{
			Address: config.PrometheusURL,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create Prometheus client: %w", err)
		}
		prometheusAPI = v1.NewAPI(client)
	}

	notificationService := NewNotificationService(
		config.EmailConfig,
		config.SlackConfig,
		config.WebhookConfig,
	)

	return &AlertingService{
		config:              config,
		prometheusAPI:       prometheusAPI,
		rules:               make(map[string]*AlertRule),
		activeAlerts:        make(map[string]*Alert),
		alertHistory:        make([]Alert, 0),
		notificationService: notificationService,
	}, nil
}

// AddRule adds a new alert rule
func (as *AlertingService) AddRule(rule AlertRule) error {
	if rule.ID == "" {
		return fmt.Errorf("rule ID cannot be empty")
	}
	if rule.Name == "" {
		return fmt.Errorf("rule name cannot be empty")
	}
	if rule.Query == "" {
		return fmt.Errorf("rule query cannot be empty")
	}

	as.rules[rule.ID] = &rule
	return nil
}

// RemoveRule removes an alert rule
func (as *AlertingService) RemoveRule(ruleID string) {
	delete(as.rules, ruleID)
	// Also remove any active alerts from this rule
	for alertID, alert := range as.activeAlerts {
		if alert.ID == ruleID {
			delete(as.activeAlerts, alertID)
		}
	}
}

// GetRules returns all alert rules
func (as *AlertingService) GetRules() map[string]*AlertRule {
	return as.rules
}

// GetActiveAlerts returns all currently active alerts
func (as *AlertingService) GetActiveAlerts() map[string]*Alert {
	return as.activeAlerts
}

// GetAlertHistory returns the alert history
func (as *AlertingService) GetAlertHistory() []Alert {
	return as.alertHistory
}

// EvaluateRules evaluates all enabled rules and generates alerts
func (as *AlertingService) EvaluateRules(ctx context.Context) error {
	if as.prometheusAPI == nil {
		return fmt.Errorf("Prometheus client not configured")
	}

	for _, rule := range as.rules {
		if !rule.Enabled {
			continue
		}

		err := as.evaluateRule(ctx, rule)
		if err != nil {
			// Log error but continue evaluating other rules
			fmt.Printf("Failed to evaluate rule %s: %v\n", rule.ID, err)
		}
	}

	return nil
}

// evaluateRule evaluates a single rule
func (as *AlertingService) evaluateRule(ctx context.Context, rule *AlertRule) error {
	// Query Prometheus
	result, warnings, err := as.prometheusAPI.Query(ctx, rule.Query, time.Now())
	if err != nil {
		return fmt.Errorf("failed to query Prometheus: %w", err)
	}

	if len(warnings) > 0 {
		fmt.Printf("Prometheus query warnings for rule %s: %v\n", rule.ID, warnings)
	}

	// Check if result indicates alert condition
	shouldFire := as.shouldFireAlert(result)
	alertID := rule.ID

	currentAlert, exists := as.activeAlerts[alertID]

	if shouldFire && (!exists || currentAlert.Status == StatusResolved) {
		// Create or update alert
		alert := Alert{
			ID:                   alertID,
			Name:                 rule.Name,
			Description:          rule.Annotations["description"],
			Severity:             rule.Severity,
			Status:               StatusFiring,
			Labels:               rule.Labels,
			Annotations:          rule.Annotations,
			StartsAt:             time.Now().UTC(),
			NotificationChannels: rule.NotificationChannels,
		}

		// Add Prometheus-specific labels
		if labels := as.extractLabelsFromResult(result); len(labels) > 0 {
			for k, v := range labels {
				alert.Labels[k] = v
			}
		}

		as.activeAlerts[alertID] = &alert
		as.alertHistory = append(as.alertHistory, alert)

		// Send notifications
		err := as.sendNotifications(alert)
		if err != nil {
			fmt.Printf("Failed to send notifications for alert %s: %v\n", alertID, err)
		}

	} else if !shouldFire && exists && currentAlert.Status == StatusFiring {
		// Resolve alert
		now := time.Now().UTC()
		currentAlert.Status = StatusResolved
		currentAlert.EndsAt = &now

		as.alertHistory = append(as.alertHistory, *currentAlert)
		delete(as.activeAlerts, alertID)

		// Send resolution notifications
		err := as.sendNotifications(*currentAlert)
		if err != nil {
			fmt.Printf("Failed to send resolution notifications for alert %s: %v\n", alertID, err)
		}
	}

	return nil
}

// shouldFireAlert determines if an alert should fire based on Prometheus query result
func (as *AlertingService) shouldFireAlert(result interface{}) bool {
	// Simple implementation: fire if result is non-empty
	// In a real implementation, this would be more sophisticated
	// based on the type of result (vector, matrix, scalar, etc.)
	return result != nil
}

// extractLabelsFromResult extracts labels from Prometheus query result
func (as *AlertingService) extractLabelsFromResult(result interface{}) map[string]string {
	labels := make(map[string]string)

	// This is a simplified implementation
	// In a real implementation, you'd parse the actual Prometheus result structure
	// and extract relevant labels based on the query type

	return labels
}

// sendNotifications sends notifications through all configured channels
func (as *AlertingService) sendNotifications(alert Alert) error {
	var errors []error

	for _, channel := range alert.NotificationChannels {
		var err error

		switch channel {
		case ChannelEmail:
			err = as.notificationService.SendEmail(alert)
		case ChannelSlack:
			err = as.notificationService.SendSlack(alert)
		case ChannelWebhook:
			err = as.notificationService.SendWebhook(alert)
		default:
			err = fmt.Errorf("unknown notification channel: %s", channel)
		}

		if err != nil {
			errors = append(errors, err)
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("failed to send some notifications: %v", errors)
	}

	return nil
}

// Start starts the alerting service evaluation loop
func (as *AlertingService) Start(ctx context.Context) error {
	if !as.config.Enabled {
		return nil
	}

	ticker := time.NewTicker(as.config.EvalInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			err := as.EvaluateRules(ctx)
			if err != nil {
				fmt.Printf("Failed to evaluate alert rules: %v\n", err)
			}
		}
	}
}

// AddPredefinedRules adds common alert rules for fraud detection
func (as *AlertingService) AddPredefinedRules() {
	// High fraud detection rate
	as.AddRule(AlertRule{
		ID:                   "high_fraud_rate",
		Name:                 "High Fraud Detection Rate",
		Query:                "rate(quantumbeam_fraud_detection_total[5m]) > 0.1",
		Severity:             SeverityWarning,
		For:                  2 * time.Minute,
		Labels:               map[string]string{"service": "fraud_detection"},
		Annotations:          map[string]string{"description": "Fraud detection rate is above 10%"},
		Enabled:              true,
		NotificationChannels: []NotificationChannel{ChannelEmail, ChannelSlack},
		EvalInterval:         30 * time.Second,
	})

	// High error rate
	as.AddRule(AlertRule{
		ID:                   "high_error_rate",
		Name:                 "High Error Rate",
		Query:                "rate(quantumbeam_http_requests_total{status_code=~\"5..\"}[5m]) > 0.05",
		Severity:             SeverityCritical,
		For:                  1 * time.Minute,
		Labels:               map[string]string{"service": "api"},
		Annotations:          map[string]string{"description": "HTTP 5xx error rate is above 5%"},
		Enabled:              true,
		NotificationChannels: []NotificationChannel{ChannelEmail, ChannelSlack, ChannelWebhook},
		EvalInterval:         30 * time.Second,
	})

	// Slow response times
	as.AddRule(AlertRule{
		ID:                   "slow_response_times",
		Name:                 "Slow Response Times",
		Query:                "histogram_quantile(0.95, rate(quantumbeam_http_request_duration_seconds_bucket[5m])) > 1",
		Severity:             SeverityWarning,
		For:                  3 * time.Minute,
		Labels:               map[string]string{"service": "api"},
		Annotations:          map[string]string{"description": "95th percentile response time is above 1 second"},
		Enabled:              true,
		NotificationChannels: []NotificationChannel{ChannelEmail},
		EvalInterval:         30 * time.Second,
	})

	// Quantum backend down
	as.AddRule(AlertRule{
		ID:                   "quantum_backend_down",
		Name:                 "Quantum Backend Down",
		Query:                "quantumbeam_quantum_backend_status == 0",
		Severity:             SeverityCritical,
		For:                  30 * time.Second,
		Labels:               map[string]string{"service": "quantum"},
		Annotations:          map[string]string{"description": "One or more quantum backends are down"},
		Enabled:              true,
		NotificationChannels: []NotificationChannel{ChannelEmail, ChannelSlack, ChannelWebhook},
		EvalInterval:         15 * time.Second,
	})

	// Database connection issues
	as.AddRule(AlertRule{
		ID:                   "database_connection_issues",
		Name:                 "Database Connection Issues",
		Query:                "quantumbeam_database_connections == 0",
		Severity:             SeverityCritical,
		For:                  1 * time.Minute,
		Labels:               map[string]string{"service": "database"},
		Annotations:          map[string]string{"description": "No active database connections"},
		Enabled:              true,
		NotificationChannels: []NotificationChannel{ChannelEmail, ChannelSlack},
		EvalInterval:         30 * time.Second,
	})
}