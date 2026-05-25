package repositories

import (
	"context"
	"github.com/queryflux/backend/internal/domain/entities"
	"time"
)

// AlertRepository defines the interface for alert operations
type AlertRepository interface {
	// Create creates a new alert
	Create(ctx context.Context, alert *entities.Alert) error

	// GetByID retrieves an alert by ID
	GetByID(ctx context.Context, id string) (*entities.Alert, error)

	// Update updates an existing alert
	Update(ctx context.Context, alert *entities.Alert) error

	// Delete deletes an alert by ID
	Delete(ctx context.Context, id string) error

	// GetByUserID retrieves alerts for a user with pagination
	GetByUserID(ctx context.Context, userID string, limit, offset int) ([]*entities.Alert, error)

	// GetByConnectionID retrieves alerts for a connection with pagination
	GetByConnectionID(ctx context.Context, connectionID string, limit, offset int) ([]*entities.Alert, error)

	// GetActiveAlerts retrieves active alerts for a user
	GetActiveAlerts(ctx context.Context, userID string) ([]*entities.Alert, error)

	// GetByStatus retrieves alerts by status
	GetByStatus(ctx context.Context, status string, limit, offset int) ([]*entities.Alert, error)

	// GetBySeverity retrieves alerts by severity
	GetBySeverity(ctx context.Context, severity string, limit, offset int) ([]*entities.Alert, error)

	// GetByType retrieves alerts by type
	GetByType(ctx context.Context, alertType string, limit, offset int) ([]*entities.Alert, error)

	// GetByDateRange retrieves alerts within a date range
	GetByDateRange(ctx context.Context, userID string, startDate, endDate time.Time, limit, offset int) ([]*entities.Alert, error)

	// Resolve resolves an alert
	Resolve(ctx context.Context, alertID string) error

	// Mute mutes an alert
	Mute(ctx context.Context, alertID string) error

	// Reactivate reactivates a muted alert
	Reactivate(ctx context.Context, alertID string) error

	// Count returns the total number of alerts for a user
	Count(ctx context.Context, userID string) (int64, error)

	// CountByStatus returns the number of alerts by status for a user
	CountByStatus(ctx context.Context, userID, status string) (int64, error)

	// CountBySeverity returns the number of alerts by severity for a user
	CountBySeverity(ctx context.Context, userID, severity string) (int64, error)

	// GetAlertStats retrieves alert statistics for a user
	GetAlertStats(ctx context.Context, userID string, days int) (*AlertStats, error)

	// DeleteOldAlerts deletes resolved alerts older than specified days
	DeleteOldAlerts(ctx context.Context, olderThanDays int) (int64, error)

	// Exists checks if an alert exists by ID
	Exists(ctx context.Context, id string) (bool, error)

	// GetUnresolvedAlerts retrieves unresolved alerts older than specified duration
	GetUnresolvedAlerts(ctx context.Context, olderThan time.Duration) ([]*entities.Alert, error)
}

// AlertStats represents alert statistics
type AlertStats struct {
	TotalAlerts      int64             `json:"total_alerts"`
	ActiveAlerts     int64             `json:"active_alerts"`
	ResolvedAlerts   int64             `json:"resolved_alerts"`
	MutedAlerts      int64             `json:"muted_alerts"`
	AlertsBySeverity map[string]int64  `json:"alerts_by_severity"`
	AlertsByType     map[string]int64  `json:"alerts_by_type"`
	AlertsPerDay     []DailyAlertCount `json:"alerts_per_day"`
}

// DailyAlertCount represents alert count for a specific day
type DailyAlertCount struct {
	Date  time.Time `json:"date"`
	Count int64     `json:"count"`
}