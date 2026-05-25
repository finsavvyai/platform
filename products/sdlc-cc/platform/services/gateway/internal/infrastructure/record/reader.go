package record

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Row is one event row read back from session_recordings.
type Row struct {
	ID           uuid.UUID `json:"id"`
	SessionID    uuid.UUID `json:"session_id"`
	TenantID     uuid.UUID `json:"tenant_id"`
	UserID       uuid.UUID `json:"user_id"`
	ConsentToken string    `json:"consent_token"`
	RecordedAt   time.Time `json:"recorded_at"`
	Event        *Event    `json:"event,omitempty"`
}

// Reader fetches recording rows for a given session.
type Reader interface {
	ListBySession(ctx context.Context, sessionID, tenantID uuid.UUID) ([]Row, error)
}

// SqlReader queries session_recordings using a *sql.DB (compatible with
// stdlib.OpenDBFromPool and go-sqlmock).
type SqlReader struct {
	db *sql.DB
}

// NewSqlReader wraps a sql.DB for read access to session_recordings.
func NewSqlReader(db *sql.DB) *SqlReader {
	return &SqlReader{db: db}
}

const listBySessionQ = `
	SELECT id, session_id, tenant_id, user_id, consent_token, recorded_at, payload
	FROM session_recordings
	WHERE session_id = $1 AND tenant_id = $2
	ORDER BY recorded_at ASC`

// ListBySession returns all event rows for sessionID, filtered by tenantID
// (enforcing tenant isolation on top of RLS).
func (r *SqlReader) ListBySession(ctx context.Context, sessionID, tenantID uuid.UUID) ([]Row, error) {
	rows, err := r.db.QueryContext(ctx, listBySessionQ, sessionID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Row
	for rows.Next() {
		var row Row
		var payloadBytes []byte
		if err := rows.Scan(
			&row.ID, &row.SessionID, &row.TenantID, &row.UserID,
			&row.ConsentToken, &row.RecordedAt, &payloadBytes,
		); err != nil {
			return nil, err
		}
		if len(payloadBytes) > 0 {
			var ev Event
			if json.Unmarshal(payloadBytes, &ev) == nil {
				row.Event = &ev
			}
		}
		out = append(out, row)
	}
	return out, rows.Err()
}
