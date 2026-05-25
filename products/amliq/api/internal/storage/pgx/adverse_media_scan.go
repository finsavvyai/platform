package pgx

import (
	"database/sql"

	"github.com/aegis-aml/aegis/internal/domain"
)

func scanMediaHits(rows *sql.Rows) ([]domain.AdverseMediaHit, error) {
	var hits []domain.AdverseMediaHit
	for rows.Next() {
		var h domain.AdverseMediaHit
		var tid string
		if err := rows.Scan(
			&h.ID, &tid, &h.EntityID, &h.URL, &h.Title,
			&h.Category, &h.Severity, &h.Summary, &h.DetectedAt,
		); err != nil {
			return nil, err
		}
		h.TenantID, _ = domain.NewTenantID(tid)
		hits = append(hits, h)
	}
	return hits, rows.Err()
}
