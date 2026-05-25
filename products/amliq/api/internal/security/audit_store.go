package security

import (
	"context"
	"time"
)

// AuditFilter defines query criteria for audit events.
type AuditFilter struct {
	TenantID string
	Action   string
	From     time.Time
	To       time.Time
	Limit    int
}

// AuditStore defines persistence operations for audit events.
type AuditStore interface {
	// Save persists an audit entry. Context may be cancelled.
	Save(ctx context.Context, entry AuditEntry) error

	// Query retrieves audit entries matching filter criteria.
	Query(ctx context.Context, filter AuditFilter) ([]AuditEntry, error)

	// Purge deletes entries older than the given time,
	// returning count of deleted rows.
	Purge(ctx context.Context, before time.Time) (int64, error)
}
