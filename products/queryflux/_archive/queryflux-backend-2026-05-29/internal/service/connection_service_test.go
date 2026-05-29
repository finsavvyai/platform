package service

import (
	"context"
	"errors"
	"testing"

	"github.com/queryflux/backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

func TestConnectionService_Create(t *testing.T) {
	repo := &mockConnRepo{}
	svc := NewConnectionService(repo, "test-encryption-key-32bytes!!")

	req := domain.CreateConnectionRequest{
		Name: "My DB", Type: "postgres", Host: "localhost",
		Port: 5432, Database: "testdb", Username: "user", Password: "pass",
	}

	conn, err := svc.Create(context.Background(), "user-1", req)

	require.NoError(t, err)
	assert.Equal(t, "My DB", conn.Name)
	assert.Equal(t, "user-1", conn.UserID)
	assert.NotEmpty(t, conn.EncryptedPassword)
	assert.NotEqual(t, "pass", conn.EncryptedPassword)
}

func TestConnectionService_GetByID_OwnershipCheck(t *testing.T) {
	repo := &mockConnRepo{
		findByIDFunc: func(_ context.Context, id string) (*domain.Connection, error) {
			return &domain.Connection{ID: id, UserID: "user-1", Name: "Test"}, nil
		},
	}
	svc := NewConnectionService(repo, "test-key-32bytes-long-enough!!")

	conn, err := svc.GetByID(context.Background(), "user-1", "conn-1")
	require.NoError(t, err)
	assert.Equal(t, "Test", conn.Name)

	_, err = svc.GetByID(context.Background(), "user-2", "conn-1")
	assert.Equal(t, ErrUnauthorized, err)
}

func TestConnectionService_EncryptDecrypt(t *testing.T) {
	svc := NewConnectionService(&mockConnRepo{}, "test-encryption-key-32bytes!!")

	password := "super-secret-password"
	encrypted, err := svc.encryptPassword(password)
	require.NoError(t, err)
	assert.NotEqual(t, password, encrypted)

	decrypted, err := svc.DecryptPassword(encrypted)
	require.NoError(t, err)
	assert.Equal(t, password, decrypted)
}

func TestConnectionService_Update(t *testing.T) {
	stored := &domain.Connection{
		ID: "conn-1", UserID: "user-1", Name: "Old Name",
		Host: "old-host", Port: 5432,
	}

	repo := &mockConnRepo{
		findByIDFunc: func(_ context.Context, id string) (*domain.Connection, error) {
			return stored, nil
		},
	}
	svc := NewConnectionService(repo, "test-key-32bytes-long-enough!!")

	req := domain.UpdateConnectionRequest{Name: "New Name", Host: "new-host"}
	conn, err := svc.Update(context.Background(), "user-1", "conn-1", req)

	require.NoError(t, err)
	assert.Equal(t, "New Name", conn.Name)
	assert.Equal(t, "new-host", conn.Host)
}

func TestConnectionService_Delete(t *testing.T) {
	deleted := false
	repo := &mockConnRepo{
		findByIDFunc: func(_ context.Context, id string) (*domain.Connection, error) {
			return &domain.Connection{ID: id, UserID: "user-1"}, nil
		},
		deleteFunc: func(_ context.Context, id string) error {
			deleted = true
			return nil
		},
	}
	svc := NewConnectionService(repo, "test-key-32bytes-long-enough!!")

	err := svc.Delete(context.Background(), "user-1", "conn-1")

	require.NoError(t, err)
	assert.True(t, deleted)
}

func TestConnectionService_Delete_WrongUser(t *testing.T) {
	repo := &mockConnRepo{
		findByIDFunc: func(_ context.Context, id string) (*domain.Connection, error) {
			return &domain.Connection{ID: id, UserID: "user-1"}, nil
		},
	}
	svc := NewConnectionService(repo, "test-key-32bytes-long-enough!!")

	err := svc.Delete(context.Background(), "user-2", "conn-1")
	assert.Equal(t, ErrUnauthorized, err)
}

func TestConnectionService_ListByUser(t *testing.T) {
	repo := &mockConnRepo{
		findByUserFunc: func(_ context.Context, userID string) ([]domain.Connection, error) {
			return []domain.Connection{
				{ID: "conn-1", UserID: userID, Name: "DB 1"},
				{ID: "conn-2", UserID: userID, Name: "DB 2"},
			}, nil
		},
	}
	svc := NewConnectionService(repo, "test-key-32bytes-long-enough!!")

	conns, err := svc.ListByUser(context.Background(), "user-1")

	require.NoError(t, err)
	assert.Len(t, conns, 2)
}
