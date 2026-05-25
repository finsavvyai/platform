package service

import (
	"context"
	"errors"
	"time"

	"github.com/queryflux/backend/internal/domain"
	"golang.org/x/crypto/bcrypt"
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
	return nil, nil
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

func newTestUser(email, password string) *domain.User {
	hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return &domain.User{
		ID:           "test-user-" + email,
		Email:        email,
		PasswordHash: string(hash),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
}

func newMockRepoWithTokenStore(user *domain.User) (*mockUserRepo, map[string]*domain.RefreshToken) {
	storedTokens := make(map[string]*domain.RefreshToken)

	repo := &mockUserRepo{
		findByEmailFunc: func(_ context.Context, e string) (*domain.User, error) {
			if user != nil && e == user.Email {
				return user, nil
			}
			return nil, errors.New("not found")
		},
		saveRefreshFunc: func(_ context.Context, id, userID, token string, exp interface{}) error {
			storedTokens[token] = &domain.RefreshToken{
				ID: id, UserID: userID, Token: token,
				ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
			}
			return nil
		},
		findRefreshFunc: func(_ context.Context, token, userID string) (*domain.RefreshToken, error) {
			if t, ok := storedTokens[token]; ok && t.UserID == userID {
				return t, nil
			}
			return nil, errors.New("not found")
		},
		revokeRefreshFunc: func(_ context.Context, tokenID string) error {
			for _, t := range storedTokens {
				if t.ID == tokenID {
					t.Revoked = true
				}
			}
			return nil
		},
	}

	return repo, storedTokens
}
