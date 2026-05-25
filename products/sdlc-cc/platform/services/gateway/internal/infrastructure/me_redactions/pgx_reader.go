// Postgres-backed reader for the per-user redaction view.
// Claude Team D1 closeout. Queries audit_logs scoped to (tenant_id,
// actor_id) where action LIKE 'dlp.%' so the data subject sees
// every detection event recorded against their own user id.
package me_redactions

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	mehandler "github.com/sdlc-ai/platform/services/gateway/internal/app/handlers/me_redactions"
)

// PgxReader satisfies mehandler.Reader against a pgxpool.
type PgxReader struct {
	pool *pgxpool.Pool
}

// NewPgxReader wires the reader. Pool is required.
func NewPgxReader(pool *pgxpool.Pool) *PgxReader {
	if pool == nil {
		panic("me_redactions: pgxpool required")
	}
	return &PgxReader{pool: pool}
}

// ListUserRedactions returns the caller's own DLP detection rows.
// `details` JSONB column is parsed for the `leg`, `types`, and
// `matches` fields the audit Writer recorded.
func (r *PgxReader) ListUserRedactions(ctx context.Context, q mehandler.Query) (mehandler.Page, error) {
	out := mehandler.Page{Events: []mehandler.Event{}}
	limit := q.Limit
	if limit <= 0 || limit > 1000 {
		limit = 100
	}
	args := []any{q.TenantID, q.UserID}
	conds := []string{
		"tenant_id = $1",
		"actor_id = $2",
		"action LIKE 'dlp.%'",
	}
	idx := 3
	if q.From != nil {
		conds = append(conds, fmt.Sprintf("created_at >= $%d", idx))
		args = append(args, *q.From)
		idx++
	}
	if q.To != nil {
		conds = append(conds, fmt.Sprintf("created_at <= $%d", idx))
		args = append(args, *q.To)
		idx++
	}
	stmt := `SELECT id, action, details, created_at
	           FROM audit_logs
	          WHERE ` + joinAnd(conds) +
		` ORDER BY created_at DESC LIMIT ` + itoa(limit)
	rows, err := r.pool.Query(ctx, stmt, args...)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return out, nil
		}
		return out, fmt.Errorf("me_redactions: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var id, action string
		var details []byte
		var createdAt = mehandler.Event{}.CreatedAt
		if err := rows.Scan(&id, &action, &details, &createdAt); err != nil {
			return out, err
		}
		ev := mehandler.Event{Action: action, CreatedAt: createdAt}
		if id != "" {
			ev.ID = uuidFromString(id)
		}
		if len(details) > 0 {
			var parsed struct {
				Leg     string   `json:"leg"`
				Types   []string `json:"types"`
				Matches int      `json:"matches"`
			}
			if jerr := json.Unmarshal(details, &parsed); jerr == nil {
				ev.Leg = parsed.Leg
				ev.Types = parsed.Types
				ev.Matches = parsed.Matches
			}
		}
		out.Events = append(out.Events, ev)
	}
	return out, nil
}
