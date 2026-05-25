package pgx

import (
	"context"
	"database/sql"

	"github.com/aegis-aml/aegis/internal/domain"
)

// MonitorAlertRepository persists monitor alerts in PostgreSQL.
type MonitorAlertRepository struct {
	db *sql.DB
}

// NewMonitorAlertRepository creates a new repository.
func NewMonitorAlertRepository(db *sql.DB) *MonitorAlertRepository {
	return &MonitorAlertRepository{db: db}
}

// Create inserts a new monitor alert.
func (r *MonitorAlertRepository) Create(
	ctx context.Context, a domain.MonitorAlert,
) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO monitor_alerts
		(id, profile_id, tenant_id, alert_type, match_score,
		 matched_entity, previous_score, severity,
		 reviewed_by, reviewed_at, disposition, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		a.ID, a.ProfileID, a.TenantID.String(),
		string(a.AlertType), a.MatchScore, a.MatchedEntity,
		a.PreviousScore, string(a.Severity),
		a.ReviewedBy, a.ReviewedAt, a.Disposition,
		a.CreatedAt)
	return err
}

// ListByTenant returns all alerts for a tenant.
func (r *MonitorAlertRepository) ListByTenant(
	ctx context.Context, tid domain.TenantID,
) ([]domain.MonitorAlert, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, profile_id, tenant_id, alert_type,
		       match_score, matched_entity, previous_score,
		       severity, reviewed_by, reviewed_at,
		       disposition, created_at
		FROM monitor_alerts WHERE tenant_id=$1
		ORDER BY created_at DESC`, tid.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanMonitorAlerts(rows)
}

// GetByID retrieves a single alert.
func (r *MonitorAlertRepository) GetByID(
	ctx context.Context, id string,
) (*domain.MonitorAlert, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, profile_id, tenant_id, alert_type,
		       match_score, matched_entity, previous_score,
		       severity, reviewed_by, reviewed_at,
		       disposition, created_at
		FROM monitor_alerts WHERE id=$1`, id)
	a, err := scanMonitorAlert(row)
	if err != nil {
		return nil, err
	}
	return &a, nil
}
