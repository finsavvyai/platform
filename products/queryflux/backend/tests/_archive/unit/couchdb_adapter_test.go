package nosql_test

import (
	"context"
	"testing"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/nosql"

	"github.com/stretchr/testify/assert"
)

func TestCouchDBAdapter_NewCouchDBAdapter(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test CouchDB",
		Type:     entities.TypeCouchDB,
		Host:     "localhost",
		Port:     5984,
		Database: "testdb",
		Username: "admin",
		Password: "admin",
	}

	adapter := nosql.NewCouchDBAdapter(conn)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
	assert.False(t, adapter.IsConnected())
}

func TestCouchDBAdapter_Connect_InvalidHost(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test CouchDB",
		Type:     entities.TypeCouchDB,
		Host:     "invalid-host-that-does-not-exist",
		Port:     5984,
		Database: "testdb",
		Username: "admin",
		Password: "admin",
	}

	adapter := nosql.NewCouchDBAdapter(conn)
	ctx := context.Background()

	err := adapter.Connect(ctx, conn)
	assert.Error(t, err)
	assert.False(t, adapter.IsConnected())
}

func TestCouchDBAdapter_Connect_InvalidPort(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test CouchDB",
		Type:     entities.TypeCouchDB,
		Host:     "localhost",
		Port:     99999, // Invalid port
		Database: "testdb",
		Username: "admin",
		Password: "admin",
	}

	adapter := nosql.NewCouchDBAdapter(conn)
	ctx := context.Background()

	err := adapter.Connect(ctx, conn)
	assert.Error(t, err)
	assert.False(t, adapter.IsConnected())
}

func TestCouchDBAdapter_TestConnection_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test CouchDB",
		Type:     entities.TypeCouchDB,
		Host:     "localhost",
		Port:     5984,
		Database: "testdb",
		Username: "admin",
		Password: "admin",
	}

	adapter := nosql.NewCouchDBAdapter(conn)
	ctx := context.Background()

	err := adapter.TestConnection(ctx)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestCouchDBAdapter_ExecuteQuery_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test CouchDB",
		Type:     entities.TypeCouchDB,
		Host:     "localhost",
		Port:     5984,
		Database: "testdb",
		Username: "admin",
		Password: "admin",
	}

	adapter := nosql.NewCouchDBAdapter(conn)
	ctx := context.Background()

	result, err := adapter.ExecuteQuery(ctx, "testdb/_all_docs")
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestCouchDBAdapter_GetSchema_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test CouchDB",
		Type:     entities.TypeCouchDB,
		Host:     "localhost",
		Port:     5984,
		Database: "testdb",
		Username: "admin",
		Password: "admin",
	}

	adapter := nosql.NewCouchDBAdapter(conn)
	ctx := context.Background()

	schema, err := adapter.GetSchema(ctx)
	assert.Error(t, err)
	assert.Nil(t, schema)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestCouchDBAdapter_GetTableInfo_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test CouchDB",
		Type:     entities.TypeCouchDB,
		Host:     "localhost",
		Port:     5984,
		Database: "testdb",
		Username: "admin",
		Password: "admin",
	}

	adapter := nosql.NewCouchDBAdapter(conn)
	ctx := context.Background()

	tableInfo, err := adapter.GetTableInfo(ctx, "testdb")
	assert.Error(t, err)
	assert.Nil(t, tableInfo)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestCouchDBAdapter_Disconnect_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test CouchDB",
		Type:     entities.TypeCouchDB,
		Host:     "localhost",
		Port:     5984,
		Database: "testdb",
		Username: "admin",
		Password: "admin",
	}

	adapter := nosql.NewCouchDBAdapter(conn)
	ctx := context.Background()

	err := adapter.Disconnect(ctx)
	assert.NoError(t, err) // Disconnect should not error if not connected
	assert.False(t, adapter.IsConnected())
}

func TestCouchDBAdapter_ExecuteQuery_InvalidFormat(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test CouchDB",
		Type:     entities.TypeCouchDB,
		Host:     "localhost",
		Port:     5984,
		Database: "testdb",
		Username: "admin",
		Password: "admin",
		SSL:      false,
	}

	adapter := nosql.NewCouchDBAdapter(conn)
	ctx := context.Background()

	// Simulate connection by setting baseURL (this won't actually connect)
	err := adapter.Connect(ctx, conn)
	if err == nil {
		// Only test if connection succeeded (e.g., if CouchDB is actually running)
		result, err := adapter.ExecuteQuery(ctx, "")
		assert.Error(t, err)
		assert.Nil(t, result)
		adapter.Disconnect(ctx)
	}
}
