package base

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/sirupsen/logrus"
)

// PoolableAdapter represents an adapter that can be managed by the pool manager
type PoolableAdapter interface {
	types.DatabaseAdapter
	GetPoolableConfig() PoolableConfig
	ResetConnection(ctx context.Context) error
}

// PoolableConfig defines how an adapter should be managed in a pool
type PoolableConfig struct {
	MaxConnections      int           `json:"max_connections"`
	MinConnections      int           `json:"min_connections"`
	ConnectionLifetime  time.Duration `json:"connection_lifetime"`
	IdleTimeout         time.Duration `json:"idle_timeout"`
	HealthCheckInterval time.Duration `json:"health_check_interval"`
	HealthCheckTimeout  time.Duration `json:"health_check_timeout"`
}

// ConnectionPoolManager manages a pool of database connections
type ConnectionPoolManager struct {
	connections   map[string]*PooledConnection
	mutex         sync.RWMutex
	logger        *logrus.Logger
	ctx           context.Context
	cancel        context.CancelFunc
	cleanupTicker *time.Ticker
	stats         *PoolStats
}

// PooledConnection represents a pooled database connection
type PooledConnection struct {
	ID              string
	Adapter         PoolableAdapter
	Connection      *entities.Connection
	CreatedAt       time.Time
	LastUsed        time.Time
	HealthCheckTime time.Time
	IsHealthy       bool
	UseCount        int64
	mutex           sync.RWMutex
}

// PoolStats tracks pool statistics
type PoolStats struct {
	TotalConnections     int64     `json:"total_connections"`
	ActiveConnections    int64     `json:"active_connections"`
	IdleConnections      int64     `json:"idle_connections"`
	UnhealthyConnections int64     `json:"unhealthy_connections"`
	CreatedConnections   int64     `json:"created_connections"`
	DestroyedConnections int64     `json:"destroyed_connections"`
	HealthCheckFailures  int64     `json:"health_check_failures"`
	LastCleanup          time.Time `json:"last_cleanup"`
}

// NewConnectionPoolManager creates a new connection pool manager
func NewConnectionPoolManager(logger *logrus.Logger) *ConnectionPoolManager {
	if logger == nil {
		logger = logrus.New()
		logger.SetLevel(logrus.InfoLevel)
	}

	ctx, cancel := context.WithCancel(context.Background())

	manager := &ConnectionPoolManager{
		connections: make(map[string]*PooledConnection),
		logger:      logger,
		ctx:         ctx,
		cancel:      cancel,
		stats:       &PoolStats{},
	}

	// Start cleanup routine
	manager.cleanupTicker = time.NewTicker(time.Minute * 5)
	go manager.cleanupRoutine()

	return manager
}

// GetConnection retrieves a connection from the pool or creates a new one
func (pm *ConnectionPoolManager) GetConnection(conn *entities.Connection) (PoolableAdapter, error) {
	poolKey := pm.getPoolKey(conn)

	pm.mutex.RLock()
	pooled, exists := pm.connections[poolKey]
	pm.mutex.RUnlock()

	if exists {
		pooled.mutex.Lock()
		pooled.LastUsed = time.Now()
		pooled.UseCount++
		isHealthy := pooled.IsHealthy
		pooled.mutex.Unlock()

		if isHealthy {
			pm.logger.Debugf("Reusing pooled connection %s", poolKey)
			return pooled.Adapter, nil
		}

		// Connection is unhealthy, remove it
		pm.removeConnection(poolKey)
	}

	// Create new connection
	pm.logger.Infof("Creating new connection for %s", poolKey)
	adapter, err := pm.createAdapter(conn)
	if err != nil {
		return nil, err
	}

	// Test the connection
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
	defer cancel()

	if err := adapter.Connect(ctx, conn); err != nil {
		return nil, err
	}

	// Add to pool
	pooled = &PooledConnection{
		ID:              poolKey,
		Adapter:         adapter,
		Connection:      conn,
		CreatedAt:       time.Now(),
		LastUsed:        time.Now(),
		HealthCheckTime: time.Now(),
		IsHealthy:       true,
		UseCount:        1,
	}

	pm.mutex.Lock()
	pm.connections[poolKey] = pooled
	pm.updateStats()
	pm.mutex.Unlock()

	pm.logger.Infof("Added connection %s to pool", poolKey)
	return adapter, nil
}

// ReturnConnection returns a connection to the pool (for future use)
func (pm *ConnectionPoolManager) ReturnConnection(adapter PoolableAdapter) {
	// This method can be used for future enhancements
	// Currently, connections are managed automatically
}

// HealthCheck performs health checks on all pooled connections
func (pm *ConnectionPoolManager) HealthCheck(ctx context.Context) {
	pm.mutex.RLock()
	connections := make([]*PooledConnection, 0, len(pm.connections))
	for _, conn := range pm.connections {
		connections = append(connections, conn)
	}
	pm.mutex.RUnlock()

	for _, pooled := range connections {
		select {
		case <-ctx.Done():
			return
		default:
		}

		pm.checkConnectionHealth(pooled)
	}
}

// checkConnectionHealth checks the health of a single connection
func (pm *ConnectionPoolManager) checkConnectionHealth(pooled *PooledConnection) {
	pooled.mutex.Lock()
	defer pooled.mutex.Unlock()

	// Skip if recently checked
	if time.Since(pooled.HealthCheckTime) < pooled.Adapter.GetPoolableConfig().HealthCheckInterval {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), pooled.Adapter.GetPoolableConfig().HealthCheckTimeout)
	defer cancel()

	healthy := pooled.Adapter.TestConnection(ctx) == nil
	wasHealthy := pooled.IsHealthy
	pooled.IsHealthy = healthy
	pooled.HealthCheckTime = time.Now()

	if !healthy && wasHealthy {
		pm.stats.HealthCheckFailures++
		pm.logger.Warnf("Connection %s became unhealthy", pooled.ID)
	} else if healthy && !wasHealthy {
		pm.logger.Infof("Connection %s recovered and is now healthy", pooled.ID)
	}
}

// removeConnection removes a connection from the pool
func (pm *ConnectionPoolManager) removeConnection(poolKey string) {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	if pooled, exists := pm.connections[poolKey]; exists {
		pm.logger.Infof("Removing connection %s from pool", poolKey)

		ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
		defer cancel()

		if err := pooled.Adapter.Disconnect(ctx); err != nil {
			pm.logger.Errorf("Error disconnecting adapter %s: %v", poolKey, err)
		}

		delete(pm.connections, poolKey)
		pm.stats.DestroyedConnections++
		pm.updateStats()
	}
}

// cleanupRoutine runs periodic cleanup of idle and unhealthy connections
func (pm *ConnectionPoolManager) cleanupRoutine() {
	for {
		select {
		case <-pm.ctx.Done():
			return
		case <-pm.cleanupTicker.C:
			pm.cleanup()
		}
	}
}

// cleanup removes idle and unhealthy connections
func (pm *ConnectionPoolManager) cleanup() {
	pm.mutex.RLock()
	toRemove := make([]string, 0)

	for poolKey, pooled := range pm.connections {
		pooled.mutex.RLock()
		config := pooled.Adapter.GetPoolableConfig()
		isIdle := time.Since(pooled.LastUsed) > config.IdleTimeout
		isExpired := time.Since(pooled.CreatedAt) > config.ConnectionLifetime
		isUnhealthy := !pooled.IsHealthy
		pooled.mutex.RUnlock()

		if isIdle || isExpired || isUnhealthy {
			toRemove = append(toRemove, poolKey)
		}
	}
	pm.mutex.RUnlock()

	// Remove marked connections
	for _, poolKey := range toRemove {
		reason := "unknown"
		pm.mutex.RLock()
		if pooled, exists := pm.connections[poolKey]; exists {
			pooled.mutex.RLock()
			if time.Since(pooled.LastUsed) > pooled.Adapter.GetPoolableConfig().IdleTimeout {
				reason = "idle"
			} else if time.Since(pooled.CreatedAt) > pooled.Adapter.GetPoolableConfig().ConnectionLifetime {
				reason = "expired"
			} else if !pooled.IsHealthy {
				reason = "unhealthy"
			}
			pooled.mutex.RUnlock()
		}
		pm.mutex.RUnlock()

		pm.logger.Infof("Removing connection %s from pool: %s", poolKey, reason)
		pm.removeConnection(poolKey)
	}

	pm.stats.LastCleanup = time.Now()
	pm.logger.Debugf("Cleanup completed. Removed %d connections", len(toRemove))
}

// GetStats returns current pool statistics
func (pm *ConnectionPoolManager) GetStats() *PoolStats {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	// Return a copy
	stats := *pm.stats
	return &stats
}

// updateStats updates the pool statistics
func (pm *ConnectionPoolManager) updateStats() {
	pm.stats.TotalConnections = int64(len(pm.connections))

	active := int64(0)
	idle := int64(0)
	unhealthy := int64(0)

	for _, pooled := range pm.connections {
		pooled.mutex.RLock()
		if pooled.IsHealthy {
			if time.Since(pooled.LastUsed) < time.Minute*5 {
				active++
			} else {
				idle++
			}
		} else {
			unhealthy++
		}
		pooled.mutex.RUnlock()
	}

	pm.stats.ActiveConnections = active
	pm.stats.IdleConnections = idle
	pm.stats.UnhealthyConnections = unhealthy
}

// getPoolKey generates a unique key for a connection
func (pm *ConnectionPoolManager) getPoolKey(conn *entities.Connection) string {
	return fmt.Sprintf("%s://%s:%d/%s", conn.Type, conn.Host, conn.Port, conn.Database)
}

// createAdapter creates an appropriate adapter for the connection type
func (pm *ConnectionPoolManager) createAdapter(conn *entities.Connection) (PoolableAdapter, error) {
	// This would typically use the factory pattern
	// For now, return an error to be implemented by specific adapters
	return nil, fmt.Errorf("adapter creation not implemented for type %s", conn.Type)
}

// Close shuts down the pool manager
func (pm *ConnectionPoolManager) Close() {
	pm.logger.Info("Shutting down connection pool manager")

	if pm.cleanupTicker != nil {
		pm.cleanupTicker.Stop()
	}

	pm.cancel()

	// Close all connections
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	for poolKey, pooled := range pm.connections {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
		defer cancel()

		if err := pooled.Adapter.Disconnect(ctx); err != nil {
			pm.logger.Errorf("Error disconnecting adapter %s: %v", poolKey, err)
		}
	}

	pm.connections = make(map[string]*PooledConnection)
	pm.logger.Info("Connection pool manager shutdown complete")
}

// ForceHealthCheck forces an immediate health check of all connections
func (pm *ConnectionPoolManager) ForceHealthCheck() {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*30)
	defer cancel()
	pm.HealthCheck(ctx)
}

// GetConnectionInfo returns information about pooled connections
func (pm *ConnectionPoolManager) GetConnectionInfo() map[string]*PooledConnectionInfo {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	result := make(map[string]*PooledConnectionInfo)
	for poolKey, pooled := range pm.connections {
		pooled.mutex.RLock()
		info := &PooledConnectionInfo{
			ID:              pooled.ID,
			Type:            pooled.Connection.Type,
			Host:            pooled.Connection.Host,
			Port:            pooled.Connection.Port,
			Database:        pooled.Connection.Database,
			CreatedAt:       pooled.CreatedAt,
			LastUsed:        pooled.LastUsed,
			HealthCheckTime: pooled.HealthCheckTime,
			IsHealthy:       pooled.IsHealthy,
			UseCount:        pooled.UseCount,
		}
		pooled.mutex.RUnlock()
		result[poolKey] = info
	}

	return result
}

// PooledConnectionInfo represents information about a pooled connection
type PooledConnectionInfo struct {
	ID              string    `json:"id"`
	Type            string    `json:"type"`
	Host            string    `json:"host"`
	Port            int       `json:"port"`
	Database        string    `json:"database"`
	CreatedAt       time.Time `json:"created_at"`
	LastUsed        time.Time `json:"last_used"`
	HealthCheckTime time.Time `json:"health_check_time"`
	IsHealthy       bool      `json:"is_healthy"`
	UseCount        int64     `json:"use_count"`
}
