package storage

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

type MonitorRepository interface {
	Create(ctx context.Context, m domain.OngoingMonitor) error
	ListByTenant(ctx context.Context, tenantID domain.TenantID) ([]domain.OngoingMonitor, error)
	ListDue(ctx context.Context, limit int) ([]domain.OngoingMonitor, error)
	Delete(ctx context.Context, monitorID string) error
	UpdateLastScreened(ctx context.Context, monitorID string) error
}
