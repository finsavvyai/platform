package storage

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

type TransactionRepository interface {
	Create(ctx context.Context, txn domain.Transaction) error
	ListByEntity(ctx context.Context, entityID string, limit int) ([]domain.Transaction, error)
	ListByTenant(ctx context.Context, tenantID domain.TenantID, limit int) ([]domain.Transaction, error)
}
