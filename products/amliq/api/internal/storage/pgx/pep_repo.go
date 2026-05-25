package pgx

import (
	"context"
	"database/sql"

	"github.com/aegis-aml/aegis/internal/domain"
)

type PEPRepository struct {
	db *sql.DB
}

func NewPEPRepository(db *sql.DB) *PEPRepository {
	return &PEPRepository{db: db}
}

func (r *PEPRepository) Create(
	ctx context.Context, profile domain.PEPProfile,
) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO pep_profiles
		(entity_id, tier, position, country, is_active,
		 active_from, active_to)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		profile.EntityID, int(profile.Tier), profile.Position,
		profile.Country, profile.IsActive,
		profile.ActiveFrom, profile.ActiveTo)
	return err
}

func (r *PEPRepository) GetByEntityID(
	ctx context.Context, entityID string,
) (*domain.PEPProfile, error) {
	var p domain.PEPProfile
	var tier int
	err := r.db.QueryRowContext(ctx, `
		SELECT entity_id, tier, position, country,
		       is_active, active_from, active_to
		FROM pep_profiles WHERE entity_id=$1`, entityID,
	).Scan(&p.EntityID, &tier, &p.Position, &p.Country,
		&p.IsActive, &p.ActiveFrom, &p.ActiveTo)
	if err != nil {
		return nil, err
	}
	p.Tier = domain.PEPTier(tier)
	return &p, nil
}

func (r *PEPRepository) ListByCountry(
	ctx context.Context, country string, limit int,
) ([]domain.PEPProfile, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT entity_id, tier, position, country, is_active
		FROM pep_profiles WHERE country=$1
		ORDER BY tier LIMIT $2`, country, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var profiles []domain.PEPProfile
	for rows.Next() {
		var p domain.PEPProfile
		var tier int
		if err := rows.Scan(&p.EntityID, &tier, &p.Position,
			&p.Country, &p.IsActive); err != nil {
			return nil, err
		}
		p.Tier = domain.PEPTier(tier)
		profiles = append(profiles, p)
	}
	return profiles, rows.Err()
}
