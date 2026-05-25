package storage

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

type AdverseMediaRepository interface {
	Create(ctx context.Context, hit domain.AdverseMediaHit) error
	ListByEntity(ctx context.Context, entityID string) ([]domain.AdverseMediaHit, error)
	ListUnreviewed(ctx context.Context, tenantID domain.TenantID, limit int) ([]domain.AdverseMediaHit, error)
}
