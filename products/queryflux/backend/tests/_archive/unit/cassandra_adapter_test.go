package nosql_test

import (
	"context"
	"testing"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/nosql"

	"github.com/stretchr/testify/assert"
)

func TestCassandraAdapter_NewCassandraAdapter(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Cassandra",
		Type:     entities.TypeCassandra,
		Host:     "localhost",
		Port:     9042,
		Database: "test_keyspace",
		Username: "cassandra",
		Password: "cassandra",
	}

	adapter := nosql.NewCassandraAdapter(conn)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
	assert.False(t, adapter.IsConnected())
}

func TestCassandraAdapter_Connect_InvalidHost(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Cassandra",
		Type:     entities.TypeCassandra,
		Host:     "invalid-host",
		Port:     9042,
		Database: "test_keyspace",
		Username: "cassandra",
		Password: "cassandra",
	}

	adapter := nosql.NewCassandraAdapter(conn)
	ctx := context.Background()

	err := adapter.Connect(ctx, conn)
	assert.Error(t, err)
	assert.False(t, adapter.IsConnected())
}

func TestCassandraAdapter_TestConnection_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Cassandra",
		Type:     entities.TypeCassandra,
		Host:     "localhost",
		Port:     9042,
		Database: "test_keyspace",
		Username: "cassandra",
		Password: "cassandra",
	}

	adapter := nosql.NewCassandraAdapter(conn)
	ctx := context.Background()

	err := adapter.TestConnection(ctx)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestCassandraAdapter_ExecuteQuery_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Cassandra",
		Type:     entities.TypeCassandra,
		Host:     "localhost",
		Port:     9042,
		Database: "test_keyspace",
		Username: "cassandra",
		Password: "cassandra",
	}

	adapter := nosql.NewCassandraAdapter(conn)
	ctx := context.Background()

	result, err := adapter.ExecuteQuery(ctx, "SELECT * FROM system.local")
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestCassandraAdapter_ExecuteQuery_EmptyQuery(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Cassandra",
		Type:     entities.TypeCassandra,
		Host:     "localhost",
		Port:     9042,
		Database: "test_keyspace",
		Username: "cassandra",
		Password: "cassandra",
	}

	adapter := nosql.NewCassandraAdapter(conn)
	ctx := context.Background()

	result, err := adapter.ExecuteQuery(ctx, "")
	assert.Error(t, err)
	assert.Nil(t, result)
	// Note: Connection check happens before query validation
	assert.Contains(t, err.Error(), "Not connected")
}

func TestCassandraAdapter_GetSchema_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Cassandra",
		Type:     entities.TypeCassandra,
		Host:     "localhost",
		Port:     9042,
		Database: "test_keyspace",
		Username: "cassandra",
		Password: "cassandra",
	}

	adapter := nosql.NewCassandraAdapter(conn)
	ctx := context.Background()

	schema, err := adapter.GetSchema(ctx)
	assert.Error(t, err)
	assert.Nil(t, schema)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestCassandraAdapter_GetTableInfo_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Cassandra",
		Type:     entities.TypeCassandra,
		Host:     "localhost",
		Port:     9042,
		Database: "test_keyspace",
		Username: "cassandra",
		Password: "cassandra",
	}

	adapter := nosql.NewCassandraAdapter(conn)
	ctx := context.Background()

	tableInfo, err := adapter.GetTableInfo(ctx, "test_table")
	assert.Error(t, err)
	assert.Nil(t, tableInfo)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestCassandraAdapter_Disconnect_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Cassandra",
		Type:     entities.TypeCassandra,
		Host:     "localhost",
		Port:     9042,
		Database: "test_keyspace",
		Username: "cassandra",
		Password: "cassandra",
	}

	adapter := nosql.NewCassandraAdapter(conn)
	ctx := context.Background()

	err := adapter.Disconnect(ctx)
	assert.NoError(t, err)
	assert.False(t, adapter.IsConnected())
}

// Integration tests would require a running Cassandra instance
// These tests focus on the adapter logic without external dependencies
