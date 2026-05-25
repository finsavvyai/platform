package pgx

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

// ListByTenant returns all profiles for a tenant.
func (r *MonitorProfileRepository) ListByTenant(
	ctx context.Context, tid domain.TenantID,
) ([]domain.MonitorProfile, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, tenant_id, entity_name, entity_type,
		       risk_level, lists_to_screen, frequency, status,
		       last_screened_at, next_screen_at, match_count,
		       created_at
		FROM monitor_profiles WHERE tenant_id=$1
		ORDER BY created_at DESC`, tid.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanMonitorProfiles(rows)
}

// ListDue returns profiles due for re-screening.
func (r *MonitorProfileRepository) ListDue(
	ctx context.Context, now int64, limit int,
) ([]domain.MonitorProfile, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, tenant_id, entity_name, entity_type,
		       risk_level, lists_to_screen, frequency, status,
		       last_screened_at, next_screen_at, match_count,
		       created_at
		FROM monitor_profiles
		WHERE status='active'
		  AND next_screen_at <= TO_TIMESTAMP($1)
		ORDER BY next_screen_at LIMIT $2`, now, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanMonitorProfiles(rows)
}

// Update updates an existing profile.
func (r *MonitorProfileRepository) Update(
	ctx context.Context, p domain.MonitorProfile,
) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE monitor_profiles
		SET entity_name=$2, risk_level=$3, frequency=$4,
		    status=$5, last_screened_at=$6,
		    next_screen_at=$7, match_count=$8
		WHERE id=$1`,
		p.ID, p.EntityName, string(p.RiskLevel),
		string(p.Frequency), string(p.Status),
		p.LastScreenedAt, p.NextScreenAt, p.MatchCount)
	return err
}

// Delete removes a profile by id.
func (r *MonitorProfileRepository) Delete(
	ctx context.Context, id string,
) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM monitor_profiles WHERE id=$1`, id)
	return err
}
