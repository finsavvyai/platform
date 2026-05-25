// Postgres-backed implementations of the compliance package's read
// interfaces. BEAT-PLAN Day 32.
//
// Each reader satisfies one of compliance.RBACReader,
// compliance.RetentionReader, compliance.DLPEventReader. The router
// wires these in place of the prior stubs once the security suite has
// a pgxpool to talk to.
package compliance

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	apphandlers "github.com/sdlc-ai/platform/services/gateway/internal/app/handlers/compliance"
)

// PgxReaders bundles every compliance reader against one pool so the
// caller wires three interfaces with one constructor.
type PgxReaders struct {
	pool *pgxpool.Pool
}

// NewPgxReaders wires the readers. Pool is required.
func NewPgxReaders(pool *pgxpool.Pool) *PgxReaders {
	if pool == nil {
		panic("compliance: pgxpool required")
	}
	return &PgxReaders{pool: pool}
}

// Snapshot satisfies apphandlers.RBACReader. Returns every role with
// its granted permissions plus every user-role assignment for the
// tenant.
func (r *PgxReaders) Snapshot(ctx context.Context, tenantID uuid.UUID) (apphandlers.RBACSnapshot, error) {
	out := apphandlers.RBACSnapshot{
		TenantID:    tenantID,
		GeneratedAt: time.Now().UTC(),
	}

	roleRows, err := r.pool.Query(ctx,
		`SELECT r.id, r.name, r.description,
		        COALESCE(array_agg(p.name) FILTER (WHERE p.name IS NOT NULL), '{}')
		   FROM roles r
		   LEFT JOIN role_permissions rp ON rp.role_id = r.id
		   LEFT JOIN permissions p       ON p.id = rp.permission_id
		  WHERE r.tenant_id = $1
		  GROUP BY r.id, r.name, r.description
		  ORDER BY r.name`,
		tenantID,
	)
	if err != nil {
		return out, fmt.Errorf("compliance: roles: %w", err)
	}
	roleByID := map[uuid.UUID]string{}
	for roleRows.Next() {
		var id uuid.UUID
		var name, desc string
		var perms []string
		if err := roleRows.Scan(&id, &name, &desc, &perms); err != nil {
			roleRows.Close()
			return out, fmt.Errorf("compliance: roles scan: %w", err)
		}
		roleByID[id] = name
		out.Roles = append(out.Roles, apphandlers.Role{Name: name, Description: desc, Permissions: perms})
	}
	roleRows.Close()

	asgRows, err := r.pool.Query(ctx,
		`SELECT user_id, role_id FROM user_roles WHERE tenant_id = $1 ORDER BY user_id`,
		tenantID,
	)
	if err != nil {
		return out, fmt.Errorf("compliance: assignments: %w", err)
	}
	defer asgRows.Close()
	for asgRows.Next() {
		var uid, rid uuid.UUID
		if err := asgRows.Scan(&uid, &rid); err != nil {
			return out, fmt.Errorf("compliance: assignments scan: %w", err)
		}
		out.Assignments = append(out.Assignments, apphandlers.Assignment{
			UserID:   uid,
			RoleName: roleByID[rid],
			Scope:    "tenant",
		})
	}
	return out, nil
}

// Status satisfies apphandlers.RetentionReader. Reads the per-tenant
// policy + each table's oldest row so SOC2 evidence can show the
// gap between policy and reality.
func (r *PgxReaders) Status(ctx context.Context, tenantID uuid.UUID) (apphandlers.RetentionReport, error) {
	out := apphandlers.RetentionReport{
		TenantID:    tenantID,
		GeneratedAt: time.Now().UTC(),
	}
	rows, err := r.pool.Query(ctx,
		`SELECT data_type, days, hold_until
		   FROM retention_policies
		  WHERE tenant_id = $1
		  ORDER BY data_type`,
		tenantID,
	)
	if err != nil {
		return out, fmt.Errorf("compliance: retention: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var dataType string
		var days int
		var hold *time.Time
		if err := rows.Scan(&dataType, &days, &hold); err != nil {
			return out, fmt.Errorf("compliance: retention scan: %w", err)
		}
		entry := apphandlers.RetentionStatus{
			DataType:       dataType,
			RetentionDays:  days,
			LegalHoldUntil: hold,
		}
		if oldest, err := r.oldestRow(ctx, dataType, tenantID); err == nil && !oldest.IsZero() {
			entry.OldestRowAt = &oldest
		}
		out.Items = append(out.Items, entry)
	}
	return out, nil
}

// oldestRow returns the oldest created_at for the named data class
// within the tenant. Returns zero time when the class has no rows or
// no `created_at` column the reader knows about.
func (r *PgxReaders) oldestRow(ctx context.Context, dataType string, tenantID uuid.UUID) (time.Time, error) {
	table, ok := retentionTableFor(dataType)
	if !ok {
		return time.Time{}, nil
	}
	var ts *time.Time
	err := r.pool.QueryRow(ctx,
		fmt.Sprintf(`SELECT MIN(created_at) FROM %s WHERE tenant_id = $1`, table),
		tenantID,
	).Scan(&ts)
	if err != nil {
		return time.Time{}, err
	}
	if ts == nil {
		return time.Time{}, nil
	}
	return *ts, nil
}

// retentionTableFor maps a retention data_type to the table whose
// oldest row defines the actual on-disk retention window. Unknown
// types return false so the reader skips them silently.
func retentionTableFor(dataType string) (string, bool) {
	switch dataType {
	case "audit_logs":
		return "audit_logs", true
	case "documents":
		return "documents", true
	case "embeddings":
		return "embeddings", true
	case "spend_events":
		return "spend_events", true
	case "chat_history":
		return "chat_messages", true
	}
	return "", false
}

// List satisfies apphandlers.DLPEventReader. Reads dlp.* rows from
// audit_logs since DLP detections are appended via the audit chain.
func (r *PgxReaders) List(ctx context.Context, q apphandlers.DLPEventQuery) (apphandlers.DLPEventPage, error) {
	out := apphandlers.DLPEventPage{}
	limit := q.Limit
	if limit <= 0 || limit > 1000 {
		limit = 100
	}
	args := []any{q.TenantID}
	conds := []string{"tenant_id = $1", "action LIKE 'dlp.%'"}
	idx := 2
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
	stmt := `SELECT id, tenant_id, actor_id, action, details, created_at
	           FROM audit_logs
	          WHERE ` + joinAnd(conds) +
		` ORDER BY created_at DESC LIMIT ` + itoa(limit+1)
	rows, err := r.pool.Query(ctx, stmt, args...)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return out, nil
		}
		return out, fmt.Errorf("compliance: dlp: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var (
			id, tenant uuid.UUID
			actor      *uuid.UUID
			action     string
			details    map[string]any
			createdAt  time.Time
		)
		if err := rows.Scan(&id, &tenant, &actor, &action, &details, &createdAt); err != nil {
			return out, fmt.Errorf("compliance: dlp scan: %w", err)
		}
		row := apphandlers.DLPEventRow{
			ID:         id,
			TenantID:   tenant,
			UserID:     actor,
			Direction:  legFrom(action),
			Action:     stringField(details, "action"),
			MatchCount: intField(details, "matches"),
			OccurredAt: createdAt,
		}
		// Details may carry a single detector type or a list.
		if t := stringField(details, "detector"); t != "" {
			row.Detector = t
		} else if types, ok := details["types"].([]any); ok && len(types) > 0 {
			if s, ok := types[0].(string); ok {
				row.Detector = s
			}
		}
		out.Rows = append(out.Rows, row)
	}
	if len(out.Rows) > limit {
		out.NextCursor = out.Rows[limit].ID.String()
		out.Rows = out.Rows[:limit]
	}
	return out, nil
}

// legFrom maps `dlp.inbound`/`dlp.outbound` to the JSON shape the
// handler returns. Unknown actions fall through as empty strings so
// the caller can decide whether to filter.
func legFrom(action string) string {
	switch action {
	case "dlp.inbound":
		return "inbound"
	case "dlp.outbound":
		return "outbound"
	}
	return ""
}

func stringField(m map[string]any, k string) string {
	if v, ok := m[k].(string); ok {
		return v
	}
	return ""
}

func intField(m map[string]any, k string) int {
	switch v := m[k].(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	}
	return 0
}

func joinAnd(parts []string) string {
	out := parts[0]
	for _, p := range parts[1:] {
		out += " AND " + p
	}
	return out
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}
