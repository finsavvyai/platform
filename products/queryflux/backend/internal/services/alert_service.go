package services

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
)

// alertService implements the AlertService interface
type alertService struct {
	alertRepo repositories.AlertRepository
	userRepo  repositories.UserRepository
	connRepo  repositories.ConnectionRepository
}

// NotificationConfig represents notification configuration
type NotificationConfig struct {
	SMTPHost     string
	SMTPPort     int
	SMTPUsername string
	SMTPPassword string
	FromEmail    string
}

// NewAlertService creates a new alert service
func NewAlertService(
	alertRepo repositories.AlertRepository,
	userRepo repositories.UserRepository,
	connRepo repositories.ConnectionRepository,
) AlertService {
	return &alertService{
		alertRepo: alertRepo,
		userRepo:  userRepo,
		connRepo:  connRepo,
	}
}

// Create creates a new alert
func (s *alertService) Create(ctx context.Context, userID, connectionID, alertType, severity, message string, threshold, currentValue float64) (*entities.Alert, error) {
	// Validate alert parameters
	alert, err := entities.NewAlert(userID, connectionID, alertType, severity, message, threshold, currentValue)
	if err != nil {
		return nil, fmt.Errorf("invalid alert parameters: %w", err)
	}

	// Store alert in repository
	if err := s.alertRepo.Create(ctx, alert); err != nil {
		return nil, fmt.Errorf("failed to create alert: %w", err)
	}

	log.Printf("Created alert: %s for user %s on connection %s", alert.ID, userID, connectionID)
	return alert, nil
}

// GetByID retrieves an alert by ID
func (s *alertService) GetByID(ctx context.Context, id string) (*entities.Alert, error) {
	return s.alertRepo.GetByID(ctx, id)
}

// GetByUserID retrieves alerts for a user
func (s *alertService) GetByUserID(ctx context.Context, userID string, limit, offset int) ([]*entities.Alert, error) {
	return s.alertRepo.GetByUserID(ctx, userID, limit, offset)
}

// GetActiveAlerts retrieves active alerts for a user
func (s *alertService) GetActiveAlerts(ctx context.Context, userID string) ([]*entities.Alert, error) {
	return s.alertRepo.GetActiveAlerts(ctx, userID)
}

// Resolve resolves an alert
func (s *alertService) Resolve(ctx context.Context, alertID string) error {
	// Get alert
	alert, err := s.alertRepo.GetByID(ctx, alertID)
	if err != nil {
		return fmt.Errorf("failed to get alert: %w", err)
	}

	// Check if alert is already resolved
	if alert.IsResolved() {
		return fmt.Errorf("alert %s is already resolved", alertID)
	}

	// Mark alert as resolved
	alert.Resolve()

	// Update in repository
	if err := s.alertRepo.Update(ctx, alert); err != nil {
		return fmt.Errorf("failed to update alert: %w", err)
	}

	log.Printf("Resolved alert: %s", alertID)
	return nil
}

// Mute mutes an alert
func (s *alertService) Mute(ctx context.Context, alertID string) error {
	// Get alert
	alert, err := s.alertRepo.GetByID(ctx, alertID)
	if err != nil {
		return fmt.Errorf("failed to get alert: %w", err)
	}

	// Check if alert is already muted
	if alert.IsMuted() {
		return fmt.Errorf("alert %s is already muted", alertID)
	}

	// Mark alert as muted
	alert.Mute()

	// Update in repository
	if err := s.alertRepo.Update(ctx, alert); err != nil {
		return fmt.Errorf("failed to update alert: %w", err)
	}

	log.Printf("Muted alert: %s", alertID)
	return nil
}

// Reactivate reactivates a muted alert
func (s *alertService) Reactivate(ctx context.Context, alertID string) error {
	// Get alert
	alert, err := s.alertRepo.GetByID(ctx, alertID)
	if err != nil {
		return fmt.Errorf("failed to get alert: %w", err)
	}

	// Check if alert is active
	if alert.IsActive() {
		return fmt.Errorf("alert %s is already active", alertID)
	}

	// Mark alert as active again
	alert.Reactivate()

	// Update in repository
	if err := s.alertRepo.Update(ctx, alert); err != nil {
		return fmt.Errorf("failed to update alert: %w", err)
	}

	log.Printf("Reactivated alert: %s", alertID)
	return nil
}

// GetAlertStats retrieves alert statistics
func (s *alertService) GetAlertStats(ctx context.Context, userID string, days int) (*repositories.AlertStats, error) {
	return s.alertRepo.GetAlertStats(ctx, userID, days)
}

// ProcessMetrics processes metrics and creates alerts if thresholds are exceeded
func (s *alertService) ProcessMetrics(ctx context.Context, metrics *entities.DatabaseMetrics) error {
	// Get connection to determine user
	connection, err := s.connRepo.GetByID(ctx, metrics.ConnectionID)
	if err != nil {
		return fmt.Errorf("failed to get connection: %w", err)
	}

	// Get existing active alerts for this connection and type
	activeAlerts, err := s.alertRepo.GetActiveAlerts(ctx, connection.UserID)
	if err != nil {
		return fmt.Errorf("failed to get active alerts: %w", err)
	}

	// Create a map of existing alerts to avoid duplicates
	existingAlerts := make(map[string]bool)
	for _, alert := range activeAlerts {
		if alert.ConnectionID == metrics.ConnectionID {
			existingAlerts[alert.Type] = true
		}
	}

	// Default thresholds (in a real implementation, these would be configurable per user/connection)
	thresholds := map[string]float64{
		entities.AlertTypeCPU:         80.0,
		entities.AlertTypeMemory:      85.0,
		entities.AlertTypeDisk:        90.0,
		entities.AlertTypeConnections: 100.0,
		entities.AlertTypeQueryTime:   5000.0,
	}

	// Check each metric against thresholds
	alertsToCreate := []map[string]interface{}{
		{"type": entities.AlertTypeCPU, "value": metrics.CPUUsage, "threshold": thresholds[entities.AlertTypeCPU]},
		{"type": entities.AlertTypeMemory, "value": metrics.MemoryUsage, "threshold": thresholds[entities.AlertTypeMemory]},
		{"type": entities.AlertTypeDisk, "value": metrics.DiskUsage, "threshold": thresholds[entities.AlertTypeDisk]},
		{"type": entities.AlertTypeConnections, "value": float64(metrics.ActiveConnections), "threshold": thresholds[entities.AlertTypeConnections]},
		{"type": entities.AlertTypeQueryTime, "value": metrics.AverageQueryTime, "threshold": thresholds[entities.AlertTypeQueryTime]},
	}

	for _, alertData := range alertsToCreate {
		alertType := alertData["type"].(string)
		value := alertData["value"].(float64)
		threshold := alertData["threshold"].(float64)

		if value > threshold {
			// Skip if there's already an active alert of this type for this connection
			if existingAlerts[alertType] {
				continue
			}

			// Determine severity
			severity := s.calculateSeverity(value, threshold)

			// Create alert message
			message := fmt.Sprintf("%s threshold exceeded: %.2f (threshold: %.2f)",
				s.getAlertTypeDisplayName(alertType), value, threshold)

			// Create alert
			alert, err := s.Create(ctx, connection.UserID, metrics.ConnectionID, alertType, severity, message, threshold, value)
			if err != nil {
				log.Printf("Failed to create %s alert: %v", alertType, err)
				continue
			}

			// Send notification
			if err := s.SendNotification(ctx, alert); err != nil {
				log.Printf("Failed to send notification for alert %s: %v", alert.ID, err)
			}
		}
	}

	return nil
}

// SendNotification sends alert notifications
func (s *alertService) SendNotification(ctx context.Context, alert *entities.Alert) error {
	// Get user details
	user, err := s.userRepo.GetByID(ctx, alert.UserID)
	if err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}

	// Get connection details
	connection, err := s.connRepo.GetByID(ctx, alert.ConnectionID)
	if err != nil {
		return fmt.Errorf("failed to get connection: %w", err)
	}

	// Create notification message
	subject := fmt.Sprintf("[%s] %s Alert on %s",
		strings.ToUpper(alert.Severity),
		s.getAlertTypeDisplayName(alert.Type),
		connection.Name)

	body := fmt.Sprintf(`
Alert Details:
- Type: %s
- Severity: %s
- Connection: %s
- Threshold: %.2f
- Current Value: %.2f
- Message: %s
- Time: %s

This is an automated alert from QueryFlux.
		`,
		s.getAlertTypeDisplayName(alert.Type),
		alert.Severity,
		connection.Name,
		alert.Threshold,
		alert.CurrentValue,
		alert.Message,
		alert.CreatedAt.Format(time.RFC3339),
	)

	// Send email notification (in a real implementation, this would be configurable)
	if err := s.sendEmailNotification(user.Email, subject, body); err != nil {
		log.Printf("Failed to send email notification: %v", err)
		// Don't fail the operation if email fails
	}

	// Log notification sent
	log.Printf("Sent notification for alert %s to user %s", alert.ID, user.Email)

	return nil
}

// calculateSeverity determines alert severity based on how much the threshold is exceeded
func (s *alertService) calculateSeverity(value, threshold float64) string {
	ratio := value / threshold

	if ratio >= 2.0 {
		return entities.SeverityCritical
	} else if ratio >= 1.5 {
		return entities.SeverityHigh
	} else if ratio >= 1.0 {
		return entities.SeverityMedium
	} else {
		return entities.SeverityLow
	}
}

// getAlertTypeDisplayName returns a human-readable name for alert type
func (s *alertService) getAlertTypeDisplayName(alertType string) string {
	switch alertType {
	case entities.AlertTypeCPU:
		return "CPU Usage"
	case entities.AlertTypeMemory:
		return "Memory Usage"
	case entities.AlertTypeDisk:
		return "Disk Usage"
	case entities.AlertTypeConnections:
		return "Active Connections"
	case entities.AlertTypeQueryTime:
		return "Average Query Time"
	default:
		return alertType
	}
}

// sendEmailNotification sends an email notification (placeholder implementation)
func (s *alertService) sendEmailNotification(toEmail, subject, body string) error {
	// This is a placeholder implementation
	// In a real application, you would:
	// 1. Use proper SMTP configuration from environment variables or config
	// 2. Use an email service like SendGrid, Mailgun, or AWS SES
	// 3. Handle email templates and formatting
	// 4. Implement proper error handling and retry logic

	log.Printf("Email notification would be sent to %s: %s", toEmail, subject)
	log.Printf("Email body: %s", body)

	// For now, just log that we would send an email
	return nil
}

// CreateAlertFromMetrics creates an alert from metrics with custom parameters
func (s *alertService) CreateAlertFromMetrics(
	ctx context.Context,
	userID, connectionID, alertType, severity, message string,
	threshold, currentValue float64,
) (*entities.Alert, error) {
	return s.Create(ctx, userID, connectionID, alertType, severity, message, threshold, currentValue)
}

// GetAlertsByConnection retrieves alerts for a specific connection
func (s *alertService) GetAlertsByConnection(ctx context.Context, connectionID string, limit, offset int) ([]*entities.Alert, error) {
	return s.alertRepo.GetByConnectionID(ctx, connectionID, limit, offset)
}

// GetAlertsBySeverity retrieves alerts filtered by severity
func (s *alertService) GetAlertsBySeverity(ctx context.Context, userID, severity string, limit, offset int) ([]*entities.Alert, error) {
	return s.alertRepo.GetBySeverity(ctx, severity, limit, offset)
}

// GetAlertsByType retrieves alerts filtered by type
func (s *alertService) GetAlertsByType(ctx context.Context, userID, alertType string, limit, offset int) ([]*entities.Alert, error) {
	return s.alertRepo.GetByType(ctx, alertType, limit, offset)
}

// GetAlertsByDateRange retrieves alerts within a date range
func (s *alertService) GetAlertsByDateRange(ctx context.Context, userID string, startDate, endDate time.Time, limit, offset int) ([]*entities.Alert, error) {
	return s.alertRepo.GetByDateRange(ctx, userID, startDate, endDate, limit, offset)
}

// BatchResolve resolves multiple alerts at once
func (s *alertService) BatchResolve(ctx context.Context, alertIDs []string) error {
	for _, alertID := range alertIDs {
		if err := s.Resolve(ctx, alertID); err != nil {
			log.Printf("Failed to resolve alert %s: %v", alertID, err)
			// Continue with other alerts even if one fails
		}
	}
	return nil
}

// BatchMute mutes multiple alerts at once
func (s *alertService) BatchMute(ctx context.Context, alertIDs []string) error {
	for _, alertID := range alertIDs {
		if err := s.Mute(ctx, alertID); err != nil {
			log.Printf("Failed to mute alert %s: %v", alertID, err)
			// Continue with other alerts even if one fails
		}
	}
	return nil
}

// CleanupOldAlerts removes old resolved alerts
func (s *alertService) CleanupOldAlerts(ctx context.Context, olderThanDays int) (int64, error) {
	return s.alertRepo.DeleteOldAlerts(ctx, olderThanDays)
}
