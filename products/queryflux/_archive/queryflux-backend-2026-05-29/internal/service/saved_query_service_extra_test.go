package service

import (
	"context"
	"errors"
	"testing"

	"github.com/queryflux/backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSavedQueryService_Create_RepoError(t *testing.T) {
	repo := &mockSavedQueryRepo{
		createFunc: func(_ context.Context, _ *domain.SavedQuery) error {
			return errors.New("db failure")
		},
	}
	svc := NewSavedQueryService(repo)

	_, err := svc.Create(context.Background(), "user-1",
		domain.CreateSavedQueryRequest{SQL: "SELECT 1", ConnectionID: "c-1"})
	assert.Error(t, err)
}

func TestSavedQueryService_Update_AllFields(t *testing.T) {
	repo := &mockSavedQueryRepo{
		findByIDFunc: func(_ context.Context, id string) (*domain.SavedQuery, error) {
			return &domain.SavedQuery{
				ID: id, UserID: "user-1", Name: "Old",
				SQL: "SELECT 1", Description: "old desc",
			}, nil
		},
	}
	svc := NewSavedQueryService(repo)

	tags := []string{"tag1", "tag2"}
	q, err := svc.Update(context.Background(), "user-1", "q-1",
		domain.UpdateSavedQueryRequest{
			Name:        "New",
			SQL:         "SELECT 2",
			Description: "new desc",
			Tags:        tags,
		})

	require.NoError(t, err)
	assert.Equal(t, "New", q.Name)
	assert.Equal(t, "SELECT 2", q.SQL)
	assert.Equal(t, "new desc", q.Description)
	assert.Equal(t, tags, q.Tags)
}

func TestSavedQueryService_Update_RepoError(t *testing.T) {
	repo := &mockSavedQueryRepo{
		findByIDFunc: func(_ context.Context, id string) (*domain.SavedQuery, error) {
			return &domain.SavedQuery{ID: id, UserID: "user-1"}, nil
		},
		updateFunc: func(_ context.Context, _ *domain.SavedQuery) error {
			return errors.New("db failure")
		},
	}
	svc := NewSavedQueryService(repo)

	_, err := svc.Update(context.Background(), "user-1", "q-1",
		domain.UpdateSavedQueryRequest{Name: "X"})
	assert.Error(t, err)
}

func TestSavedQueryService_Update_NotFound(t *testing.T) {
	svc := NewSavedQueryService(&mockSavedQueryRepo{})

	_, err := svc.Update(context.Background(), "user-1", "q-1",
		domain.UpdateSavedQueryRequest{Name: "X"})
	assert.Error(t, err)
}

func TestSavedQueryService_Delete_RepoError(t *testing.T) {
	repo := &mockSavedQueryRepo{
		findByIDFunc: func(_ context.Context, id string) (*domain.SavedQuery, error) {
			return &domain.SavedQuery{ID: id, UserID: "user-1"}, nil
		},
		deleteFunc: func(_ context.Context, _ string) error {
			return errors.New("db failure")
		},
	}
	svc := NewSavedQueryService(repo)

	err := svc.Delete(context.Background(), "user-1", "q-1")
	assert.Error(t, err)
}

func TestSavedQueryService_Delete_WrongUser(t *testing.T) {
	repo := &mockSavedQueryRepo{
		findByIDFunc: func(_ context.Context, id string) (*domain.SavedQuery, error) {
			return &domain.SavedQuery{ID: id, UserID: "other-user"}, nil
		},
	}
	svc := NewSavedQueryService(repo)

	err := svc.Delete(context.Background(), "user-1", "q-1")
	assert.ErrorIs(t, err, ErrUnauthorized)
}

func TestSavedQueryService_GetByID_NotFound(t *testing.T) {
	svc := NewSavedQueryService(&mockSavedQueryRepo{})

	_, err := svc.GetByID(context.Background(), "user-1", "q-1")
	assert.Error(t, err)
}
