package pgx

import (
	"context"
	"database/sql"

	"github.com/aegis-aml/aegis/internal/domain"
)

type AdverseMediaRepository struct {
	db *sql.DB
}

func NewAdverseMediaRepository(db *sql.DB) *AdverseMediaRepository {
	return &AdverseMediaRepository{db: db}
}

func (r *AdverseMediaRepository) Create(
	ctx context.Context, hit domain.AdverseMediaHit,
) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO adverse_media_hits
		(id, tenant_id, entity_id, source_url, headline,
		 category, severity, snippet, discovered_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		hit.ID, hit.TenantID.String(), hit.EntityID,
		hit.URL, hit.Title, string(hit.Category),
		hit.Severity, hit.Summary, hit.DetectedAt)
	return err
}

func (r *AdverseMediaRepository) ListByEntity(
	ctx context.Context, entityID string,
) ([]domain.AdverseMediaHit, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, tenant_id, entity_id, source_url, headline,
		       category, severity, snippet, discovered_at
		FROM adverse_media_hits WHERE entity_id=$1
		ORDER BY discovered_at DESC`, entityID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanMediaHits(rows)
}

func (r *AdverseMediaRepository) ListUnreviewed(
	ctx context.Context, tenantID domain.TenantID, limit int,
) ([]domain.AdverseMediaHit, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, tenant_id, entity_id, source_url, headline,
		       category, severity, snippet, discovered_at
		FROM adverse_media_hits
		WHERE tenant_id=$1
		ORDER BY severity DESC, discovered_at DESC
		LIMIT $2`, tenantID.String(), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanMediaHits(rows)
}
