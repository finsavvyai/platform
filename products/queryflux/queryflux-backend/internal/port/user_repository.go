package port

import (
	"context"

	"github.com/queryflux/backend/internal/domain"
)

type UserRepository interface {
	FindByEmail(ctx context.Context, email string) (*domain.User, error)
	Create(ctx context.Context, email, passwordHash string) (*domain.User, error)
	SaveRefreshToken(ctx context.Context, id, userID, token string, expiresAt interface{}) error
	FindRefreshToken(ctx context.Context, token, userID string) (*domain.RefreshToken, error)
	DeleteRefreshToken(ctx context.Context, tokenID string) error
	RevokeRefreshToken(ctx context.Context, tokenID string) error
}
