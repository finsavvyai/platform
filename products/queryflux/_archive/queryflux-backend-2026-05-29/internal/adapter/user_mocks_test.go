package adapter

import (
	"context"
	"errors"

	"github.com/queryflux/backend/internal/domain"
)

type mockUserRepo struct {
	findByEmailFunc   func(ctx context.Context, email string) (*domain.User, error)
	createFunc        func(ctx context.Context, email, hash string) (*domain.User, error)
	saveRefreshFunc   func(ctx context.Context, id, userID, token string, exp interface{}) error
	findRefreshFunc   func(ctx context.Context, token, userID string) (*domain.RefreshToken, error)
	deleteRefreshFunc func(ctx context.Context, tokenID string) error
	revokeRefreshFunc func(ctx context.Context, tokenID string) error
}

func (m *mockUserRepo) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	if m.findByEmailFunc != nil {
		return m.findByEmailFunc(ctx, email)
	}
	return nil, errors.New("not found")
}

func (m *mockUserRepo) Create(ctx context.Context, email, hash string) (*domain.User, error) {
	if m.createFunc != nil {
		return m.createFunc(ctx, email, hash)
	}
	return &domain.User{ID: "u-1", Email: email}, nil
}

func (m *mockUserRepo) SaveRefreshToken(ctx context.Context, id, userID, token string, exp interface{}) error {
	if m.saveRefreshFunc != nil {
		return m.saveRefreshFunc(ctx, id, userID, token, exp)
	}
	return nil
}

func (m *mockUserRepo) FindRefreshToken(ctx context.Context, token, userID string) (*domain.RefreshToken, error) {
	if m.findRefreshFunc != nil {
		return m.findRefreshFunc(ctx, token, userID)
	}
	return nil, errors.New("not found")
}

func (m *mockUserRepo) DeleteRefreshToken(ctx context.Context, tokenID string) error {
	if m.deleteRefreshFunc != nil {
		return m.deleteRefreshFunc(ctx, tokenID)
	}
	return nil
}

func (m *mockUserRepo) RevokeRefreshToken(ctx context.Context, tokenID string) error {
	if m.revokeRefreshFunc != nil {
		return m.revokeRefreshFunc(ctx, tokenID)
	}
	return nil
}
