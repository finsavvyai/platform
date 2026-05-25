package storage

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

// MonitorProfileRepository persists monitor profiles.
type MonitorProfileRepository interface {
	Create(ctx context.Context, p domain.MonitorProfile) error
	GetByID(ctx context.Context, id string) (*domain.MonitorProfile, error)
	ListByTenant(ctx context.Context, tid domain.TenantID) ([]domain.MonitorProfile, error)
	ListDue(ctx context.Context, now int64, limit int) ([]domain.MonitorProfile, error)
	Update(ctx context.Context, p domain.MonitorProfile) error
	Delete(ctx context.Context, id string) error
}
