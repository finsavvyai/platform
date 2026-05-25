package alerting

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
)

// AlertSeverity represents the severity level of an alert
type AlertSeverity string

const (
	SeverityCritical AlertSeverity = "critical"
	SeverityHigh     AlertSeverity = "high"
	SeverityMedium   AlertSeverity = "medium"
	SeverityLow      AlertSeverity = "low"
	SeverityInfo     AlertSeverity = "info"
)

// AlertStatus represents the status of an alert
type AlertStatus string

const (
	StatusFiring   AlertStatus = "firing"
	StatusResolved AlertStatus = "resolved"
	StatusSilenced AlertStatus = "silenced"
)

// Alert represents an alert notification
type Alert struct {
	ID           string                 `json:"id"`
	Name         string                 `json:"name"`
	Severity     AlertSeverity          `json:"severity"`
	Status       AlertStatus            `json:"status"`
	Summary      string                 `json:"summary"`
	Description  string                 `json:"description"`
	Labels       map[string]string      `json:"labels"`
	Annotations  map[string]string      `json:"annotations"`
	StartsAt     time.Time              `json:"starts_at"`
	EndsAt       *time.Time             `json:"ends_at,omitempty"`
	UpdatedAt    time.Time              `json:"updated_at"`
	Source       string                 `json:"source"`
	GeneratorURL string                 `json:"generator_url,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// AlertRule represents an alert rule definition
type AlertRule struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Query       string                 `json:"query"`
	Condition   string                 `json:"condition"`
	Severity    AlertSeverity          `json:"severity"`
	Description string                 `json:"description"`
	For         time.Duration          `json:"for"`
	Labels      map[string]string      `json:"labels"`
	Annotations map[string]string      `json:"annotations"`
	Enabled     bool                   `json:"enabled"`
	Threshold   float64                `json:"threshold"`
	Operator    string                 `json:"operator"`
	Config      map[string]interface{} `json:"config"`
}

// AlertNotification represents a notification channel
type AlertNotification struct {
	ID         string                 `json:"id"`
	Name       string                 `json:"name"`
	Type       string                 `json:"type"`
	Enabled    bool                   `json:"enabled"`
	Config     map[string]interface{} `json:"config"`
	Recipients []string               `json:"recipients"`
	Filters    map[string]string      `json:"filters"`
	Template   string                 `json:"template"`
	CreatedAt  time.Time              `json:"created_at"`
	UpdatedAt  time.Time              `json:"updated_at"`
}

// AlertGroup represents a group of related alerts
type AlertGroup struct {
	ID             string            `json:"id"`
	Name           string            `json:"name"`
	Labels         map[string]string `json:"labels"`
	Alerts         []Alert           `json:"alerts"`
	Receivers      []string          `json:"receivers"`
	Routes         []AlertRoute      `json:"routes"`
	GroupBy        []string          `json:"group_by"`
	GroupWait      time.Duration     `json:"group_wait"`
	GroupInterval  time.Duration     `json:"group_interval"`
	RepeatInterval time.Duration     `json:"repeat_interval"`
}

// AlertRoute represents alert routing rules
type AlertRoute struct {
	Match     map[string]string `json:"match"`
	MatchRE   map[string]string `json:"match_re"`
	Receiver  string            `json:"receiver"`
	GroupBy   []string          `json:"group_by"`
	GroupWait time.Duration     `json:"group_wait"`
	Continue  bool              `json:"continue"`
	Routes    []AlertRoute      `json:"routes"`
}

// AlertManager manages alerts and notifications
type AlertManager struct {
	rules          map[string]*AlertRule
	notifications  map[string]*AlertNotification
	groups         map[string]*AlertGroup
	activeAlerts   map[string]*Alert
	silencedAlerts map[string]bool
	config         AlertManagerConfig
	prometheus     v1.API
	mu             sync.RWMutex
	ctx            context.Context
	cancel         context.CancelFunc
}

// AlertManagerConfig contains configuration for the alert manager
type AlertManagerConfig struct {
	PrometheusURL      string        `json:"prometheus_url"`
	EvaluationInterval time.Duration `json:"evaluation_interval"`
	ResolveTimeout     time.Duration `json:"resolve_timeout"`
	DefaultSeverity    AlertSeverity `json:"default_severity"`
	GroupInterval      time.Duration `json:"group_interval"`
	RepeatInterval     time.Duration `json:"repeat_interval"`
	SilenceDuration    time.Duration `json:"silence_duration"`
	MaxAlerts          int           `json:"max_alerts"`
	EnablePersistence  bool          `json:"enable_persistence"`
	StoragePath        string        `json:"storage_path"`
}

// NotificationProvider interface for notification providers
type NotificationProvider interface {
	Name() string
	Type() string
	Send(ctx context.Context, alert Alert) error
	Validate(config map[string]interface{}) error
}

// SlackProvider sends alerts to Slack
type SlackProvider struct {
	webhookURL string
	channel    string
	username   string
	iconEmoji  string
}

// EmailProvider sends alerts via email
type EmailProvider struct {
	smtpHost    string
	smtpPort    int
	username    string
	password    string
	fromAddress string
	fromName    string
	tls         bool
}

// WebhookProvider sends alerts to custom webhooks
type WebhookProvider struct {
	url        string
	method     string
	headers    map[string]string
	timeout    time.Duration
	retryCount int
	retryDelay time.Duration
}

// PagerDutyProvider sends alerts to PagerDuty
type PagerDutyProvider struct {
	serviceKey string
	severity   string
	class      string
	component  string
	group      string
}

// NewAlertManager creates a new alert manager
func NewAlertManager(config AlertManagerConfig) (*AlertManager, error) {
	ctx, cancel := context.WithCancel(context.Background())

	am := &AlertManager{
		rules:          make(map[string]*AlertRule),
		notifications:  make(map[string]*AlertNotification),
		groups:         make(map[string]*AlertGroup),
		activeAlerts:   make(map[string]*Alert),
		silencedAlerts: make(map[string]bool),
		config:         config,
		ctx:            ctx,
		cancel:         cancel,
	}

	// Initialize Prometheus client
	if config.PrometheusURL != "" {
		client, err := api.NewClient(api.Config{
			Address: config.PrometheusURL,
		})
		if err != nil {
			cancel()
			return nil, fmt.Errorf("failed to create Prometheus client: %w", err)
		}
		am.prometheus = v1.NewAPI(client)
	}

	// Load default rules and notifications
	am.loadDefaults()

	return am, nil
}

// loadDefaults loads default alert rules and notifications
func (am *AlertManager) loadDefaults() {
	// Default alert rules
	defaultRules := []AlertRule{
		{
			ID:          "high_error_rate",
			Name:        "High Error Rate",
			Query:       "rate(http_requests_total{status_code=~\"5..\"}[5m]) > 0.1",
			Severity:    SeverityHigh,
			Description: "Error rate is above 10%",
			For:         5 * time.Minute,
			Labels:      map[string]string{"team": "backend"},
			Enabled:     true,
		},
		{
			ID:          "high_latency",
			Name:        "High Response Latency",
			Query:       "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1",
			Severity:    SeverityMedium,
			Description: "95th percentile latency is above 1 second",
			For:         10 * time.Minute,
			Labels:      map[string]string{"team": "backend"},
			Enabled:     true,
		},
		{
			ID:          "service_down",
			Name:        "Service Down",
			Query:       "up{job=\"quantumbeam-api\"} == 0",
			Severity:    SeverityCritical,
			Description: "Service is down",
			For:         1 * time.Minute,
			Labels:      map[string]string{"team": "backend"},
			Enabled:     true,
		},
		{
			ID:          "high_memory_usage",
			Name:        "High Memory Usage",
			Query:       "memory_usage_bytes / memory_total_bytes > 0.9",
			Severity:    SeverityMedium,
			Description: "Memory usage is above 90%",
			For:         15 * time.Minute,
			Labels:      map[string]string{"team": "backend"},
			Enabled:     true,
		},
		{
			ID:          "fraud_detection_accuracy",
			Name:        "Fraud Detection Accuracy Drop",
			Query:       "model_accuracy_score < 0.8",
			Severity:    SeverityHigh,
			Description: "Fraud detection model accuracy dropped below 80%",
			For:         30 * time.Minute,
			Labels:      map[string]string{"team": "ml"},
			Enabled:     true,
		},
	}

	for _, rule := range defaultRules {
		am.rules[rule.ID] = &rule
	}

	// Default notification channels
	defaultNotifications := []AlertNotification{
		{
			ID:       "slack_alerts",
			Name:     "Slack Alerts",
			Type:     "slack",
			Enabled:  true,
			Config:   map[string]interface{}{"webhook_url": os.Getenv("SLACK_WEBHOOK_URL")},
			Template: "slack",
		},
		{
			ID:       "email_alerts",
			Name:     "Email Alerts",
			Type:     "email",
			Enabled:  true,
			Config:   map[string]interface{}{"smtp_host": os.Getenv("SMTP_HOST")},
			Template: "email",
		},
		{
			ID:       "pagerduty_alerts",
			Name:     "PagerDuty Alerts",
			Type:     "pagerduty",
			Enabled:  true,
			Config:   map[string]interface{}{"service_key": os.Getenv("PAGERDUTY_SERVICE_KEY")},
			Template: "pagerduty",
		},
	}

	for _, notification := range defaultNotifications {
		am.notifications[notification.ID] = &notification
	}
}

// Start starts the alert manager
func (am *AlertManager) Start() error {
	go am.evaluationLoop()
	return nil
}

// Stop stops the alert manager
func (am *AlertManager) Stop() {
	am.cancel()
}

// evaluationLoop runs the alert evaluation loop
func (am *AlertManager) evaluationLoop() {
	ticker := time.NewTicker(am.config.EvaluationInterval)
	defer ticker.Stop()

	for {
		select {
		case <-am.ctx.Done():
			return
		case <-ticker.C:
			am.evaluateRules()
		}
	}
}

// evaluateRules evaluates all alert rules
func (am *AlertManager) evaluateRules() {
	am.mu.Lock()
	defer am.mu.Unlock()

	for _, rule := range am.rules {
		if !rule.Enabled {
			continue
		}

		go am.evaluateRule(rule)
	}
}

// evaluateRule evaluates a single alert rule
func (am *AlertManager) evaluateRule(rule *AlertRule) {
	ctx, cancel := context.WithTimeout(am.ctx, 30*time.Second)
	defer cancel()

	if am.prometheus == nil {
		return
	}

	// Query Prometheus
	result, _, err := am.prometheus.Query(ctx, rule.Query, time.Now())
	if err != nil {
		am.logError("Failed to query Prometheus for rule %s: %v", rule.ID, err)
		return
	}

	// Process query results
	switch result.Type() {
	case model.ValVector:
		vector := result.(model.Vector)
		for _, sample := range vector {
			am.processAlertSample(rule, sample)
		}
	case model.ValScalar:
		scalar := result.(model.Scalar)
		am.processAlertSample(rule, model.Sample{
			Value:     scalar.Value,
			Timestamp: scalar.Timestamp,
		})
	}
}

// processAlertSample processes a single alert sample
func (am *AlertManager) processAlertSample(rule *AlertRule, sample model.Sample) {
	alertID := fmt.Sprintf("%s-%s", rule.ID, generateFingerprint(sample))

	// Check if value meets threshold condition
	if am.meetsThreshold(sample.Value, rule.Operator, rule.Threshold) {
		// Alert should fire
		if alert, exists := am.activeAlerts[alertID]; !exists {
			// New alert
			newAlert := Alert{
				ID:          alertID,
				Name:        rule.Name,
				Severity:    rule.Severity,
				Status:      StatusFiring,
				Summary:     fmt.Sprintf("%s: %.2f", rule.Name, sample.Value),
				Description: rule.Description,
				Labels:      mergeLabels(rule.Labels, sample.Metric),
				Annotations: rule.Annotations,
				StartsAt:    time.Now(),
				UpdatedAt:   time.Now(),
				Source:      "quantumbeam-alertmanager",
			}

			am.activeAlerts[alertID] = &newAlert

			// Check if alert should be sent (after 'for' duration)
			if rule.For == 0 || time.Since(newAlert.StartsAt) >= rule.For {
				am.sendAlert(newAlert)
			}
		} else {
			// Update existing alert
			alert.UpdatedAt = time.Now()
		}
	} else {
		// Alert should resolve
		if alert, exists := am.activeAlerts[alertID]; exists {
			now := time.Now()
			alert.Status = StatusResolved
			alert.EndsAt = &now
			alert.UpdatedAt = now

			am.sendAlert(*alert)
			delete(am.activeAlerts, alertID)
		}
	}
}

// meetsThreshold checks if a value meets the threshold condition
func (am *AlertManager) meetsThreshold(value float64, operator string, threshold float64) bool {
	switch operator {
	case ">", "gt":
		return value > threshold
	case ">=", "gte":
		return value >= threshold
	case "<", "lt":
		return value < threshold
	case "<=", "lte":
		return value <= threshold
	case "==", "eq":
		return value == threshold
	case "!=", "ne":
		return value != threshold
	default:
		return value > threshold
	}
}

// sendAlert sends an alert through notification channels
func (am *AlertManager) sendAlert(alert Alert) {
	// Check if alert is silenced
	if am.isSilenced(alert.ID) {
		return
	}

	// Route alert to appropriate notifications
	receivers := am.routeAlert(alert)

	for _, receiverID := range receivers {
		if notification, exists := am.notifications[receiverID]; exists && notification.Enabled {
			go am.sendNotification(notification, alert)
		}
	}
}

// routeAlert routes an alert to appropriate receivers
func (am *AlertManager) routeAlert(alert Alert) []string {
	receivers := []string{}

	// Default routing based on severity
	switch alert.Severity {
	case SeverityCritical:
		receivers = append(receivers, "pagerduty_alerts", "slack_alerts", "email_alerts")
	case SeverityHigh:
		receivers = append(receivers, "slack_alerts", "email_alerts")
	case SeverityMedium:
		receivers = append(receivers, "slack_alerts")
	case SeverityLow, SeverityInfo:
		receivers = append(receivers, "slack_alerts")
	}

	return receivers
}

// sendNotification sends an alert through a notification channel
func (am *AlertManager) sendNotification(notification *AlertNotification, alert Alert) {
	provider := am.getNotificationProvider(notification)
	if provider == nil {
		return
	}

	ctx, cancel := context.WithTimeout(am.ctx, 30*time.Second)
	defer cancel()

	if err := provider.Send(ctx, alert); err != nil {
		am.logError("Failed to send alert via %s: %v", notification.Name, err)
	}
}

// getNotificationProvider creates a notification provider
func (am *AlertManager) getNotificationProvider(notification *AlertNotification) NotificationProvider {
	switch notification.Type {
	case "slack":
		return &SlackProvider{
			webhookURL: getStringConfig(notification.Config, "webhook_url"),
			channel:    getStringConfig(notification.Config, "channel"),
			username:   getStringConfig(notification.Config, "username"),
			iconEmoji:  getStringConfig(notification.Config, "icon_emoji"),
		}
	case "email":
		return &EmailProvider{
			smtpHost:    getStringConfig(notification.Config, "smtp_host"),
			smtpPort:    getIntConfig(notification.Config, "smtp_port"),
			username:    getStringConfig(notification.Config, "username"),
			password:    getStringConfig(notification.Config, "password"),
			fromAddress: getStringConfig(notification.Config, "from_address"),
			fromName:    getStringConfig(notification.Config, "from_name"),
			tls:         getBoolConfig(notification.Config, "tls"),
		}
	case "webhook":
		return &WebhookProvider{
			url:        getStringConfig(notification.Config, "url"),
			method:     getStringConfig(notification.Config, "method"),
			headers:    getStringMapConfig(notification.Config, "headers"),
			timeout:    getDurationConfig(notification.Config, "timeout"),
			retryCount: getIntConfig(notification.Config, "retry_count"),
			retryDelay: getDurationConfig(notification.Config, "retry_delay"),
		}
	case "pagerduty":
		return &PagerDutyProvider{
			serviceKey: getStringConfig(notification.Config, "service_key"),
			severity:   getStringConfig(notification.Config, "severity"),
			class:      getStringConfig(notification.Config, "class"),
			component:  getStringConfig(notification.Config, "component"),
			group:      getStringConfig(notification.Config, "group"),
		}
	}

	return nil
}

// AddRule adds a new alert rule
func (am *AlertManager) AddRule(rule *AlertRule) error {
	am.mu.Lock()
	defer am.mu.Unlock()

	am.rules[rule.ID] = rule
	return nil
}

// UpdateRule updates an existing alert rule
func (am *AlertManager) UpdateRule(rule *AlertRule) error {
	am.mu.Lock()
	defer am.mu.Unlock()

	if _, exists := am.rules[rule.ID]; !exists {
		return fmt.Errorf("alert rule %s not found", rule.ID)
	}

	am.rules[rule.ID] = rule
	return nil
}

// DeleteRule deletes an alert rule
func (am *AlertManager) DeleteRule(id string) error {
	am.mu.Lock()
	defer am.mu.Unlock()

	delete(am.rules, id)
	return nil
}

// GetRules returns all alert rules
func (am *AlertManager) GetRules() map[string]*AlertRule {
	am.mu.RLock()
	defer am.mu.RUnlock()

	rules := make(map[string]*AlertRule)
	for k, v := range am.rules {
		rules[k] = v
	}
	return rules
}

// AddNotification adds a new notification channel
func (am *AlertManager) AddNotification(notification *AlertNotification) error {
	am.mu.Lock()
	defer am.mu.Unlock()

	am.notifications[notification.ID] = notification
	return nil
}

// GetActiveAlerts returns all active alerts
func (am *AlertManager) GetActiveAlerts() []Alert {
	am.mu.RLock()
	defer am.mu.RUnlock()

	alerts := make([]Alert, 0, len(am.activeAlerts))
	for _, alert := range am.activeAlerts {
		alerts = append(alerts, *alert)
	}
	return alerts
}

// SilenceAlert silences an alert
func (am *AlertManager) SilenceAlert(alertID string, duration time.Duration) error {
	am.mu.Lock()
	defer am.mu.Unlock()

	am.silencedAlerts[alertID] = true

	// Auto-unsilence after duration
	go func() {
		time.Sleep(duration)
		am.mu.Lock()
		delete(am.silencedAlerts, alertID)
		am.mu.Unlock()
	}()

	return nil
}

// isSilenced checks if an alert is silenced
func (am *AlertManager) isSilenced(alertID string) bool {
	am.mu.RLock()
	defer am.mu.RUnlock()

	return am.silencedAlerts[alertID]
}

// Helper functions
func generateFingerprint(sample model.Sample) string {
	data, _ := json.Marshal(sample.Metric)
	return fmt.Sprintf("%x", md5.Sum(data))
}

func mergeLabels(labels map[string]string, metric model.Metric) map[string]string {
	result := make(map[string]string)
	for k, v := range labels {
		result[k] = v
	}
	for k, v := range metric {
		result[string(k)] = string(v)
	}
	return result
}

func getStringConfig(config map[string]interface{}, key string) string {
	if val, ok := config[key].(string); ok {
		return val
	}
	return ""
}

func getIntConfig(config map[string]interface{}, key string) int {
	if val, ok := config[key].(int); ok {
		return val
	}
	if val, ok := config[key].(float64); ok {
		return int(val)
	}
	return 0
}

func getBoolConfig(config map[string]interface{}, key string) bool {
	if val, ok := config[key].(bool); ok {
		return val
	}
	return false
}

func getDurationConfig(config map[string]interface{}, key string) time.Duration {
	if val, ok := config[key].(string); ok {
		if duration, err := time.ParseDuration(val); err == nil {
			return duration
		}
	}
	return 0
}

func getStringMapConfig(config map[string]interface{}, key string) map[string]string {
	if val, ok := config[key].(map[string]interface{}); ok {
		result := make(map[string]string)
		for k, v := range val {
			if str, ok := v.(string); ok {
				result[k] = str
			}
		}
		return result
	}
	return make(map[string]string)
}

func (am *AlertManager) logError(format string, args ...interface{}) {
	// In a real implementation, this would use a proper logger
	fmt.Printf("ERROR: "+format+"\n", args...)
}
