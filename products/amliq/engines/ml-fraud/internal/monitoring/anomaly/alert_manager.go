package anomaly

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"gopkg.in/yaml.v3"
)

// AlertManager manages anomaly detection alerts
type AlertManager struct {
	config        AlertManagerConfig
	logger        *log.Logger
	alertRules    map[string]*ManagerAlertRule
	incidentStore *IncidentStore
	mu            sync.RWMutex
	promRegistry  *prometheus.Registry
	metrics       *AlertMetrics
}

// AlertManagerConfig contains configuration for alert management
type AlertManagerConfig struct {
	Enabled           bool               `json:"enabled"`
	AlertRulesPath    string             `json:"alert_rules_path"`
	IncidentStorePath string             `json:"incident_store_path"`
	PrometheusURL     string             `json:"prometheus_url"`
	AlertThresholds   AlertThresholds    `json:"alert_thresholds"`
	Notification      NotificationConfig `json:"notification"`
	IncidentConfig    IncidentConfig     `json:"incident_config"`
	AckTimeout        time.Duration      `json:"ack_timeout"`
	AutoResolution    time.Duration      `json:"auto_resolution"`
	MaxOpenIncidents  int                `json:"max_open_incidents"`
	AlertRetention    time.Duration      `json:"alert_retention"`
}

// AlertThresholds contains threshold configurations
type AlertThresholds struct {
	CriticalScore float64       `json:"critical_score"`
	HighScore     float64       `json:"high_score"`
	MediumScore   float64       `json:"medium_score"`
	LowScore      float64       `json:"low_score"`
	AnomalyRate   float64       `json:"anomaly_rate"`
	RecoveryRate  float64       `json:"recovery_rate"`
	BatchSize     int           `json:"batch_size"`
	FlushInterval time.Duration `json:"flush_interval"`
}

// NotificationConfig contains notification configuration
type NotificationConfig struct {
	Slack     SlackConfig     `json:"slack"`
	Email     EmailConfig     `json:"email"`
	PagerDuty PagerDutyConfig `json:"pagerduty"`
	Webhooks  []WebhookConfig `json:"webhooks"`
}

// SlackConfig contains Slack notification configuration
type SlackConfig struct {
	Enabled    bool   `json:"enabled"`
	WebhookURL string `json:"webhook_url"`
	Channel    string `json:"channel"`
	Username   string `json:"username"`
	IconEmoji  string `json:"icon_emoji"`
}

// EmailConfig contains email notification configuration
type EmailConfig struct {
	Enabled    bool     `json:"enabled"`
	SMTPServer string   `json:"smtp_server"`
	Port       int      `json:"port"`
	Username   string   `json:"username"`
	Password   string   `json:"password"`
	From       string   `json:"from"`
	To         []string `json:"to"`
	Subject    string   `json:"subject"`
}

// PagerDutyConfig contains PagerDuty notification configuration
type PagerDutyConfig struct {
	Enabled   bool   `json:"enabled"`
	APIKey    string `json:"api_key"`
	ServiceID string `json:"service_id"`
	Severity  string `json:"severity"`
}

// WebhookConfig contains webhook notification configuration
type WebhookConfig struct {
	Enabled bool              `json:"enabled"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
	Method  string            `json:"method"`
	Timeout time.Duration     `json:"timeout"`
	Retries int               `json:"retries"`
}

// IncidentConfig contains incident management configuration
type IncidentConfig struct {
	Enabled         bool                  `json:"enabled"`
	TriageTime      time.Duration         `json:"triage_time"`
	Escalation      EscalationConfig      `json:"escalation"`
	Acknowledgement AcknowledgementConfig `json:"acknowledgement"`
	Resolution      ResolutionConfig      `json:"resolution"`
	AutoCreate      bool                  `json:"auto_create"`
	Assignee        string                `json:"assignee"`
	Tags            []string              `json:"tags"`
}

// EscalationConfig contains escalation configuration
type EscalationConfig struct {
	Levels []EscalationLevel `json:"levels"`
	Rules  []EscalationRule  `json:"rules"`
}

// EscalationLevel represents an escalation level
type EscalationLevel struct {
	Name    string        `json:"name"`
	Timeout time.Duration `json:"timeout"`
	Notify  []string      `json:"notify"`
	Actions []string      `json:"actions"`
}

// EscalationRule defines escalation triggers
type EscalationRule struct {
	Condition string        `json:"condition"`
	Threshold float64       `json:"threshold"`
	Duration  time.Duration `json:"duration"`
	Action    string        `json:"action"`
}

// AcknowledgementConfig contains acknowledgement configuration
type AcknowledgementConfig struct {
	Required bool          `json:"required"`
	Timeout  time.Duration `json:"timeout"`
	Notify   []string      `json:"notify"`
}

// ResolutionConfig contains resolution configuration
type ResolutionConfig struct {
	AutoResolve bool          `json:"auto_resolve"`
	ResolveTime time.Duration `json:"resolve_time"`
	Conditions  []string      `json:"conditions"`
}

// ManagerAlertRule defines an alert rule
type ManagerAlertRule struct {
	ID           string              `json:"id"`
	Name         string              `json:"name"`
	Description  string              `json:"description"`
	Enabled      bool                `json:"enabled"`
	Metrics      []MetricRule        `json:"metrics"`
	Conditions   []AlertCondition    `json:"conditions"`
	Severity     string              `json:"severity"`
	Labels       map[string]string   `json:"labels"`
	Annotations  map[string]string   `json:"annotations"`
	Notification NotificationRule    `json:"notification"`
	Escalation   AlertEscalationRule `json:"escalation"`
	Actions      []AlertAction       `json:"actions"`
	Schedule     string              `json:"schedule"`
	Cooldown     time.Duration       `json:"cooldown"`
}

// MetricRule defines a metric rule
type MetricRule struct {
	Name      string  `json:"name"`
	Query     string  `json:"query"`
	Operator  string  `json:"operator"`
	Threshold float64 `json:"threshold"`
	For       string  `json:"for"`
}

// AlertCondition defines alert condition logic
type AlertCondition struct {
	Type      string            `json:"type"`
	Query     string            `json:"query"`
	Operator  string            `json:"operator"`
	Threshold float64           `json:"threshold"`
	For       string            `json:"for"`
	Labels    map[string]string `json:"labels"`
}

// NotificationRule defines notification behavior
type NotificationRule struct {
	Channels []string `json:"channels"`
	Message  string   `json:"message"`
	Template string   `json:"template"`
	Priority string   `json:"priority"`
}

// AlertEscalationRule defines escalation behavior
type AlertEscalationRule struct {
	Condition string  `json:"condition"`
	Threshold float64 `json:"threshold"`
	For       string  `json:"for"`
	Action    string  `json:"action"`
}

// AlertAction defines actions to take when alert fires
type AlertAction struct {
	Type       string                 `json:"type"`
	Parameters map[string]interface{} `json:"parameters"`
}

// Incident represents an anomaly incident
type Incident struct {
	ID               string            `json:"id"`
	Title            string            `json:"title"`
	Description      string            `json:"description"`
	Severity         string            `json:"severity"`
	Status           string            `json:"status"`
	State            string            `json:"state"`
	CreatedAt        time.Time         `json:"created_at"`
	UpdatedAt        time.Time         `json:"updated_at"`
	ResolvedAt       *time.Time        `json:"resolved_at,omitempty"`
	AcknowledgedAt   *time.Time        `json:"acknowledged_at,omitempty"`
	ResolvedBy       string            `json:"resolved_by,omitempty"`
	AcknowledgedBy   string            `json:"acknowledged_by,omitempty"`
	Assignee         string            `json:"assignee"`
	Tags             []string          `json:"tags"`
	Labels           map[string]string `json:"labels"`
	Annotations      map[string]string `json:"annotations"`
	Alerts           []AnomalyAlert    `json:"alerts"`
	RootCause        string            `json:"root_cause"`
	Correlation      string            `json:"correlation"`
	Timeline         []TimelineEvent   `json:"timeline"`
	RelatedIncidents []string          `json:"related_incidents"`
}

// TimelineEvent represents an event in the incident timeline
type TimelineEvent struct {
	Timestamp   time.Time              `json:"timestamp"`
	EventType   string                 `json:"event_type"`
	Description string                 `json:"description"`
	Actor       string                 `json:"actor"`
	Data        map[string]interface{} `json:"data"`
}

// IncidentStore stores and manages incidents
type IncidentStore struct {
	incidents map[string]*Incident
	mu        sync.RWMutex
}

// AlertMetrics contains metrics for alert management
type AlertMetrics struct {
	AlertsTotal        *prometheus.CounterVec `json:"alerts_total"`
	AlertsBySeverity   *prometheus.CounterVec `json:"alerts_by_severity"`
	AlertsByStatus     *prometheus.CounterVec `json:"alerts_by_status"`
	IncidentsTotal     *prometheus.CounterVec `json:"incidents_total"`
	IncidentsOpen      *prometheus.GaugeVec   `json:"incidents_open"`
	MeanResolutionTime prometheus.Histogram   `json:"mean_resolution_time"`
}

// NewAlertManager creates a new alert manager
func NewAlertManager(config AlertManagerConfig) (*AlertManager, error) {
	logger := log.New(log.Writer(), "[ALERT-MANAGER] ", log.LstdFlags|log.Lmsgprefix)

	am := &AlertManager{
		config:     config,
		logger:     logger,
		alertRules: make(map[string]*ManagerAlertRule),
		incidentStore: &IncidentStore{
			incidents: make(map[string]*Incident),
		},
		promRegistry: prometheus.NewRegistry(),
	}

	// Initialize metrics
	am.metrics = &AlertMetrics{
		AlertsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "anomaly_alerts_total",
				Help: "Total number of anomaly alerts generated",
			},
			[]string{"severity", "metric_name"},
		),
		AlertsBySeverity: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "anomaly_alerts_by_severity",
				Help: "Number of alerts by severity level",
			},
			[]string{"severity"},
		),
		AlertsByStatus: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "anomaly_alerts_by_status",
				Help: "Number of alerts by status",
			},
			[]string{"status"},
		),
		IncidentsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "anomaly_incidents_total",
				Help: "Total number of anomaly incidents created",
			},
			[]string{"severity"},
		),
		IncidentsOpen: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "anomaly_incidents_open",
				Help: "Number of currently open incidents",
			},
			[]string{"severity"},
		),
		MeanResolutionTime: prometheus.NewHistogram(
			prometheus.HistogramOpts{
				Name:    "anomaly_incidents_resolution_time_seconds",
				Help:    "Time to resolve incidents",
				Buckets: []float64{60, 300, 600, 1800, 3600, 7200, 14400, 28800},
			},
		),
	}

	// Register metrics
	am.promRegistry.MustRegister(am.metrics.AlertsTotal)
	am.promRegistry.MustRegister(am.metrics.AlertsBySeverity)
	am.promRegistry.MustRegister(am.metrics.AlertsByStatus)
	am.promRegistry.MustRegister(am.metrics.IncidentsTotal)
	am.promRegistry.MustRegister(am.metrics.IncidentsOpen)
	am.promRegistry.MustRegister(am.metrics.MeanResolutionTime)

	// Load alert rules
	if err := am.loadAlertRules(); err != nil {
		return nil, fmt.Errorf("failed to load alert rules: %w", err)
	}

	// Load existing incidents
	if err := am.loadIncidents(); err != nil {
		logger.Printf("Warning: Failed to load existing incidents: %v", err)
	}

	// Start incident management loop if enabled
	if config.IncidentConfig.Enabled {
		go am.incidentManagementLoop()
	}

	return am, nil
}

// loadAlertRules loads alert rules from configuration file
func (am *AlertManager) loadAlertRules() error {
	if am.config.AlertRulesPath == "" {
		return nil
	}

	data, err := os.ReadFile(am.config.AlertRulesPath)
	if err != nil {
		return fmt.Errorf("failed to read alert rules file: %w", err)
	}

	var rules struct {
		Rules []ManagerAlertRule `json:"rules"`
	}

	if err := yaml.Unmarshal(data, &rules); err != nil {
		return fmt.Errorf("failed to unmarshal alert rules: %w", err)
	}

	for i := range rules.Rules {
		rule := &rules.Rules[i]
		if rule.ID == "" {
			rule.ID = fmt.Sprintf("rule-%d", i)
		}
		am.alertRules[rule.ID] = rule
	}

	am.logger.Printf("Loaded %d alert rules", len(am.alertRules))
	return nil
}

// loadIncidents loads existing incidents from storage
func (am *AlertManager) loadIncidents() error {
	if am.config.IncidentStorePath == "" {
		return nil
	}

	data, err := os.ReadFile(am.config.IncidentStorePath)
	if err != nil {
		return fmt.Errorf("failed to read incident store: %w", err)
	}

	var incidents map[string]*Incident
	if err := json.Unmarshal(data, &incidents); err != nil {
		return fmt.Errorf("faiLED to unmarshal incidents: %w", err)
	}

	am.incidentStore.mu.Lock()
	am.incidentStore.incidents = incidents
	am.incidentStore.mu.Unlock()

	am.logger.Printf("Loaded %d existing incidents", len(incidents))
	return nil
}

// saveIncidents saves incidents to storage
func (am *AlertManager) saveIncidents() error {
	if am.config.IncidentStorePath == "" {
		return nil
	}

	am.incidentStore.mu.RLock()
	defer am.incidentStore.mu.RUnlock()

	data, err := json.MarshalIndent(am.incidentStore.incidents, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal incidents: %w", err)
	}

	return os.WriteFile(am.config.IncidentStorePath, data, 0644)
}

// ProcessAlert processes an anomaly alert
func (am *AlertManager) ProcessAlert(alert AnomalyAlert) error {
	if !am.config.Enabled {
		return nil
	}

	am.logger.Printf("Processing alert: %s - %s", alert.MetricName, alert.Severity)

	// Update metrics
	am.metrics.AlertsTotal.With(
		prometheus.Labels{
			"severity":    alert.Severity,
			"metric_name": alert.MetricName,
		},
	).Inc()

	// Check if alert matches any rules
	matchingRules := am.findMatchingRules(alert)
	if len(matchingRules) == 0 {
		return nil
	}

	// Create or update incident if incident management is enabled
	if am.config.IncidentConfig.Enabled {
		incident, err := am.createOrUpdateIncident(alert, matchingRules)
		if err != nil {
			return fmt.Errorf("failed to create/update incident: %w", err)
		}

		// Send notifications
		if err := am.sendIncidentNotifications(incident); err != nil {
			am.logger.Printf("Failed to send incident notifications: %v", err)
		}
	}

	return nil
}

// findMatchingRules finds alert rules that match an alert
func (am *AlertManager) findMatchingRules(alert AnomalyAlert) []*ManagerAlertRule {
	var matchingRules []*ManagerAlertRule

	for _, rule := range am.alertRules {
		if !rule.Enabled {
			continue
		}

		if am.alertMatchesRule(alert, rule) {
			matchingRules = append(matchingRules, rule)
		}
	}

	return matchingRules
}

// alertMatchesRule checks if an alert matches an alert rule
func (am *AlertManager) alertMatchesRule(alert AnomalyAlert, rule *ManagerAlertRule) bool {
	// Check severity
	if rule.Severity != "" && rule.Severity != alert.Severity {
		return false
	}

	// Check metric name
	if rule.Name != "" && rule.Name != alert.MetricName {
		return false
	}

	// Check conditions
	for _, condition := range rule.Conditions {
		if am.alertMatchesCondition(alert, condition) {
			return true
		}
	}

	return false
}

// alertMatchesCondition checks if an alert matches a condition
func (am *AlertManager) alertMatchesCondition(alert AnomalyAlert, condition AlertCondition) bool {
	// This is a simplified implementation
	// In practice, you would query Prometheus and evaluate conditions
	return false
}

// createOrUpdateIncident creates a new incident or updates an existing one
func (am *AlertManager) createOrUpdateIncident(alert AnomalyAlert, rules []*ManagerAlertRule) (*Incident, error) {
	am.incidentStore.mu.Lock()
	defer am.incidentStore.mu.Unlock()

	// Look for existing incident with same correlation or metric
	var incident *Incident
	existingID := ""

	for id, inc := range am.incidentStore.incidents {
		if inc.State == "open" && inc.Labels["metric_name"] == alert.MetricName {
			incident = inc
			existingID = id
			break
		}
	}

	// Create new incident if none exists
	if incident == nil {
		incident = &Incident{
			ID:          generateIncidentID(),
			Title:       fmt.Sprintf("Anomaly detected in %s", alert.MetricName),
			Description: generateIncidentDescription(alert),
			Severity:    am.determineIncidentSeverity(alert, rules),
			Status:      "new",
			State:       "open",
			CreatedAt:   alert.Timestamp,
			UpdatedAt:   alert.Timestamp,
			Tags:        am.config.IncidentConfig.Tags,
			Labels:      alert.Labels,
			Annotations: contextToAnnotations(alert.Context),
			// State: "investigating", // Removed duplicate
			Alerts: []AnomalyAlert{alert},
		}

		if am.config.IncidentConfig.AutoCreate {
			incident.Assignee = am.config.IncidentConfig.Assignee
		}

		am.incidentStore.incidents[incident.ID] = incident
	} else {
		// Update existing incident
		incident.State = "investigating"
		incident.UpdatedAt = alert.Timestamp
		incident.Alerts = append(incident.Alerts, alert)

		// Update severity if needed
		newSeverity := am.determineIncidentSeverity(alert, rules)
		if am.shouldUpgradeSeverity(incident.Severity, newSeverity) {
			incident.Severity = newSeverity
		}

		am.incidentStore.incidents[existingID] = incident
	}

	// Add timeline event
	event := TimelineEvent{
		Timestamp:   alert.Timestamp,
		EventType:   "alert_detected",
		Description: fmt.Sprintf("Anomaly detected: %s", alert.Message),
		Actor:       "anomaly_detector",
		Data: map[string]interface{}{
			"alert_id":  alert.ID,
			"score":     alert.Score,
			"deviation": alert.Deviation,
		},
	}

	incident.Timeline = append(incident.Timeline, event)

	// Update metrics
	am.metrics.IncidentsTotal.With(
		prometheus.Labels{
			"severity": incident.Severity,
		},
	).Inc()

	am.metrics.IncidentsOpen.With(
		prometheus.Labels{
			"severity": incident.Severity,
		},
	).Set(float64(am.countOpenIncidents(incident.Severity)))

	// Save to storage
	if err := am.saveIncidents(); err != nil {
		am.logger.Printf("Failed to save incidents: %v", err)
	}

	return incident, nil
}

// sendIncidentNotifications sends notifications for an incident
func (am *AlertManager) sendIncidentNotifications(incident *Incident) error {
	// Send Slack notification
	if am.config.Notification.Slack.Enabled {
		if err := am.sendSlackNotification(incident); err != nil {
			am.logger.Printf("Failed to send Slack notification: %v", err)
		}
	}

	// Send email notification
	if am.config.Notification.Email.Enabled {
		if err := am.sendEmailNotification(incident); err != nil {
			am.logger.Printf("Failed to send email notification: %v", err)
		}
	}

	// Send PagerDuty notification
	if am.config.Notification.PagerDuty.Enabled {
		if err := am.sendPagerDutyNotification(incident); err != nil {
			am.logger.Printf("Failed to send PagerDuty notification: %v", err)
		}
	}

	// Send webhook notifications
	for _, webhook := range am.config.Notification.Webhooks {
		if err := am.sendWebhookNotification(incident, webhook); err != nil {
			am.logger.Printf("Failed to send webhook notification: %v", err)
		}
	}

	return nil
}

// sendSlackNotification sends Slack notification
func (am *AlertManager) sendSlackNotification(incident *Incident) error {
	if !am.config.Notification.Slack.Enabled {
		return nil
	}

	payload := map[string]interface{}{
		"text": fmt.Sprintf(":warning: Incident %s: %s", incident.ID, incident.Title),
		"attachments": []map[string]interface{}{
			{
				"color": "danger",
				"fields": []map[string]interface{}{
					{
						"title": "Severity",
						"value": incident.Severity,
						"short": true,
					},
					{
						"title": "Status",
						"value": incident.Status,
						"short": true,
					},
					{
						"title": "Created",
						"value": incident.CreatedAt.Format(time.RFC3339),
						"short": true,
					},
					{
						"title": "Alerts",
						"value": len(incident.Alerts),
						"short": true,
					},
				},
				"actions": []map[string]interface{}{
					{
						"type": "button",
						"text": "View Details",
						"url":  fmt.Sprintf("%s/incidents/%s", am.config.PrometheusURL, incident.ID),
					},
				},
			},
		},
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", am.config.Notification.Slack.WebhookURL, bytes.NewBuffer(data))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+am.config.Notification.Slack.Username)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("Slack notification failed with status %d", resp.StatusCode)
	}

	return nil
}

// sendEmailNotification sends email notification
func (am *AlertManager) sendEmailNotification(incident *Incident) error {
	// Implementation would send email via SMTP
	return nil
}

// sendPagerDutyNotification sends PagerDuty notification
func (am *AlertManager) sendPagerDutyNotification(incident *Incident) error {
	if !am.config.Notification.PagerDuty.Enabled {
		return nil
	}

	payload := map[string]interface{}{
		"routing_key":  am.config.Notification.PagerDuty.ServiceID,
		"event_action": "trigger",
		"payload": map[string]interface{}{
			"summary":   fmt.Sprintf("Incident %s: %s", incident.ID, incident.Title),
			"severity":  am.config.Notification.PagerDuty.Severity,
			"timestamp": incident.CreatedAt.Unix(),
			"details":   incident.Description,
			"custom_details": map[string]interface{}{
				"incident_id": incident.ID,
				"severity":    incident.Severity,
				"status":      incident.Status,
				"labels":      incident.Labels,
			},
		},
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", "https://events.pagerduty.com/v2/enqueue", bytes.NewBuffer(data))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Token token="+am.config.Notification.PagerDuty.APIKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("PagerDuty notification failed with status %d", resp.StatusCode)
	}

	return nil
}

// sendWebhookNotification sends webhook notification
func (am *AlertManager) sendWebhookNotification(incident *Incident, config WebhookConfig) error {
	payload := map[string]interface{}{
		"incident":  incident,
		"timestamp": time.Now(),
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	method := "POST"
	if config.Method != "" {
		method = config.Method
	}

	req, err := http.NewRequest(method, config.URL, bytes.NewBuffer(data))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	for key, value := range config.Headers {
		req.Header.Set(key, value)
	}

	client := &http.Client{
		Timeout: config.Timeout,
	}

	var resp *http.Response

	for attempt := 0; attempt < config.Retries; attempt++ {
		resp, err = client.Do(req)
		if err == nil && resp.StatusCode < 400 {
			break
		}

		if attempt == config.Retries-1 {
			return fmt.Errorf("webhook notification failed after %d attempts: %v", config.Retries, err)
		}

		time.Sleep(2 * time.Second)
	}

	if resp != nil {
		defer resp.Body.Close()
	}

	if resp != nil && resp.StatusCode >= 400 {
		return fmt.Errorf("webhook notification failed with status %d", resp.StatusCode)
	}

	return nil
}

// incidentManagementLoop manages incident lifecycle
func (am *AlertManager) incidentManagementLoop() {
	ticker := time.NewTicker(am.config.AckTimeout)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			am.checkIncidentAging()
			am.checkEscalations()
			am.checkAutoResolution()
		}
	}
}

// checkIncidentAging checks for incident aging and takes appropriate action
func (am *AlertManager) checkIncidentAging() {
	am.incidentStore.mu.RLock()
	defer am.incidentStore.mu.RUnlock()

	for _, incident := range am.incidentStore.incidents {
		if incident.State != "resolved" && incident.State != "closed" {
			age := time.Since(incident.CreatedAt)
			if age > am.config.IncidentConfig.TriageTime && incident.AcknowledgedAt == nil {
				// Escalate or auto-acknowledge
				am.logger.Printf("Incident %s has not been acknowledged for %v", incident.ID, age)
			}
		}
	}
}

// checkEscalations checks for escalation requirements
func (am *AlertManager) checkEscalations() {
	// Implementation would check escalation rules and trigger escalations
}

// checkAutoResolution checks for auto-resolution opportunities
func (am *AlertManager) checkAutoResolution() {
	// Implementation would check if incidents can be auto-resolved
}

// countOpenIncidents counts open incidents by severity
func (am *AlertManager) countOpenIncidents(severity string) float64 {
	am.incidentStore.mu.RLock()
	defer am.incidentStore.mu.RUnlock()

	count := 0
	for _, incident := range am.incidentStore.incidents {
		if incident.State == "open" && incident.Severity == severity {
			count++
		}
	}

	return float64(count)
}

// shouldUpgradeSeverity checks if severity should be upgraded
func (am *AlertManager) shouldUpgradeSeverity(current, new string) bool {
	severityOrder := map[string]int{
		"low":      1,
		"medium":   2,
		"high":     3,
		"critical": 4,
	}

	currentLevel, exists := severityOrder[current]
	newLevel, exists := severityOrder[new]

	return exists && newLevel > currentLevel
}

// generateIncidentID generates a unique incident ID
func generateIncidentID() string {
	return fmt.Sprintf("inc-%d", time.Now().UnixNano())
}

// generateIncidentDescription generates a description for the incident
func generateIncidentDescription(alert AnomalyAlert) string {
	return fmt.Sprintf("Anomaly detected in metric %s. Value: %.2f, Expected: %.2f, Deviation: %.2f%%, Score: %.2f",
		alert.MetricName, alert.Value, alert.ExpectedValue, alert.Deviation, alert.Score)
}

// determineIncidentSeverity determines incident severity
func (am *AlertManager) determineIncidentSeverity(alert AnomalyAlert, rules []*ManagerAlertRule) string {
	// Start with alert severity
	severity := alert.Severity

	// Check if any rule specifies higher severity
	for _, rule := range rules {
		if rule.Severity != "" && am.shouldUpgradeSeverity(severity, rule.Severity) {
			severity = rule.Severity
		}
	}

	// Consider anomaly score
	if alert.Score > am.config.AlertThresholds.CriticalScore {
		severity = "critical"
	} else if alert.Score > am.config.AlertThresholds.HighScore {
		severity = "high"
	} else if alert.Score > am.config.AlertThresholds.MediumScore {
		severity = "medium"
	} else {
		severity = "low"
	}

	return severity
}

// GetMetrics returns the alert metrics for Prometheus
func (am *AlertManager) GetMetrics() *prometheus.Registry {
	return am.promRegistry
}

// GetIncidents returns all incidents
func (am *AlertManager) GetIncidents() map[string]*Incident {
	am.incidentStore.mu.RLock()
	defer am.incidentStore.mu.RUnlock()

	incidents := make(map[string]*Incident)
	for id, incident := range am.incidentStore.incidents {
		incidents[id] = incident
	}

	return incidents
}

// GetIncident returns a specific incident by ID
func (am *AlertManager) GetIncident(id string) (*Incident, error) {
	am.incidentStore.mu.RLock()
	defer am.incidentStore.mu.RUnlock()

	incident, exists := am.incidentStore.incidents[id]
	if !exists {
		return nil, fmt.Errorf("incident not found: %s", id)
	}

	return incident, nil
}

// AcknowledgeIncident acknowledges an incident
func (am *AlertManager) AcknowledgeIncident(id string, user string) error {
	am.incidentStore.mu.Lock()
	defer am.incidentStore.mu.Unlock()

	incident, exists := am.incidentStore.incidents[id]
	if !exists {
		return fmt.Errorf("incident not found: %s", id)
	}

	now := time.Now()
	incident.AcknowledgedAt = &now
	incident.AcknowledgedBy = user
	incident.State = "acknowledged"

	// Add timeline event
	event := TimelineEvent{
		Timestamp:   now,
		EventType:   "acknowledged",
		Description: fmt.Sprintf("Incident acknowledged by %s", user),
		Actor:       user,
		Data: map[string]interface{}{
			"incident_id": incident.ID,
		},
	}

	incident.Timeline = append(incident.Timeline, event)
	incident.UpdatedAt = now

	return am.saveIncidents()
}

// ResolveIncident resolves an incident
func (am *AlertManager) ResolveIncident(id string, user string, resolution string) error {
	am.incidentStore.mu.Lock()
	defer am.incidentStore.mu.Unlock()

	incident, exists := am.incidentStore.incidents[id]
	if !exists {
		return fmt.Errorf("incident not found: %s", id)
	}

	now := time.Now()
	incident.ResolvedAt = &now
	incident.ResolvedBy = user
	incident.State = "resolved"

	// Add timeline event
	event := TimelineEvent{
		Timestamp:   now,
		EventType:   "resolved",
		Description: fmt.Sprintf("Incident resolved by %s: %s", user, resolution),
		Actor:       user,
		Data: map[string]interface{}{
			"incident_id": incident.ID,
			"resolution":  resolution,
		},
	}

	incident.Timeline = append(incident.Timeline, event)
	incident.UpdatedAt = now

	// Update metrics
	am.metrics.MeanResolutionTime.Observe(time.Since(incident.CreatedAt).Seconds())

	return am.saveIncidents()
}

func contextToAnnotations(ctx map[string]interface{}) map[string]string {
	annotations := make(map[string]string)
	for k, v := range ctx {
		annotations[k] = fmt.Sprintf("%v", v)
	}
	return annotations
}

// Shutdown stops the alert manager
func (am *AlertManager) Shutdown() error {
	// Stop any background routines or close resources
	return nil
}

// GetActiveAlerts returns all active alerts
func (am *AlertManager) GetActiveAlerts() ([]map[string]interface{}, error) {
	am.mu.RLock()
	defer am.mu.RUnlock()
	// Return stub alerts or convert incidents
	return []map[string]interface{}{}, nil
}

// AcknowledgeAlert acknowledges an alert
func (am *AlertManager) AcknowledgeAlert(id string, user string, comment string) error {
	am.mu.Lock()
	defer am.mu.Unlock()
	// Logic to acknowledge alert
	return nil
}
