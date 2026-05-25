package repositories

import (
	"context"
	"github.com/queryflux/backend/internal/domain/entities"
)

// AuditRepository defines the interface for audit log operations
type AuditRepository interface {
	// Log creates a new audit log entry
	Log(ctx context.Context, audit *entities.AuditLog) error

	// GetByID retrieves an audit log entry by ID
	GetByID(ctx context.Context, id string) (*entities.AuditLog, error)

	// Query retrieves audit logs based on filters
	Query(ctx context.Context, filter *entities.AuditLogFilter) ([]*entities.AuditLog, error)

	// GetByUser retrieves audit logs for a specific user
	GetByUser(ctx context.Context, userID string, limit, offset int) ([]*entities.AuditLog, error)

	// GetByResource retrieves audit logs for a specific resource
	GetByResource(ctx context.Context, resourceType, resourceID string, limit, offset int) ([]*entities.AuditLog, error)

	// GetByTeam retrieves audit logs for a team
	GetByTeam(ctx context.Context, teamID string, limit, offset int) ([]*entities.AuditLog, error)

	// GetByAction retrieves audit logs by action type
	GetByAction(ctx context.Context, action string, limit, offset int) ([]*entities.AuditLog, error)

	// GetFailedActions retrieves failed audit log entries
	GetFailedActions(ctx context.Context, limit, offset int) ([]*entities.AuditLog, error)

	// GetStats retrieves audit statistics
	GetStats(ctx context.Context, filter *entities.AuditLogFilter) (*entities.AuditLogStats, error)

	// GetUserActivitySummary retrieves a summary of user activity
	GetUserActivitySummary(ctx context.Context, userID string, days int) (*UserActivitySummary, error)

	// GetRecentActions retrieves recent audit log entries
	GetRecentActions(ctx context.Context, limit int) ([]*entities.AuditLog, error)

	// Count returns the total number of audit logs matching filters
	Count(ctx context.Context, filter *entities.AuditLogFilter) (int64, error)

	// CleanupOldLogs removes audit logs older than specified days
	CleanupOldLogs(ctx context.Context, olderThanDays int) (int64, error)

	// Export exports audit logs to a format (JSON, CSV)
	Export(ctx context.Context, filter *entities.AuditLogFilter, format string) ([]byte, error)
}

// UserActivitySummary represents a summary of user activity
type UserActivitySummary struct {
	UserID              string                 `json:"user_id"`
	TotalActions        int64                  `json:"total_actions"`
	ActionsByType       map[string]int64       `json:"actions_by_type"`
	ResourcesAccessed   int64                  `json:"resources_accessed"`
	FailedActions       int64                  `json:"failed_actions"`
	LastActivityAt      string                 `json:"last_activity_at"`
	MostUsedResources   []ResourceAccessCount  `json:"most_used_resources"`
}

// ResourceAccessCount represents the number of times a resource was accessed
type ResourceAccessCount struct {
	ResourceType string `json:"resource_type"`
	ResourceID   string `json:"resource_id"`
	Count        int64  `json:"count"`
}
