package storage

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

type UserRepository interface {
	Create(ctx context.Context, user domain.User) error
	GetByEmail(ctx context.Context, email string) (*domain.User, error)
	GetByID(ctx context.Context, id string) (*domain.User, error)
	GetByProvider(ctx context.Context, provider, providerID string) (*domain.User, error)
	ListAll(ctx context.Context) ([]domain.User, error)
}
