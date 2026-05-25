// Package audit provides query models and repository for reading audit log
// entries written by the existing logger package. It exposes the read path
// used by the Audit Log Viewer API.
package audit

import (
	"errors"
	"time"
)

// ActionType classifies the audit event category.
type ActionType string

const (
	ActionLogin            ActionType = "login"
	ActionLogout           ActionType = "logout"
	ActionRuleCreate       ActionType = "rule_create"
	ActionRuleUpdate       ActionType = "rule_update"
	ActionRuleDelete       ActionType = "rule_delete"
	ActionTransactionScan  ActionType = "transaction_analyze"
	ActionRoleChange       ActionType = "role_change"
	ActionConfigUpdate     ActionType = "config_update"
	ActionAPIKeyCreate     ActionType = "api_key_create"
	ActionAPIKeyRevoke     ActionType = "api_key_revoke"
	ActionWebhookCreate    ActionType = "webhook_create"
	ActionReportGenerate   ActionType = "report_generate"
)

// SortOrder controls listing direction.
type SortOrder string

const (
	SortAsc  SortOrder = "asc"
	SortDesc SortOrder = "desc"
)

// AuditEntry is a single immutable audit log record.
type AuditEntry struct {
	ID         string            `json:"id"`
	TenantID   string            `json:"tenant_id"`
	ActorID    string            `json:"actor_id"`
	ActorRole  string            `json:"actor_role"`
	Action     ActionType        `json:"action"`
	Resource   string            `json:"resource"`
	ResourceID string            `json:"resource_id"`
	Details    map[string]string `json:"details"`
	IPAddress  string            `json:"ip_address"`
	Timestamp  time.Time         `json:"timestamp"`
}

// Validate checks required fields on an AuditEntry.
func (e *AuditEntry) Validate() error {
	if e.TenantID == "" {
		return ErrEmptyTenantID
	}
	if e.ActorID == "" {
		return ErrEmptyActorID
	}
	if e.Action == "" {
		return ErrEmptyAction
	}
	if e.Resource == "" {
		return ErrEmptyResource
	}
	return nil
}

// AuditFilter constrains which entries to return.
type AuditFilter struct {
	Actor    string     `json:"actor,omitempty"`
	Action   ActionType `json:"action,omitempty"`
	Resource string     `json:"resource,omitempty"`
	From     *time.Time `json:"from,omitempty"`
	To       *time.Time `json:"to,omitempty"`
	Keyword  string     `json:"q,omitempty"`
}

// Validate ensures date range is coherent when both bounds are set.
func (f *AuditFilter) Validate() error {
	if f.From != nil && f.To != nil && f.From.After(*f.To) {
		return ErrInvalidDateRange
	}
	return nil
}

// AuditQuery combines filters with pagination and sorting.
type AuditQuery struct {
	TenantID  string      `json:"tenant_id"`
	Filters   AuditFilter `json:"filters"`
	SortBy    string      `json:"sort_by"`
	SortOrder SortOrder   `json:"sort_order"`
	Cursor    string      `json:"cursor"`
	Limit     int         `json:"limit"`
}

// DefaultLimit is the page size when none is specified.
const DefaultLimit = 50

// MaxLimit caps the maximum page size to prevent abuse.
const MaxLimit = 200

// Validate checks the query is well-formed.
func (q *AuditQuery) Validate() error {
	if q.TenantID == "" {
		return ErrEmptyTenantID
	}
	if err := q.Filters.Validate(); err != nil {
		return err
	}
	if q.Limit <= 0 {
		q.Limit = DefaultLimit
	}
	if q.Limit > MaxLimit {
		q.Limit = MaxLimit
	}
	if q.SortOrder == "" {
		q.SortOrder = SortDesc
	}
	if q.SortOrder != SortAsc && q.SortOrder != SortDesc {
		return ErrInvalidSortOrder
	}
	return nil
}

// AuditStats summarises audit activity for a tenant.
type AuditStats struct {
	TotalEvents   int               `json:"total_events"`
	UniqueActors  int               `json:"unique_actors"`
	TopAction     ActionType        `json:"top_action"`
	TopResource   string            `json:"top_resource"`
	ActionCounts  map[ActionType]int `json:"action_counts"`
}

// --- Sentinel errors ---

var (
	ErrEmptyTenantID    = errors.New("tenant_id must not be empty")
	ErrEmptyActorID     = errors.New("actor_id must not be empty")
	ErrEmptyAction      = errors.New("action must not be empty")
	ErrEmptyResource    = errors.New("resource must not be empty")
	ErrInvalidDateRange = errors.New("from must be before to")
	ErrInvalidSortOrder = errors.New("sort_order must be asc or desc")
	ErrEntryNotFound    = errors.New("audit entry not found")
)
