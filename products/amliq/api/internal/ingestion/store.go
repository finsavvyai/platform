package ingestion

import (
	"context"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// EntityStore is the ingestion-layer interface for entity persistence.
type EntityStore interface {
	ListByListID(ctx context.Context, tenantID domain.TenantID, listID string) ([]domain.Entity, error)
	BulkUpsert(ctx context.Context, tenantID domain.TenantID, entities []domain.Entity) error
	SoftDelete(ctx context.Context, tenantID domain.TenantID, entities []domain.Entity) error
}

// StreamingEntityStore is an optional extension to EntityStore used by
// the streaming sync path. It exposes the cheap-to-load ID set for a
// list, a point fetch for a batch of IDs, and an ID-keyed soft-delete
// — enough to drive delta reconciliation without loading the whole
// prior snapshot into RAM.
type StreamingEntityStore interface {
	EntityStore
	IDsByListID(ctx context.Context, tenantID domain.TenantID, listID string) ([]string, error)
	GetByIDs(ctx context.Context, tenantID domain.TenantID, ids []string) ([]domain.Entity, error)
	SoftDeleteByIDs(ctx context.Context, tenantID domain.TenantID, ids []string) error
}

// ListMetaStore tracks sync metadata per list per tenant.
type ListMetaStore interface {
	RecordSync(ctx context.Context, meta domain.ListSyncMeta) error
	UpdateLastSynced(ctx context.Context, tenantID domain.TenantID, listID string, at time.Time) error
	GetMeta(ctx context.Context, tenantID domain.TenantID, listID string) (*domain.ListSyncMeta, error)
}
