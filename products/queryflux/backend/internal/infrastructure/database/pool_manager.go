package database

import (
	"context"
	"fmt"
	"github.com/queryflux/backend/internal/domain/entities"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

// PoolMetrics represents connection pool metrics
type PoolMetrics struct {
	ConnectionID     string    `json:"connection_id"`
	ActiveConnections int      `json:"active_connections"`
	IdleConnections  int      `json:"idle_connections"`
	TotalConnections int      `json:"total_connections"`
	QueriesExecuted  int64    `json:"queries_executed"`
	QueryErrors      int64    `json:"query_errors"`
	AvgQueryTime     float64  `json:"avg_query_time_ms"`
	LastActivity     time.Time `json:"last_activity"`
	CreatedAt        time.Time `json:"created_at"`
}

// PoolConfig represents connection pool configuration
type PoolConfig struct {
	MaxConnections     int           `json:"max_connections"`
	MinConnections     int           `json:"min_connections"`
	ConnectionTimeout  time.Duration `json:"connection_timeout"`
	IdleTimeout        time.Duration `json:"idle_timeout"`
	MaxLifetime        time.Duration `json:"max_lifetime"`
	HealthCheckInterval time.Duration `json:"health_check_interval"`
}

// DefaultPoolConfig returns default pool configuration
func DefaultPoolConfig() *PoolConfig {
	return &PoolConfig{
		MaxConnections:      10,
		MinConnections:      2,
		ConnectionTimeout:   30 * time.Second,
		IdleTimeout:         30 * time.Minute,
		MaxLifetime:         time.Hour,
		HealthCheckInterval: 5 * time.Minute,
	}
}

// PoolManager manages database connection pools with metrics and health monitoring
type PoolManager struct {
	adapters        map[string]DatabaseAdapter
	metrics         map[string]*PoolMetrics
	config          *PoolConfig
	factory         *AdapterFactory
	encryptionSvc   *EncryptionService
	mutex           sync.RWMutex
	logger          *logrus.Logger
	healthTicker    *time.Ticker
	cleanupTicker   *time.Ticker
	stopChan        chan struct{}
}

// NewPoolManager creates a new connection pool manager
func NewPoolManager(config *PoolConfig, encryptionSvc *EncryptionService) *PoolManager {
	if config == nil {
		config = DefaultPoolConfig()
	}

	logger := logrus.New()

	pm := &PoolManager{
		adapters:      make(map[string]DatabaseAdapter),
		metrics:       make(map[string]*PoolMetrics),
		config:        config,
		factory:       NewAdapterFactory(logger),
		encryptionSvc: encryptionSvc,
		logger:        logger,
		stopChan:      make(chan struct{}),
	}

	// Start background tasks
	pm.startBackgroundTasks()

	return pm
}

// Connect creates and manages a database connection
func (pm *PoolManager) Connect(ctx context.Context, conn *entities.Connection) error {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	// Check if already connected
	if adapter, exists := pm.adapters[conn.ID]; exists {
		if adapter.IsConnected() {
			pm.logger.Infof("Connection %s already exists and is active", conn.ID)
			return nil
		}
		// Remove stale adapter
		delete(pm.adapters, conn.ID)
		delete(pm.metrics, conn.ID)
	}

	// Decrypt connection credentials
	decryptedConn, err := pm.decryptConnection(conn)
	if err != nil {
		return &AdapterError{
			Code:    "DECRYPTION_FAILED",
			Message: "Failed to decrypt connection credentials",
			Details: err.Error(),
		}
	}

	// Create adapter
	adapter, err := pm.factory.CreateAdapter(decryptedConn)
	if err != nil {
		return err
	}

	// Connect to database
	if err := adapter.Connect(ctx, decryptedConn); err != nil {
		return err
	}

	// Store adapter and initialize metrics
	pm.adapters[conn.ID] = adapter
	pm.metrics[conn.ID] = &PoolMetrics{
		ConnectionID:      conn.ID,
		ActiveConnections: 1,
		IdleConnections:   0,
		TotalConnections:  1,
		QueriesExecuted:   0,
		QueryErrors:       0,
		AvgQueryTime:      0,
		LastActivity:      time.Now(),
		CreatedAt:         time.Now(),
	}

	pm.logger.Infof("Successfully connected to database: %s (%s)", conn.Name, conn.Type)
	return nil
}

// Disconnect closes a database connection
func (pm *PoolManager) Disconnect(ctx context.Context, connectionID string) error {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	adapter, exists := pm.adapters[connectionID]
	if !exists {
		return nil // Already disconnected
	}

	// Disconnect adapter
	if err := adapter.Disconnect(ctx); err != nil {
		pm.logger.Warnf("Error disconnecting adapter %s: %v", connectionID, err)
	}

	// Clean up
	delete(pm.adapters, connectionID)
	delete(pm.metrics, connectionID)

	pm.logger.Infof("Disconnected from database: %s", connectionID)
	return nil
}

// ExecuteQuery executes a query with metrics tracking
func (pm *PoolManager) ExecuteQuery(ctx context.Context, connectionID, query string, params ...interface{}) (*QueryResult, error) {
	pm.mutex.RLock()
	adapter, exists := pm.adapters[connectionID]
	metrics := pm.metrics[connectionID]
	pm.mutex.RUnlock()

	if !exists {
		return nil, &AdapterError{
			Code:    "CONNECTION_NOT_FOUND",
			Message: "Database connection not found",
		}
	}

	// Record query start time
	startTime := time.Now()

	// Execute query
	result, err := adapter.ExecuteQuery(ctx, query, params...)

	// Update metrics
	pm.mutex.Lock()
	if metrics != nil {
		duration := time.Since(startTime)
		metrics.QueriesExecuted++
		metrics.LastActivity = time.Now()

		if err != nil {
			metrics.QueryErrors++
		}

		// Update average query time
		if metrics.QueriesExecuted == 1 {
			metrics.AvgQueryTime = float64(duration.Nanoseconds()) / 1e6 // Convert to milliseconds
		} else {
			// Exponential moving average
			alpha := 0.1
			newTime := float64(duration.Nanoseconds()) / 1e6
			metrics.AvgQueryTime = alpha*newTime + (1-alpha)*metrics.AvgQueryTime
		}
	}
	pm.mutex.Unlock()

	if err != nil {
		pm.logger.Errorf("Query execution failed for connection %s: %v", connectionID, err)
		return nil, err
	}

	pm.logger.Debugf("Query executed successfully for connection %s in %v", connectionID, time.Since(startTime))
	return result, nil
}

// GetSchema retrieves database schema with caching
func (pm *PoolManager) GetSchema(ctx context.Context, connectionID string) (*SchemaInfo, error) {
	pm.mutex.RLock()
	adapter, exists := pm.adapters[connectionID]
	pm.mutex.RUnlock()

	if !exists {
		return nil, &AdapterError{
			Code:    "CONNECTION_NOT_FOUND",
			Message: "Database connection not found",
		}
	}

	return adapter.GetSchema(ctx)
}

// GetTableInfo retrieves table information
func (pm *PoolManager) GetTableInfo(ctx context.Context, connectionID, tableName string) (*TableInfo, error) {
	pm.mutex.RLock()
	adapter, exists := pm.adapters[connectionID]
	pm.mutex.RUnlock()

	if !exists {
		return nil, &AdapterError{
			Code:    "CONNECTION_NOT_FOUND",
			Message: "Database connection not found",
		}
	}

	return adapter.GetTableInfo(ctx, tableName)
}

// TestConnection tests if a connection is valid
func (pm *PoolManager) TestConnection(ctx context.Context, connectionID string) error {
	pm.mutex.RLock()
	adapter, exists := pm.adapters[connectionID]
	pm.mutex.RUnlock()

	if !exists {
		return &AdapterError{
			Code:    "CONNECTION_NOT_FOUND",
			Message: "Database connection not found",
		}
	}

	return adapter.TestConnection(ctx)
}

// GetMetrics returns connection pool metrics
func (pm *PoolManager) GetMetrics(connectionID string) (*PoolMetrics, error) {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	metrics, exists := pm.metrics[connectionID]
	if !exists {
		return nil, &AdapterError{
			Code:    "CONNECTION_NOT_FOUND",
			Message: "Connection metrics not found",
		}
	}

	// Return a copy to avoid race conditions
	metricsCopy := *metrics
	return &metricsCopy, nil
}

// GetAllMetrics returns metrics for all connections
func (pm *PoolManager) GetAllMetrics() map[string]*PoolMetrics {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	result := make(map[string]*PoolMetrics)
	for id, metrics := range pm.metrics {
		metricsCopy := *metrics
		result[id] = &metricsCopy
	}

	return result
}

// GetActiveConnections returns list of active connection IDs
func (pm *PoolManager) GetActiveConnections() []string {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	connections := make([]string, 0, len(pm.adapters))
	for id := range pm.adapters {
		connections = append(connections, id)
	}

	return connections
}

// IsConnected checks if a connection exists and is active
func (pm *PoolManager) IsConnected(connectionID string) bool {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	adapter, exists := pm.adapters[connectionID]
	if !exists {
		return false
	}

	return adapter.IsConnected()
}

// Close shuts down the pool manager and all connections
func (pm *PoolManager) Close(ctx context.Context) error {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	// Stop background tasks
	close(pm.stopChan)
	if pm.healthTicker != nil {
		pm.healthTicker.Stop()
	}
	if pm.cleanupTicker != nil {
		pm.cleanupTicker.Stop()
	}

	// Close all connections
	var errors []error
	for id, adapter := range pm.adapters {
		if err := adapter.Disconnect(ctx); err != nil {
			errors = append(errors, fmt.Errorf("failed to disconnect %s: %w", id, err))
		}
	}

	// Clear maps
	pm.adapters = make(map[string]DatabaseAdapter)
	pm.metrics = make(map[string]*PoolMetrics)

	if len(errors) > 0 {
		return fmt.Errorf("errors closing connections: %v", errors)
	}

	pm.logger.Info("Pool manager closed successfully")
	return nil
}

// startBackgroundTasks starts health checking and cleanup tasks
func (pm *PoolManager) startBackgroundTasks() {
	// Health check ticker
	pm.healthTicker = time.NewTicker(pm.config.HealthCheckInterval)
	go pm.healthCheckLoop()

	// Cleanup ticker (run every minute)
	pm.cleanupTicker = time.NewTicker(time.Minute)
	go pm.cleanupLoop()
}

// healthCheckLoop performs periodic health checks on connections
func (pm *PoolManager) healthCheckLoop() {
	for {
		select {
		case <-pm.healthTicker.C:
			pm.performHealthChecks()
		case <-pm.stopChan:
			return
		}
	}
}

// cleanupLoop performs periodic cleanup of stale connections
func (pm *PoolManager) cleanupLoop() {
	for {
		select {
		case <-pm.cleanupTicker.C:
			pm.performCleanup()
		case <-pm.stopChan:
			return
		}
	}
}

// performHealthChecks checks the health of all connections
func (pm *PoolManager) performHealthChecks() {
	pm.mutex.RLock()
	connectionIDs := make([]string, 0, len(pm.adapters))
	for id := range pm.adapters {
		connectionIDs = append(connectionIDs, id)
	}
	pm.mutex.RUnlock()

	for _, id := range connectionIDs {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		if err := pm.TestConnection(ctx, id); err != nil {
			pm.logger.Warnf("Health check failed for connection %s: %v", id, err)
			// Optionally disconnect unhealthy connections
			pm.Disconnect(ctx, id)
		}
		cancel()
	}
}

// performCleanup removes stale connections and updates metrics
func (pm *PoolManager) performCleanup() {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	now := time.Now()
	for id, metrics := range pm.metrics {
		// Remove connections that have been idle too long
		if now.Sub(metrics.LastActivity) > pm.config.IdleTimeout {
			pm.logger.Infof("Removing idle connection: %s", id)
			if adapter, exists := pm.adapters[id]; exists {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				adapter.Disconnect(ctx)
				cancel()
				delete(pm.adapters, id)
			}
			delete(pm.metrics, id)
		}
	}
}

// decryptConnection decrypts connection credentials
func (pm *PoolManager) decryptConnection(conn *entities.Connection) (*entities.Connection, error) {
	if pm.encryptionSvc == nil {
		return conn, nil // No encryption service configured
	}

	// Create a copy to avoid modifying the original
	decryptedConn := *conn

	// Decrypt password if it's encrypted
	if conn.Password != "" {
		decryptedPassword, err := pm.encryptionSvc.Decrypt(conn.Password)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt password: %w", err)
		}
		decryptedConn.Password = decryptedPassword
	}

	return &decryptedConn, nil
}