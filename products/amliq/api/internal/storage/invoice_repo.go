package storage

import (
	"context"
	"errors"

	"github.com/aegis-aml/aegis/internal/domain"
)

var ErrInvoiceNotFound = errors.New("invoice not found")

type InvoiceRepository interface {
	Create(ctx context.Context, inv domain.Invoice) error
	GetByID(ctx context.Context, id string) (*domain.Invoice, error)
	ListByTenantID(ctx context.Context, tenantID domain.TenantID) ([]domain.Invoice, error)
	Update(ctx context.Context, inv domain.Invoice) error
}
