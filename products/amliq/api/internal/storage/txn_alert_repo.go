package storage

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

type TxnAlertRepository interface {
	Create(ctx context.Context, alert domain.TxnAlert) error
	ListByTenant(ctx context.Context, tenantID domain.TenantID, limit int) ([]domain.TxnAlert, error)
	CountByType(ctx context.Context, tenantID domain.TenantID) (map[string]int, error)
}
