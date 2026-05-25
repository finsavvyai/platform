package services

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
	"go.uber.org/zap"
)

// AlertingService implements comprehensive alerting functionality
type AlertingService struct {
	logger             *zap.Logger
	alertManager       ports.AlertManager
	alertRuleManager   ports.AlertRuleManager
	notificationManager ports.NotificationManager
	metricsStorage     ports.MetricsStorage
	wsManager          ports.WebSocketManager

	rules              map[string]*domain.AlertRule
	activeAlerts       map[string]*domain.Alert
	evaluationState    map[string]*EvaluationState
	mu                 sync.RWMutex
	ctx                context.Context
	cancel             context.CancelFunc
	wg                 sync.WaitGroup
	evaluationTicker   *time.Ticker
	config             *AlertingConfig
}

// AlertingConfig represents alerting service configuration
type AlertingConfig struct {
	Enabled                bool          `json:"enabled"`
	EvaluationInterval     time.Duration `json:"evaluation_interval"`
	MaxConcurrentEvaluations int         `json:"max_concurrent_evaluations"`
	DefaultSeverity        domain.AlertSeverity `json:"default_severity"`
	NotificationRetries    int           `json:"notification_retries"`
	NotificationTimeout    time.Duration `json:"notification_timeout"`
	AlertRetention         time.Duration `json:"alert_retention"`
	SilenceDefaultDuration time.Duration `json:"silence_default_duration"`
}

// EvaluationState tracks the state of rule evaluations
type EvaluationState struct {
	LastEvaluation time.Time
	LastFiring     time.Time
	AlertID        string
	ConsecutiveFires int
}

// NewAlertingService creates a new alerting service
func NewAlertingService(
	logger *zap.Logger,
	alertManager ports.AlertManager,
	alertRuleManager ports.AlertRuleManager,
	notificationManager ports.NotificationManager,
	metricsStorage ports.MetricsStorage,
	wsManager ports.WebSocketManager,
) *AlertingService {
	ctx, cancel := context.WithCancel(context.Background())

	return &AlertingService{
		logger:             logger,
		alertManager:       alertManager,
		alertRuleManager:   alertRuleManager,
		notificationManager: notificationManager,
		metricsStorage:     metricsStorage,
		wsManager:          wsManager,
		rules:              make(map[string]*domain.AlertRule),
		activeAlerts:       make(map[string]*domain.Alert),
		evaluationState:    make(map[string]*EvaluationState),
		ctx:                ctx,
		cancel:             cancel,
		config: &AlertingConfig{
			Enabled:                true,
			EvaluationInterval:     30 * time.Second,
			MaxConcurrentEvaluations: 10,
			DefaultSeverity:        domain.AlertSeverityMedium,
			NotificationRetries:    3,
			NotificationTimeout:    10 * time.Second,
			AlertRetention:         7 * 24 * time.Hour, // 7 days
			SilenceDefaultDuration: 1 * time.Hour,
		},
	}
}

// Start starts the alerting service
func (s *AlertingService) Start(ctx context.Context) error {
	if !s.config.Enabled {
		s.logger.Info("Alerting service is disabled")
		return nil
	}

	s.logger.Info("Starting alerting service")

	// Load existing alert rules
	if err := s.loadAlertRules(ctx); err != nil {
		return fmt.Errorf("failed to load alert rules: %w", err)
	}

	// Load existing active alerts
	if err := s.loadActiveAlerts(ctx); err != nil {
		s.logger.Warn("Failed to load active alerts", zap.Error(err))
	}

	// Start periodic evaluation
	s.startPeriodicEvaluation(ctx)

	// Start cleanup routine
	s.startCleanupRoutine(ctx)

	s.logger.Info("Alerting service started successfully")
	return nil
}

// Stop stops the alerting service
func (s *AlertingService) Stop(ctx context.Context) error {
	s.logger.Info("Stopping alerting service")

	s.cancel()

	if s.evaluationTicker != nil {
		s.evaluationTicker.Stop()
	}

	s.wg.Wait()

	s.logger.Info("Alerting service stopped")
	return nil
}

// CreateAlertRule creates a new alert rule
func (s *AlertingService) CreateAlertRule(ctx context.Context, rule *domain.AlertRule) error {
	if err := s.validateAlertRule(rule); err != nil {
		return fmt.Errorf("invalid alert rule: %w", err)
	}

	if err := s.alertRuleManager.CreateRule(ctx, rule); err != nil {
		return fmt.Errorf("failed to create alert rule: %w", err)
	}

	s.mu.Lock()
	s.rules[rule.ID] = rule
	s.mu.Unlock()

	s.logger.Info("Alert rule created",
		zap.String("rule_id", rule.ID),
		zap.String("rule_name", rule.Name),
		zap.String("metric_name", rule.MetricName))

	return nil
}

// UpdateAlertRule updates an existing alert rule
func (s *AlertingService) UpdateAlertRule(ctx context.Context, rule *domain.AlertRule) error {
	if err := s.validateAlertRule(rule); err != nil {
		return fmt.Errorf("invalid alert rule: %w", err)
	}

	if err := s.alertRuleManager.UpdateRule(ctx, rule); err != nil {
		return fmt.Errorf("failed to update alert rule: %w", err)
	}

	s.mu.Lock()
	s.rules[rule.ID] = rule
	// Reset evaluation state for this rule
	delete(s.evaluationState, rule.ID)
	s.mu.Unlock()

	s.logger.Info("Alert rule updated", zap.String("rule_id", rule.ID))
	return nil
}

// DeleteAlertRule deletes an alert rule
func (s *AlertingService) DeleteAlertRule(ctx context.Context, ruleID string) error {
	if err := s.alertRuleManager.DeleteRule(ctx, ruleID); err != nil {
		return fmt.Errorf("failed to delete alert rule: %w", err)
	}

	s.mu.Lock()
	delete(s.rules, ruleID)
	delete(s.evaluationState, ruleID)
	s.mu.Unlock()

	s.logger.Info("Alert rule deleted", zap.String("rule_id", ruleID))
	return nil
}

// GetAlertRules returns all alert rules
func (s *AlertingService) GetAlertRules(ctx context.Context, enabled *bool) ([]*domain.AlertRule, error) {
	return s.alertRuleManager.GetRules(ctx, enabled)
}

// GetAlertRule returns a specific alert rule
func (s *AlertingService) GetAlertRule(ctx context.Context, ruleID string) (*domain.AlertRule, error) {
	return s.alertRuleManager.GetRule(ctx, ruleID)
}

// EvaluateRules evaluates all alert rules
func (s *AlertingService) EvaluateRules(ctx context.Context) ([]*domain.Alert, error) {
	s.mu.RLock()
	rules := make([]*domain.AlertRule, 0, len(s.rules))
	for _, rule := range s.rules {
		if rule.Enabled {
			rules = append(rules, rule)
		}
	}
	s.mu.RUnlock()

	var alerts []*domain.Alert
	var wg sync.WaitGroup
	semaphore := make(chan struct{}, s.config.MaxConcurrentEvaluations)
	alertsChan := make(chan *domain.Alert, len(rules))

	for _, rule := range rules {
		wg.Add(1)
		semaphore <- struct{}{}

		go func(r *domain.AlertRule) {
			defer wg.Done()
			defer func() { <-semaphore }()

			if alert, err := s.evaluateRule(ctx, r); err != nil {
				s.logger.Error("Failed to evaluate alert rule",
					zap.Error(err),
					zap.String("rule_id", r.ID))
			} else if alert != nil {
				alertsChan <- alert
			}
		}(rule)
	}

	wg.Wait()
	close(alertsChan)

	for alert := range alertsChan {
		alerts = append(alerts, alert)
	}

	return alerts, nil
}

// GetAlerts returns alerts based on filters
func (s *AlertingService) GetAlerts(ctx context.Context, filters ports.AlertFilters) ([]*domain.Alert, error) {
	return s.alertManager.GetAlerts(ctx, filters)
}

// GetActiveAlerts returns all active alerts
func (s *AlertingService) GetActiveAlerts(ctx context.Context) ([]*domain.Alert, error) {
	return s.alertManager.GetActiveAlerts(ctx)
}

// AcknowledgeAlert acknowledges an alert
func (s *AlertingService) AcknowledgeAlert(ctx context.Context, alertID string, userID string) error {
	alert, err := s.alertManager.GetAlert(ctx, alertID)
	if err != nil {
		return fmt.Errorf("failed to get alert: %w", err)
	}

	if alert.Status != domain.AlertStatusActive {
		return fmt.Errorf("alert %s is not active", alertID)
	}

	// Add acknowledgment annotation
	if alert.Annotations == nil {
		alert.Annotations = make(map[string]string)
	}
	alert.Annotations["acknowledged_by"] = userID
	alert.Annotations["acknowledged_at"] = time.Now().Format(time.RFC3339)

	if err := s.alertManager.UpdateAlert(ctx, alert); err != nil {
		return fmt.Errorf("failed to update alert: %w", err)
	}

	// Broadcast alert update
	if s.wsManager != nil {
		s.wsManager.BroadcastAlert(ctx, alert)
	}

	s.logger.Info("Alert acknowledged",
		zap.String("alert_id", alertID),
		zap.String("user_id", userID))

	return nil
}

// SilenceAlert silences an alert for a specified duration
func (s *AlertingService) SilenceAlert(ctx context.Context, alertID string, duration time.Duration, userID string) error {
	alert, err := s.alertManager.GetAlert(ctx, alertID)
	if err != nil {
		return fmt.Errorf("failed to get alert: %w", err)
	}

	if alert.Status != domain.AlertStatusActive {
		return fmt.Errorf("alert %s is not active", alertID)
	}

	silenceUntil := time.Now().Add(duration)
	if err := s.alertManager.SilenceAlert(ctx, alertID, duration); err != nil {
		return fmt.Errorf("failed to silence alert: %w", err)
	}

	// Add silence annotation
	if alert.Annotations == nil {
		alert.Annotations = make(map[string]string)
	}
	alert.Annotations["silenced_by"] = userID
	alert.Annotations["silenced_until"] = silenceUntil.Format(time.RFC3339)
	alert.Annotations["silence_duration"] = duration.String()

	if err := s.alertManager.UpdateAlert(ctx, alert); err != nil {
		return fmt.Errorf("failed to update alert: %w", err)
	}

	// Broadcast alert update
	if s.wsManager != nil {
		s.wsManager.BroadcastAlert(ctx, alert)
	}

	s.logger.Info("Alert silenced",
		zap.String("alert_id", alertID),
		zap.String("user_id", userID),
		zap.Duration("duration", duration))

	return nil
}

// ResolveAlert manually resolves an alert
func (s *AlertingService) ResolveAlert(ctx context.Context, alertID string, userID string) error {
	alert, err := s.alertManager.GetAlert(ctx, alertID)
	if err != nil {
		return fmt.Errorf("failed to get alert: %w", err)
	}

	if alert.Status == domain.AlertStatusResolved {
		return fmt.Errorf("alert %s is already resolved", alertID)
	}

	if err := s.alertManager.ResolveAlert(ctx, alertID); err != nil {
		return fmt.Errorf("failed to resolve alert: %w", err)
	}

	// Add resolution annotation
	if alert.Annotations == nil {
		alert.Annotations = make(map[string]string)
	}
	alert.Annotations["resolved_by"] = userID
	alert.Annotations["resolved_at"] = time.Now().Format(time.RFC3339)

	// Update alert status
	alert.Status = domain.AlertStatusResolved
	now := time.Now()
	alert.ResolvedAt = &now

	if err := s.alertManager.UpdateAlert(ctx, alert); err != nil {
		return fmt.Errorf("failed to update alert: %w", err)
	}

	// Broadcast alert update
	if s.wsManager != nil {
		s.wsManager.BroadcastAlert(ctx, alert)
	}

	// Send resolution notification
	s.sendResolutionNotification(ctx, alert)

	s.logger.Info("Alert resolved",
		zap.String("alert_id", alertID),
		zap.String("user_id", userID))

	return nil
}

// TestAlertRule tests an alert rule against current metrics
func (s *AlertingService) TestAlertRule(ctx context.Context, rule *domain.AlertRule) (*domain.Alert, error) {
	if err := s.validateAlertRule(rule); err != nil {
		return nil, fmt.Errorf("invalid alert rule: %w", err)
	}

	return s.evaluateRule(ctx, rule)
}

// Private methods

func (s *AlertingService) startPeriodicEvaluation(ctx context.Context) {
	s.evaluationTicker = time.NewTicker(s.config.EvaluationInterval)

	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		for {
			select {
			case <-s.evaluationTicker.C:
				if _, err := s.EvaluateRules(ctx); err != nil {
					s.logger.Error("Failed to evaluate alert rules", zap.Error(err))
				}
			case <-s.ctx.Done():
				return
			}
		}
	}()
}

func (s *AlertingService) startCleanupRoutine(ctx context.Context) {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				s.cleanupOldAlerts(ctx)
			case <-s.ctx.Done():
				return
			}
		}
	}()
}

func (s *AlertingService) loadAlertRules(ctx context.Context) error {
	rules, err := s.alertRuleManager.GetRules(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to get alert rules: %w", err)
	}

	s.mu.Lock()
	for _, rule := range rules {
		s.rules[rule.ID] = rule
	}
	s.mu.Unlock()

	s.logger.Info("Loaded alert rules", zap.Int("count", len(rules)))
	return nil
}

func (s *AlertingService) loadActiveAlerts(ctx context.Context) error {
	activeAlerts, err := s.alertManager.GetActiveAlerts(ctx)
	if err != nil {
		return fmt.Errorf("failed to get active alerts: %w", err)
	}

	s.mu.Lock()
	for _, alert := range activeAlerts {
		s.activeAlerts[alert.ID] = alert
	}
	s.mu.Unlock()

	s.logger.Info("Loaded active alerts", zap.Int("count", len(activeAlerts)))
	return nil
}

func (s *AlertingService) evaluateRule(ctx context.Context, rule *domain.AlertRule) (*domain.Alert, error) {
	// Query metrics for this rule
	query := &ports.MetricsQuery{
		Name:   rule.MetricName,
		From:   time.Now().Add(-rule.Duration),
		To:     time.Now(),
		Limit:  100,
	}

	metrics, err := s.metricsStorage.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query metrics: %w", err)
	}

	if len(metrics) == 0 {
		// No metrics available, check if we have an active alert to resolve
		return s.checkForAlertResolution(ctx, rule), nil
	}

	// Evaluate the condition
	latestMetric := metrics[len(metrics)-1]
	value := latestMetric.Value

	firing := false
	switch rule.Condition {
	case "gt":
		firing = value > rule.Threshold
	case "lt":
		firing = value < rule.Threshold
	case "gte":
		firing = value >= rule.Threshold
	case "lte":
		firing = value <= rule.Threshold
	case "eq":
		firing = value == rule.Threshold
	case "neq":
		firing = value != rule.Threshold
	default:
		return nil, fmt.Errorf("unsupported condition: %s", rule.Condition)
	}

	// Update evaluation state
	s.mu.Lock()
	state := s.getOrCreateEvaluationState(rule.ID)
	state.LastEvaluation = time.Now()

	if firing {
		state.ConsecutiveFires++
		state.LastFiring = time.Now()
	} else {
		state.ConsecutiveFires = 0
	}
	s.mu.Unlock()

	// Handle alert state changes
	if firing {
		return s.handleFiringAlert(ctx, rule, value, latestMetric.Labels)
	} else {
		return s.checkForAlertResolution(ctx, rule), nil
	}
}

func (s *AlertingService) handleFiringAlert(ctx context.Context, rule *domain.AlertRule, value float64, labels map[string]string) (*domain.Alert, error) {
	s.mu.Lock()
	state := s.evaluationState[rule.ID]

	// Check if we already have an active alert for this rule
	for _, alert := range s.activeAlerts {
		if alert.Source == rule.ID && alert.Status == domain.AlertStatusActive {
			// Update existing alert
			alert.CurrentValue = value
			alert.UpdatedAt = time.Now()

			s.mu.Unlock()

			if err := s.alertManager.UpdateAlert(ctx, alert); err != nil {
				return nil, fmt.Errorf("failed to update alert: %w", err)
			}

			// Broadcast alert update
			if s.wsManager != nil {
				s.wsManager.BroadcastAlert(ctx, alert)
			}

			return nil, nil
		}
	}
	s.mu.Unlock()

	// Create new alert
	alert := &domain.Alert{
		ID:            generateAlertID(),
		Name:          rule.Name,
		Description:   rule.Description,
		Severity:      rule.Severity,
		Status:        domain.AlertStatusActive,
		Source:        rule.ID,
		Condition:     rule.Condition,
		Threshold:     rule.Threshold,
		CurrentValue:  value,
		Labels:        mergeLabels(rule.Labels, labels),
		Annotations:   rule.Annotations,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	// Store alert
	if err := s.alertManager.CreateAlert(ctx, alert); err != nil {
		return nil, fmt.Errorf("failed to create alert: %w", err)
	}

	// Update state
	s.mu.Lock()
	state.AlertID = alert.ID
	s.activeAlerts[alert.ID] = alert
	s.mu.Unlock()

	// Send notifications
	s.sendAlertNotifications(ctx, alert)

	// Broadcast alert
	if s.wsManager != nil {
		s.wsManager.BroadcastAlert(ctx, alert)
	}

	s.logger.Info("Alert fired",
		zap.String("alert_id", alert.ID),
		zap.String("rule_id", rule.ID),
		zap.String("severity", string(alert.Severity)),
		zap.Float64("value", value),
		zap.Float64("threshold", rule.Threshold))

	return alert, nil
}

func (s *AlertingService) checkForAlertResolution(ctx context.Context, rule *domain.AlertRule) *domain.Alert {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Find active alerts for this rule
	for alertID, alert := range s.activeAlerts {
		if alert.Source == rule.ID && alert.Status == domain.AlertStatusActive {
			// Check if alert should be resolved (no consecutive fires for evaluation interval)
			state := s.evaluationState[rule.ID]
			if time.Since(state.LastFiring) > rule.Duration {
				// Resolve the alert
				alert.Status = domain.AlertStatusResolved
				now := time.Now()
				alert.ResolvedAt = &now
				alert.UpdatedAt = now

				delete(s.activeAlerts, alertID)

				if err := s.alertManager.UpdateAlert(ctx, alert); err != nil {
					s.logger.Error("Failed to resolve alert", zap.Error(err), zap.String("alert_id", alertID))
				} else {
					// Broadcast resolution
					if s.wsManager != nil {
						s.wsManager.BroadcastAlert(ctx, alert)
					}

					// Send resolution notification
					s.sendResolutionNotification(ctx, alert)

					s.logger.Info("Alert auto-resolved",
						zap.String("alert_id", alertID),
						zap.String("rule_id", rule.ID))
				}

				return alert
			}
		}
	}

	return nil
}

func (s *AlertingService) sendAlertNotifications(ctx context.Context, alert *domain.Alert) {
	if s.notificationManager == nil {
		return
	}

	notification := &ports.Notification{
		ID:       generateNotificationID(),
		Type:     "alert",
		Severity: alert.Severity,
		Title:    fmt.Sprintf("[%s] %s", strings.ToUpper(string(alert.Severity)), alert.Name),
		Message:  alert.Description,
		Data: map[string]interface{}{
			"alert_id":     alert.ID,
			"source":       alert.Source,
			"severity":     alert.Severity,
			"threshold":    alert.Threshold,
			"current_value": alert.CurrentValue,
			"condition":    alert.Condition,
		},
		CreatedAt: time.Now(),
		Status:    "pending",
	}

	if err := s.notificationManager.SendNotification(ctx, notification); err != nil {
		s.logger.Error("Failed to send alert notification",
			zap.Error(err),
			zap.String("alert_id", alert.ID))
	}
}

func (s *AlertingService) sendResolutionNotification(ctx context.Context, alert *domain.Alert) {
	if s.notificationManager == nil {
		return
	}

	notification := &ports.Notification{
		ID:       generateNotificationID(),
		Type:     "alert_resolved",
		Severity: domain.AlertSeverityInfo,
		Title:    fmt.Sprintf("[RESOLVED] %s", alert.Name),
		Message:  fmt.Sprintf("Alert %s has been resolved", alert.Name),
		Data: map[string]interface{}{
			"alert_id": alert.ID,
			"source":   alert.Source,
		},
		CreatedAt: time.Now(),
		Status:    "pending",
	}

	if err := s.notificationManager.SendNotification(ctx, notification); err != nil {
		s.logger.Error("Failed to send resolution notification",
			zap.Error(err),
			zap.String("alert_id", alert.ID))
	}
}

func (s *AlertingService) cleanupOldAlerts(ctx context.Context) {
	cutoff := time.Now().Add(-s.config.AlertRetention)

	filters := ports.AlertFilters{
		To: cutoff,
	}

	alerts, err := s.alertManager.GetAlerts(ctx, filters)
	if err != nil {
		s.logger.Error("Failed to get old alerts for cleanup", zap.Error(err))
		return
	}

	for _, alert := range alerts {
		if alert.Status == domain.AlertStatusResolved {
			if err := s.alertManager.DeleteAlert(ctx, alert.ID); err != nil {
				s.logger.Error("Failed to delete old alert",
					zap.Error(err),
					zap.String("alert_id", alert.ID))
			}
		}
	}

	s.logger.Info("Cleaned up old alerts", zap.Int("count", len(alerts)))
}

func (s *AlertingService) validateAlertRule(rule *domain.AlertRule) error {
	if rule.Name == "" {
		return fmt.Errorf("rule name is required")
	}
	if rule.MetricName == "" {
		return fmt.Errorf("metric name is required")
	}
	if rule.Condition == "" {
		return fmt.Errorf("condition is required")
	}
	if rule.Threshold == 0 {
		return fmt.Errorf("threshold is required")
	}
	if rule.Duration == 0 {
		return fmt.Errorf("duration is required")
	}
	if rule.Severity == "" {
		rule.Severity = s.config.DefaultSeverity
	}
	return nil
}

func (s *AlertingService) getOrCreateEvaluationState(ruleID string) *EvaluationState {
	state, exists := s.evaluationState[ruleID]
	if !exists {
		state = &EvaluationState{
			LastEvaluation: time.Now(),
			ConsecutiveFires: 0,
		}
		s.evaluationState[ruleID] = state
	}
	return state
}

func mergeLabels(labels1, labels2 map[string]string) map[string]string {
	result := make(map[string]string)
	for k, v := range labels1 {
		result[k] = v
	}
	for k, v := range labels2 {
		result[k] = v
	}
	return result
}

func generateAlertID() string {
	return fmt.Sprintf("alert_%d", time.Now().UnixNano())
}

func generateNotificationID() string {
	return fmt.Sprintf("notif_%d", time.Now().UnixNano())
}