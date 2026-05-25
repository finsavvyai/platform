package pgx

import (
	"context"
	"database/sql"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// ListMonitorRepository persists list sync monitors in PostgreSQL.
type ListMonitorRepository struct{ db *sql.DB }

// NewListMonitorRepository creates a new repository.
func NewListMonitorRepository(db *sql.DB) *ListMonitorRepository {
	return &ListMonitorRepository{db: db}
}

// Upsert inserts or updates a list monitor row.
func (r *ListMonitorRepository) Upsert(
	ctx context.Context, m domain.ListMonitor,
) error {
	// ON CONFLICT preserves the previous last_synced_at on failed
	// syncs (m.LastSyncedAt is nil on error) but updates it on
	// successful syncs via COALESCE.
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO list_monitors
			(id, tenant_id, list_source, last_synced_at,
			 next_sync_at, status, error_message, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		ON CONFLICT (id) DO UPDATE SET
			last_synced_at = COALESCE(EXCLUDED.last_synced_at, list_monitors.last_synced_at),
			next_sync_at   = EXCLUDED.next_sync_at,
			status         = EXCLUDED.status,
			error_message  = EXCLUDED.error_message,
			updated_at     = $9`,
		m.ID, m.TenantID.String(), m.ListSource,
		m.LastSyncedAt, m.NextSyncAt,
		m.Status, m.ErrorMessage,
		m.CreatedAt, time.Now().UTC())
	return err
}

// ListByTenant returns all monitors for a tenant.
func (r *ListMonitorRepository) ListByTenant(
	ctx context.Context, tid domain.TenantID,
) ([]domain.ListMonitor, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, tenant_id, list_source, last_synced_at,
		       next_sync_at, status, error_message,
		       created_at, updated_at
		FROM list_monitors WHERE tenant_id=$1
		ORDER BY list_source`, tid.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanListMonitors(rows)
}

// DeleteByTenantAndList removes a monitor for a specific list.
func (r *ListMonitorRepository) DeleteByTenantAndList(
	ctx context.Context, tid domain.TenantID, listID string,
) error {
	id := "lm_" + tid.String() + "_" + listID
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM list_monitors WHERE id=$1`, id)
	return err
}
