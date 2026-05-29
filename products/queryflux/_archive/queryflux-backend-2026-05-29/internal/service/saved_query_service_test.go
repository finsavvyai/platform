package service

import (
	"context"
	"errors"
	"testing"

	"github.com/queryflux/backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockSavedQueryRepo struct {
	createFunc     func(ctx context.Context, q *domain.SavedQuery) error
	findByIDFunc   func(ctx context.Context, id string) (*domain.SavedQuery, error)
	findByUserFunc func(ctx context.Context, userID string) ([]domain.SavedQuery, error)
	updateFunc     func(ctx context.Context, q *domain.SavedQuery) error
	deleteFunc     func(ctx context.Context, id string) error
}

func (m *mockSavedQueryRepo) Create(ctx context.Context, q *domain.SavedQuery) error {
	if m.createFunc != nil {
		return m.createFunc(ctx, q)
	}
	return nil
}

func (m *mockSavedQueryRepo) FindByID(ctx context.Context, id string) (*domain.SavedQuery, error) {
	if m.findByIDFunc != nil {
		return m.findByIDFunc(ctx, id)
	}
	return nil, errors.New("not found")
}

func (m *mockSavedQueryRepo) FindByUserID(ctx context.Context, userID string) ([]domain.SavedQuery, error) {
	if m.findByUserFunc != nil {
		return m.findByUserFunc(ctx, userID)
	}
	return []domain.SavedQuery{}, nil
}

func (m *mockSavedQueryRepo) Update(ctx context.Context, q *domain.SavedQuery) error {
	if m.updateFunc != nil {
		return m.updateFunc(ctx, q)
	}
	return nil
}

func (m *mockSavedQueryRepo) Delete(ctx context.Context, id string) error {
	if m.deleteFunc != nil {
		return m.deleteFunc(ctx, id)
	}
	return nil
}

func TestSavedQueryService_Create(t *testing.T) {
	svc := NewSavedQueryService(&mockSavedQueryRepo{})

	q, err := svc.Create(context.Background(), "user-1", domain.CreateSavedQueryRequest{
		Name: "My Query", SQL: "SELECT 1", ConnectionID: "conn-1",
	})

	require.NoError(t, err)
	assert.NotEmpty(t, q.ID)
	assert.Equal(t, "user-1", q.UserID)
	assert.Equal(t, "My Query", q.Name)
	assert.Equal(t, "conn-1", q.ConnectionID)
}

func TestSavedQueryService_GetByID(t *testing.T) {
	repo := &mockSavedQueryRepo{
		findByIDFunc: func(_ context.Context, id string) (*domain.SavedQuery, error) {
			return &domain.SavedQuery{ID: id, UserID: "user-1", SQL: "SELECT 1"}, nil
		},
	}
	svc := NewSavedQueryService(repo)

	q, err := svc.GetByID(context.Background(), "user-1", "q-1")
	require.NoError(t, err)
	assert.Equal(t, "q-1", q.ID)
}

func TestSavedQueryService_GetByID_Forbidden(t *testing.T) {
	repo := &mockSavedQueryRepo{
		findByIDFunc: func(_ context.Context, id string) (*domain.SavedQuery, error) {
			return &domain.SavedQuery{ID: id, UserID: "other-user"}, nil
		},
	}
	svc := NewSavedQueryService(repo)

	_, err := svc.GetByID(context.Background(), "user-1", "q-1")
	assert.ErrorIs(t, err, ErrUnauthorized)
}

func TestSavedQueryService_ListByUser(t *testing.T) {
	repo := &mockSavedQueryRepo{
		findByUserFunc: func(_ context.Context, uid string) ([]domain.SavedQuery, error) {
			return []domain.SavedQuery{
				{ID: "q-1", UserID: uid},
				{ID: "q-2", UserID: uid},
			}, nil
		},
	}
	svc := NewSavedQueryService(repo)

	queries, err := svc.ListByUser(context.Background(), "user-1")
	require.NoError(t, err)
	assert.Len(t, queries, 2)
}

func TestSavedQueryService_Update(t *testing.T) {
	repo := &mockSavedQueryRepo{
		findByIDFunc: func(_ context.Context, id string) (*domain.SavedQuery, error) {
			return &domain.SavedQuery{ID: id, UserID: "user-1", Name: "Old"}, nil
		},
	}
	svc := NewSavedQueryService(repo)

	q, err := svc.Update(context.Background(), "user-1", "q-1",
		domain.UpdateSavedQueryRequest{Name: "New"})
	require.NoError(t, err)
	assert.Equal(t, "New", q.Name)
}

func TestSavedQueryService_Delete(t *testing.T) {
	deleted := false
	repo := &mockSavedQueryRepo{
		findByIDFunc: func(_ context.Context, id string) (*domain.SavedQuery, error) {
			return &domain.SavedQuery{ID: id, UserID: "user-1"}, nil
		},
		deleteFunc: func(_ context.Context, id string) error {
			deleted = true
			return nil
		},
	}
	svc := NewSavedQueryService(repo)

	err := svc.Delete(context.Background(), "user-1", "q-1")
	require.NoError(t, err)
	assert.True(t, deleted)
}
