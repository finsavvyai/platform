package pgx

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

// ListAll returns all entities from the database for index building.
func (r *EntityRepository) ListAll() ([]domain.Entity, error) {
	rows, err := r.db.Query(`
		SELECT id, type, full_name, given_name, family_name,
		       original_script, dob, nationalities, list_id,
		       metadata, created_at, updated_at,
		       addresses, identifiers, aliases
		FROM entities
		ORDER BY id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.Entity
	for rows.Next() {
		ent, err := scanEntityFromRows(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, *ent)
	}
	return results, rows.Err()
}
