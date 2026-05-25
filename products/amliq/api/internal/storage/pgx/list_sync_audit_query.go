package pgx

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

// AuditFilter narrows list_sync_audit reads for the admin API.
type AuditFilter struct {
	ListID   string
	TenantID string
	Status   string
	Limit    int
}

// ListRecent reads the most recent audit rows matching filter. Used
// by /api/v1/admin/list-sync-audit and by the alerter's debounce
// check.
func ListRecent(
	ctx context.Context, db *sql.DB, f AuditFilter,
) ([]domain.ListSyncAudit, error) {
	if f.Limit <= 0 || f.Limit > 500 {
		f.Limit = 100
	}
	q := `SELECT id, tenant_id, list_id, status, started_at,
        COALESCE(finished_at, started_at) AS finished_at,
        COALESCE(duration_ms,0), COALESCE(entities_before,0),
        COALESCE(entities_after,0), COALESCE(delta,0),
        COALESCE(fetch_strategy,''), COALESCE(source_bytes,0),
        COALESCE(error,''), triggered_by
      FROM list_sync_audit WHERE 1=1`
	args := []interface{}{}
	i := 1
	if f.ListID != "" {
		q += fmt.Sprintf(" AND list_id=$%d", i)
		args = append(args, f.ListID)
		i++
	}
	if f.TenantID != "" {
		q += fmt.Sprintf(" AND tenant_id=$%d", i)
		args = append(args, f.TenantID)
		i++
	}
	if f.Status != "" {
		q += fmt.Sprintf(" AND status=$%d", i)
		args = append(args, f.Status)
		i++
	}
	q += fmt.Sprintf(" ORDER BY started_at DESC LIMIT $%d", i)
	args = append(args, f.Limit)

	rows, err := db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.ListSyncAudit, 0, f.Limit)
	for rows.Next() {
		var a domain.ListSyncAudit
		var st string
		if err := rows.Scan(&a.ID, &a.TenantID, &a.ListID, &st,
			&a.StartedAt, &a.FinishedAt, &a.DurationMS,
			&a.EntitiesBefore, &a.EntitiesAfter, &a.Delta,
			&a.FetchStrategy, &a.SourceBytes, &a.Error,
			&a.TriggeredBy); err != nil {
			return nil, err
		}
		a.Status = domain.SyncStatus(st)
		out = append(out, a)
	}
	return out, rows.Err()
}
