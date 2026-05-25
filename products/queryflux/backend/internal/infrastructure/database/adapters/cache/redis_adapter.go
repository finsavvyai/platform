package cache

import (
	"context"
	"crypto/tls"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/redis/go-redis/v9"
	"github.com/sirupsen/logrus"
)

// RedisAdapter implements DatabaseAdapter for Redis
type RedisAdapter struct {
	conn   *entities.Connection
	client redis.UniversalClient
	mutex  sync.RWMutex
	logger *logrus.Logger
}

// RedisCommand represents a parsed Redis command
type RedisCommand struct {
	Name string        `json:"name"`
	Args []interface{} `json:"args"`
}

// toColumnInfo converts string columns to ColumnInfo
func (r *RedisAdapter) toColumnInfo(columns []string) []types.ColumnInfo {
	result := make([]types.ColumnInfo, len(columns))
	for i, name := range columns {
		result[i] = types.ColumnInfo{
			Name: name,
			Type: "string",
		}
	}
	return result
}

// Connect establishes a connection to Redis
func (r *RedisAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	if r.client != nil {
		return nil // Already connected
	}

	r.conn = conn

	db := 0
	if conn.Database != "" {
		if dbNum, err := strconv.Atoi(conn.Database); err == nil {
			db = dbNum
		}
	}

	if r.isClusterMode(conn) {
		clusterOptions := &redis.ClusterOptions{
			Addrs:    []string{fmt.Sprintf("%s:%d", conn.Host, conn.Port)},
			Password: conn.Password,
		}

		if conn.SSL {
			clusterOptions.TLSConfig = &tls.Config{
				InsecureSkipVerify: true,
			}
		}

		clusterOptions.PoolSize = 10
		clusterOptions.MinIdleConns = 2
		clusterOptions.ConnMaxIdleTime = 30 * time.Minute
		clusterOptions.DialTimeout = 5 * time.Second
		clusterOptions.ReadTimeout = 3 * time.Second
		clusterOptions.WriteTimeout = 3 * time.Second

		r.client = redis.NewClusterClient(clusterOptions)
	} else {
		options := &redis.Options{
			Addr:     fmt.Sprintf("%s:%d", conn.Host, conn.Port),
			Password: conn.Password,
			DB:       db,
		}

		if conn.SSL {
			options.TLSConfig = &tls.Config{
				InsecureSkipVerify: true,
			}
		}

		options.PoolSize = 10
		options.MinIdleConns = 2
		options.ConnMaxIdleTime = 30 * time.Minute
		options.DialTimeout = 5 * time.Second
		options.ReadTimeout = 3 * time.Second
		options.WriteTimeout = 3 * time.Second

		r.client = redis.NewClient(options)
	}

	if err := r.client.Ping(ctx).Err(); err != nil {
		r.client.Close()
		r.client = nil
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Failed to ping Redis server",
			Details: err.Error(),
		}
	}

	r.logger.Infof("Connected to Redis server: %s", conn.Name)
	return nil
}

// isClusterMode checks if the connection should use cluster mode
func (r *RedisAdapter) isClusterMode(conn *entities.Connection) bool {
	if conn.Options != nil {
		if mode, exists := conn.Options["mode"]; exists {
			return strings.ToLower(mode) == "cluster"
		}
	}
	return false
}

// Disconnect closes the Redis connection
func (r *RedisAdapter) Disconnect(ctx context.Context) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	if r.client == nil {
		return nil
	}

	if err := r.client.Close(); err != nil {
		return &types.AdapterError{
			Code:    "DISCONNECT_FAILED",
			Message: "Failed to close Redis connection",
			Details: err.Error(),
		}
	}

	r.client = nil
	r.logger.Infof("Disconnected from Redis server: %s", r.conn.Name)
	return nil
}

// TestConnection tests if the Redis connection is valid
func (r *RedisAdapter) TestConnection(ctx context.Context) error {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	if r.client == nil {
		return &types.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to Redis server",
		}
	}

	if err := r.client.Ping(ctx).Err(); err != nil {
		return &types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Connection test failed",
			Details: err.Error(),
		}
	}

	return nil
}

// HealthCheck checks the health of the connection
func (r *RedisAdapter) HealthCheck(ctx context.Context) error {
	return r.TestConnection(ctx)
}

// Ping checks connectivity
func (r *RedisAdapter) Ping(ctx context.Context) error {
	return r.TestConnection(ctx)
}

// IsConnected returns true if the adapter is connected to Redis
func (r *RedisAdapter) IsConnected() bool {
	r.mutex.RLock()
	defer r.mutex.RUnlock()
	return r.client != nil
}

// GetConnectionInfo returns the connection information
func (r *RedisAdapter) GetConnectionInfo() *entities.Connection {
	return r.conn
}

// BeginTransaction starts a new transaction - Not supported in Redis
func (r *RedisAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	return nil, fmt.Errorf("transactions transaction not supported for Redis adapter")
}
