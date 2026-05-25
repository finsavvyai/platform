package pgx

import (
	"context"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

// FullTextSearch uses PostgreSQL tsvector + trigram for entity name matching.
// Falls back to ILIKE if tsvector returns no results.
func (r *EntityRepository) FullTextSearch(
	ctx context.Context,
	tenantID domain.TenantID,
	query string,
	limit int,
) ([]domain.Entity, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}

	results, err := r.searchTSVector(ctx, tenantID, query, limit)
	if err != nil {
		return nil, err
	}
	if len(results) > 0 {
		return results, nil
	}

	return r.searchTrigram(ctx, tenantID, query, limit)
}

func (r *EntityRepository) searchTSVector(
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
		  AND to_tsvector('simple', full_name) @@ plainto_tsquery('simple', $2)
		ORDER BY ts_rank(to_tsvector('simple', full_name), plainto_tsquery('simple', $2)) DESC
		LIMIT $3
	`, tenantID.String(), query, limit)
	if err != nil {
		return nil, fmt.Errorf("tsvector search: %w", err)
	}
	defer rows.Close()
	return collectEntities(rows)
}
