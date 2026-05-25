package repositories

import (
	"context"

	"github.com/queryflux/backend/internal/domain/entities"
)

// CustomerRepository defines the interface for customer persistence
type CustomerRepository interface {
	// Customer CRUD operations
	Create(ctx context.Context, customer *entities.Customer) error
	GetByID(ctx context.Context, id string) (*entities.Customer, error)
	GetByUserID(ctx context.Context, userID string) (*entities.Customer, error)
	GetByLemonSqueezyID(ctx context.Context, lemonSqueezyID string) (*entities.Customer, error)
	Update(ctx context.Context, customer *entities.Customer) error
	Delete(ctx context.Context, id string) error

	// Customer queries
	GetByEmail(ctx context.Context, email string) (*entities.Customer, error)
	ListByStore(ctx context.Context, storeID string, limit, offset int) ([]*entities.Customer, error)
}