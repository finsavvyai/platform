// Postgres-backed reader for the D3 compliance evidence export.
// Walks audit_logs filtered by an OR of action LIKE patterns and
// projects each row into the export's stable Event shape.
package compliance_export

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	cehandler "github.com/sdlc-ai/platform/services/gateway/internal/app/handlers/compliance_export"
)

// PgxReader satisfies cehandler.Reader against a pgxpool.
type PgxReader struct {
	pool *pgxpool.Pool
}

// NewPgxReader wires the reader. Pool is required.
func NewPgxReader(pool *pgxpool.Pool) *PgxReader {
	if pool == nil {
		panic("compliance_export: pgxpool required")
	}
	return &PgxReader{pool: pool}
}

// List returns every audit_logs row matching the OR-of-LIKE
// filter, scoped to the tenant. The caller does ordering + hash-
// chain work; this method just produces the rows.
func (r *PgxReader) List(ctx context.Context, q cehandler.Query) ([]cehandler.Event, error) {
	if len(q.ActionLikes) == 0 {
		return nil, nil
	}
	args := []any{q.TenantID}
	likes := make([]string, 0, len(q.ActionLikes))
	for i, p := range q.ActionLikes {
		args = append(args, p)
		likes = append(likes, fmt.Sprintf("action LIKE $%d", i+2))
	}
	conds := []string{"tenant_id = $1", "(" + strings.Join(likes, " OR ") + ")"}
	idx := len(args) + 1
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
	stmt := `SELECT id, action, actor_id, target_type, target_id, details, created_at
	           FROM audit_logs
	          WHERE ` + strings.Join(conds, " AND ") +
		` ORDER BY created_at`
	rows, err := r.pool.Query(ctx, stmt, args...)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("compliance_export: %w", err)
	}
	defer rows.Close()
	var out []cehandler.Event
	for rows.Next() {
		var (
			id, action, targetType, targetID string
			actorID                          *string
			details                          []byte
		)
		ev := cehandler.Event{}
		if err := rows.Scan(&id, &action, &actorID, &targetType, &targetID, &details, &ev.CreatedAt); err != nil {
			return out, err
		}
		ev.ID = id
		ev.Action = action
		if actorID != nil {
			ev.ActorID = *actorID
		}
		if targetType != "" || targetID != "" {
			ev.Target = targetType + ":" + targetID
		}
		if len(details) > 0 {
			var parsed map[string]any
			if jerr := json.Unmarshal(details, &parsed); jerr == nil {
				ev.Details = parsed
			}
		}
		out = append(out, ev)
	}
	return out, nil
}
