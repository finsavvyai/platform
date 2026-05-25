package pgx

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// maxIDsPerDelete caps IN-list size so a retire pass for a 500k-row
// list fans out across multiple round-trips instead of overflowing
// Postgres' parameter limit (default 65535).
const maxIDsPerDelete = 5_000

// SoftDeleteByIDs marks entities as deleted by ID. Large ID sets are
// chunked to keep each statement's parameter count well under the
// pgx default cap. Used at end-of-stream to retire any prior IDs
// the parser didn't re-emit.
func (r *EntityRepository) SoftDeleteByIDs(
	ctx context.Context,
	tenantID domain.TenantID,
	ids []string,
) error {
	if len(ids) == 0 {
		return nil
	}
	for start := 0; start < len(ids); start += maxIDsPerDelete {
		end := start + maxIDsPerDelete
		if end > len(ids) {
			end = len(ids)
		}
		if err := r.softDeleteChunk(ctx, tenantID, ids[start:end]); err != nil {
			return err
		}
	}
	return nil
}

func (r *EntityRepository) softDeleteChunk(
	ctx context.Context,
	tenantID domain.TenantID,
	ids []string,
) error {
	placeholders := make([]string, len(ids))
	args := make([]interface{}, 0, len(ids)+2)
	args = append(args, time.Now().UTC(), tenantID.String())
	for i, id := range ids {
		placeholders[i] = fmt.Sprintf("$%d", i+3)
		args = append(args, id)
	}
	query := fmt.Sprintf(`
		UPDATE entities SET deleted_at = $1
		WHERE tenant_id = $2 AND id IN (%s) AND deleted_at IS NULL
	`, strings.Join(placeholders, ","))
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}
