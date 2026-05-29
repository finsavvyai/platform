package service

import (
	"context"
	"testing"

	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/internal/port"
	"github.com/queryflux/backend/pkg/logger"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestQueryService_SetPoolManager(t *testing.T) {
	log := logger.New("error")
	svc := NewQueryService(&testMockDB{}, log)
	assert.Nil(t, svc.poolManager)

	pm := NewPoolManager(nil, &testMockDB{}, func(dsn string) (port.DatabasePort, error) {
		return &testMockDB{}, nil
	})
	defer pm.Close()

	svc.SetPoolManager(pm)
	assert.NotNil(t, svc.poolManager)
}

func TestQueryService_Execute_WithPoolManager(t *testing.T) {
	defaultDB := &testMockDB{
		executeQueryFunc: func(_ context.Context, q string) (*domain.QueryResponse, error) {
			return &domain.QueryResponse{SQL: q, ExecutionMs: 1.0, Rows: []map[string]interface{}{{"src": "default"}}}, nil
		},
	}

	connDB := &testMockDB{
		executeQueryFunc: func(_ context.Context, q string) (*domain.QueryResponse, error) {
			return &domain.QueryResponse{SQL: q, ExecutionMs: 2.0, Rows: []map[string]interface{}{{"src": "conn"}}}, nil
		},
	}

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
		return connDB, nil
	}

	pm := NewPoolManager(connSvc, defaultDB, factory)
	defer pm.Close()

	log := logger.New("error")
	svc := NewQueryService(defaultDB, log)
	svc.SetPoolManager(pm)

	t.Run("uses pool manager for specific connection", func(t *testing.T) {
		req := domain.QueryRequest{DatabaseID: "conn-1", SQL: "SELECT 1"}
		result, err := svc.Execute(context.Background(), req, "user-1")
		require.NoError(t, err)
		assert.Equal(t, 2.0, result.ExecutionMs)
	})

	t.Run("uses default when no userID", func(t *testing.T) {
		req := domain.QueryRequest{DatabaseID: "conn-1", SQL: "SELECT 1"}
		result, err := svc.Execute(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, 1.0, result.ExecutionMs)
	})

	t.Run("uses default for empty databaseID", func(t *testing.T) {
		req := domain.QueryRequest{DatabaseID: "", SQL: "SELECT 1"}
		result, err := svc.Execute(context.Background(), req, "user-1")
		require.NoError(t, err)
		assert.Equal(t, 1.0, result.ExecutionMs)
	})
}
