package storage

import (
	"context"
	"errors"

	"github.com/aegis-aml/aegis/internal/domain"
)

var ErrBillingEventNotFound = errors.New("billing event not found")

type BillingEventRepository interface {
	Append(ctx context.Context, evt domain.BillingEvent) error
	GetByID(ctx context.Context, id string) (*domain.BillingEvent, error)
	ListByTenantID(ctx context.Context, tenantID domain.TenantID, limit int) ([]domain.BillingEvent, error)
}
