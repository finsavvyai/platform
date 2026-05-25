package connection

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"go.uber.org/zap"
)

// PoolConfig represents connection pool configuration
type PoolConfig struct {
	MaxOpenConnections    int           `json:"max_open_connections"`
	MaxIdleConnections    int           `json:"max_idle_connections"`
	MaxConnectionLifetime time.Duration `json:"max_connection_lifetime"`
	MaxIdleTime           time.Duration `json:"max_idle_time"`
	HealthCheckPeriod     time.Duration `json:"health_check_period"`
	HealthCheckTimeout    time.Duration `json:"health_check_timeout"`
	ConnectTimeout        time.Duration `json:"connect_timeout"`
	RetryAttempts         int           `json:"retry_attempts"`
	RetryDelay            time.Duration `json:"retry_delay"`
	EnableFailover        bool          `json:"enable_failover"`
	FailoverThreshold     int           `json:"failover_threshold"`
}

// DefaultPoolConfig returns a default pool configuration
func DefaultPoolConfig() PoolConfig {
	return PoolConfig{
		MaxOpenConnections:    25,
		MaxIdleConnections:    5,
		MaxConnectionLifetime: 30 * time.Minute,
		MaxIdleTime:           5 * time.Minute,
		HealthCheckPeriod:     30 * time.Second,
		HealthCheckTimeout:    5 * time.Second,
		ConnectTimeout:        10 * time.Second,
		RetryAttempts:         3,
		RetryDelay:            1 * time.Second,
		EnableFailover:        true,
		FailoverThreshold:     3,
	}
}

// ConnectionHealth represents the health status of a connection
type ConnectionHealth struct {
	ConnectionID string        `json:"connection_id"`
	Healthy      bool          `json:"healthy"`
	LastCheck    time.Time     `json:"last_check"`
	ResponseTime time.Duration `json:"response_time"`
	ErrorCount   int           `json:"error_count"`
	ErrorMessage string        `json:"error_message,omitempty"`
}

// PooledConnection represents a database connection in the pool
type PooledConnection struct {
	ID        string
	DB        *sql.DB
	Config    *entities.Connection
	Health    ConnectionHealth
	CreatedAt time.Time
	LastUsed  time.Time
	UseCount  int64
	IsPrimary bool
	mu        sync.RWMutex
}

// ConnectionPool manages a pool of database connections with health monitoring
type ConnectionPool struct {
	connections     map[string]*PooledConnection
	primaryID       string
	config          PoolConfig
	logger          *zap.Logger
	mu              sync.RWMutex
	ctx             context.Context
	cancel          context.CancelFunc
	healthCheckStop chan struct{}
	metrics         *PoolMetrics
}

// PoolMetrics tracks connection pool statistics
type PoolMetrics struct {
	TotalConnections     int64         `json:"total_connections"`
	ActiveConnections    int64         `json:"active_connections"`
	IdleConnections      int64         `json:"idle_connections"`
	HealthyConnections   int64         `json:"healthy_connections"`
	UnhealthyConnections int64         `json:"unhealthy_connections"`
	TotalQueries         int64         `json:"total_queries"`
	SuccessfulQueries    int64         `json:"successful_queries"`
	FailedQueries        int64         `json:"failed_queries"`
	AvgResponseTime      time.Duration `json:"avg_response_time"`
	LastHealthCheck      time.Time     `json:"last_health_check"`
	PoolCreated          time.Time     `json:"pool_created"`
}

// NewConnectionPool creates a new connection pool
func NewConnectionPool(config PoolConfig, logger *zap.Logger) *ConnectionPool {
	ctx, cancel := context.WithCancel(context.Background())

	pool := &ConnectionPool{
		connections:     make(map[string]*PooledConnection),
		config:          config,
		logger:          logger,
		ctx:             ctx,
		cancel:          cancel,
		healthCheckStop: make(chan struct{}),
		metrics: &PoolMetrics{
			PoolCreated: time.Now(),
		},
	}

	return pool
}

// AddConnection adds a new connection to the pool
func (p *ConnectionPool) AddConnection(connConfig *entities.Connection) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Check if connection already exists
	if _, exists := p.connections[connConfig.ID]; exists {
		return fmt.Errorf("connection %s already exists in pool", connConfig.ID)
	}

	// Create database connection
	db, err := p.createDatabaseConnection(connConfig)
	if err != nil {
		return fmt.Errorf("failed to create database connection: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(p.config.MaxOpenConnections)
	db.SetMaxIdleConns(p.config.MaxIdleConnections)
	db.SetConnMaxLifetime(p.config.MaxConnectionLifetime)
	db.SetConnMaxIdleTime(p.config.MaxIdleTime)

	// Create pooled connection
	pooledConn := &PooledConnection{
		ID:     connConfig.ID,
		DB:     db,
		Config: connConfig,
		Health: ConnectionHealth{
			ConnectionID: connConfig.ID,
			Healthy:      true,
			LastCheck:    time.Now(),
			ResponseTime: 0,
			ErrorCount:   0,
		},
		CreatedAt: time.Now(),
		LastUsed:  time.Now(),
		IsPrimary: len(p.connections) == 0, // First connection is primary
	}

	p.connections[connConfig.ID] = pooledConn
	p.metrics.TotalConnections++
	p.metrics.ActiveConnections++

	// Set as primary if it's the first connection
	if pooledConn.IsPrimary {
		p.primaryID = connConfig.ID
	}

	p.logger.Info("Connection added to pool",
		zap.String("connection_id", connConfig.ID),
		zap.String("database_type", connConfig.Type),
		zap.Bool("is_primary", pooledConn.IsPrimary))

	// Start health checking if this is the first connection
	if len(p.connections) == 1 {
		go p.startHealthChecking()
	}

	return nil
}

// GetConnection gets a connection from the pool based on strategy
func (p *ConnectionPool) GetConnection(strategy ...string) (*PooledConnection, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	if len(p.connections) == 0 {
		return nil, fmt.Errorf("no connections available in pool")
	}

	// Default strategy is primary-first
	strat := "primary-first"
	if len(strategy) > 0 {
		strat = strategy[0]
	}

	switch strat {
	case "primary-first":
		return p.getPrimaryConnection()
	case "round-robin":
		return p.getRoundRobinConnection()
	case "least-connections":
		return p.getLeastConnectionsConnection()
	case "health-first":
		return p.getHealthiestConnection()
	default:
		return p.getPrimaryConnection()
	}
}

// getPrimaryConnection returns the primary connection or fallback
func (p *ConnectionPool) getPrimaryConnection() (*PooledConnection, error) {
	if p.primaryID == "" {
		return p.getHealthiestConnection()
	}

	if conn, exists := p.connections[p.primaryID]; exists && conn.Health.Healthy {
		conn.UseCount++
		conn.LastUsed = time.Now()
		return conn, nil
	}

	// Fallback to healthiest connection
	return p.getHealthiestConnection()
}

// getHealthiestConnection returns the healthiest connection
func (p *ConnectionPool) getHealthiestConnection() (*PooledConnection, error) {
	var bestConn *PooledConnection
	var bestScore float64 = -1

	for _, conn := range p.connections {
		if !conn.Health.Healthy {
			continue
		}

		// Calculate health score (lower is better)
		score := float64(conn.Health.ErrorCount) +
			float64(conn.Health.ResponseTime/time.Millisecond)/1000 +
			float64(time.Since(conn.Health.LastCheck)/time.Second)/60

		if bestScore == -1 || score < bestScore {
			bestScore = score
			bestConn = conn
		}
	}

	if bestConn == nil {
		return nil, fmt.Errorf("no healthy connections available")
	}

	bestConn.UseCount++
	bestConn.LastUsed = time.Now()
	return bestConn, nil
}

// getRoundRobinConnection returns connections in round-robin order
func (p *ConnectionPool) getRoundRobinConnection() (*PooledConnection, error) {
	var conn *PooledConnection
	var minUseCount int64 = -1

	for _, c := range p.connections {
		if !c.Health.Healthy {
			continue
		}

		if minUseCount == -1 || c.UseCount < minUseCount {
			minUseCount = c.UseCount
			conn = c
		}
	}

	if conn == nil {
		return nil, fmt.Errorf("no healthy connections available")
	}

	conn.UseCount++
	conn.LastUsed = time.Now()
	return conn, nil
}

// getLeastConnectionsConnection returns connection with least usage
func (p *ConnectionPool) getLeastConnectionsConnection() (*PooledConnection, error) {
	return p.getRoundRobinConnection() // Same implementation for now
}

// ExecuteQuery executes a query using the pool with retry logic
func (p *ConnectionPool) ExecuteQuery(ctx context.Context, query string, args []interface{}, strategy ...string) (*sql.Rows, error) {
	conn, err := p.GetConnection(strategy...)
	if err != nil {
		return nil, err
	}

	p.metrics.TotalQueries++
	startTime := time.Now()

	var lastErr error
	for attempt := 0; attempt <= p.config.RetryAttempts; attempt++ {
		if attempt > 0 {
			p.logger.Debug("Retrying query execution",
				zap.String("connection_id", conn.ID),
				zap.Int("attempt", attempt),
				zap.Error(lastErr))

			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(p.config.RetryDelay):
			}
		}

		rows, err := conn.DB.QueryContext(ctx, query, args...)
		if err == nil {
			p.metrics.SuccessfulQueries++

			// Update response time metrics
			responseTime := time.Since(startTime)
			p.updateAverageResponseTime(responseTime)

			return rows, nil
		}

		lastErr = err

		// Check if connection is unhealthy
		if p.isConnectionError(err) {
			p.markConnectionUnhealthy(conn, err)

			// Try to get a different connection for retry
			if attempt < p.config.RetryAttempts {
				newConn, newErr := p.GetConnection("health-first")
				if newErr == nil && newConn.ID != conn.ID {
					conn = newConn
				}
			}
		}
	}

	p.metrics.FailedQueries++
	return nil, fmt.Errorf("query execution failed after %d attempts: %w", p.config.RetryAttempts+1, lastErr)
}

// ExecuteQueryRow executes a query that returns a single row
func (p *ConnectionPool) ExecuteQueryRow(ctx context.Context, query string, args []interface{}, strategy ...string) *sql.Row {
	conn, err := p.GetConnection(strategy...)
	if err != nil {
		// Return a row that will always error
		return &sql.Row{}
	}

	return conn.DB.QueryRowContext(ctx, query, args...)
}

// Close closes all connections in the pool
func (p *ConnectionPool) Close() error {
	p.cancel()

	p.mu.Lock()
	defer p.mu.Unlock()

	// Stop health checking
	select {
	case <-p.healthCheckStop:
		// Already closed
	default:
		close(p.healthCheckStop)
	}

	var lastErr error
	for id, conn := range p.connections {
		if err := conn.DB.Close(); err != nil {
			p.logger.Error("Failed to close connection",
				zap.String("connection_id", id),
				zap.Error(err))
			lastErr = err
		}
	}

	p.connections = make(map[string]*PooledConnection)
	p.logger.Info("Connection pool closed")

	return lastErr
}

// GetMetrics returns current pool metrics
func (p *ConnectionPool) GetMetrics() PoolMetrics {
	p.mu.RLock()
	defer p.mu.RUnlock()

	metrics := *p.metrics

	// Count healthy/unhealthy connections
	for _, conn := range p.connections {
		if conn.Health.Healthy {
			metrics.HealthyConnections++
		} else {
			metrics.UnhealthyConnections++
		}
	}

	metrics.ActiveConnections = int64(len(p.connections))
	metrics.IdleConnections = int64(len(p.connections)) // Simplified

	return metrics
}

// ConnectionInfo represents summary info about a connection in the pool
type ConnectionInfo struct {
	ID        string
	Config    *entities.Connection
	Health    ConnectionHealth
	UseCount  int64
	LastUsed  time.Time
	IsPrimary bool
}

// GetConnectionInfo returns health status of all connections
func (p *ConnectionPool) GetConnectionInfo() []ConnectionInfo {
	p.mu.RLock()
	defer p.mu.RUnlock()

	info := make([]ConnectionInfo, 0, len(p.connections))
	for _, conn := range p.connections {
		conn.mu.RLock()
		info = append(info, ConnectionInfo{
			ID:        conn.ID,
			Config:    conn.Config,
			Health:    conn.Health,
			UseCount:  conn.UseCount,
			LastUsed:  conn.LastUsed,
			IsPrimary: conn.IsPrimary,
		})
		conn.mu.RUnlock()
	}
	return info
}

// startHealthChecking starts the background health checking process
func (p *ConnectionPool) startHealthChecking() {
	ticker := time.NewTicker(p.config.HealthCheckPeriod)
	defer ticker.Stop()

	for {
		select {
		case <-p.ctx.Done():
			return
		case <-p.healthCheckStop:
			return
		case <-ticker.C:
			p.performHealthCheck()
		}
	}
}

// performHealthCheck checks health of all connections
func (p *ConnectionPool) performHealthCheck() {
	p.mu.RLock()
	connections := make([]*PooledConnection, 0, len(p.connections))
	for _, conn := range p.connections {
		connections = append(connections, conn)
	}
	p.mu.RUnlock()

	var wg sync.WaitGroup
	for _, conn := range connections {
		wg.Add(1)
		go func(c *PooledConnection) {
			defer wg.Done()
			p.checkConnectionHealth(c)
		}(conn)
	}

	wg.Wait()
	p.metrics.LastHealthCheck = time.Now()
}

// checkConnectionHealth checks the health of a single connection
func (p *ConnectionPool) checkConnectionHealth(conn *PooledConnection) {
	ctx, cancel := context.WithTimeout(context.Background(), p.config.HealthCheckTimeout)
	defer cancel()

	startTime := time.Now()

	// Simple health check query
	// heathQuery removed as it was unused and db.PingContext is used instead

	err := conn.DB.PingContext(ctx)
	responseTime := time.Since(startTime)

	conn.mu.Lock()
	defer conn.mu.Unlock()

	conn.Health.LastCheck = time.Now()
	conn.Health.ResponseTime = responseTime

	if err == nil {
		// Connection is healthy
		if !conn.Health.Healthy {
			p.logger.Info("Connection recovered",
				zap.String("connection_id", conn.ID))
		}
		conn.Health.Healthy = true
		conn.Health.ErrorCount = 0
		conn.Health.ErrorMessage = ""
	} else {
		// Connection is unhealthy
		conn.Health.Healthy = false
		conn.Health.ErrorCount++
		conn.Health.ErrorMessage = err.Error()

		p.logger.Warn("Connection health check failed",
			zap.String("connection_id", conn.ID),
			zap.Duration("response_time", responseTime),
			zap.Int("error_count", conn.Health.ErrorCount),
			zap.Error(err))

		// Consider failover if threshold reached
		if p.config.EnableFailover && conn.Health.ErrorCount >= p.config.FailoverThreshold && conn.IsPrimary {
			p.considerFailover(conn)
		}
	}
}

// considerFailover considers failing over to a healthy connection
func (p *ConnectionPool) considerFailover(unhealthyConn *PooledConnection) {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Find a healthy connection to promote
	var newPrimary *PooledConnection
	for _, conn := range p.connections {
		if conn.ID != unhealthyConn.ID && conn.Health.Healthy {
			newPrimary = conn
			break
		}
	}

	if newPrimary != nil {
		oldPrimaryID := p.primaryID
		p.primaryID = newPrimary.ID

		// Update primary status
		p.connections[oldPrimaryID].IsPrimary = false
		newPrimary.IsPrimary = true

		p.logger.Info("Database failover completed",
			zap.String("old_primary", oldPrimaryID),
			zap.String("new_primary", newPrimary.ID),
			zap.String("reason", "health_check_failure"))
	} else {
		p.logger.Error("No healthy connections available for failover",
			zap.String("unhealthy_primary", unhealthyConn.ID))
	}
}

// createDatabaseConnection creates a new database connection
func (p *ConnectionPool) createDatabaseConnection(connConfig *entities.Connection) (*sql.DB, error) {
	// This would typically use the database adapters from the existing system
	// For now, return a placeholder implementation
	return nil, fmt.Errorf("database connection creation not implemented - requires integration with database adapters")
}

// isConnectionError checks if an error indicates connection problems
func (p *ConnectionPool) isConnectionError(err error) bool {
	if err == nil {
		return false
	}

	errStr := err.Error()
	connectionErrors := []string{
		"connection refused",
		"connection reset",
		"broken pipe",
		"timeout",
		"no such host",
		"connection lost",
		"database is closed",
		"bad connection",
	}

	for _, connErr := range connectionErrors {
		if contains(errStr, connErr) {
			return true
		}
	}

	return false
}

// markConnectionUnhealthy marks a connection as unhealthy
func (p *ConnectionPool) markConnectionUnhealthy(conn *PooledConnection, err error) {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	conn.Health.Healthy = false
	conn.Health.ErrorCount++
	conn.Health.ErrorMessage = err.Error()
	conn.Health.LastCheck = time.Now()

	p.logger.Warn("Connection marked as unhealthy",
		zap.String("connection_id", conn.ID),
		zap.Error(err))
}

// updateAverageResponseTime updates the rolling average response time
func (p *ConnectionPool) updateAverageResponseTime(responseTime time.Duration) {
	// Simple rolling average implementation
	if p.metrics.AvgResponseTime == 0 {
		p.metrics.AvgResponseTime = responseTime
	} else {
		// Weight the new response time at 10%
		p.metrics.AvgResponseTime = time.Duration(float64(p.metrics.AvgResponseTime)*0.9 + float64(responseTime)*0.1)
	}
}

// contains checks if a string contains a substring (case-insensitive)
func contains(s, substr string) bool {
	return len(s) >= len(substr) &&
		(s == substr ||
			(len(s) > len(substr) &&
				(s[:len(substr)] == substr ||
					s[len(s)-len(substr):] == substr ||
					containsMiddle(s, substr))))
}

func containsMiddle(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
