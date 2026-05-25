package pgx

import (
	"context"
	"database/sql"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// ListMetaRepository persists list sync metadata.
type ListMetaRepository struct {
	db *sql.DB
}

// NewListMetaRepository creates a new list meta repository.
func NewListMetaRepository(db *sql.DB) *ListMetaRepository {
	return &ListMetaRepository{db: db}
}

// RecordSync upserts sync metadata for a list within a tenant.
func (r *ListMetaRepository) RecordSync(
	ctx context.Context, meta domain.ListSyncMeta,
) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO list_sync_meta (tenant_id, list_id, etag, entity_count, synced_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (tenant_id, list_id) DO UPDATE SET
			etag = EXCLUDED.etag,
			entity_count = EXCLUDED.entity_count,
			synced_at = EXCLUDED.synced_at
	`, meta.TenantID.String(), meta.ListID, meta.ETag,
		meta.EntityCount, meta.SyncedAt)
	return err
}

// UpdateLastSynced sets the synced_at timestamp for a list.
func (r *ListMetaRepository) UpdateLastSynced(
	ctx context.Context, tenantID domain.TenantID, listID string, at time.Time,
) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE list_sync_meta SET synced_at = $1 WHERE tenant_id = $2 AND list_id = $3`,
		at, tenantID.String(), listID)
	return err
}

// GetMeta returns sync metadata for a specific list and tenant.
func (r *ListMetaRepository) GetMeta(
	ctx context.Context, tenantID domain.TenantID, listID string,
) (*domain.ListSyncMeta, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT tenant_id, list_id, etag, entity_count, synced_at
		FROM list_sync_meta WHERE tenant_id = $1 AND list_id = $2
	`, tenantID.String(), listID)
	return scanListMeta(row)
}
