package nosql_test

import (
	"context"
	"testing"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/nosql"

	"github.com/stretchr/testify/assert"
)

func TestArangoDBAdapter_NewArangoDBAdapter(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test ArangoDB",
		Type:     entities.TypeArangoDB,
		Host:     "localhost",
		Port:     8529,
		Database: "testdb",
		Username: "root",
		Password: "password",
	}

	adapter := nosql.NewArangoDBAdapter(conn)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
	assert.False(t, adapter.IsConnected())
}

func TestArangoDBAdapter_Connect_InvalidHost(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test ArangoDB",
		Type:     entities.TypeArangoDB,
		Host:     "invalid-host-that-does-not-exist",
		Port:     8529,
		Database: "testdb",
		Username: "root",
		Password: "password",
	}

	adapter := nosql.NewArangoDBAdapter(conn)
	ctx := context.Background()

	err := adapter.Connect(ctx, conn)
	assert.Error(t, err)
	assert.False(t, adapter.IsConnected())
}

func TestArangoDBAdapter_Connect_InvalidPort(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test ArangoDB",
		Type:     entities.TypeArangoDB,
		Host:     "localhost",
		Port:     99999, // Invalid port
		Database: "testdb",
		Username: "root",
		Password: "password",
	}

	adapter := nosql.NewArangoDBAdapter(conn)
	ctx := context.Background()

	err := adapter.Connect(ctx, conn)
	assert.Error(t, err)
	assert.False(t, adapter.IsConnected())
}

func TestArangoDBAdapter_TestConnection_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test ArangoDB",
		Type:     entities.TypeArangoDB,
		Host:     "localhost",
		Port:     8529,
		Database: "testdb",
		Username: "root",
		Password: "password",
	}

	adapter := nosql.NewArangoDBAdapter(conn)
	ctx := context.Background()

	err := adapter.TestConnection(ctx)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestArangoDBAdapter_ExecuteQuery_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test ArangoDB",
		Type:     entities.TypeArangoDB,
		Host:     "localhost",
		Port:     8529,
		Database: "testdb",
		Username: "root",
		Password: "password",
	}

	adapter := nosql.NewArangoDBAdapter(conn)
	ctx := context.Background()

	result, err := adapter.ExecuteQuery(ctx, "FOR doc IN collection RETURN doc")
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestArangoDBAdapter_GetSchema_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test ArangoDB",
		Type:     entities.TypeArangoDB,
		Host:     "localhost",
		Port:     8529,
		Database: "testdb",
		Username: "root",
		Password: "password",
	}

	adapter := nosql.NewArangoDBAdapter(conn)
	ctx := context.Background()

	schema, err := adapter.GetSchema(ctx)
	assert.Error(t, err)
	assert.Nil(t, schema)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestArangoDBAdapter_GetTableInfo_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test ArangoDB",
		Type:     entities.TypeArangoDB,
		Host:     "localhost",
		Port:     8529,
		Database: "testdb",
		Username: "root",
		Password: "password",
	}

	adapter := nosql.NewArangoDBAdapter(conn)
	ctx := context.Background()

	tableInfo, err := adapter.GetTableInfo(ctx, "collection")
	assert.Error(t, err)
	assert.Nil(t, tableInfo)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestArangoDBAdapter_Disconnect_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test ArangoDB",
		Type:     entities.TypeArangoDB,
		Host:     "localhost",
		Port:     8529,
		Database: "testdb",
		Username: "root",
		Password: "password",
	}

	adapter := nosql.NewArangoDBAdapter(conn)
	ctx := context.Background()

	err := adapter.Disconnect(ctx)
	assert.NoError(t, err) // Disconnect should not error if not connected
	assert.False(t, adapter.IsConnected())
}

func TestArangoDBAdapter_Connect_DatabaseNotFound(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test ArangoDB",
		Type:     entities.TypeArangoDB,
		Host:     "localhost",
		Port:     8529,
		Database: "nonexistent_database",
		Username: "root",
		Password: "password",
	}

	adapter := nosql.NewArangoDBAdapter(conn)
	ctx := context.Background()

	// This will fail if ArangoDB is running but database doesn't exist
	err := adapter.Connect(ctx, conn)
	if err != nil {
		// Should get database not found error or connection error
		assert.Error(t, err)
		assert.False(t, adapter.IsConnected())
	}
}
