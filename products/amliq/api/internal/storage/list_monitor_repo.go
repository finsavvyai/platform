package storage

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

// ListMonitorRepository persists per-tenant list sync monitors.
type ListMonitorRepository interface {
	Upsert(ctx context.Context, m domain.ListMonitor) error
	ListByTenant(ctx context.Context, tid domain.TenantID) ([]domain.ListMonitor, error)
	DeleteByTenantAndList(ctx context.Context, tid domain.TenantID, listID string) error
}
