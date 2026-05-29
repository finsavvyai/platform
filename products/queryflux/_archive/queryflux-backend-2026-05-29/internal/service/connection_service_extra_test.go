package service

import (
	"context"
	"errors"
	"testing"

	"github.com/queryflux/backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConnectionService_Create_WithSSL(t *testing.T) {
	svc := NewConnectionService(&mockConnRepo{}, "test-encryption-key-32bytes!!")

	req := domain.CreateConnectionRequest{
		Name: "SSL DB", Type: "postgres", Host: "localhost",
		Port: 5432, Database: "testdb", Username: "user",
		Password: "pass", SSL: true,
	}

	conn, err := svc.Create(context.Background(), "user-1", req)
	require.NoError(t, err)
	assert.Equal(t, "require", conn.SSLMode)
}

func TestConnectionService_Create_RepoError(t *testing.T) {
	repo := &mockConnRepo{
		createFunc: func(_ context.Context, _ *domain.Connection) error {
			return errors.New("db write failure")
		},
	}
	svc := NewConnectionService(repo, "test-encryption-key-32bytes!!")

	req := domain.CreateConnectionRequest{
		Name: "DB", Type: "postgres", Host: "h", Port: 5432,
		Database: "d", Username: "u", Password: "p",
	}

	_, err := svc.Create(context.Background(), "user-1", req)
	assert.Error(t, err)
}

func TestConnectionService_Update_AllFields(t *testing.T) {
	stored := &domain.Connection{
		ID: "c-1", UserID: "user-1", Name: "Old",
		Host: "old", Port: 5432, Database: "old_db",
		Username: "old_user", SSLMode: "disable",
	}

	repo := &mockConnRepo{
		findByIDFunc: func(_ context.Context, _ string) (*domain.Connection, error) {
			return stored, nil
		},
	}
	svc := NewConnectionService(repo, "test-encryption-key-32bytes!!")

	sslTrue := true
	req := domain.UpdateConnectionRequest{
		Name: "New", Host: "new", Port: 5433, Database: "new_db",
		Username: "new_user", Password: "new_pass", SSL: &sslTrue,
	}

	conn, err := svc.Update(context.Background(), "user-1", "c-1", req)
	require.NoError(t, err)
	assert.Equal(t, "New", conn.Name)
	assert.Equal(t, "new", conn.Host)
	assert.Equal(t, 5433, conn.Port)
	assert.Equal(t, "new_db", conn.Database)
	assert.Equal(t, "new_user", conn.Username)
	assert.Equal(t, "require", conn.SSLMode)
	assert.NotEmpty(t, conn.EncryptedPassword)
}

func TestConnectionService_Update_SSLFalse(t *testing.T) {
	stored := &domain.Connection{
		ID: "c-1", UserID: "user-1", SSLMode: "require",
	}

	repo := &mockConnRepo{
		findByIDFunc: func(_ context.Context, _ string) (*domain.Connection, error) {
			return stored, nil
		},
	}
	svc := NewConnectionService(repo, "test-encryption-key-32bytes!!")

	sslFalse := false
	req := domain.UpdateConnectionRequest{SSL: &sslFalse}
	conn, err := svc.Update(context.Background(), "user-1", "c-1", req)

	require.NoError(t, err)
	assert.Equal(t, "disable", conn.SSLMode)
}

func TestConnectionService_Update_RepoError(t *testing.T) {
	repo := &mockConnRepo{
		findByIDFunc: func(_ context.Context, _ string) (*domain.Connection, error) {
			return &domain.Connection{ID: "c-1", UserID: "user-1"}, nil
		},
		updateFunc: func(_ context.Context, _ *domain.Connection) error {
			return errors.New("update failure")
		},
	}
	svc := NewConnectionService(repo, "test-encryption-key-32bytes!!")

	_, err := svc.Update(context.Background(), "user-1", "c-1",
		domain.UpdateConnectionRequest{Name: "X"})
	assert.Error(t, err)
}

func TestConnectionService_Update_NotFound(t *testing.T) {
	svc := NewConnectionService(&mockConnRepo{}, "test-encryption-key-32bytes!!")

	_, err := svc.Update(context.Background(), "user-1", "c-1",
		domain.UpdateConnectionRequest{Name: "X"})
	assert.Error(t, err)
}

func TestConnectionService_DecryptPassword_InvalidBase64(t *testing.T) {
	svc := NewConnectionService(&mockConnRepo{}, "test-encryption-key-32bytes!!")

	_, err := svc.DecryptPassword("not-valid-base64!!!")
	assert.Error(t, err)
}

func TestConnectionService_DecryptPassword_TooShort(t *testing.T) {
	svc := NewConnectionService(&mockConnRepo{}, "test-encryption-key-32bytes!!")

	_, err := svc.DecryptPassword("YWJj") // base64 of "abc" — too short for GCM
	assert.Error(t, err)
}

func TestConnectionService_NewWithShortKey(t *testing.T) {
	svc := NewConnectionService(&mockConnRepo{}, "short")

	// Should still work — key gets padded to 32 bytes
	req := domain.CreateConnectionRequest{
		Name: "DB", Type: "postgres", Host: "h", Port: 5432,
		Database: "d", Username: "u", Password: "p",
	}
	conn, err := svc.Create(context.Background(), "user-1", req)
	require.NoError(t, err)
	assert.NotEmpty(t, conn.EncryptedPassword)

	decrypted, err := svc.DecryptPassword(conn.EncryptedPassword)
	require.NoError(t, err)
	assert.Equal(t, "p", decrypted)
}
