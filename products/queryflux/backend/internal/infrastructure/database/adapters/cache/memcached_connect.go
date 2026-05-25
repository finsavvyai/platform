package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/bradfitz/gomemcache/memcache"
)

// Connect establishes a connection to Memcached using bradfitz/gomemcache.
func (m *MemcachedAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if m.client != nil {
		return nil // Already connected
	}

	m.conn = conn

	server := fmt.Sprintf("%s:%d", conn.Host, conn.Port)
	client := memcache.New(server)

	if timeout := conn.Options["timeout"]; timeout != "" {
		if duration, err := time.ParseDuration(timeout); err == nil {
			client.Timeout = duration
		}
	} else {
		client.Timeout = 100 * time.Millisecond
	}

	if err := client.Ping(); err != nil {
		return memcachedAdapterError("CONNECTION_TEST_FAILED",
			"Failed to connect to Memcached", ctx, err)
	}

	m.client = client
	m.logger.Infof("Connected to Memcached: %s", conn.Name)
	return nil
}

// Disconnect closes the Memcached connection. gomemcache has no explicit Close
// so we simply drop the client reference.
func (m *MemcachedAdapter) Disconnect(ctx context.Context) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if m.client == nil {
		return nil
	}

	m.client = nil
	m.logger.Infof("Disconnected from Memcached: %s", m.conn.Name)
	return nil
}

// IsConnected returns true if the adapter is connected to Memcached.
func (m *MemcachedAdapter) IsConnected() bool {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return m.client != nil
}

// TestConnection pings the Memcached server.
func (m *MemcachedAdapter) TestConnection(ctx context.Context) error {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	if m.client == nil {
		return &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Memcached",
		}
	}
	if err := m.client.Ping(); err != nil {
		return memcachedAdapterError("CONNECTION_TEST_FAILED",
			"Connection test failed", ctx, err)
	}
	return nil
}

// HealthCheck delegates to TestConnection.
func (m *MemcachedAdapter) HealthCheck(ctx context.Context) error {
	return m.TestConnection(ctx)
}

// Ping delegates to TestConnection.
func (m *MemcachedAdapter) Ping(ctx context.Context) error {
	return m.TestConnection(ctx)
}

// GetConnectionInfo returns the connection metadata.
func (m *MemcachedAdapter) GetConnectionInfo() *entities.Connection {
	return m.conn
}
