package storage

import (
	"context"
	"errors"

	"github.com/aegis-aml/aegis/internal/domain"
)

var ErrSubscriptionNotFound = errors.New("subscription not found")

type SubscriptionRepository interface {
	Create(ctx context.Context, sub domain.Subscription) error
	GetByTenantID(ctx context.Context, tenantID domain.TenantID) (*domain.Subscription, error)
	GetByLemonSqueezyID(ctx context.Context, lsID string) (*domain.Subscription, error)
	Update(ctx context.Context, sub domain.Subscription) error
	Delete(ctx context.Context, id string) error
	ListByTenantID(ctx context.Context, tenantID domain.TenantID) ([]domain.Subscription, error)
}
