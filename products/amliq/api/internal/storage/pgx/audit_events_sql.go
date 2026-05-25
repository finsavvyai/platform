package pgx

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/aegis-aml/aegis/internal/security"
)

// AuditEventsSQL writes security.AuditEntry rows via database/sql —
// the codebase wrapper returns *sql.DB, and the pgxpool-based
// EventAuditRepo is never actually wired. This is the Save-only
// narrow implementation used by the alerting channel.
type AuditEventsSQL struct{ db *sql.DB }

// NewAuditEventsSQL constructs a sql-backed audit writer.
func NewAuditEventsSQL(db *sql.DB) *AuditEventsSQL {
	return &AuditEventsSQL{db: db}
}

// Save inserts an audit entry into audit_events.
func (r *AuditEventsSQL) Save(
	ctx context.Context, entry security.AuditEntry,
) error {
	details, err := json.Marshal(entry.Details)
	if err != nil {
		return fmt.Errorf("marshal details: %w", err)
	}
	_, err = r.db.ExecContext(ctx,
		`INSERT INTO audit_events
			(timestamp, request_id, tenant_id, action, details, ip)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		entry.Timestamp, entry.RequestID, entry.TenantID,
		entry.Action, details, entry.IP)
	if err != nil {
		return fmt.Errorf("insert audit_events: %w", err)
	}
	return nil
}
