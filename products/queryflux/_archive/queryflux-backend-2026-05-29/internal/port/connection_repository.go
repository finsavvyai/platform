package port

import (
	"context"

	"github.com/queryflux/backend/internal/domain"
)

type ConnectionRepository interface {
	Create(ctx context.Context, conn *domain.Connection) error
	FindByID(ctx context.Context, id string) (*domain.Connection, error)
	FindByUserID(ctx context.Context, userID string) ([]domain.Connection, error)
	Update(ctx context.Context, conn *domain.Connection) error
	Delete(ctx context.Context, id string) error
}
