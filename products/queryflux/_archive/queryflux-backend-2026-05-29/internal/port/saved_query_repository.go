package port

import (
	"context"

	"github.com/queryflux/backend/internal/domain"
)

type SavedQueryRepository interface {
	Create(ctx context.Context, query *domain.SavedQuery) error
	FindByID(ctx context.Context, id string) (*domain.SavedQuery, error)
	FindByUserID(ctx context.Context, userID string) ([]domain.SavedQuery, error)
	Update(ctx context.Context, query *domain.SavedQuery) error
	Delete(ctx context.Context, id string) error
}
