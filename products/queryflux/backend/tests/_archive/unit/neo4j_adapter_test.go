package nosql_test

import (
	"context"
	"testing"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/nosql"

	"github.com/stretchr/testify/assert"
)

func TestNeo4jAdapter_NewNeo4jAdapter(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Neo4j",
		Type:     entities.TypeNeo4j,
		Host:     "localhost",
		Port:     7687,
		Database: "neo4j",
		Username: "neo4j",
		Password: "password",
	}

	adapter := nosql.NewNeo4jAdapter(conn)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
	assert.False(t, adapter.IsConnected())
}

func TestNeo4jAdapter_Connect_InvalidHost(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Neo4j",
		Type:     entities.TypeNeo4j,
		Host:     "invalid-host",
		Port:     7687,
		Database: "neo4j",
		Username: "neo4j",
		Password: "password",
	}

	adapter := nosql.NewNeo4jAdapter(conn)
	ctx := context.Background()

	err := adapter.Connect(ctx, conn)
	assert.Error(t, err)
	assert.False(t, adapter.IsConnected())
}

func TestNeo4jAdapter_TestConnection_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Neo4j",
		Type:     entities.TypeNeo4j,
		Host:     "localhost",
		Port:     7687,
		Database: "neo4j",
		Username: "neo4j",
		Password: "password",
	}

	adapter := nosql.NewNeo4jAdapter(conn)
	ctx := context.Background()

	err := adapter.TestConnection(ctx)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestNeo4jAdapter_ExecuteQuery_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Neo4j",
		Type:     entities.TypeNeo4j,
		Host:     "localhost",
		Port:     7687,
		Database: "neo4j",
		Username: "neo4j",
		Password: "password",
	}

	adapter := nosql.NewNeo4jAdapter(conn)
	ctx := context.Background()

	result, err := adapter.ExecuteQuery(ctx, "MATCH (n) RETURN n LIMIT 1")
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestNeo4jAdapter_ExecuteQuery_EmptyQuery(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Neo4j",
		Type:     entities.TypeNeo4j,
		Host:     "localhost",
		Port:     7687,
		Database: "neo4j",
		Username: "neo4j",
		Password: "password",
	}

	adapter := nosql.NewNeo4jAdapter(conn)
	ctx := context.Background()

	result, err := adapter.ExecuteQuery(ctx, "")
	assert.Error(t, err)
	assert.Nil(t, result)
	// Note: Connection check happens before query validation
	assert.Contains(t, err.Error(), "Not connected")
}

func TestNeo4jAdapter_GetSchema_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Neo4j",
		Type:     entities.TypeNeo4j,
		Host:     "localhost",
		Port:     7687,
		Database: "neo4j",
		Username: "neo4j",
		Password: "password",
	}

	adapter := nosql.NewNeo4jAdapter(conn)
	ctx := context.Background()

	schema, err := adapter.GetSchema(ctx)
	assert.Error(t, err)
	assert.Nil(t, schema)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestNeo4jAdapter_GetTableInfo_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Neo4j",
		Type:     entities.TypeNeo4j,
		Host:     "localhost",
		Port:     7687,
		Database: "neo4j",
		Username: "neo4j",
		Password: "password",
	}

	adapter := nosql.NewNeo4jAdapter(conn)
	ctx := context.Background()

	tableInfo, err := adapter.GetTableInfo(ctx, "Person")
	assert.Error(t, err)
	assert.Nil(t, tableInfo)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestNeo4jAdapter_Disconnect_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Neo4j",
		Type:     entities.TypeNeo4j,
		Host:     "localhost",
		Port:     7687,
		Database: "neo4j",
		Username: "neo4j",
		Password: "password",
	}

	adapter := nosql.NewNeo4jAdapter(conn)
	ctx := context.Background()

	err := adapter.Disconnect(ctx)
	assert.NoError(t, err)
	assert.False(t, adapter.IsConnected())
}
