//go:build legacy_migrated
// +build legacy_migrated

package monitoring

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	"go.uber.org/zap"
)

// AlertManager manages alerts and notifications
type AlertManager struct {
	logger       *zap.Logger
	config       *AlertingConfig
	redisClient  *redis.Client
	notifier     NotificationSender
	rules        map[string]*AlertRule
	activeAlerts map[string]*ActiveAlert
	ctx          context.Context
	cancel       context.CancelFunc
}

// AlertingConfig holds alerting configuration
type AlertingConfig struct {
	Enabled             bool          `yaml:"enabled" json:"enabled"`
	EvaluationInterval  time.Duration `yaml:"evaluation_interval" json:"evaluation_interval"`
	NotificationTimeout time.Duration `yaml:"notification_timeout" json:"notification_timeout"`
	MaxActiveAlerts     int           `yaml:"max_active_alerts" json:"max_active_alerts"`
	AlertRetention      time.Duration `yaml:"alert_retention" json:"alert_retention"`
	GroupWaitInterval   time.Duration `yaml:"group_wait_interval" json:"group_wait_interval"`
	GroupInterval       time.Duration `yaml:"group_interval" json:"group_interval"`
	RepeatInterval      time.Duration `yaml:"repeat_interval" json:"repeat_interval"`
}

// AlertRule defines an alert rule
type AlertRule struct {
	ID            string               `yaml:"id" json:"id"`
	Name          string               `yaml:"name" json:"name"`
	Description   string               `yaml:"description" json:"description"`
	Query         string               `yaml:"query" json:"query"`
	Condition     string               `yaml:"condition" json:"condition"` // gt, lt, eq, ne
	Threshold     float64              `yaml:"threshold" json:"threshold"`
	Duration      time.Duration        `yaml:"duration" json:"duration"`
	Severity      AlertSeverity        `yaml:"severity" json:"severity"`
	Labels        map[string]string    `yaml:"labels" json:"labels"`
	Annotations   map[string]string    `yaml:"annotations" json:"annotations"`
	Enabled       bool                 `yaml:"enabled" json:"enabled"`
	For           time.Duration        `yaml:"for" json:"for"`
	Runbook       string               `yaml:"runbook" json:"runbook"`
	Tags          []string             `yaml:"tags" json:"tags"`
	Owner         string               `yaml:"owner" json:"owner"`
	Team          string               `yaml:"team" json:"team"`
	Environment   []string             `yaml:"environment" json:"environment"`
	Silences      []SilenceRule        `yaml:"silences" json:"silences"`
	Inhibitions   []InhibitionRule     `yaml:"inhibitions" json:"inhibitions"`
	Notifications []NotificationConfig `yaml:"notifications" json:"notifications"`
}

// AlertSeverity represents alert severity levels
type AlertSeverity string

const (
	SeverityCritical AlertSeverity = "critical"
	SeverityWarning  AlertSeverity = "warning"
	SeverityInfo     AlertSeverity = "info"
	SeverityDebug    AlertSeverity = "debug"
)

// ActiveAlert represents an active alert
type ActiveAlert struct {
	ID            string               `json:"id"`
	RuleID        string               `json:"rule_id"`
	Name          string               `json:"name"`
	Description   string               `json:"description"`
	Severity      AlertSeverity        `json:"severity"`
	Status        AlertStatus          `json:"status"`
	StartTime     time.Time            `json:"start_time"`
	EndTime       *time.Time           `json:"end_time,omitempty"`
	Duration      time.Duration        `json:"duration"`
	Labels        map[string]string    `json:"labels"`
	Annotations   map[string]string    `json:"annotations"`
	Value         float64              `json:"value"`
	Threshold     float64              `json:"threshold"`
	Query         string               `json:"query"`
	Condition     string               `json:"condition"`
	Notifications []NotificationStatus `json:"notifications"`
	Silenced      bool                 `json:"silenced"`
	SilenceUntil  *time.Time           `json:"silence_until,omitempty"`
	Owner         string               `json:"owner"`
	Team          string               `json:"team"`
	Runbook       string               `json:"runbook"`
	LastSent      *time.Time           `json:"last_sent,omitempty"`
	SentCount     int                  `json:"sent_count"`
	Resolved      bool                 `json:"resolved"`
}

// AlertStatus represents alert status
type AlertStatus string

const (
	StatusFiring   AlertStatus = "firing"
	StatusResolved AlertStatus = "resolved"
	StatusSilenced AlertStatus = "silenced"
)

// SilenceRule defines a silence rule
type SilenceRule struct {
	ID         string         `yaml:"id" json:"id"`
	Matchers   []LabelMatcher `yaml:"matchers" json:"matchers"`
	StartsAt   time.Time      `yaml:"starts_at" json:"starts_at"`
	EndsAt     time.Time      `yaml:"ends_at" json:"ends_at"`
	CreatedBy  string         `yaml:"created_by" json:"created_by"`
	Comment    string         `yaml:"comment" json:"comment"`
	MatchersID string         `yaml:"matchers_id" json:"matchers_id"`
}

// InhibitionRule defines an inhibition rule
type InhibitionRule struct {
	SourceMatchers []LabelMatcher `yaml:"source_matchers" json:"source_matchers"`
	TargetMatchers []LabelMatcher `yaml:"target_matchers" json:"target_matchers"`
	Equal          []string       `yaml:"equal" json:"equal"`
}

// LabelMatcher matches on labels
type LabelMatcher struct {
	Name  string `yaml:"name" json:"name"`
	Value string `yaml:"value" json:"value"`
	Op    string `yaml:"op" json:"op"` // =, !=, =~, !~
}

// NotificationConfig defines notification configuration
type NotificationConfig struct {
	Type     string                 `yaml:"type" json:"type"`
	Enabled  bool                   `yaml:"enabled" json:"enabled"`
	Settings map[string]interface{} `yaml:"settings" json:"settings"`
	Template string                 `yaml:"template" json:"template"`
	Retry    int                    `yaml:"retry" json:"retry"`
	Timeout  time.Duration          `yaml:"timeout" json:"timeout"`
}

// NotificationStatus represents notification status
type NotificationStatus struct {
	Type      string     `json:"type"`
	Status    string     `json:"status"`
	SentAt    *time.Time `json:"sent_at,omitempty"`
	Error     string     `json:"error,omitempty"`
	Retries   int        `json:"retries"`
	NextRetry *time.Time `json:"next_retry,omitempty"`
}

// NotificationSender interface for sending notifications
type NotificationSender interface {
	SendAlert(ctx context.Context, alert *ActiveAlert, config NotificationConfig) error
	SendResolved(ctx context.Context, alert *ActiveAlert, config NotificationConfig) error
}

// Default alerting configuration
var (
	DefaultAlertingConfig = AlertingConfig{
		Enabled:             true,
		EvaluationInterval:  15 * time.Second,
		NotificationTimeout: 30 * time.Second,
		MaxActiveAlerts:     1000,
		AlertRetention:      7 * 24 * time.Hour, // 7 days
		GroupWaitInterval:   10 * time.Second,
		GroupInterval:       10 * time.Second,
		RepeatInterval:      1 * time.Hour,
	}
)

// NewAlertManager creates a new alert manager
func NewAlertManager(redisClient *redis.Client, logger *zap.Logger, config *AlertingConfig, notifier NotificationSender) *AlertManager {
	if config == nil {
		config = &DefaultAlertingConfig
	}

	ctx, cancel := context.WithCancel(context.Background())

	am := &AlertManager{
		logger:       logger,
		config:       config,
		redisClient:  redisClient,
		notifier:     notifier,
		rules:        make(map[string]*AlertRule),
		activeAlerts: make(map[string]*ActiveAlert),
		ctx:          ctx,
		cancel:       cancel,
	}

	// Load existing rules and alerts
	am.loadRules()
	am.loadActiveAlerts()

	return am
}

// Start starts the alert manager
func (am *AlertManager) Start() error {
	if !am.config.Enabled {
		am.logger.Info("Alert manager is disabled")
		return nil
	}

	am.logger.Info("Starting alert manager")

	// Start evaluation loop
	go am.evaluationLoop()

	// Start notification loop
	go am.notificationLoop()

	// Start cleanup loop
	go am.cleanupLoop()

	am.logger.Info("Alert manager started successfully")
	return nil
}

// Stop stops the alert manager
func (am *AlertManager) Stop() error {
	am.logger.Info("Stopping alert manager")
	am.cancel()
	return nil
}

// AddRule adds a new alert rule
func (am *AlertManager) AddRule(rule *AlertRule) error {
	if rule.ID == "" {
		return fmt.Errorf("rule ID cannot be empty")
	}

	am.rules[rule.ID] = rule

	// Store in Redis
	if err := am.storeRule(rule); err != nil {
		return fmt.Errorf("failed to store rule: %w", err)
	}

	am.logger.Info("Alert rule added",
		zap.String("rule_id", rule.ID),
		zap.String("rule_name", rule.Name))

	return nil
}

// RemoveRule removes an alert rule
func (am *AlertManager) RemoveRule(ruleID string) error {
	delete(am.rules, ruleID)

	// Remove from Redis
	if err := am.redisClient.Del(am.ctx, fmt.Sprintf("alert_rule:%s", ruleID)).Err(); err != nil {
		return fmt.Errorf("failed to remove rule from Redis: %w", err)
	}

	// Resolve any active alerts for this rule
	for alertID, alert := range am.activeAlerts {
		if alert.RuleID == ruleID && alert.Status == StatusFiring {
			am.resolveAlert(alertID, "Rule removed")
		}
	}

	am.logger.Info("Alert rule removed",
		zap.String("rule_id", ruleID))

	return nil
}

// GetRules returns all alert rules
func (am *AlertManager) GetRules() map[string]*AlertRule {
	return am.rules
}

// GetActiveAlerts returns all active alerts
func (am *AlertManager) GetActiveAlerts() map[string]*ActiveAlert {
	return am.activeAlerts
}

// SilenceAlert silences an alert
func (am *AlertManager) SilenceAlert(alertID string, duration time.Duration, reason string) error {
	alert, exists := am.activeAlerts[alertID]
	if !exists {
		return fmt.Errorf("alert %s not found", alertID)
	}

	silenceUntil := time.Now().Add(duration)
	alert.Silenced = true
	alert.SilenceUntil = &silenceUntil

	// Store silence
	silence := SilenceRule{
		ID: fmt.Sprintf("silence_%s_%d", alertID, time.Now().Unix()),
		Matchers: []LabelMatcher{
			{Name: "alert_id", Value: alertID, Op: "="},
		},
		StartsAt:  time.Now(),
		EndsAt:    silenceUntil,
		CreatedBy: "alert_manager",
		Comment:   reason,
	}

	if err := am.storeSilence(&silence); err != nil {
		return fmt.Errorf("failed to store silence: %w", err)
	}

	am.logger.Info("Alert silenced",
		zap.String("alert_id", alertID),
		zap.Duration("duration", duration),
		zap.String("reason", reason))

	return nil
}

// UnsilenceAlert unsilences an alert
func (am *AlertManager) UnsilenceAlert(alertID string) error {
	alert, exists := am.activeAlerts[alertID]
	if !exists {
		return fmt.Errorf("alert %s not found", alertID)
	}

	alert.Silenced = false
	alert.SilenceUntil = nil

	// Remove silences for this alert
	silences, err := am.getSilences()
	if err != nil {
		return fmt.Errorf("failed to get silences: %w", err)
	}

	for _, silence := range silences {
		if len(silence.Matchers) > 0 && silence.Matchers[0].Value == alertID {
			am.redisClient.Del(am.ctx, fmt.Sprintf("silence:%s", silence.ID))
		}
	}

	am.logger.Info("Alert unsilenced",
		zap.String("alert_id", alertID))

	return nil
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

// evaluateRules evaluates all enabled alert rules
func (am *AlertManager) evaluateRules() {
	for _, rule := range am.rules {
		if !rule.Enabled {
			continue
		}

		if err := am.evaluateRule(rule); err != nil {
			am.logger.Error("Failed to evaluate rule",
				zap.String("rule_id", rule.ID),
				zap.Error(err))
		}
	}
}

// evaluateRule evaluates a single alert rule
func (am *AlertManager) evaluateRule(rule *AlertRule) error {
	// Execute query to get current value
	value, err := am.executeQuery(rule.Query)
	if err != nil {
		return fmt.Errorf("failed to execute query: %w", err)
	}

	// Check if condition is met
	firing := am.checkCondition(value, rule.Condition, rule.Threshold)
	alertID := fmt.Sprintf("%s:%s", rule.ID, am.getAlertKey(rule.Labels))

	if firing {
		// Check if alert already exists
		alert, exists := am.activeAlerts[alertID]
		if exists {
			// Update existing alert
			alert.Value = value
			alert.EndTime = nil
			alert.Resolved = false
			if alert.Status != StatusFiring {
				alert.Status = StatusFiring
				alert.StartTime = time.Now()
			}
		} else {
			// Create new alert
			alert = &ActiveAlert{
				ID:          alertID,
				RuleID:      rule.ID,
				Name:        rule.Name,
				Description: rule.Description,
				Severity:    rule.Severity,
				Status:      StatusFiring,
				StartTime:   time.Now(),
				Labels:      rule.Labels,
				Annotations: rule.Annotations,
				Value:       value,
				Threshold:   rule.Threshold,
				Query:       rule.Query,
				Condition:   rule.Condition,
				Owner:       rule.Owner,
				Team:        rule.Team,
				Runbook:     rule.Runbook,
				SentCount:   0,
				Resolved:    false,
			}
			am.activeAlerts[alertID] = alert
		}

		// Store alert
		if err := am.storeAlert(alert); err != nil {
			am.logger.Error("Failed to store alert",
				zap.String("alert_id", alertID),
				zap.Error(err))
		}

		// Check if we should send notification
		if am.shouldSendNotification(alert, rule) {
			am.queueNotification(alert, rule)
		}

	} else {
		// Check if alert should be resolved
		if alert, exists := am.activeAlerts[alertID]; exists && alert.Status == StatusFiring {
			am.resolveAlert(alertID, "Condition no longer met")
		}
	}

	return nil
}

// executeQuery executes a query and returns the result
func (am *AlertManager) executeQuery(query string) (float64, error) {
	// This would implement actual query execution against Prometheus, InfluxDB, etc.
	// For now, return a mock value
	return 0.0, nil
}

// checkCondition checks if a condition is met
func (am *AlertManager) checkCondition(value float64, condition string, threshold float64) bool {
	switch strings.ToLower(condition) {
	case "gt", "greater_than":
		return value > threshold
	case "lt", "less_than":
		return value < threshold
	case "eq", "equal":
		return value == threshold
	case "ne", "not_equal":
		return value != threshold
	case "gte", "greater_than_or_equal":
		return value >= threshold
	case "lte", "less_than_or_equal":
		return value <= threshold
	default:
		return false
	}
}

// getAlertKey generates a unique key for an alert based on labels
func (am *AlertManager) getAlertKey(labels map[string]string) string {
	var parts []string
	for k, v := range labels {
		parts = append(parts, fmt.Sprintf("%s=%s", k, v))
	}
	return strings.Join(parts, ",")
}

// shouldSendNotification checks if a notification should be sent
func (am *AlertManager) shouldSendNotification(alert *ActiveAlert, rule *AlertRule) bool {
	// Check if alert is silenced
	if alert.Silenced {
		return false
	}

	// Check if we've waited long enough (for rule.Duration)
	if rule.Duration > 0 && time.Since(alert.StartTime) < rule.Duration {
		return false
	}

	// Check if we haven't sent recently (repeat interval)
	if alert.LastSent != nil && time.Since(*alert.LastSent) < am.config.RepeatInterval {
		return false
	}

	return true
}

// queueNotification queues a notification to be sent
func (am *AlertManager) queueNotification(alert *ActiveAlert, rule *AlertRule) {
	// Store notification in Redis queue
	notification := map[string]interface{}{
		"alert_id":  alert.ID,
		"rule_id":   rule.ID,
		"action":    "fire",
		"timestamp": time.Now().Unix(),
	}

	data, _ := json.Marshal(notification)
	am.redisClient.LPush(am.ctx, "alert_notifications", data)
}

// resolveAlert resolves an alert
func (am *AlertManager) resolveAlert(alertID, reason string) {
	alert, exists := am.activeAlerts[alertID]
	if !exists {
		return
	}

	alert.Status = StatusResolved
	alert.Resolved = true
	now := time.Now()
	alert.EndTime = &now
	alert.Duration = now.Sub(alert.StartTime)

	// Add resolution annotation
	if alert.Annotations == nil {
		alert.Annotations = make(map[string]string)
	}
	alert.Annotations["resolved_at"] = now.Format(time.RFC3339)
	alert.Annotations["resolution_reason"] = reason

	// Store updated alert
	if err := am.storeAlert(alert); err != nil {
		am.logger.Error("Failed to store resolved alert",
			zap.String("alert_id", alertID),
			zap.Error(err))
	}

	// Queue resolved notification
	rule, exists := am.rules[alert.RuleID]
	if exists {
		notification := map[string]interface{}{
			"alert_id":  alertID,
			"rule_id":   rule.ID,
			"action":    "resolve",
			"timestamp": time.Now().Unix(),
		}

		data, _ := json.Marshal(notification)
		am.redisClient.LPush(am.ctx, "alert_notifications", data)
	}

	am.logger.Info("Alert resolved",
		zap.String("alert_id", alertID),
		zap.String("reason", reason),
		zap.Duration("duration", alert.Duration))
}

// notificationLoop processes notifications
func (am *AlertManager) notificationLoop() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-am.ctx.Done():
			return
		case <-ticker.C:
			am.processNotifications()
		}
	}
}

// processNotifications processes pending notifications
func (am *AlertManager) processNotifications() {
	for {
		result, err := am.redisClient.BRPop(am.ctx, 1*time.Second, "alert_notifications").Result()
		if err == redis.Nil {
			break
		} else if err != nil {
			am.logger.Error("Failed to pop notification from queue", zap.Error(err))
			break
		}

		var notification map[string]interface{}
		if err := json.Unmarshal([]byte(result[1]), &notification); err != nil {
			am.logger.Error("Failed to unmarshal notification", zap.Error(err))
			continue
		}

		am.sendNotification(notification)
	}
}

// sendNotification sends a notification
func (am *AlertManager) sendNotification(notification map[string]interface{}) {
	alertID := notification["alert_id"].(string)
	action := notification["action"].(string)

	alert, exists := am.activeAlerts[alertID]
	if !exists {
		// Alert might have been resolved and removed, check Redis
		loadedAlert, err := am.loadAlert(alertID)
		if err != nil {
			am.logger.Error("Failed to load alert for notification",
				zap.String("alert_id", alertID),
				zap.Error(err))
			return
		}
		alert = loadedAlert
	}

	rule, exists := am.rules[alert.RuleID]
	if !exists {
		am.logger.Error("Rule not found for alert",
			zap.String("alert_id", alertID),
			zap.String("rule_id", alert.RuleID))
		return
	}

	// Send notifications for each configured channel
	for _, config := range rule.Notifications {
		if !config.Enabled {
			continue
		}

		var err error
		if action == "fire" {
			err = am.notifier.SendAlert(am.ctx, alert, config)
		} else if action == "resolve" {
			err = am.notifier.SendResolved(am.ctx, alert, config)
		}

		if err != nil {
			am.logger.Error("Failed to send notification",
				zap.String("alert_id", alertID),
				zap.String("type", config.Type),
				zap.Error(err))
		} else {
			am.logger.Info("Notification sent",
				zap.String("alert_id", alertID),
				zap.String("type", config.Type),
				zap.String("action", action))

			// Update alert notification status
			alert.LastSent = &[]time.Time{time.Now()}[0]
			alert.SentCount++
		}
	}
}

// cleanupLoop performs periodic cleanup
func (am *AlertManager) cleanupLoop() {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-am.ctx.Done():
			return
		case <-ticker.C:
			am.performCleanup()
		}
	}
}

// performCleanup performs cleanup tasks
func (am *AlertManager) performCleanup() {
	// Clean up old resolved alerts
	cutoff := time.Now().Add(-am.config.AlertRetention)
	for alertID, alert := range am.activeAlerts {
		if alert.Resolved && alert.EndTime != nil && alert.EndTime.Before(cutoff) {
			delete(am.activeAlerts, alertID)
			am.redisClient.Del(am.ctx, fmt.Sprintf("alert:%s", alertID))
		}
	}

	// Clean up expired silences
	silences, err := am.getSilences()
	if err == nil {
		for _, silence := range silences {
			if silence.EndsAt.Before(time.Now()) {
				am.redisClient.Del(am.ctx, fmt.Sprintf("silence:%s", silence.ID))
			}
		}
	}
}

// Storage methods
func (am *AlertManager) storeRule(rule *AlertRule) error {
	data, err := json.Marshal(rule)
	if err != nil {
		return err
	}
	return am.redisClient.Set(am.ctx, fmt.Sprintf("alert_rule:%s", rule.ID), data, 0).Err()
}

func (am *AlertManager) storeAlert(alert *ActiveAlert) error {
	data, err := json.Marshal(alert)
	if err != nil {
		return err
	}
	return am.redisClient.Set(am.ctx, fmt.Sprintf("alert:%s", alert.ID), data, am.config.AlertRetention).Err()
}

func (am *AlertManager) storeSilence(silence *SilenceRule) error {
	data, err := json.Marshal(silence)
	if err != nil {
		return err
	}
	duration := silence.EndsAt.Sub(time.Now())
	return am.redisClient.Set(am.ctx, fmt.Sprintf("silence:%s", silence.ID), data, duration).Err()
}

func (am *AlertManager) loadRules() error {
	keys, err := am.redisClient.Keys(am.ctx, "alert_rule:*").Result()
	if err != nil {
		return err
	}

	for _, key := range keys {
		data, err := am.redisClient.Get(am.ctx, key).Result()
		if err != nil {
			continue
		}

		var rule AlertRule
		if err := json.Unmarshal([]byte(data), &rule); err != nil {
			continue
		}

		am.rules[rule.ID] = &rule
	}

	return nil
}

func (am *AlertManager) loadActiveAlerts() error {
	keys, err := am.redisClient.Keys(am.ctx, "alert:*").Result()
	if err != nil {
		return err
	}

	for _, key := range keys {
		data, err := am.redisClient.Get(am.ctx, key).Result()
		if err != nil {
			continue
		}

		var alert ActiveAlert
		if err := json.Unmarshal([]byte(data), &alert); err != nil {
			continue
		}

		am.activeAlerts[alert.ID] = &alert
	}

	return nil
}

func (am *AlertManager) loadAlert(alertID string) (*ActiveAlert, error) {
	data, err := am.redisClient.Get(am.ctx, fmt.Sprintf("alert:%s", alertID)).Result()
	if err != nil {
		return nil, err
	}

	var alert ActiveAlert
	if err := json.Unmarshal([]byte(data), &alert); err != nil {
		return nil, err
	}

	return &alert, nil
}

func (am *AlertManager) getSilences() ([]SilenceRule, error) {
	keys, err := am.redisClient.Keys(am.ctx, "silence:*").Result()
	if err != nil {
		return nil, err
	}

	var silences []SilenceRule
	for _, key := range keys {
		data, err := am.redisClient.Get(am.ctx, key).Result()
		if err != nil {
			continue
		}

		var silence SilenceRule
		if err := json.Unmarshal([]byte(data), &silence); err != nil {
			continue
		}

		silences = append(silences, silence)
	}

	return silences, nil
}