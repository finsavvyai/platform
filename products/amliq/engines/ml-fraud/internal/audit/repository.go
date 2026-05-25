package audit

import "context"

// AuditRepository defines the port for reading audit log entries.
// All operations are tenant-scoped; implementations must enforce isolation.
type AuditRepository interface {
	// List returns audit entries matching the query filters with
	// cursor-based pagination. Returns entries and a next-cursor token.
	List(ctx context.Context, query AuditQuery) ([]AuditEntry, string, error)

	// GetByID returns a single audit entry. Returns ErrEntryNotFound
	// when the entry does not exist or belongs to a different tenant.
	GetByID(ctx context.Context, tenantID, entryID string) (*AuditEntry, error)

	// GetStats returns aggregated statistics for the given tenant
	// within the optional time range specified by the filter.
	GetStats(ctx context.Context, tenantID string, filter AuditFilter) (*AuditStats, error)

	// Insert adds a new audit entry. Used by the audit logger bridge.
	Insert(ctx context.Context, entry *AuditEntry) error
}
