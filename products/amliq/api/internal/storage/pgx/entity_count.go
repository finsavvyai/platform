package pgx

import "context"

// CountByListID returns entity counts grouped by list_id.
func (r *EntityRepository) CountByListID(ctx context.Context) (map[string]int, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT list_id, COUNT(*) FROM entities
		GROUP BY list_id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := make(map[string]int)
	for rows.Next() {
		var listID string
		var count int
		if err := rows.Scan(&listID, &count); err != nil {
			return nil, err
		}
		counts[listID] = count
	}
	return counts, rows.Err()
}
