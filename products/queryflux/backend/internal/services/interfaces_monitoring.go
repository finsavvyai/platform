package services

import (
	"context"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
)

// MetricsService defines the interface for database metrics business logic
type MetricsService interface {
	CollectMetrics(ctx context.Context, connectionID string) (*entities.DatabaseMetrics, error)
	GetLatestMetrics(ctx context.Context, connectionID string) (*entities.DatabaseMetrics, error)
	GetMetricsHistory(ctx context.Context, connectionID string, startTime, endTime time.Time, limit, offset int) ([]*entities.DatabaseMetrics, error)
	GetAverageMetrics(ctx context.Context, connectionID string, startTime, endTime time.Time) (*entities.DatabaseMetrics, error)
	StartMonitoring(ctx context.Context, connectionID string, interval time.Duration) error
	StopMonitoring(ctx context.Context, connectionID string) error
	CheckThresholds(ctx context.Context, metrics *entities.DatabaseMetrics) ([]*entities.Alert, error)
}

// AlertService defines the interface for alert management business logic
type AlertService interface {
	Create(ctx context.Context, userID, connectionID, alertType, severity, message string, threshold, currentValue float64) (*entities.Alert, error)
	GetByID(ctx context.Context, id string) (*entities.Alert, error)
	GetByUserID(ctx context.Context, userID string, limit, offset int) ([]*entities.Alert, error)
	GetActiveAlerts(ctx context.Context, userID string) ([]*entities.Alert, error)
	Resolve(ctx context.Context, alertID string) error
	Mute(ctx context.Context, alertID string) error
	Reactivate(ctx context.Context, alertID string) error
	GetAlertStats(ctx context.Context, userID string, days int) (*repositories.AlertStats, error)
	ProcessMetrics(ctx context.Context, metrics *entities.DatabaseMetrics) error
	SendNotification(ctx context.Context, alert *entities.Alert) error
	GetAlertsByConnection(ctx context.Context, connectionID string, limit, offset int) ([]*entities.Alert, error)
	GetAlertsBySeverity(ctx context.Context, userID, severity string, limit, offset int) ([]*entities.Alert, error)
	GetAlertsByType(ctx context.Context, userID, alertType string, limit, offset int) ([]*entities.Alert, error)
	GetAlertsByDateRange(ctx context.Context, userID string, startDate, endDate time.Time, limit, offset int) ([]*entities.Alert, error)
	BatchResolve(ctx context.Context, alertIDs []string) error
	BatchMute(ctx context.Context, alertIDs []string) error
	CleanupOldAlerts(ctx context.Context, olderThanDays int) (int64, error)
}

// WebSocketService defines the interface for real-time WebSocket operations
type WebSocketService interface {
	BroadcastDatabaseMetrics(ctx context.Context, connectionID string, metrics *entities.DatabaseMetrics) error
	BroadcastQueryProgress(ctx context.Context, queryID string, status string, progress float64, message string, duration time.Duration) error
	BroadcastQueryResult(ctx context.Context, query *entities.Query) error
	NotifyQueryStarted(ctx context.Context, queryID string) error
	NotifyQueryProgress(ctx context.Context, queryID string, progress float64, message string, duration time.Duration) error
	NotifyQueryCompleted(ctx context.Context, query *entities.Query) error
	NotifyQueryFailed(ctx context.Context, queryID string, errorMsg string, duration time.Duration) error
	NotifyQueryCancelled(ctx context.Context, queryID string, duration time.Duration) error
	GetHubStats(ctx context.Context) (map[string]interface{}, error)
	StartMetricsMonitoring(ctx context.Context, connectionID string, interval time.Duration, metricsService interface{})
	ValidateWebSocketMessage(messageType string, data interface{}) error
}
