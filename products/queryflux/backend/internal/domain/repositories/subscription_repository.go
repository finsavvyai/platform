package repositories

import (
	"context"

	"github.com/queryflux/backend/internal/domain/entities"
)

// SubscriptionRepository defines the interface for subscription persistence
type SubscriptionRepository interface {
	// Subscription CRUD operations
	Create(ctx context.Context, subscription *entities.Subscription) error
	GetByID(ctx context.Context, id string) (*entities.Subscription, error)
	GetByUserID(ctx context.Context, userID string) (*entities.Subscription, error)
	GetByCustomerID(ctx context.Context, customerID string) (*entities.Subscription, error)
	GetByLemonSqueezyID(ctx context.Context, lemonSqueezyID string) (*entities.Subscription, error)
	Update(ctx context.Context, subscription *entities.Subscription) error
	Delete(ctx context.Context, id string) error

	// Subscription status and usage
	UpdateStatus(ctx context.Context, id, status string) error
	IncrementUsage(ctx context.Context, id string) error
	ResetUsage(ctx context.Context, id string) error
	GetActiveSubscriptions(ctx context.Context) ([]*entities.Subscription, error)
	GetExpiringSubscriptions(ctx context.Context, days int) ([]*entities.Subscription, error)

	// Subscription queries
	ListByUser(ctx context.Context, userID string, limit, offset int) ([]*entities.Subscription, error)
	CountByUser(ctx context.Context, userID string) (int, error)
}