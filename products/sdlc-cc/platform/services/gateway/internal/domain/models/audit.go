package models

import (
	"net"
	"time"

	"github.com/google/uuid"
)

// Action constants for common audit event types.
const (
	ActionLogin    = "login"
	ActionLogout   = "logout"
	ActionRegister = "register"
	ActionRotate   = "rotate"
	ActionRevoke   = "revoke"
)

// ResourceType constants for resource identifiers in audit events.
const (
	ResourceTypeUser     = "user"
	ResourceTypePolicy   = "policy"
	ResourceTypeDocument = "document"
	ResourceTypeAPIKey   = "api_key"
	ResourceTypeTenant   = "tenant"
)

// AuditLog is an append-only record of a sensitive platform action.
type AuditLog struct {
	ID           uuid.UUID  `json:"id"                     db:"id"`
	TenantID     uuid.UUID  `json:"tenant_id"              db:"tenant_id"`
	UserID       *uuid.UUID `json:"user_id,omitempty"      db:"user_id"`
	Action       string     `json:"action"                 db:"action"`
	ResourceType string     `json:"resource_type"          db:"resource_type"`
	ResourceID   *uuid.UUID `json:"resource_id,omitempty"  db:"resource_id"`
	Details      JSONB      `json:"details"                db:"details"`
	IPAddress    net.IP     `json:"ip_address"             db:"ip_address"`
	UserAgent    string     `json:"user_agent"             db:"user_agent"`
	Signature    string     `json:"signature"              db:"signature"`
	CreatedAt    time.Time  `json:"created_at"             db:"created_at"`
}

// AuditLogFilter holds optional filter criteria for audit log queries.
type AuditLogFilter struct {
	UserID        *uuid.UUID `json:"user_id,omitempty"`
	Action        *string    `json:"action,omitempty"`
	ResourceType  *string    `json:"resource_type,omitempty"`
	ResourceID    *uuid.UUID `json:"resource_id,omitempty"`
	IPAddress     *string    `json:"ip_address,omitempty"`
	CreatedAfter  *time.Time `json:"created_after,omitempty"`
	CreatedBefore *time.Time `json:"created_before,omitempty"`
	Limit         *int       `json:"limit,omitempty"`
	Offset        *int       `json:"offset,omitempty"`
	Cursor        string     `json:"cursor,omitempty"`
}
