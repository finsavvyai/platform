// Reader-side of the audit pipeline. Satisfies
// compliance.AuditEventReader against the audit_logs table that
// migration 009 (Day 12) extends with HMAC + actor/target columns.
//
// BEAT-PLAN S1.3 / INTEGRATION-DEBT Day 13. This is the smallest
// surface the /compliance/audit-events handler needs; richer queries
// stay in the existing repositories.auditLogRepository.

package audit

import (
	"context"
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sdlc-ai/platform/services/gateway/internal/app/handlers/compliance"
)

// PgxReader implements compliance.AuditEventReader against pgxpool.
type PgxReader struct {
	pool *pgxpool.Pool
}

// NewPgxReader constructs the reader. Pool is required.
func NewPgxReader(pool *pgxpool.Pool) *PgxReader {
	if pool == nil {
		panic("audit reader: pool required")
	}
	return &PgxReader{pool: pool}
}

// Query returns one page of audit rows, ordered created_at DESC.
// Cursor is opaque base64 over "<created_at>|<id>" so callers cannot
// craft offsets that bypass tenant isolation.
func (r *PgxReader) Query(ctx context.Context, q compliance.AuditEventQuery) (compliance.AuditEventPage, error) {
	limit := q.Limit
	if limit <= 0 || limit > 1000 {
		limit = 100
	}

	conds := []string{"1=1"}
	args := []interface{}{}
	idx := 1
	if q.TenantID != nil {
		conds = append(conds, fmt.Sprintf("tenant_id = $%d", idx))
		args = append(args, *q.TenantID)
		idx++
	}
	if q.ActorID != nil {
		conds = append(conds, fmt.Sprintf("actor_id = $%d", idx))
		args = append(args, *q.ActorID)
		idx++
	}
	if q.Action != "" {
		conds = append(conds, fmt.Sprintf("action = $%d", idx))
		args = append(args, q.Action)
		idx++
	}
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
	if q.Cursor != "" {
		ct, cid, err := decodeCursor(q.Cursor)
		if err != nil {
			return compliance.AuditEventPage{}, fmt.Errorf("invalid cursor: %w", err)
		}
		conds = append(conds, fmt.Sprintf("(created_at, id) < ($%d, $%d)", idx, idx+1))
		args = append(args, ct, cid)
		idx += 2
	}

	stmt := `
SELECT id, tenant_id, actor_id, COALESCE(actor_type,''),
       action::text,
       COALESCE(NULLIF(COALESCE(target_type,'')||':'||COALESCE(target_id,''),':'),''),
       COALESCE(host(ip_address), ''),
       created_at
FROM   audit_logs
WHERE  ` + strings.Join(conds, " AND ") + `
ORDER BY created_at DESC, id DESC
LIMIT  ` + strconv.Itoa(limit+1)

	rows, err := r.pool.Query(ctx, stmt, args...)
	if err != nil {
		return compliance.AuditEventPage{}, fmt.Errorf("audit reader: query: %w", err)
	}
	defer rows.Close()

	out := make([]compliance.AuditEventRow, 0, limit)
	for rows.Next() {
		var (
			row     compliance.AuditEventRow
			actorID *uuid.UUID
		)
		if err := rows.Scan(&row.ID, &row.TenantID, &actorID,
			&row.ActorType, &row.Action, &row.Target, &row.IP, &row.CreatedAt); err != nil {
			return compliance.AuditEventPage{}, fmt.Errorf("audit reader: scan: %w", err)
		}
		row.ActorID = actorID
		out = append(out, row)
	}
	if err := rows.Err(); err != nil {
		return compliance.AuditEventPage{}, fmt.Errorf("audit reader: rows: %w", err)
	}

	page := compliance.AuditEventPage{Rows: out}
	if len(out) > limit {
		last := out[limit-1]
		page.Rows = out[:limit]
		page.NextCursor = encodeCursor(last.CreatedAt, last.ID)
	}
	return page, nil
}

func encodeCursor(t time.Time, id uuid.UUID) string {
	raw := t.UTC().Format(time.RFC3339Nano) + "|" + id.String()
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func decodeCursor(c string) (time.Time, uuid.UUID, error) {
	raw, err := base64.RawURLEncoding.DecodeString(c)
	if err != nil {
		return time.Time{}, uuid.Nil, err
	}
	parts := strings.SplitN(string(raw), "|", 2)
	if len(parts) != 2 {
		return time.Time{}, uuid.Nil, fmt.Errorf("malformed cursor")
	}
	t, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil {
		return time.Time{}, uuid.Nil, err
	}
	id, err := uuid.Parse(parts[1])
	if err != nil {
		return time.Time{}, uuid.Nil, err
	}
	return t, id, nil
}
