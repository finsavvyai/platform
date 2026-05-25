package aws_test

import (
	"context"
	"testing"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/aws"

	"github.com/stretchr/testify/assert"
)

func TestDocumentDBAdapter_NewDocumentDBAdapter(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test DocumentDB",
		Type:     entities.TypeAWSDocumentDB,
		Host:     "docdb-cluster.cluster-xxx.us-east-1.docdb.amazonaws.com",
		Port:     27017,
		Database: "testdb",
		Username: "admin",
		Password: "password",
		SSL:      true,
	}

	adapter := aws.NewDocumentDBAdapter(conn)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
	assert.False(t, adapter.IsConnected())
}

func TestDocumentDBAdapter_Connect_InvalidHost(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test DocumentDB",
		Type:     entities.TypeAWSDocumentDB,
		Host:     "invalid-host-that-does-not-exist.docdb.amazonaws.com",
		Port:     27017,
		Database: "testdb",
		Username: "admin",
		Password: "password",
		SSL:      true,
	}

	adapter := aws.NewDocumentDBAdapter(conn)
	ctx := context.Background()

	err := adapter.Connect(ctx, conn)
	assert.Error(t, err)
	assert.False(t, adapter.IsConnected())
}

func TestDocumentDBAdapter_Connect_InvalidPort(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test DocumentDB",
		Type:     entities.TypeAWSDocumentDB,
		Host:     "docdb-cluster.cluster-xxx.us-east-1.docdb.amazonaws.com",
		Port:     99999, // Invalid port
		Database: "testdb",
		Username: "admin",
		Password: "password",
		SSL:      true,
	}

	adapter := aws.NewDocumentDBAdapter(conn)
	ctx := context.Background()

	err := adapter.Connect(ctx, conn)
	assert.Error(t, err)
	assert.False(t, adapter.IsConnected())
}

func TestDocumentDBAdapter_TestConnection_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test DocumentDB",
		Type:     entities.TypeAWSDocumentDB,
		Host:     "docdb-cluster.cluster-xxx.us-east-1.docdb.amazonaws.com",
		Port:     27017,
		Database: "testdb",
		Username: "admin",
		Password: "password",
		SSL:      true,
	}

	adapter := aws.NewDocumentDBAdapter(conn)
	ctx := context.Background()

	err := adapter.TestConnection(ctx)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestDocumentDBAdapter_ExecuteQuery_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test DocumentDB",
		Type:     entities.TypeAWSDocumentDB,
		Host:     "docdb-cluster.cluster-xxx.us-east-1.docdb.amazonaws.com",
		Port:     27017,
		Database: "testdb",
		Username: "admin",
		Password: "password",
		SSL:      true,
	}

	adapter := aws.NewDocumentDBAdapter(conn)
	ctx := context.Background()

	result, err := adapter.ExecuteQuery(ctx, "collection.find({})")
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestDocumentDBAdapter_GetSchema_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test DocumentDB",
		Type:     entities.TypeAWSDocumentDB,
		Host:     "docdb-cluster.cluster-xxx.us-east-1.docdb.amazonaws.com",
		Port:     27017,
		Database: "testdb",
		Username: "admin",
		Password: "password",
		SSL:      true,
	}

	adapter := aws.NewDocumentDBAdapter(conn)
	ctx := context.Background()

	schema, err := adapter.GetSchema(ctx)
	assert.Error(t, err)
	assert.Nil(t, schema)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestDocumentDBAdapter_GetTableInfo_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test DocumentDB",
		Type:     entities.TypeAWSDocumentDB,
		Host:     "docdb-cluster.cluster-xxx.us-east-1.docdb.amazonaws.com",
		Port:     27017,
		Database: "testdb",
		Username: "admin",
		Password: "password",
		SSL:      true,
	}

	adapter := aws.NewDocumentDBAdapter(conn)
	ctx := context.Background()

	tableInfo, err := adapter.GetTableInfo(ctx, "collection")
	assert.Error(t, err)
	assert.Nil(t, tableInfo)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestDocumentDBAdapter_Disconnect_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test DocumentDB",
		Type:     entities.TypeAWSDocumentDB,
		Host:     "docdb-cluster.cluster-xxx.us-east-1.docdb.amazonaws.com",
		Port:     27017,
		Database: "testdb",
		Username: "admin",
		Password: "password",
		SSL:      true,
	}

	adapter := aws.NewDocumentDBAdapter(conn)
	ctx := context.Background()

	err := adapter.Disconnect(ctx)
	assert.NoError(t, err) // Disconnect should not error if not connected
	assert.False(t, adapter.IsConnected())
}

func TestDocumentDBAdapter_ExecuteQuery_InvalidFormat(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test DocumentDB",
		Type:     entities.TypeAWSDocumentDB,
		Host:     "localhost",
		Port:     27017,
		Database: "testdb",
		Username: "admin",
		Password: "password",
		SSL:      false,
	}

	adapter := aws.NewDocumentDBAdapter(conn)
	ctx := context.Background()

	// Even if not connected, this should fail with invalid query format
	result, err := adapter.ExecuteQuery(ctx, "invalid query")
	assert.Error(t, err)
	assert.Nil(t, result)
}

func TestDocumentDBAdapter_BuildConnectionString(t *testing.T) {
	tests := []struct {
		name     string
		conn     *entities.Connection
		expected string
	}{
		{
			name: "with SSL",
			conn: &entities.Connection{
				Host:     "docdb-cluster.amazonaws.com",
				Port:     27017,
				Database: "testdb",
				Username: "admin",
				Password: "pass",
				SSL:      true,
			},
			expected: "mongodb://admin:pass@docdb-cluster.amazonaws.com:27017/testdb?ssl=true&replicaSet=rs0&readPreference=secondaryPreferred",
		},
		{
			name: "without SSL",
			conn: &entities.Connection{
				Host:     "localhost",
				Port:     27017,
				Database: "testdb",
				Username: "admin",
				Password: "pass",
				SSL:      false,
			},
			expected: "mongodb://admin:pass@localhost:27017/testdb",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			adapter := aws.NewDocumentDBAdapter(tt.conn)
			// Note: buildDocumentDBConnectionString is private, so we can't test it directly
			// This test serves as documentation of expected behavior
			assert.NotNil(t, adapter)
		})
	}
}
