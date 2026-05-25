package alerting

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/streadway/amqp"
)

// AlertSeverity represents the severity level of an alert
type AlertSeverity string

const (
	SeverityInfo     AlertSeverity = "info"
	SeverityWarning  AlertSeverity = "warning"
	SeverityCritical AlertSeverity = "critical"
	SeverityFatal    AlertSeverity = "fatal"
)

// AlertStatus represents the status of an alert
type AlertStatus string

const (
	StatusFiring   AlertStatus = "firing"
	StatusResolved AlertStatus = "resolved"
	StatusSilenced AlertStatus = "silenced"
)

// NotificationChannel represents different notification channels
type NotificationChannel string

const (
	ChannelEmail   NotificationChannel = "email"
	ChannelSlack   NotificationChannel = "slack"
	ChannelWebhook NotificationChannel = "webhook"
	ChannelSMS     NotificationChannel = "sms"
	ChannelPager   NotificationChannel = "pager"
)

// AlertRule represents an alert rule definition
type AlertRule struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Query       string          `json:"query"`
	Condition   string          `json:"condition"`
	Threshold   float64         `json:"threshold"`
	Duration    time.Duration   `json:"duration"`
	Severity    AlertSeverity   `json:"severity"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	Enabled     bool            `json:"enabled"`
	Channels    []NotificationChannel `json:"channels"`
	EscalationPolicy *EscalationPolicy `json:"escalation_policy,omitempty"`
}

// EscalationPolicy defines how alerts escalate
type EscalationPolicy struct {
	Levels []EscalationLevel `json:"levels"`
}

// EscalationLevel defines a single escalation level
type EscalationLevel struct {
	WaitTime    time.Duration         `json:"wait_time"`
	Channels    []NotificationChannel `json:"channels"`
	Recipients  []string              `json:"recipients"`
	Conditions  map[string]interface{} `json:"conditions,omitempty"`
}

// Alert represents an active alert
type Alert struct {
	ID          string                 `json:"id"`
	RuleID      string                 `json:"rule_id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Status      AlertStatus            `json:"status"`
	Severity    AlertSeverity          `json:"severity"`
	StartTime   time.Time              `json:"start_time"`
	EndTime     *time.Time             `json:"end_time,omitempty"`
	LastSent    time.Time              `json:"last_sent"`
	Value       float64                `json:"value"`
	Threshold   float64                `json:"threshold"`
	Labels      map[string]string      `json:"labels"`
	Annotations map[string]string      `json:"annotations"`
	Context     map[string]interface{} `json:"context"`
	EscalationLevel int                `json:"escalation_level"`
}

// Notification represents a notification message
type Notification struct {
	ID         string                 `json:"id"`
	AlertID    string                 `json:"alert_id"`
	Channel    NotificationChannel    `json:"channel"`
	Recipient  string                 `json:"recipient"`
	Subject    string                 `json:"subject"`
	Message    string                 `json:"message"`
	Status     string                 `json:"status"`
	Attempts   int                    `json:"attempts"`
	LastAttempt time.Time             `json:"last_attempt"`
	SentAt     *time.Time             `json:"sent_at,omitempty"`
	Error      string                 `json:"error,omitempty"`
	Metadata   map[string]interface{} `json:"metadata"`
}

// Config holds alerting configuration
type Config struct {
	PrometheusURL      string        `json:"prometheus_url"`
	RedisAddr          string        `json:"redis_addr"`
	RabbitMQURL        string        `json:"rabbitmq_url"`
	SMTPServer         string        `json:"smtp_server"`
	SMTPPort           int           `json:"smtp_port"`
	SMTPUsername       string        `json:"smtp_username"`
	SMTPPassword       string        `json:"smtp_password"`
	SlackWebhookURL    string        `json:"slack_webhook_url"`
	DefaultFromEmail   string        `json:"default_from_email"`
	MaxRetries         int           `json:"max_retries"`
	RetryDelay         time.Duration `json:"retry_delay"`
	EvaluationInterval time.Duration `json:"evaluation_interval"`
	NotificationTimeout time.Duration `json:"notification_timeout"`
}

// AlertManager manages alerts and notifications
type AlertManager struct {
	config       *Config
	promClient   v1.API
	redisClient  *redis.Client
	rabbitConn   *amqp.Connection
	rules        map[string]*AlertRule
	activeAlerts map[string]*Alert
}

// NewAlertManager creates a new alert manager
func NewAlertManager(config *Config) (*AlertManager, error) {
	// Initialize Prometheus client
	client, err := api.NewClient(api.Config{
		Address: config.PrometheusURL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Prometheus client: %w", err)
	}

	promClient := v1.NewAPI(client)

	// Initialize Redis client
	rdb := redis.NewClient(&redis.Options{
		Addr: config.RedisAddr,
	})

	// Initialize RabbitMQ connection
	conn, err := amqp.Dial(config.RabbitMQURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	return &AlertManager{
		config:       config,
		promClient:   promClient,
		redisClient:  rdb,
		rabbitConn:   conn,
		rules:        make(map[string]*AlertRule),
		activeAlerts: make(map[string]*Alert),
	}, nil
}

// LoadDefaultRules loads default alert rules
func (am *AlertManager) LoadDefaultRules() {
	defaultRules := []*AlertRule{
		{
			ID:          "high_fraud_rate",
			Name:        "High Fraud Detection Rate",
			Description: "Fraud detection rate is above threshold",
			Query:       "rate(fraud_detections_total[5m])",
			Condition:   ">",
			Threshold:   0.1,
			Duration:    2 * time.Minute,
			Severity:    SeverityWarning,
			Labels: map[string]string{
				"team":     "security",
				"service":  "fraud_detection",
				"category": "business_metrics",
			},
			Channels: []NotificationChannel{ChannelEmail, ChannelSlack},
			Enabled:  true,
		},
		{
			ID:          "quantum_backend_down",
			Name:        "Quantum Backend Unavailable",
			Description: "Quantum backend is not responding",
			Query:       "quantum_backend_availability",
			Condition:   "<",
			Threshold:   0.5,
			Duration:    1 * time.Minute,
			Severity:    SeverityCritical,
			Labels: map[string]string{
				"team":     "infrastructure",
				"service":  "quantum_processing",
				"category": "system_health",
			},
			Channels: []NotificationChannel{ChannelEmail, ChannelSlack, ChannelPager},
			Enabled:  true,
			EscalationPolicy: &EscalationPolicy{
				Levels: []EscalationLevel{
					{
						WaitTime: 5 * time.Minute,
						Channels: []NotificationChannel{ChannelEmail, ChannelSlack},
						Recipients: []string{"team-leads@quantumbeam.io"},
					},
					{
						WaitTime: 15 * time.Minute,
						Channels: []NotificationChannel{ChannelPager},
						Recipients: []string{"oncall@quantumbeam.io"},
					},
				},
			},
		},
		{
			ID:          "high_response_time",
			Name:        "High API Response Time",
			Description: "API response time is above SLA",
			Query:       "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
			Condition:   ">",
			Threshold:   1.0,
			Duration:    3 * time.Minute,
			Severity:    SeverityWarning,
			Labels: map[string]string{
				"team":     "infrastructure",
				"service":  "api",
				"category": "performance",
			},
			Channels: []NotificationChannel{ChannelEmail, ChannelSlack},
			Enabled:  true,
		},
		{
			ID:          "authentication_failures",
			Name:        "High Authentication Failure Rate",
			Description: "Authentication failure rate is suspiciously high",
			Query:       "rate(failed_auth_attempts_total[5m]) / rate(login_attempts_total[5m])",
			Condition:   ">",
			Threshold:   0.3,
			Duration:    1 * time.Minute,
			Severity:    SeverityCritical,
			Labels: map[string]string{
				"team":     "security",
				"service":  "authentication",
				"category": "security",
			},
			Channels: []NotificationChannel{ChannelEmail, ChannelSlack, ChannelPager},
			Enabled:  true,
		},
		{
			ID:          "quantum_circuit_failures",
			Name:        "High Quantum Circuit Failure Rate",
			Description: "Quantum circuit execution failure rate is high",
			Query:       "rate(quantum_circuit_executions_total{result=\"failed\"}[5m]) / rate(quantum_circuit_executions_total[5m])",
			Condition:   ">",
			Threshold:   0.2,
			Duration:    2 * time.Minute,
			Severity:    SeverityWarning,
			Labels: map[string]string{
				"team":     "quantum",
				"service":  "quantum_processing",
				"category": "quantum_metrics",
			},
			Channels: []NotificationChannel{ChannelEmail, ChannelSlack},
			Enabled:  true,
		},
		{
			ID:          "memory_usage_high",
			Name:        "High Memory Usage",
			Description: "Memory usage is above threshold",
			Query:       "memory_usage_bytes / (1024*1024*1024)",
			Condition:   ">",
			Threshold:   8.0, // 8GB
			Duration:    5 * time.Minute,
			Severity:    SeverityWarning,
			Labels: map[string]string{
				"team":     "infrastructure",
				"service":  "system",
				"category": "system_health",
			},
			Channels: []NotificationChannel{ChannelEmail, ChannelSlack},
			Enabled:  true,
		},
		{
			ID:          "database_connections_high",
			Name:        "High Database Connection Usage",
			Description: "Database connection pool usage is high",
			Query:       "database_connections_active / database_connections_max",
			Condition:   ">",
			Threshold:   0.8,
			Duration:    3 * time.Minute,
			Severity:    SeverityWarning,
			Labels: map[string]string{
				"team":     "infrastructure",
				"service":  "database",
				"category": "system_health",
			},
			Channels: []NotificationChannel{ChannelEmail, ChannelSlack},
			Enabled:  true,
		},
	}

	for _, rule := range defaultRules {
		am.rules[rule.ID] = rule
	}
}

// AddRule adds a new alert rule
func (am *AlertManager) AddRule(rule *AlertRule) error {
	// Validate rule
	if err := am.validateRule(rule); err != nil {
		return fmt.Errorf("invalid rule: %w", err)
	}

	am.rules[rule.ID] = rule

	// Store rule in Redis for persistence
	ruleData, err := json.Marshal(rule)
	if err != nil {
		return fmt.Errorf("failed to marshal rule: %w", err)
	}

	return am.redisClient.Set(context.Background(),
		fmt.Sprintf("alert_rule:%s", rule.ID),
		ruleData,
		0).Err()
}

// RemoveRule removes an alert rule
func (am *AlertManager) RemoveRule(ruleID string) error {
	delete(am.rules, ruleID)

	// Remove from Redis
	return am.redisClient.Del(context.Background(),
		fmt.Sprintf("alert_rule:%s", ruleID)).Err()
}

// Start starts the alert manager
func (am *AlertManager) Start(ctx context.Context) error {
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

// evaluateRules evaluates all enabled alert rules
func (am *AlertManager) evaluateRules(ctx context.Context) {
	for _, rule := range am.rules {
		if !rule.Enabled {
			continue
		}

		go am.evaluateRule(ctx, rule)
	}
}

// evaluateRule evaluates a single alert rule
func (am *AlertManager) evaluateRule(ctx context.Context, rule *AlertRule) {
	// Query Prometheus
	result, warnings, err := am.promClient.Query(ctx, rule.Query, time.Now())
	if err != nil {
		am.logError("failed to query Prometheus", map[string]interface{}{
			"rule_id": rule.ID,
			"query":   rule.Query,
			"error":   err.Error(),
		})
		return
	}

	if len(warnings) > 0 {
		am.logWarning("Prometheus query warnings", map[string]interface{}{
			"rule_id":  rule.ID,
			"warnings": warnings,
		})
	}

	// Process result
	if result.Type() == model.ValVector {
		vector := result.(model.Vector)
		for _, sample := range vector {
			value := float64(sample.Value)

			// Check if condition is met
			conditionMet := am.checkCondition(value, rule.Condition, rule.Threshold)

			alertID := fmt.Sprintf("%s:%s", rule.ID, sample.Metric.String())

			if conditionMet {
				// Check if alert already exists
				if alert, exists := am.activeAlerts[alertID]; exists {
					// Update existing alert
					alert.Value = value
					alert.LastSent = time.Now()

					// Check for escalation
					am.checkEscalation(ctx, alert)
				} else {
					// Create new alert
					alert := &Alert{
						ID:            alertID,
						RuleID:        rule.ID,
						Name:          rule.Name,
						Description:   rule.Description,
						Status:        StatusFiring,
						Severity:      rule.Severity,
						StartTime:     time.Now(),
						LastSent:      time.Now(),
						Value:         value,
						Threshold:     rule.Threshold,
						Labels:        rule.Labels,
						Annotations:   rule.Annotations,
						Context:       map[string]interface{}{
							"metric": sample.Metric.String(),
							"query":  rule.Query,
						},
						EscalationLevel: 0,
					}

					am.activeAlerts[alertID] = alert
					am.storeAlert(ctx, alert)
					am.sendNotifications(ctx, alert)
				}
			} else {
				// Check if alert exists and should be resolved
				if alert, exists := am.activeAlerts[alertID]; exists {
					now := time.Now()
					alert.Status = StatusResolved
					alert.EndTime = &now

					am.storeAlert(ctx, alert)
					am.sendResolutionNotifications(ctx, alert)

					delete(am.activeAlerts, alertID)
				}
			}
		}
	}
}

// checkCondition checks if a value meets the condition
func (am *AlertManager) checkCondition(value float64, condition string, threshold float64) bool {
	switch condition {
	case ">":
		return value > threshold
	case ">=":
		return value >= threshold
	case "<":
		return value < threshold
	case "<=":
		return value <= threshold
	case "==":
		return value == threshold
	case "!=":
		return value != threshold
	default:
		return false
	}
}

// checkEscalation checks if an alert should be escalated
func (am *AlertManager) checkEscalation(ctx context.Context, alert *Alert) {
	if alert.EscalationPolicy == nil {
		return
	}

	timeSinceStart := time.Since(alert.StartTime)
	currentLevel := alert.EscalationLevel

	// Check if we should escalate to next level
	if currentLevel < len(alert.EscalationPolicy.Levels)-1 {
		nextLevel := alert.EscalationPolicy.Levels[currentLevel+1]
		if timeSinceStart >= nextLevel.WaitTime {
			alert.EscalationLevel++
			am.sendEscalationNotifications(ctx, alert, nextLevel)
		}
	}
}

// sendNotifications sends notifications for an alert
func (am *AlertManager) sendNotifications(ctx context.Context, alert *Alert) {
	for _, channel := range am.getAlertChannels(alert) {
		notification := &Notification{
			ID:        fmt.Sprintf("%s:%s:%d", alert.ID, channel, time.Now().Unix()),
			AlertID:   alert.ID,
			Channel:   channel,
			Subject:   fmt.Sprintf("[%s] %s", string(alert.Severity), alert.Name),
			Status:    "pending",
			Attempts:  0,
			Metadata: map[string]interface{}{
				"alert": alert,
			},
		}

		// Generate message based on channel
		notification.Message = am.generateMessage(alert, channel)

		// Send notification
		go am.sendNotification(ctx, notification)
	}
}

// sendNotification sends a single notification
func (am *AlertManager) sendNotification(ctx context.Context, notification *Notification) {
	var err error

	switch notification.Channel {
	case ChannelEmail:
		err = am.sendEmailNotification(ctx, notification)
	case ChannelSlack:
		err = am.sendSlackNotification(ctx, notification)
	case ChannelWebhook:
		err = am.sendWebhookNotification(ctx, notification)
	case ChannelSMS:
		err = am.sendSMSNotification(ctx, notification)
	case ChannelPager:
		err = am.sendPagerNotification(ctx, notification)
	}

	notification.Attempts++
	notification.LastAttempt = time.Now()

	if err != nil {
		notification.Error = err.Error()
		notification.Status = "failed"

		// Retry if under max retries
		if notification.Attempts < am.config.MaxRetries {
			time.Sleep(am.config.RetryDelay)
			go am.sendNotification(ctx, notification)
		}
	} else {
		now := time.Now()
		notification.SentAt = &now
		notification.Status = "sent"
	}

	am.storeNotification(ctx, notification)
}

// generateMessage generates a notification message for a specific channel
func (am *AlertManager) generateMessage(alert *Alert, channel NotificationChannel) string {
	switch channel {
	case ChannelEmail:
		return am.generateEmailMessage(alert)
	case ChannelSlack:
		return am.generateSlackMessage(alert)
	case ChannelWebhook:
		return am.generateWebhookMessage(alert)
	case ChannelSMS, ChannelPager:
		return am.generateShortMessage(alert)
	default:
		return alert.Description
	}
}

// generateEmailMessage generates an email message
func (am *AlertManager) generateEmailMessage(alert *Alert) string {
	duration := time.Since(alert.StartTime).Round(time.Minute)

	message := fmt.Sprintf(`
Alert: %s

Severity: %s
Status: %s
Duration: %s
Value: %.2f
Threshold: %.2f

Description: %s

Labels:
`, alert.Name, alert.Severity, alert.Status, duration, alert.Value, alert.Threshold, alert.Description)

	for k, v := range alert.Labels {
		message += fmt.Sprintf("  %s: %s\n", k, v)
	}

	message += "\nAnnotations:\n"
	for k, v := range alert.Annotations {
		message += fmt.Sprintf("  %s: %s\n", k, v)
	}

	return message
}

// generateSlackMessage generates a Slack message
func (am *AlertManager) generateSlackMessage(alert *Alert) string {
	color := map[AlertSeverity]string{
		SeverityInfo:     "good",
		SeverityWarning:  "warning",
		SeverityCritical: "danger",
		SeverityFatal:    "danger",
	}[alert.Severity]

	attachment := map[string]interface{}{
		"color":      color,
		"title":      alert.Name,
		"text":       alert.Description,
		"fields": []map[string]interface{}{
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
				"title": "Threshold",
				"value": fmt.Sprintf("%.2f", alert.Threshold),
				"short": true,
			},
			{
				"title": "Duration",
				"value": time.Since(alert.StartTime).Round(time.Minute).String(),
				"short": true,
			},
		},
	}

	attachmentJSON, _ := json.Marshal(attachment)
	return string(attachmentJSON)
}

// generateWebhookMessage generates a webhook message
func (am *AlertManager) generateWebhookMessage(alert *Alert) string {
	webhookData := map[string]interface{}{
		"alert_id":   alert.ID,
		"rule_id":    alert.RuleID,
		"name":       alert.Name,
		"severity":   string(alert.Severity),
		"status":     string(alert.Status),
		"start_time": alert.StartTime,
		"value":      alert.Value,
		"threshold":  alert.Threshold,
		"labels":     alert.Labels,
		"annotations": alert.Annotations,
	}

	data, _ := json.Marshal(webhookData)
	return string(data)
}

// generateShortMessage generates a short message for SMS/pager
func (am *AlertManager) generateShortMessage(alert *Alert) string {
	return fmt.Sprintf("[%s] %s: %s (%.2f/%.2f)",
		string(alert.Severity), alert.Name, alert.Description, alert.Value, alert.Threshold)
}

// Placeholder implementations for notification methods
func (am *AlertManager) sendEmailNotification(ctx context.Context, notification *Notification) error {
	// TODO: Implement email sending
	return nil
}

func (am *AlertManager) sendSlackNotification(ctx context.Context, notification *Notification) error {
	// TODO: Implement Slack notification
	return nil
}

func (am *AlertManager) sendWebhookNotification(ctx context.Context, notification *Notification) error {
	// TODO: Implement webhook notification
	return nil
}

func (am *AlertManager) sendSMSNotification(ctx context.Context, notification *Notification) error {
	// TODO: Implement SMS notification
	return nil
}

func (am *AlertManager) sendPagerNotification(ctx context.Context, notification *Notification) error {
	// TODO: Implement pager notification
	return nil
}

// Helper methods
func (am *AlertManager) validateRule(rule *AlertRule) error {
	// TODO: Implement rule validation
	return nil
}

func (am *AlertManager) getAlertChannels(alert *Alert) []NotificationChannel {
	// Get channels from rule
	rule, exists := am.rules[alert.RuleID]
	if !exists {
		return []NotificationChannel{}
	}

	// Check escalation policy
	if rule.EscalationPolicy != nil && alert.EscalationLevel < len(rule.EscalationPolicy.Levels) {
		level := rule.EscalationPolicy.Levels[alert.EscalationLevel]
		return level.Channels
	}

	return rule.Channels
}

func (am *AlertManager) storeAlert(ctx context.Context, alert *Alert) error {
	alertData, err := json.Marshal(alert)
	if err != nil {
		return err
	}

	return am.redisClient.Set(ctx,
		fmt.Sprintf("alert:%s", alert.ID),
		alertData,
		24*time.Hour).Err()
}

func (am *AlertManager) storeNotification(ctx context.Context, notification *Notification) error {
	notificationData, err := json.Marshal(notification)
	if err != nil {
		return err
	}

	return am.redisClient.Set(ctx,
		fmt.Sprintf("notification:%s", notification.ID),
		notificationData,
		7*24*time.Hour).Err()
}

func (am *AlertManager) sendResolutionNotifications(ctx context.Context, alert *Alert) {
	// TODO: Implement resolution notifications
}

func (am *AlertManager) sendEscalationNotifications(ctx context.Context, alert *Alert, level EscalationLevel) {
	// TODO: Implement escalation notifications
}

func (am *AlertManager) logError(message string, metadata map[string]interface{}) {
	// TODO: Implement logging
}

func (am *AlertManager) logWarning(message string, metadata map[string]interface{}) {
	// TODO: Implement logging
}