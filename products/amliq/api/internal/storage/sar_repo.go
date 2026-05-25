package storage

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

// SARRepository persists Suspicious Activity Reports.
type SARRepository interface {
	Create(ctx context.Context, sar domain.SAR) error
	GetByID(ctx context.Context, id string) (*domain.SAR, error)
	ListByTenantID(ctx context.Context, tenantID domain.TenantID, status string, limit int) ([]domain.SAR, error)
	Update(ctx context.Context, sar domain.SAR) error
	CountByTenant(ctx context.Context, tenantID domain.TenantID) (int, error)
}
