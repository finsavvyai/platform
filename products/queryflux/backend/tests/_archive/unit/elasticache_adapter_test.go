package aws_test

import (
	"context"
	"testing"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/aws"

	"github.com/stretchr/testify/assert"
)

func TestElastiCacheAdapter_NewElastiCacheAdapter(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test ElastiCache",
		Type:     entities.TypeAWSElastiCache,
		Host:     "my-cluster.abc123.0001.use1.cache.amazonaws.com",
		Port:     6379,
		Database: "0",
		Password: "auth-token",
		SSL:      true,
	}

	adapter := aws.NewElastiCacheAdapter(conn)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
	assert.False(t, adapter.IsConnected())
}

func TestElastiCacheAdapter_Connect_InvalidHost(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test ElastiCache",
		Type:     entities.TypeAWSElastiCache,
		Host:     "invalid-host-that-does-not-exist.cache.amazonaws.com",
		Port:     6379,
		Database: "0",
		Password: "auth-token",
		SSL:      true,
	}

	adapter := aws.NewElastiCacheAdapter(conn)
	ctx := context.Background()

	err := adapter.Connect(ctx, conn)
	assert.Error(t, err)
	assert.False(t, adapter.IsConnected())
}

func TestElastiCacheAdapter_Connect_InvalidPort(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test ElastiCache",
		Type:     entities.TypeAWSElastiCache,
		Host:     "my-cluster.abc123.0001.use1.cache.amazonaws.com",
		Port:     99999, // Invalid port
		Database: "0",
		Password: "auth-token",
		SSL:      true,
	}

	adapter := aws.NewElastiCacheAdapter(conn)
	ctx := context.Background()

	err := adapter.Connect(ctx, conn)
	assert.Error(t, err)
	assert.False(t, adapter.IsConnected())
}

func TestElastiCacheAdapter_TestConnection_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test ElastiCache",
		Type:     entities.TypeAWSElastiCache,
		Host:     "my-cluster.abc123.0001.use1.cache.amazonaws.com",
		Port:     6379,
		Database: "0",
		Password: "auth-token",
		SSL:      true,
	}

	adapter := aws.NewElastiCacheAdapter(conn)
	ctx := context.Background()

	err := adapter.TestConnection(ctx)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestElastiCacheAdapter_ExecuteQuery_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test ElastiCache",
		Type:     entities.TypeAWSElastiCache,
		Host:     "my-cluster.abc123.0001.use1.cache.amazonaws.com",
		Port:     6379,
		Database: "0",
		Password: "auth-token",
		SSL:      true,
	}

	adapter := aws.NewElastiCacheAdapter(conn)
	ctx := context.Background()

	result, err := adapter.ExecuteQuery(ctx, "PING")
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestElastiCacheAdapter_GetSchema_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test ElastiCache",
		Type:     entities.TypeAWSElastiCache,
		Host:     "my-cluster.abc123.0001.use1.cache.amazonaws.com",
		Port:     6379,
		Database: "0",
		Password: "auth-token",
		SSL:      true,
	}

	adapter := aws.NewElastiCacheAdapter(conn)
	ctx := context.Background()

	schema, err := adapter.GetSchema(ctx)
	assert.Error(t, err)
	assert.Nil(t, schema)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestElastiCacheAdapter_GetTableInfo_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test ElastiCache",
		Type:     entities.TypeAWSElastiCache,
		Host:     "my-cluster.abc123.0001.use1.cache.amazonaws.com",
		Port:     6379,
		Database: "0",
		Password: "auth-token",
		SSL:      true,
	}

	adapter := aws.NewElastiCacheAdapter(conn)
	ctx := context.Background()

	tableInfo, err := adapter.GetTableInfo(ctx, "db0")
	assert.Error(t, err)
	assert.Nil(t, tableInfo)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestElastiCacheAdapter_Disconnect_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test ElastiCache",
		Type:     entities.TypeAWSElastiCache,
		Host:     "my-cluster.abc123.0001.use1.cache.amazonaws.com",
		Port:     6379,
		Database: "0",
		Password: "auth-token",
		SSL:      true,
	}

	adapter := aws.NewElastiCacheAdapter(conn)
	ctx := context.Background()

	err := adapter.Disconnect(ctx)
	assert.NoError(t, err) // Disconnect should not error if not connected
	assert.False(t, adapter.IsConnected())
}

func TestElastiCacheAdapter_ExecuteQuery_EmptyCommand(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test ElastiCache",
		Type:     entities.TypeAWSElastiCache,
		Host:     "localhost",
		Port:     6379,
		Database: "0",
		SSL:      false,
	}

	adapter := aws.NewElastiCacheAdapter(conn)
	ctx := context.Background()

	// Even if not connected, this should fail with empty query
	result, err := adapter.ExecuteQuery(ctx, "")
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "Query cannot be empty")
}

func TestElastiCacheAdapter_ClusterMode(t *testing.T) {
	tests := []struct {
		name        string
		options     map[string]string
		expectCluster bool
	}{
		{
			name: "cluster mode enabled",
			options: map[string]string{
				"cluster_mode": "enabled",
			},
			expectCluster: true,
		},
		{
			name: "cluster mode true",
			options: map[string]string{
				"cluster_mode": "true",
			},
			expectCluster: true,
		},
		{
			name: "cluster mode disabled",
			options: map[string]string{
				"cluster_mode": "disabled",
			},
			expectCluster: false,
		},
		{
			name:          "no cluster mode option",
			options:       map[string]string{},
			expectCluster: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			conn := &entities.Connection{
				Host:    "localhost",
				Port:    6379,
				Options: tt.options,
			}
			adapter := aws.NewElastiCacheAdapter(conn)
			assert.NotNil(t, adapter)
			// Note: isClusterMode is private, so we can't test it directly
			// This test serves as documentation of expected behavior
		})
	}
}
