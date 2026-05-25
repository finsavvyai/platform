package pgx

import (
	"context"

	"github.com/aegis-aml/aegis/internal/storage"
)

func (r *PEPRepository) SearchByName(
	ctx context.Context, query string, limit int,
) ([]storage.PEPSearchResult, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	// Use entities table directly (indexed) — it's where PEP names are
	// stored with list_id='opensanctions_peps'. Skip the slow JOIN.
	rows, err := r.db.QueryContext(ctx, `
		SELECT e.id, e.full_name, '' AS position,
		       COALESCE(e.nationalities, '') AS country,
		       4 AS tier, true AS is_active
		FROM entities e
		WHERE e.full_name ILIKE '%' || $1 || '%'
		  AND e.list_id = 'opensanctions_peps'
		ORDER BY length(e.full_name) ASC
		LIMIT $2`, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var results []storage.PEPSearchResult
	for rows.Next() {
		var r storage.PEPSearchResult
		if err := rows.Scan(&r.EntityID, &r.Name,
			&r.Position, &r.Country, &r.Tier,
			&r.IsActive); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, rows.Err()
}
