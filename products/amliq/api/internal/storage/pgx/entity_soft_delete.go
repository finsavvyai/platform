package pgx

import (
	"context"
	"fmt"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// SoftDelete marks entities as deleted by setting deleted_at timestamp.
func (r *EntityRepository) SoftDelete(
	ctx context.Context,
	tenantID domain.TenantID,
	entities []domain.Entity,
) error {
	if len(entities) == 0 {
		return nil
	}
	now := time.Now().UTC()
	for _, ent := range entities {
		if err := r.softDeleteOne(ctx, tenantID, ent.ID, now); err != nil {
			return fmt.Errorf("soft-delete %s: %w", ent.ID, err)
		}
	}
	return nil
}

func (r *EntityRepository) softDeleteOne(
	ctx context.Context,
	tenantID domain.TenantID,
	id domain.EntityID,
	at time.Time,
) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE entities SET deleted_at = $1
		WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL
	`, at, id.String(), tenantID.String())
	return err
}

// ListByListID returns all active entities for a given list and tenant.
func (r *EntityRepository) ListByListID(
	ctx context.Context,
	tenantID domain.TenantID,
	listID string,
) ([]domain.Entity, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, type, full_name, given_name, family_name, original_script,
		       dob, nationalities, list_id, metadata, created_at, updated_at,
		       addresses, identifiers, aliases
		FROM entities
		WHERE tenant_id = $1 AND list_id = $2 AND deleted_at IS NULL
		ORDER BY created_at
	`, tenantID.String(), listID)
	if err != nil {
		return nil, fmt.Errorf("query by list: %w", err)
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
