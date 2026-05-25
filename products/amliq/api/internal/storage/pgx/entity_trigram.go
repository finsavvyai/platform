package pgx

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

// searchTrigram uses pg_trgm similarity for fuzzy name matching.
func (r *EntityRepository) searchTrigram(
	ctx context.Context,
	tenantID domain.TenantID,
	query string,
	limit int,
) ([]domain.Entity, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, type, full_name, given_name, family_name, original_script,
		       dob, nationalities, list_id, metadata, created_at, updated_at,
		       addresses, identifiers, aliases
		FROM entities
		WHERE tenant_id = $1 AND deleted_at IS NULL
		  AND similarity(full_name, $2) > 0.3
		ORDER BY similarity(full_name, $2) DESC
		LIMIT $3
	`, tenantID.String(), query, limit)
	if err != nil {
		return nil, fmt.Errorf("trigram search: %w", err)
	}
	defer rows.Close()
	return collectEntities(rows)
}

func collectEntities(rows *sql.Rows) ([]domain.Entity, error) {
	// Same rationale as collectEntitiesWithSim: trigram search
	// callers cap at 100 rows; 50 is the common case.
	results := make([]domain.Entity, 0, 50)
	for rows.Next() {
		ent, err := scanEntityFromRows(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, *ent)
	}
	return results, rows.Err()
}
