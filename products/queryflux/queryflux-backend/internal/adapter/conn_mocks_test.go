package adapter

import (
	"context"
	"errors"

	"github.com/queryflux/backend/internal/domain"
)

type mockConnRepo struct {
	createFunc     func(ctx context.Context, conn *domain.Connection) error
	findByIDFunc   func(ctx context.Context, id string) (*domain.Connection, error)
	findByUserFunc func(ctx context.Context, userID string) ([]domain.Connection, error)
	updateFunc     func(ctx context.Context, conn *domain.Connection) error
	deleteFunc     func(ctx context.Context, id string) error
}

func (m *mockConnRepo) Create(ctx context.Context, conn *domain.Connection) error {
	if m.createFunc != nil {
		return m.createFunc(ctx, conn)
	}
	return nil
}

func (m *mockConnRepo) FindByID(ctx context.Context, id string) (*domain.Connection, error) {
	if m.findByIDFunc != nil {
		return m.findByIDFunc(ctx, id)
	}
	return nil, errors.New("not found")
}

func (m *mockConnRepo) FindByUserID(ctx context.Context, userID string) ([]domain.Connection, error) {
	if m.findByUserFunc != nil {
		return m.findByUserFunc(ctx, userID)
	}
	return nil, nil
}

func (m *mockConnRepo) Update(ctx context.Context, conn *domain.Connection) error {
	if m.updateFunc != nil {
		return m.updateFunc(ctx, conn)
	}
	return nil
}

func (m *mockConnRepo) Delete(ctx context.Context, id string) error {
	if m.deleteFunc != nil {
		return m.deleteFunc(ctx, id)
	}
	return nil
}
