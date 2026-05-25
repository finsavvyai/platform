package pgx

import (
	"context"
	"database/sql"

	"github.com/aegis-aml/aegis/internal/domain"
)

type MonitorRepository struct {
	db *sql.DB
}

func NewMonitorRepository(db *sql.DB) *MonitorRepository {
	return &MonitorRepository{db: db}
}

func (r *MonitorRepository) Create(
	ctx context.Context, m domain.OngoingMonitor,
) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO ongoing_monitors
		(id, tenant_id, entity_name, entity_type, frequency,
		 active, next_screen_at, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		m.ID, m.TenantID.String(), m.EntityName,
		m.EntityType.String(), m.Frequency,
		m.Status == domain.MonitorActive, m.NextScreen, m.CreatedAt)
	return err
}

func (r *MonitorRepository) ListByTenant(
	ctx context.Context, tenantID domain.TenantID,
) ([]domain.OngoingMonitor, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, tenant_id, entity_name, entity_type, frequency,
		       active, last_screened_at, next_screen_at, created_at
		FROM ongoing_monitors WHERE tenant_id=$1
		ORDER BY created_at DESC`, tenantID.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanMonitors(rows)
}

func (r *MonitorRepository) Delete(ctx context.Context, monitorID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE ongoing_monitors SET active=FALSE WHERE id=$1`, monitorID)
	return err
}

func (r *MonitorRepository) UpdateLastScreened(ctx context.Context, monitorID string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE ongoing_monitors
		SET last_screened_at=NOW(), next_screen_at=NOW() + INTERVAL '1 day'
		WHERE id=$1`, monitorID)
	return err
}

func (r *MonitorRepository) ListDue(
	ctx context.Context, limit int,
) ([]domain.OngoingMonitor, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, tenant_id, entity_name, entity_type, frequency,
		       active, last_screened_at, next_screen_at, created_at
		FROM ongoing_monitors
		WHERE active=TRUE AND next_screen_at <= NOW()
		ORDER BY next_screen_at LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanMonitors(rows)
}
