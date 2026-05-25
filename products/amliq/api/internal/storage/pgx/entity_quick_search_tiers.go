package pgx

import (
	"context"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

// ilikeSearch performs a GIN-trigram-backed ILIKE scan. Always
// filters by deleted_at IS NULL so the partial index
// idx_entities_deleted_at does the heavy lifting.
func (r *EntityRepository) ilikeSearch(
	ctx context.Context, term string, limit int,
) ([]domain.Entity, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, type, full_name, given_name, family_name,
		       original_script, dob, nationalities, list_id,
		       metadata, created_at, updated_at,
		       addresses, identifiers, aliases, 0::float8 AS sim
		FROM entities
		WHERE full_name ILIKE '%' || $1 || '%'
		  AND deleted_at IS NULL
		ORDER BY length(full_name) ASC
		LIMIT $2
	`, term, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectEntitiesWithSim(rows)
}

// trigramSearch is QuickSearch's typo-tolerant final tier — uses the
// pg_trgm similarity operator. Extracted so the single-word fast
// path can skip tier 2 and jump straight here.
func (r *EntityRepository) trigramSearch(
	ctx context.Context, name string, limit int,
) ([]domain.Entity, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, type, full_name, given_name, family_name,
		       original_script, dob, nationalities, list_id,
		       metadata, created_at, updated_at,
		       addresses, identifiers, aliases,
		       similarity(full_name, $1) AS sim
		FROM entities
		WHERE full_name %% $1
		  AND deleted_at IS NULL
		ORDER BY similarity(full_name, $1) DESC
		LIMIT $2
	`, name, limit)
	if err != nil {
		return nil, fmt.Errorf("quick search trigram: %w", err)
	}
	defer rows.Close()
	return collectEntitiesWithSim(rows)
}
