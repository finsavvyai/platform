package pgx

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/aegis-aml/aegis/internal/domain"
)

// MonitorProfileRepository persists monitor profiles in PostgreSQL.
type MonitorProfileRepository struct {
	db *sql.DB
}

// NewMonitorProfileRepository creates a new repository.
func NewMonitorProfileRepository(db *sql.DB) *MonitorProfileRepository {
	return &MonitorProfileRepository{db: db}
}

// Create inserts a new monitor profile.
func (r *MonitorProfileRepository) Create(
	ctx context.Context, p domain.MonitorProfile,
) error {
	lists, _ := json.Marshal(p.ListsToScreen)
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO monitor_profiles
		(id, tenant_id, entity_name, entity_type, risk_level,
		 lists_to_screen, frequency, status, next_screen_at,
		 match_count, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		p.ID, p.TenantID.String(), p.EntityName,
		p.EntityType.String(), string(p.RiskLevel),
		lists, string(p.Frequency), string(p.Status),
		p.NextScreenAt, p.MatchCount, p.CreatedAt)
	return err
}

// GetByID retrieves a single profile.
func (r *MonitorProfileRepository) GetByID(
	ctx context.Context, id string,
) (*domain.MonitorProfile, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, tenant_id, entity_name, entity_type,
		       risk_level, lists_to_screen, frequency, status,
		       last_screened_at, next_screen_at, match_count,
		       created_at
		FROM monitor_profiles WHERE id=$1`, id)
	p, err := scanMonitorProfile(row)
	if err != nil {
		return nil, err
	}
	return &p, nil
}
