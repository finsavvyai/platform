package cache_test

import (
	"context"
	"testing"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/cache"

	"github.com/stretchr/testify/assert"
)

func TestMemcachedAdapter_NewMemcachedAdapter(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Memcached",
		Type:     entities.TypeMemcached,
		Host:     "localhost",
		Port:     11211,
		Database: "",
		Username: "",
		Password: "",
	}

	adapter := cache.NewMemcachedAdapter(conn)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
	assert.False(t, adapter.IsConnected())
}

func TestMemcachedAdapter_Connect_InvalidHost(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Memcached",
		Type:     entities.TypeMemcached,
		Host:     "invalid-host",
		Port:     11211,
		Database: "",
		Username: "",
		Password: "",
	}

	adapter := cache.NewMemcachedAdapter(conn)
	ctx := context.Background()

	err := adapter.Connect(ctx, conn)
	assert.Error(t, err)
	assert.False(t, adapter.IsConnected())
}

func TestMemcachedAdapter_TestConnection_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Memcached",
		Type:     entities.TypeMemcached,
		Host:     "localhost",
		Port:     11211,
		Database: "",
		Username: "",
		Password: "",
	}

	adapter := cache.NewMemcachedAdapter(conn)
	ctx := context.Background()

	err := adapter.TestConnection(ctx)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestMemcachedAdapter_ExecuteQuery_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Memcached",
		Type:     entities.TypeMemcached,
		Host:     "localhost",
		Port:     11211,
		Database: "",
		Username: "",
		Password: "",
	}

	adapter := cache.NewMemcachedAdapter(conn)
	ctx := context.Background()

	result, err := adapter.ExecuteQuery(ctx, "GET test_key")
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestMemcachedAdapter_ExecuteQuery_EmptyQuery(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Memcached",
		Type:     entities.TypeMemcached,
		Host:     "localhost",
		Port:     11211,
		Database: "",
		Username: "",
		Password: "",
	}

	adapter := cache.NewMemcachedAdapter(conn)
	ctx := context.Background()

	result, err := adapter.ExecuteQuery(ctx, "")
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "Query cannot be empty")
}

func TestMemcachedAdapter_GetSchema_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Memcached",
		Type:     entities.TypeMemcached,
		Host:     "localhost",
		Port:     11211,
		Database: "",
		Username: "",
		Password: "",
	}

	adapter := cache.NewMemcachedAdapter(conn)
	ctx := context.Background()

	schema, err := adapter.GetSchema(ctx)
	assert.Error(t, err)
	assert.Nil(t, schema)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestMemcachedAdapter_GetTableInfo_Stats(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Memcached",
		Type:     entities.TypeMemcached,
		Host:     "localhost",
		Port:     11211,
		Database: "",
		Username: "",
		Password: "",
	}

	adapter := cache.NewMemcachedAdapter(conn)
	ctx := context.Background()

	tableInfo, err := adapter.GetTableInfo(ctx, "stats")
	assert.NoError(t, err)
	assert.NotNil(t, tableInfo)
	assert.Equal(t, "stats", tableInfo.Name)
	assert.Equal(t, "memcached", tableInfo.Schema)
	assert.Len(t, tableInfo.Columns, 2)
}

func TestMemcachedAdapter_GetTableInfo_Items(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Memcached",
		Type:     entities.TypeMemcached,
		Host:     "localhost",
		Port:     11211,
		Database: "",
		Username: "",
		Password: "",
	}

	adapter := cache.NewMemcachedAdapter(conn)
	ctx := context.Background()

	tableInfo, err := adapter.GetTableInfo(ctx, "items")
	assert.NoError(t, err)
	assert.NotNil(t, tableInfo)
	assert.Equal(t, "items", tableInfo.Name)
	assert.Equal(t, "memcached", tableInfo.Schema)
	assert.Len(t, tableInfo.Columns, 4)
}

func TestMemcachedAdapter_GetTableInfo_InvalidTable(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Memcached",
		Type:     entities.TypeMemcached,
		Host:     "localhost",
		Port:     11211,
		Database: "",
		Username: "",
		Password: "",
	}

	adapter := cache.NewMemcachedAdapter(conn)
	ctx := context.Background()

	tableInfo, err := adapter.GetTableInfo(ctx, "invalid_table")
	assert.Error(t, err)
	assert.Nil(t, tableInfo)
	assert.Contains(t, err.Error(), "Table invalid_table not found")
}

func TestMemcachedAdapter_Disconnect_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Memcached",
		Type:     entities.TypeMemcached,
		Host:     "localhost",
		Port:     11211,
		Database: "",
		Username: "",
		Password: "",
	}

	adapter := cache.NewMemcachedAdapter(conn)
	ctx := context.Background()

	err := adapter.Disconnect(ctx)
	assert.NoError(t, err)
	assert.False(t, adapter.IsConnected())
}