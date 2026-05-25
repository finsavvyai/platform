package entities

import (
	"time"

	"github.com/google/uuid"
)

// AuditLog represents an audit log entry for tracking all operations
type AuditLog struct {
	ID           string                 `json:"id" db:"id"`
	UserID       string                 `json:"user_id" db:"user_id"`
	TeamID       *string                `json:"team_id" db:"team_id"`
	Action       string                 `json:"action" db:"action"`       // create, read, update, delete
	ResourceType string                 `json:"resource_type" db:"resource_type"` // user, connection, query, team, project
	ResourceID   string                 `json:"resource_id" db:"resource_id"`
	Details      string                 `json:"details" db:"details"` // JSON string with additional context
	IPAddress    string                 `json:"ip_address" db:"ip_address"`
	UserAgent    string                 `json:"user_agent" db:"user_agent"`
	Success      bool                   `json:"success" db:"success"`
	ErrorMessage *string                `json:"error_message" db:"error_message"`
	CreatedAt    time.Time              `json:"created_at" db:"created_at"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// NewAuditLog creates a new audit log entry with generated ID and timestamp
func NewAuditLog(userID, action, resourceType, resourceID, ipAddress, userAgent string) *AuditLog {
	return &AuditLog{
		ID:           uuid.New().String(),
		UserID:       userID,
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
		Success:      true,
		CreatedAt:    time.Now(),
	}
}

// WithTeam sets the team ID for the audit log
func (a *AuditLog) WithTeam(teamID string) *AuditLog {
	a.TeamID = &teamID
	return a
}

// WithDetails sets the details JSON for the audit log
func (a *AuditLog) WithDetails(details string) *AuditLog {
	a.Details = details
	return a
}

// WithError sets the error information for a failed operation
func (a *AuditLog) WithError(errMsg string) *AuditLog {
	a.Success = false
	a.ErrorMessage = &errMsg
	return a
}

// AuditLogFilter represents filters for querying audit logs
type AuditLogFilter struct {
	UserID       *string    `json:"user_id,omitempty"`
	TeamID       *string    `json:"team_id,omitempty"`
	Action       *string    `json:"action,omitempty"`
	ResourceType *string    `json:"resource_type,omitempty"`
	ResourceID   *string    `json:"resource_id,omitempty"`
	StartDate    *time.Time `json:"start_date,omitempty"`
	EndDate      *time.Time `json:"end_date,omitempty"`
	Success      *bool      `json:"success,omitempty"`
	Limit        int        `json:"limit,omitempty"`
	Offset       int        `json:"offset,omitempty"`
}

// AuditLogStats represents statistics from audit logs
type AuditLogStats struct {
	TotalActions   int64                  `json:"total_actions"`
	ActionsByType  map[string]int64       `json:"actions_by_type"`
	ResourcesByType map[string]int64      `json:"resources_by_type"`
	TopUsers       []UserActionCount      `json:"top_users"`
	FailedActions  int64                  `json:"failed_actions"`
}

// UserActionCount represents the number of actions by a user
type UserActionCount struct {
	UserID    string `json:"user_id"`
	UserName  string `json:"user_name,omitempty"`
	Count     int64  `json:"count"`
}
