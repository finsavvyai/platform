package pgx

import (
	"context"
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// IDsByListID returns the ID strings of every active entity in a list.
// Cheap alternative to ListByListID — 40 bytes per row instead of
// ~2KB per fully-hydrated entity. Used by the streaming sync path
// to build the "seen" set for deferred soft-delete.
func (r *EntityRepository) IDsByListID(
	ctx context.Context,
	tenantID domain.TenantID,
	listID string,
) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id FROM entities
		WHERE tenant_id = $1 AND list_id = $2 AND deleted_at IS NULL
	`, tenantID.String(), listID)
	if err != nil {
		return nil, fmt.Errorf("query ids: %w", err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan id: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// GetByIDs hydrates a batch of entities by ID for the current tenant.
// Used by the streaming sync path to diff each incoming batch
// against its prior state without loading the whole list.
func (r *EntityRepository) GetByIDs(
	ctx context.Context,
	tenantID domain.TenantID,
	ids []string,
) ([]domain.Entity, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	placeholders := make([]string, len(ids))
	args := make([]interface{}, 0, len(ids)+1)
	args = append(args, tenantID.String())
	for i, id := range ids {
		placeholders[i] = fmt.Sprintf("$%d", i+2)
		args = append(args, id)
	}
	query := fmt.Sprintf(`
		SELECT id, type, full_name, given_name, family_name, original_script,
		       dob, nationalities, list_id, metadata, created_at, updated_at,
		       addresses, identifiers, aliases
		FROM entities
		WHERE tenant_id = $1 AND id IN (%s) AND deleted_at IS NULL
	`, strings.Join(placeholders, ","))

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query by ids: %w", err)
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

