package observability

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/sirupsen/logrus"
)

// AlertManager manages alerting rules and notifications
type AlertManager struct {
	config      AlertingConfig
	prometheus  v1.API
	rules       map[string]*AlertRule
	logger      *logrus.Logger
	notifiers   map[string]Notifier
	ruleHistory map[string][]AlertEvent
}

// AlertingConfig holds configuration for alerting
type AlertingConfig struct {
	Enabled             bool          `yaml:"enabled"`
	PrometheusURL       string        `yaml:"prometheus_url"`
	EvaluationInterval  time.Duration `yaml:"evaluation_interval"`
	NotificationTimeout time.Duration `yaml:"notification_timeout"`
	MaxAlertsPerRule    int           `yaml:"max_alerts_per_rule"`

	// Notification channels
	Channels []NotificationChannel `yaml:"channels"`

	// Alert rules
	Rules []AlertRule `yaml:"rules"`

	// Alert grouping
	GroupBy        []string      `yaml:"group_by"`
	GroupWait      time.Duration `yaml:"group_wait"`
	GroupInterval  time.Duration `yaml:"group_interval"`
	RepeatInterval time.Duration `yaml:"repeat_interval"`
}

// NotificationChannel represents a notification channel
type NotificationChannel struct {
	Name     string                 `yaml:"name"`
	Type     string                 `yaml:"type"` // slack, email, pagerduty, webhook
	Enabled  bool                   `yaml:"enabled"`
	Config   map[string]interface{} `yaml:"config"`
	Severity []string               `yaml:"severity"` // which severities to send
}

// AlertRule represents an alert rule
type AlertRule struct {
	Name        string            `yaml:"name"`
	Description string            `yaml:"description"`
	Query       string            `yaml:"query"`
	For         time.Duration     `yaml:"for"`
	Labels      map[string]string `yaml:"labels"`
	Annotations map[string]string `yaml:"annotations"`
	Severity    string            `yaml:"severity"` // critical, warning, info
	Enabled     bool              `yaml:"enabled"`

	// Rule-specific settings
	Threshold    float64       `yaml:"threshold"`
	Operator     string        `yaml:"operator"` // >, <, >=, <=, ==, !=
	EvalInterval time.Duration `yaml:"eval_interval"`
}

// AlertEvent represents an alert event
type AlertEvent struct {
	Timestamp   time.Time         `json:"timestamp"`
	RuleName    string            `json:"rule_name"`
	Severity    string            `json:"severity"`
	Status      string            `json:"status"` // firing, resolved
	Value       float64           `json:"value"`
	Threshold   float64           `json:"threshold"`
	Message     string            `json:"message"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	EvaluatedAt time.Time         `json:"evaluated_at"`
	ResolvedAt  *time.Time        `json:"resolved_at,omitempty"`
}

// Notifier interface for sending notifications
type Notifier interface {
	Send(ctx context.Context, alert AlertEvent) error
	Type() string
	IsHealthy(ctx context.Context) bool
}

// NewAlertManager creates a new alert manager
func NewAlertManager(config AlertingConfig, logger *logrus.Logger) (*AlertManager, error) {
	if !config.Enabled {
		return &AlertManager{
			config:      config,
			rules:       make(map[string]*AlertRule),
			notifiers:   make(map[string]Notifier),
			ruleHistory: make(map[string][]AlertEvent),
			logger:      logger,
		}, nil
	}

	// Create Prometheus client
	client, err := api.NewClient(api.Config{
		Address: config.PrometheusURL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Prometheus client: %w", err)
	}

	prometheus := v1.NewAPI(client)

	am := &AlertManager{
		config:      config,
		prometheus:  prometheus,
		rules:       make(map[string]*AlertRule),
		notifiers:   make(map[string]Notifier),
		ruleHistory: make(map[string][]AlertEvent),
		logger:      logger,
	}

	// Initialize notifiers
	for _, channel := range config.Channels {
		if !channel.Enabled {
			continue
		}

		notifier, err := createNotifier(channel)
		if err != nil {
			logger.WithError(err).WithField("channel", channel.Name).Error("Failed to create notifier")
			continue
		}

		am.notifiers[channel.Name] = notifier
	}

	// Load alert rules
	for _, rule := range config.Rules {
		if rule.Enabled {
			am.rules[rule.Name] = &rule
		}
	}

	return am, nil
}

// Start starts the alert manager
func (am *AlertManager) Start(ctx context.Context) error {
	if !am.config.Enabled {
		am.logger.Info("Alerting is disabled")
		return nil
	}

	am.logger.Info("Starting alert manager")

	ticker := time.NewTicker(am.config.EvaluationInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			am.evaluateRules(ctx)
		}
	}
}

// evaluateRules evaluates all alert rules
func (am *AlertManager) evaluateRules(ctx context.Context) {
	for name, rule := range am.rules {
		if !rule.Enabled {
			continue
		}

		go func(ruleName string, r *AlertRule) {
			evalCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
			defer cancel()

			if err := am.evaluateRule(evalCtx, r); err != nil {
				am.logger.WithError(err).
					WithField("rule", ruleName).
					Error("Failed to evaluate rule")
			}
		}(name, rule)
	}
}

// evaluateRule evaluates a single alert rule
func (am *AlertManager) evaluateRule(ctx context.Context, rule *AlertRule) error {
	// Query Prometheus
	result, _, err := am.prometheus.Query(ctx, rule.Query, time.Now())
	if err != nil {
		return fmt.Errorf("failed to query Prometheus: %w", err)
	}

	// Parse result
	value, err := extractValue(result)
	if err != nil {
		return fmt.Errorf("failed to extract value from result: %w", err)
	}

	// Check if alert should fire
	shouldFire := am.shouldFireAlert(value, rule)

	// Get rule history
	history := am.ruleHistory[rule.Name]
	var lastEvent *AlertEvent
	if len(history) > 0 {
		lastEvent = &history[len(history)-1]
	}

	// Determine alert status
	var status string
	var event *AlertEvent

	if shouldFire {
		status = "firing"

		// Check if this is a new firing or continuation
		if lastEvent == nil || lastEvent.Status == "resolved" {
			// New alert
			event = &AlertEvent{
				Timestamp:   time.Now(),
				RuleName:    rule.Name,
				Severity:    rule.Severity,
				Status:      status,
				Value:       value,
				Threshold:   rule.Threshold,
				Message:     am.formatAlertMessage(rule, value),
				Labels:      rule.Labels,
				Annotations: rule.Annotations,
				EvaluatedAt: time.Now(),
			}

			// Add to history
			am.ruleHistory[rule.Name] = append(history, *event)

			// Send notification
			am.sendNotification(ctx, *event)

			am.logger.WithFields(logrus.Fields{
				"rule":      rule.Name,
				"severity":  rule.Severity,
				"value":     value,
				"threshold": rule.Threshold,
			}).Warn("Alert fired")
		} else if lastEvent.Status == "firing" {
			// Update existing firing alert
			lastEvent.Timestamp = time.Now()
			lastEvent.Value = value
		}
	} else {
		status = "resolved"

		// Check if this is a resolution
		if lastEvent != nil && lastEvent.Status == "firing" {
			now := time.Now()
			lastEvent.Status = status
			lastEvent.ResolvedAt = &now

			// Send resolution notification
			am.sendNotification(ctx, *lastEvent)

			am.logger.WithFields(logrus.Fields{
				"rule":      rule.Name,
				"severity":  rule.Severity,
				"value":     value,
				"threshold": rule.Threshold,
			}).Info("Alert resolved")
		}
	}

	// Cleanup old history (keep last 100 events per rule)
	if len(am.ruleHistory[rule.Name]) > 100 {
		am.ruleHistory[rule.Name] = am.ruleHistory[rule.Name][1:]
	}

	return nil
}

// shouldFireAlert determines if an alert should fire based on the value and rule
func (am *AlertManager) shouldFireAlert(value float64, rule *AlertRule) bool {
	switch rule.Operator {
	case ">":
		return value > rule.Threshold
	case "<":
		return value < rule.Threshold
	case ">=":
		return value >= rule.Threshold
	case "<=":
		return value <= rule.Threshold
	case "==":
		return value == rule.Threshold
	case "!=":
		return value != rule.Threshold
	default:
		return false
	}
}

// formatAlertMessage formats an alert message
func (am *AlertManager) formatAlertMessage(rule *AlertRule, value float64) string {
	if rule.Description != "" {
		return fmt.Sprintf("%s (current: %.2f, threshold: %.2f)", rule.Description, value, rule.Threshold)
	}
	return fmt.Sprintf("Alert %s fired (current: %.2f, threshold: %.2f)", rule.Name, value, rule.Threshold)
}

// sendNotification sends a notification for an alert
func (am *AlertManager) sendNotification(ctx context.Context, alert AlertEvent) {
	for _, channel := range am.config.Channels {
		if !channel.Enabled {
			continue
		}

		// Check if channel should receive this severity
		if len(channel.Severity) > 0 {
			shouldSend := false
			for _, s := range channel.Severity {
				if s == alert.Severity {
					shouldSend = true
					break
				}
			}
			if !shouldSend {
				continue
			}
		}

		notifier, exists := am.notifiers[channel.Name]
		if !exists {
			continue
		}

		// Send notification in background — outbound notifier call has its own
		// timeout derived from Background; request ctx not applicable.
		go func(n Notifier, a AlertEvent) { // #nosec G118 -- notification worker outlives request
			ctx, cancel := context.WithTimeout(context.Background(), am.config.NotificationTimeout)
			defer cancel()

			if err := n.Send(ctx, a); err != nil {
				am.logger.WithError(err).
					WithField("channel", channel.Name).
					WithField("alert", a.RuleName).
					Error("Failed to send notification")
			}
		}(notifier, alert)
	}
}

// GetActiveAlerts returns all currently active alerts
func (am *AlertManager) GetActiveAlerts() []AlertEvent {
	var active []AlertEvent

	for _, history := range am.ruleHistory {
		for _, event := range history {
			if event.Status == "firing" {
				active = append(active, event)
			}
		}
	}

	return active
}

// GetAlertHistory returns the history for a specific rule
func (am *AlertManager) GetAlertHistory(ruleName string) []AlertEvent {
	return am.ruleHistory[ruleName]
}

// createNotifier creates a notifier based on channel configuration
func createNotifier(channel NotificationChannel) (Notifier, error) {
	switch channel.Type {
	case "slack":
		return NewSlackNotifier(channel.Config)
	case "email":
		return NewEmailNotifier(channel.Config)
	case "pagerduty":
		return NewPagerDutyNotifier(channel.Config)
	case "webhook":
		return NewWebhookNotifier(channel.Config)
	default:
		return nil, fmt.Errorf("unsupported notifier type: %s", channel.Type)
	}
}

// extractValue extracts a numeric value from Prometheus query result
func extractValue(result interface{}) (float64, error) {
	// This is a simplified implementation
	// In a real implementation, you would properly parse the Prometheus response
	switch v := result.(type) {
	case float64:
		return v, nil
	case string:
		// Try to parse as float
		var f float64
		_, err := fmt.Sscanf(v, "%f", &f)
		return f, err
	default:
		return 0, fmt.Errorf("unsupported result type: %T", result)
	}
}

// SlackNotifier implements Notifier for Slack
type SlackNotifier struct {
	webhookURL string
	channel    string
	username   string
}

func NewSlackNotifier(config map[string]interface{}) (*SlackNotifier, error) {
	webhookURL, ok := config["webhook_url"].(string)
	if !ok {
		return nil, fmt.Errorf("missing webhook_url in slack config")
	}

	channel, _ := config["channel"].(string)
	username, _ := config["username"].(string)

	return &SlackNotifier{
		webhookURL: webhookURL,
		channel:    channel,
		username:   username,
	}, nil
}

func (n *SlackNotifier) Send(ctx context.Context, alert AlertEvent) error {
	// Implement Slack notification
	// This would make an HTTP POST to the Slack webhook
	return nil
}

func (n *SlackNotifier) Type() string {
	return "slack"
}

func (n *SlackNotifier) IsHealthy(ctx context.Context) bool {
	// Implement health check
	return true
}

// EmailNotifier implements Notifier for email
type EmailNotifier struct {
	smtpHost string
	smtpPort int
	username string
	password string
	from     string
	to       []string
}

func NewEmailNotifier(config map[string]interface{}) (*EmailNotifier, error) {
	// Parse email configuration
	return &EmailNotifier{}, nil
}

func (n *EmailNotifier) Send(ctx context.Context, alert AlertEvent) error {
	// Implement email notification
	return nil
}

func (n *EmailNotifier) Type() string {
	return "email"
}

func (n *EmailNotifier) IsHealthy(ctx context.Context) bool {
	return true
}

// PagerDutyNotifier implements Notifier for PagerDuty
type PagerDutyNotifier struct {
	integrationKey string
	severity       string
}

func NewPagerDutyNotifier(config map[string]interface{}) (*PagerDutyNotifier, error) {
	// Parse PagerDuty configuration
	return &PagerDutyNotifier{}, nil
}

func (n *PagerDutyNotifier) Send(ctx context.Context, alert AlertEvent) error {
	// Implement PagerDuty notification
	return nil
}

func (n *PagerDutyNotifier) Type() string {
	return "pagerduty"
}

func (n *PagerDutyNotifier) IsHealthy(ctx context.Context) bool {
	return true
}

// WebhookNotifier implements Notifier for generic webhooks
type WebhookNotifier struct {
	url     string
	headers map[string]string
	method  string
}

func NewWebhookNotifier(config map[string]interface{}) (*WebhookNotifier, error) {
	// Parse webhook configuration
	return &WebhookNotifier{}, nil
}

func (n *WebhookNotifier) Send(ctx context.Context, alert AlertEvent) error {
	// Implement webhook notification
	payload, _ := json.Marshal(alert)

	// Make HTTP request to webhook URL
	_ = payload

	return nil
}

func (n *WebhookNotifier) Type() string {
	return "webhook"
}

func (n *WebhookNotifier) IsHealthy(ctx context.Context) bool {
	return true
}
