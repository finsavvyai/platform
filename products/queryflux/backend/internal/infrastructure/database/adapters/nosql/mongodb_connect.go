package nosql

import (
	"context"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Connect establishes a connection to MongoDB using the real mongo-driver.
// Honours ctx cancellation; never logs credentials.
func (m *MongoDBAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if m.client != nil {
		return nil
	}
	m.conn = conn

	connStr, err := conn.GetConnectionString()
	if err != nil {
		return mongoErr("CONNECTION_STRING_ERROR", "Failed to build connection string", err)
	}

	clientOptions := m.applyPoolOptions(options.Client().ApplyURI(connStr), conn)
	clientOptions.SetConnectTimeout(10 * time.Second)
	clientOptions.SetServerSelectionTimeout(5 * time.Second)

	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return mongoErr("CONNECTION_FAILED", "Failed to connect to MongoDB", err)
	}

	if err := client.Ping(ctx, nil); err != nil {
		_ = client.Disconnect(ctx)
		return mongoErr("CONNECTION_TEST_FAILED", "Failed to ping MongoDB database", err)
	}

	m.client = client
	m.database = client.Database(conn.Database)
	m.logger.Infof("Connected to MongoDB database: %s", conn.Name)
	return nil
}

// applyPoolOptions threads pool/idle settings from connection options.
func (m *MongoDBAdapter) applyPoolOptions(o *options.ClientOptions, conn *entities.Connection) *options.ClientOptions {
	if maxConns, ok := conn.Options["pool_max_conns"]; ok {
		if v, err := toUint64(maxConns); err == nil && v > 0 {
			o.SetMaxPoolSize(v)
		}
	} else {
		o.SetMaxPoolSize(10)
	}
	if minConns, ok := conn.Options["pool_min_conns"]; ok {
		if v, err := toUint64(minConns); err == nil {
			o.SetMinPoolSize(v)
		}
	} else {
		o.SetMinPoolSize(2)
	}
	if maxIdle, ok := conn.Options["pool_max_conn_idle_time"]; ok {
		if v, err := toDuration(maxIdle); err == nil {
			o.SetMaxConnIdleTime(v)
		}
	} else {
		o.SetMaxConnIdleTime(30 * time.Minute)
	}
	return o
}

// Disconnect closes the MongoDB connection. Safe to call multiple times.
func (m *MongoDBAdapter) Disconnect(ctx context.Context) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	if m.client == nil {
		return nil
	}
	if err := m.client.Disconnect(ctx); err != nil {
		return mongoErr("DISCONNECT_FAILED", "Failed to disconnect from MongoDB", err)
	}
	m.client = nil
	m.database = nil
	if m.conn != nil {
		m.logger.Infof("Disconnected from MongoDB database: %s", m.conn.Name)
	}
	return nil
}

// Shutdown is an alias for Disconnect.
func (m *MongoDBAdapter) Shutdown(ctx context.Context) error { return m.Disconnect(ctx) }

// TestConnection pings the server.
func (m *MongoDBAdapter) TestConnection(ctx context.Context) error {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	if m.client == nil {
		return &types.AdapterError{Code: "NOT_CONNECTED", Message: "Not connected to database"}
	}
	if err := m.client.Ping(ctx, nil); err != nil {
		return mongoErr("CONNECTION_TEST_FAILED", "Connection test failed", err)
	}
	return nil
}

// Ping is an alias for TestConnection.
func (m *MongoDBAdapter) Ping(ctx context.Context) error { return m.TestConnection(ctx) }

// IsConnected reports whether the client + database are live.
func (m *MongoDBAdapter) IsConnected() bool {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return m.client != nil && m.database != nil
}

// GetConnectionInfo returns the bound *entities.Connection (never the raw password).
func (m *MongoDBAdapter) GetConnectionInfo() *entities.Connection { return m.conn }
