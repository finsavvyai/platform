//go:build legacy_migrated
// +build legacy_migrated

package anomaly

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// AnomalyAlerter handles alerting for detected anomalies
type AnomalyAlerter struct {
	config   AlerterConfig
	channels map[string]NotificationChannel
	alerts   chan *Anomaly
	rules    map[string]*AlertRule
	silenced map[string]time.Time
	mu       sync.RWMutex
	ctx      context.Context
	cancel   context.CancelFunc
}

// AlerterConfig contains configuration for the anomaly alerter
type AlerterConfig struct {
	Enabled           bool          `json:"enabled"`
	AlertTimeout      time.Duration `json:"alert_timeout"`
	MaxAlertsPerMin   int           `json:"max_alerts_per_min"`
	CooldownPeriod    time.Duration `json:"cooldown_period"`
	EscalationTimeout time.Duration `json:"escalation_timeout"`
	DefaultChannels   []string      `json:"default_channels"`
}

// NotificationChannel interface for anomaly alert notifications
type NotificationChannel interface {
	Name() string
	Type() string
	Send(ctx context.Context, alert *Anomaly) error
	IsHealthy() bool
}

// AlertRule represents a rule for anomaly alerting
type AlertRule struct {
	ID            string                 `json:"id"`
	Name          string                 `json:"name"`
	MetricPattern string                 `json:"metric_pattern"`
	AnomalyTypes  []AnomalyType          `json:"anomaly_types"`
	MinSeverity   AnomalySeverity        `json:"min_severity"`
	MaxFrequency  time.Duration          `json:"max_frequency"`
	Channels      []string               `json:"channels"`
	Enabled       bool                   `json:"enabled"`
	Conditions    map[string]interface{} `json:"conditions"`
	Labels        map[string]string      `json:"labels"`
	Annotations   map[string]string      `json:"annotations"`
	LastSent      time.Time              `json:"last_sent"`
	SentCount     int                    `json:"sent_count"`
}

// AlertSummary represents a summary of recent alerts
type AlertSummary struct {
	TotalAlerts      int                     `json:"total_alerts"`
	AlertsByType     map[AnomalyType]int     `json:"alerts_by_type"`
	AlertsBySeverity map[AnomalySeverity]int `json:"alerts_by_severity"`
	TopMetrics       []MetricAlertCount      `json:"top_metrics"`
	RecentAlerts     []*Anomaly              `json:"recent_alerts"`
	LastUpdated      time.Time               `json:"last_updated"`
}

// MetricAlertCount represents alert count for a metric
type MetricAlertCount struct {
	Metric string `json:"metric"`
	Count  int    `json:"count"`
}

// NewAnomalyAlerter creates a new anomaly alerter
func NewAnomalyAlerter(config AlerterConfig) *AnomalyAlerter {
	ctx, cancel := context.WithCancel(context.Background())

	// Set default values
	if config.AlertTimeout == 0 {
		config.AlertTimeout = 30 * time.Second
	}
	if config.MaxAlertsPerMin == 0 {
		config.MaxAlertsPerMin = 10
	}
	if config.CooldownPeriod == 0 {
		config.CooldownPeriod = 5 * time.Minute
	}
	if config.EscalationTimeout == 0 {
		config.EscalationTimeout = 1 * time.Hour
	}

	return &AnomalyAlerter{
		config:   config,
		channels: make(map[string]NotificationChannel),
		alerts:   make(chan *Anomaly, 1000),
		rules:    make(map[string]*AlertRule),
		silenced: make(map[string]time.Time),
		ctx:      ctx,
		cancel:   cancel,
	}
}

// Start starts the anomaly alerter
func (aa *AnomalyAlerter) Start() error {
	if !aa.config.Enabled {
		return nil
	}

	go aa.alertingLoop()
	go aa.cleanupLoop()
	return nil
}

// Stop stops the anomaly alerter
func (aa *AnomalyAlerter) Stop() {
	aa.cancel()
}

// alertingLoop processes incoming anomalies
func (aa *AnomalyAlerter) alertingLoop() {
	rateLimiter := time.NewTicker(time.Minute / time.Duration(aa.config.MaxAlertsPerMin))
	defer rateLimiter.Stop()

	for {
		select {
		case <-aa.ctx.Done():
			return
		case alert := <-aa.alerts:
			<-rateLimiter.C // Rate limit
			go aa.processAlert(alert)
		}
	}
}

// cleanupLoop cleans up expired silence entries
func (aa *AnomalyAlerter) cleanupLoop() {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-aa.ctx.Done():
			return
		case <-ticker.C:
			aa.cleanupExpiredSilences()
		}
	}
}

// processAlert processes a single anomaly alert
func (aa *AnomalyAlerter) processAlert(alert *Anomaly) {
	aa.mu.Lock()
	defer aa.mu.Unlock()

	// Check if alert is silenced
	if aa.isSilenced(alert) {
		return
	}

	// Find matching rules
	rules := aa.findMatchingRules(alert)
	if len(rules) == 0 {
		// Use default channels if no rules match
		rules = []*AlertRule{aa.createDefaultRule(alert)}
	}

	// Send notifications
	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}

		// Check frequency limits
		if time.Since(rule.LastSent) < rule.MaxFrequency {
			continue
		}

		// Determine channels
		channels := rule.Channels
		if len(channels) == 0 {
			channels = aa.config.DefaultChannels
		}

		// Send to each channel
		for _, channelName := range channels {
			channel, exists := aa.channels[channelName]
			if !exists || !channel.IsHealthy() {
				continue
			}

			ctx, cancel := context.WithTimeout(aa.ctx, aa.config.AlertTimeout)
			err := channel.Send(ctx, alert)
			cancel()

			if err != nil {
				aa.logError("Failed to send alert to %s: %v", channelName, err)
				continue
			}

			// Update rule statistics
			rule.LastSent = time.Now()
			rule.SentCount++
		}
	}
}

// isSilenced checks if an alert should be silenced
func (aa *AnomalyAlerter) isSilenced(alert *Anomaly) bool {
	for id, expiry := range aa.silenced {
		if time.Now().Before(expiry) {
			if aa.matchesSilence(id, alert) {
				return true
			}
		}
	}
	return false
}

// matchesSilence checks if an alert matches a silence rule
func (aa *AnomalyAlerter) matchesSilence(silenceID string, alert *Anomaly) bool {
	// Simple implementation - check if silence ID matches alert pattern
	// In a real implementation, this would be more sophisticated
	return silenceID == alert.Metric || silenceID == string(alert.Type)
}

// findMatchingRules finds alert rules that match an anomaly
func (aa *AnomalyAlerter) findMatchingRules(alert *Anomaly) []*AlertRule {
	var matchingRules []*AlertRule

	for _, rule := range aa.rules {
		if aa.ruleMatches(rule, alert) {
			matchingRules = append(matchingRules, rule)
		}
	}

	return matchingRules
}

// ruleMatches checks if a rule matches an anomaly
func (aa *AnomalyAlerter) ruleMatches(rule *AlertRule, alert *Anomaly) bool {
	// Check metric pattern
	if rule.MetricPattern != "" && !aa.matchesPattern(rule.MetricPattern, alert.Metric) {
		return false
	}

	// Check anomaly type
	if len(rule.AnomalyTypes) > 0 {
		typeMatched := false
		for _, anomType := range rule.AnomalyTypes {
			if anomType == alert.Type {
				typeMatched = true
				break
			}
		}
		if !typeMatched {
			return false
		}
	}

	// Check severity
	if rule.MinSeverity != "" && !aa.severityMatches(rule.MinSeverity, alert.Severity) {
		return false
	}

	// Check custom conditions
	if len(rule.Conditions) > 0 && !aa.evaluateConditions(rule.Conditions, alert) {
		return false
	}

	return true
}

// matchesPattern checks if a metric name matches a pattern
func (aa *AnomalyAlerter) matchesPattern(pattern, metric string) bool {
	// Simple pattern matching - in a real implementation, use regex
	return pattern == metric || pattern == "*"
}

// severityMatches checks if severity meets minimum requirement
func (aa *AnomalyAlerter) severityMatches(minSeverity, severity AnomalySeverity) bool {
	severityLevels := map[AnomalySeverity]int{
		SeverityLow:      1,
		SeverityMedium:   2,
		SeverityHigh:     3,
		SeverityCritical: 4,
	}

	return severityLevels[severity] >= severityLevels[minSeverity]
}

// evaluateConditions evaluates custom rule conditions
func (aa *AnomalyAlerter) evaluateConditions(conditions map[string]interface{}, alert *Anomaly) bool {
	// Simple condition evaluation - in a real implementation, this would be more sophisticated
	for key, value := range conditions {
		switch key {
		case "min_deviation":
			if minDev, ok := value.(float64); ok && alert.Deviation < minDev {
				return false
			}
		case "min_confidence":
			if minConf, ok := value.(float64); ok && alert.Confidence < minConf {
				return false
			}
		case "max_value":
			if maxVal, ok := value.(float64); ok && alert.Value > maxVal {
				return false
			}
		}
	}
	return true
}

// createDefaultRule creates a default rule for an alert
func (aa *AnomalyAlerter) createDefaultRule(alert *Anomaly) *AlertRule {
	return &AlertRule{
		ID:           fmt.Sprintf("default-%s", alert.ID),
		Name:         fmt.Sprintf("Default rule for %s", alert.Metric),
		AnomalyTypes: []AnomalyType{alert.Type},
		MinSeverity:  SeverityMedium,
		MaxFrequency: aa.config.CooldownPeriod,
		Channels:     aa.config.DefaultChannels,
		Enabled:      true,
		Conditions:   make(map[string]interface{}),
		Labels:       make(map[string]string),
		Annotations:  make(map[string]string),
	}
}

// AddChannel adds a notification channel
func (aa *AnomalyAlerter) AddChannel(channel NotificationChannel) error {
	aa.mu.Lock()
	defer aa.mu.Unlock()

	aa.channels[channel.Name()] = channel
	return nil
}

// RemoveChannel removes a notification channel
func (aa *AnomalyAlerter) RemoveChannel(name string) error {
	aa.mu.Lock()
	defer aa.mu.Unlock()

	delete(aa.channels, name)
	return nil
}

// AddRule adds an alert rule
func (aa *AnomalyAlerter) AddRule(rule *AlertRule) error {
	aa.mu.Lock()
	defer aa.mu.Unlock()

	aa.rules[rule.ID] = rule
	return nil
}

// RemoveRule removes an alert rule
func (aa *AnomalyAlerter) RemoveRule(id string) error {
	aa.mu.Lock()
	defer aa.mu.Unlock()

	delete(aa.rules, id)
	return nil
}

// SilenceAlert silences alerts matching a pattern
func (aa *AnomalyAlerter) SilenceAlert(pattern string, duration time.Duration) error {
	aa.mu.Lock()
	defer aa.mu.Unlock()

	aa.silenced[pattern] = time.Now().Add(duration)
	return nil
}

// GetAlerts returns the alert channel for consuming anomalies
func (aa *AnomalyAlerter) GetAlerts() chan<- *Anomaly {
	return aa.alerts
}

// GetRules returns all alert rules
func (aa *AnomalyAlerter) GetRules() map[string]*AlertRule {
	aa.mu.RLock()
	defer aa.mu.RUnlock()

	rules := make(map[string]*AlertRule)
	for k, v := range aa.rules {
		rules[k] = v
	}
	return rules
}

// GetChannels returns all notification channels
func (aa *AnomalyAlerter) GetChannels() map[string]NotificationChannel {
	aa.mu.RLock()
	defer aa.mu.RUnlock()

	channels := make(map[string]NotificationChannel)
	for k, v := range aa.channels {
		channels[k] = v
	}
	return channels
}

// GetAlertSummary returns a summary of recent alerts
func (aa *AnomalyAlerter) GetAlertSummary() *AlertSummary {
	aa.mu.RLock()
	defer aa.mu.RUnlock()

	summary := &AlertSummary{
		AlertsByType:     make(map[AnomalyType]int),
		AlertsBySeverity: make(map[AnomalySeverity]int),
		TopMetrics:       []MetricAlertCount{},
		RecentAlerts:     []*Anomaly{},
		LastUpdated:      time.Now(),
	}

	// This would need access to recent alerts data
	// For now, return empty summary
	return summary
}

// cleanupExpiredSilences removes expired silence entries
func (aa *AnomalyAlerter) cleanupExpiredSilences() {
	aa.mu.Lock()
	defer aa.mu.Unlock()

	now := time.Now()
	for id, expiry := range aa.silenced {
		if now.After(expiry) {
			delete(aa.silenced, id)
		}
	}
}

// logError logs an error message
func (aa *AnomalyAlerter) logError(format string, args ...interface{}) {
	// In a real implementation, this would use a proper logger
	fmt.Printf("ERROR: "+format+"\n", args...)
}

// Gin handlers for web interface

// GetAlertsHandler returns recent alerts via HTTP API
func (aa *AnomalyAlerter) GetAlertsHandler(c *gin.Context) {
	summary := aa.GetAlertSummary()
	c.JSON(200, summary)
}

// CreateSilenceHandler creates a new silence rule
func (aa *AnomalyAlerter) CreateSilenceHandler(c *gin.Context) {
	var request struct {
		Pattern  string        `json:"pattern" binding:"required"`
		Duration time.Duration `json:"duration" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	if err := aa.SilenceAlert(request.Pattern, request.Duration); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, gin.H{"message": "Silence created"})
}

// GetRulesHandler returns all alert rules
func (aa *AnomalyAlerter) GetRulesHandler(c *gin.Context) {
	rules := aa.GetRules()
	c.JSON(200, rules)
}

// CreateRuleHandler creates a new alert rule
func (aa *AnomalyAlerter) CreateRuleHandler(c *gin.Context) {
	var rule AlertRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	if err := aa.AddRule(&rule); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.JSON(201, rule)
}

// Notification channel implementations

// SlackNotificationChannel sends alerts to Slack
type SlackNotificationChannel struct {
	name       string
	webhookURL string
	channel    string
	username   string
}

func NewSlackNotificationChannel(name, webhookURL, channel, username string) *SlackNotificationChannel {
	return &SlackNotificationChannel{
		name:       name,
		webhookURL: webhookURL,
		channel:    channel,
		username:   username,
	}
}

func (snc *SlackNotificationChannel) Name() string {
	return snc.name
}

func (snc *SlackNotificationChannel) Type() string {
	return "slack"
}

func (snc *SlackNotificationChannel) Send(ctx context.Context, alert *Anomaly) error {
	// Implementation would send to Slack webhook
	return nil
}

func (snc *SlackNotificationChannel) IsHealthy() bool {
	return true
}

// EmailNotificationChannel sends alerts via email
type EmailNotificationChannel struct {
	name     string
	smtpHost string
	smtpPort int
	from     string
	to       []string
}

func NewEmailNotificationChannel(name, smtpHost string, smtpPort int, from string, to []string) *EmailNotificationChannel {
	return &EmailNotificationChannel{
		name:     name,
		smtpHost: smtpHost,
		smtpPort: smtpPort,
		from:     from,
		to:       to,
	}
}

func (enc *EmailNotificationChannel) Name() string {
	return enc.name
}

func (enc *EmailNotificationChannel) Type() string {
	return "email"
}

func (enc *EmailNotificationChannel) Send(ctx context.Context, alert *Anomaly) error {
	// Implementation would send email
	return nil
}

func (enc *EmailNotificationChannel) IsHealthy() bool {
	return true
}