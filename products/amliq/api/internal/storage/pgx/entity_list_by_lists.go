package pgx

import (
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// ListByLists returns entities matching specific list IDs only.
// Used for tiered index: load high-priority lists into RAM.
func (r *EntityRepository) ListByLists(
	listIDs []string,
) ([]domain.Entity, error) {
	if len(listIDs) == 0 {
		return nil, nil
	}
	placeholders := make([]string, len(listIDs))
	args := make([]interface{}, len(listIDs))
	for i, id := range listIDs {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}
	query := fmt.Sprintf(`
		SELECT id, type, full_name, given_name, family_name,
		       original_script, dob, nationalities, list_id,
		       metadata, created_at, updated_at,
		       addresses, identifiers, aliases
		FROM entities
		WHERE list_id IN (%s)
		ORDER BY id
	`, strings.Join(placeholders, ","))

	rows, err := r.db.Query(query, args...)
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
