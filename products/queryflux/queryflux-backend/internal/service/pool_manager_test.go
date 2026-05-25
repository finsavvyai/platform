package service

import (
	"context"
	"errors"
	"testing"

	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/internal/port"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockDBPort struct{}

func (m *mockDBPort) ExecuteQuery(ctx context.Context, q string) (*domain.QueryResponse, error) {
	return &domain.QueryResponse{SQL: q}, nil
}
func (m *mockDBPort) GetSchema(ctx context.Context) (*domain.Schema, error) {
	return &domain.Schema{}, nil
}
func (m *mockDBPort) ValidateQuery(ctx context.Context, q string) error { return nil }
func (m *mockDBPort) Close() error                                      { return nil }
func (m *mockDBPort) Ping(ctx context.Context) error                    { return nil }

func TestPoolManager_DefaultAdapter(t *testing.T) {
	defaultDB := &mockDBPort{}
	factory := func(dsn string) (port.DatabasePort, error) {
		return &mockDBPort{}, nil
	}

	pm := NewPoolManager(nil, defaultDB, factory)
	defer pm.Close()

	adapter, err := pm.GetAdapter(context.Background(), "user-1", "")
	require.NoError(t, err)
	assert.Equal(t, defaultDB, adapter)

	adapter2, err := pm.GetAdapter(context.Background(), "user-1", "default")
	require.NoError(t, err)
	assert.Equal(t, defaultDB, adapter2)
}

func TestPoolManager_CreatePoolForConnection(t *testing.T) {
	defaultDB := &mockDBPort{}
	createdDB := &mockDBPort{}
	factoryCalled := false

	conn := &domain.Connection{
		ID: "conn-1", UserID: "user-1", Name: "Test DB",
		Host: "localhost", Port: 5432, Database: "testdb",
		Username: "user", SSLMode: "disable",
	}

	connSvc := NewConnectionService(&mockConnRepo{
		findByIDFunc: func(_ context.Context, id string) (*domain.Connection, error) {
			if id == "conn-1" {
				return conn, nil
			}
			return nil, errors.New("not found")
		},
	}, "test-encryption-key-32bytes!!")

	encrypted, _ := connSvc.encryptPassword("password")
	conn.EncryptedPassword = encrypted

	factory := func(dsn string) (port.DatabasePort, error) {
		factoryCalled = true
		return createdDB, nil
	}

	pm := NewPoolManager(connSvc, defaultDB, factory)
	defer pm.Close()

	adapter, err := pm.GetAdapter(context.Background(), "user-1", "conn-1")
	require.NoError(t, err)
	assert.Equal(t, createdDB, adapter)
	assert.True(t, factoryCalled)
}

func TestPoolManager_CachesPool(t *testing.T) {
	defaultDB := &mockDBPort{}
	callCount := 0

	conn := &domain.Connection{
		ID: "conn-1", UserID: "user-1", Name: "Cached DB",
		Host: "localhost", Port: 5432, Database: "testdb",
		Username: "user", SSLMode: "disable",
	}

	connSvc := NewConnectionService(&mockConnRepo{
		findByIDFunc: func(_ context.Context, id string) (*domain.Connection, error) {
			return conn, nil
		},
	}, "test-encryption-key-32bytes!!")

	encrypted, _ := connSvc.encryptPassword("password")
	conn.EncryptedPassword = encrypted

	factory := func(dsn string) (port.DatabasePort, error) {
		callCount++
		return &mockDBPort{}, nil
	}

	pm := NewPoolManager(connSvc, defaultDB, factory)
	defer pm.Close()

	pm.GetAdapter(context.Background(), "user-1", "conn-1")
	pm.GetAdapter(context.Background(), "user-1", "conn-1")

	assert.Equal(t, 1, callCount, "factory should only be called once due to caching")
}

func TestPoolManager_ConnectionNotFound(t *testing.T) {
	defaultDB := &mockDBPort{}
	connSvc := NewConnectionService(&mockConnRepo{}, "test-key-32bytes!!")

	factory := func(dsn string) (port.DatabasePort, error) {
		return &mockDBPort{}, nil
	}

	pm := NewPoolManager(connSvc, defaultDB, factory)
	defer pm.Close()

	_, err := pm.GetAdapter(context.Background(), "user-1", "nonexistent")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestPoolManager_Close(t *testing.T) {
	defaultDB := &mockDBPort{}

	conn := &domain.Connection{
		ID: "conn-1", UserID: "user-1",
		Host: "localhost", Port: 5432, Database: "testdb",
		Username: "user", SSLMode: "disable",
	}

	connSvc := NewConnectionService(&mockConnRepo{
		findByIDFunc: func(_ context.Context, id string) (*domain.Connection, error) {
			return conn, nil
		},
	}, "test-encryption-key-32bytes!!")

	encrypted, _ := connSvc.encryptPassword("password")
	conn.EncryptedPassword = encrypted

	factory := func(dsn string) (port.DatabasePort, error) {
		return &mockDBPort{}, nil
	}

	pm := NewPoolManager(connSvc, defaultDB, factory)

	pm.GetAdapter(context.Background(), "user-1", "conn-1")

	pm.Close()

	pm.mu.RLock()
	defer pm.mu.RUnlock()
	assert.Empty(t, pm.pools)
}
