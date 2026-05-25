package database

import (
	"context"
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"
)

// ConnectionLifecycleManager manages the lifecycle of database connections
type ConnectionLifecycleManager struct {
	pool              *PostgreSQLPoolManager
	migrator          *Migrator
	transactionMgr    *TransactionManager
	logger            *zap.Logger
	mu                sync.RWMutex
	isInitialized     bool
	healthCheckCtx    context.Context
	healthCheckCancel context.CancelFunc
	metricsTicker     *time.Ticker
	cleanupTicker     *time.Ticker
}

// LifecycleConfig defines configuration for lifecycle management
type LifecycleConfig struct {
	// Health check settings
	HealthCheckInterval    time.Duration `mapstructure:"health_check_interval"`
	HealthCheckTimeout     time.Duration `mapstructure:"health_check_timeout"`
	MaxHealthCheckFailures int           `mapstructure:"max_health_check_failures"`

	// Connection cleanup settings
	CleanupInterval       time.Duration `mapstructure:"cleanup_interval"`
	IdleConnectionTimeout time.Duration `mapstructure:"idle_connection_timeout"`

	// Reconnection settings
	ReconnectInterval    time.Duration `mapstructure:"reconnect_interval"`
	MaxReconnectAttempts int           `mapstructure:"max_reconnect_attempts"`

	// Metrics collection
	MetricsInterval time.Duration `mapstructure:"metrics_interval"`

	// Auto-migration settings
	AutoMigrate         bool   `mapstructure:"auto_migrate"`
	MigrationsDirectory string `mapstructure:"migrations_directory"`
}

// DefaultLifecycleConfig returns default lifecycle configuration
func DefaultLifecycleConfig() *LifecycleConfig {
	return &LifecycleConfig{
		HealthCheckInterval:    30 * time.Second,
		HealthCheckTimeout:     5 * time.Second,
		MaxHealthCheckFailures: 3,
		CleanupInterval:        10 * time.Minute,
		IdleConnectionTimeout:  1 * time.Hour,
		ReconnectInterval:      5 * time.Second,
		MaxReconnectAttempts:   5,
		MetricsInterval:        60 * time.Second,
		AutoMigrate:            false,
		MigrationsDirectory:    "./migrations",
	}
}

// ConnectionStatus represents the status of database connections
type ConnectionStatus struct {
	IsConnected          bool          `json:"is_connected"`
	LastHealthCheck      time.Time     `json:"last_health_check"`
	HealthCheckFailures  int           `json:"health_check_failures"`
	TotalConnections     int64         `json:"total_connections"`
	ActiveConnections    int64         `json:"active_connections"`
	IdleConnections      int64         `json:"idle_connections"`
	LastReconnectAttempt *time.Time    `json:"last_reconnect_attempt,omitempty"`
	IsReconnecting       bool          `json:"is_reconnecting"`
	Uptime               time.Duration `json:"uptime"`
	LastCleanup          time.Time     `json:"last_cleanup"`
}

// NewConnectionLifecycleManager creates a new connection lifecycle manager
func NewConnectionLifecycleManager(
	pool *PostgreSQLPoolManager,
	migrator *Migrator,
	transactionMgr *TransactionManager,
	logger *zap.Logger,
) *ConnectionLifecycleManager {
	if logger == nil {
		logger = zap.NewNop()
	}

	return &ConnectionLifecycleManager{
		pool:           pool,
		migrator:       migrator,
		transactionMgr: transactionMgr,
		logger:         logger,
	}
}

// Initialize initializes the connection lifecycle management
func (clm *ConnectionLifecycleManager) Initialize(ctx context.Context, config *LifecycleConfig) error {
	clm.mu.Lock()
	defer clm.mu.Unlock()

	if clm.isInitialized {
		return nil
	}

	if config == nil {
		config = DefaultLifecycleConfig()
	}

	// Initialize health check context
	clm.healthCheckCtx, clm.healthCheckCancel = context.WithCancel(ctx)

	// Connect to database if not already connected
	if !clm.pool.IsConnected() {
		if err := clm.pool.Connect(ctx); err != nil {
			return fmt.Errorf("failed to connect to database: %w", err)
		}
	}

	// Run auto-migration if enabled
	if config.AutoMigrate {
		clm.logger.Info("Running auto-migration")
		if _, err := clm.migrator.Up(ctx); err != nil {
			clm.logger.Error("Auto-migration failed", zap.Error(err))
			// Don't fail initialization for migration errors, just log them
		}
	}

	// Start health check routine
	clm.startHealthCheckRoutine(config)

	// Start metrics collection routine
	clm.startMetricsCollection(config)

	// Start cleanup routine
	clm.startCleanupRoutine(config)

	clm.isInitialized = true
	clm.logger.Info("Connection lifecycle manager initialized")

	return nil
}

// Shutdown gracefully shuts down the connection lifecycle manager
func (clm *ConnectionLifecycleManager) Shutdown(ctx context.Context) error {
	clm.mu.Lock()
	defer clm.mu.Unlock()

	if !clm.isInitialized {
		return nil
	}

	clm.logger.Info("Shutting down connection lifecycle manager")

	// Stop all routines
	if clm.healthCheckCancel != nil {
		clm.healthCheckCancel()
	}

	if clm.metricsTicker != nil {
		clm.metricsTicker.Stop()
	}

	if clm.cleanupTicker != nil {
		clm.cleanupTicker.Stop()
	}

	// Disconnect from database
	if err := clm.pool.Disconnect(ctx); err != nil {
		clm.logger.Error("Failed to disconnect from database", zap.Error(err))
		return fmt.Errorf("failed to disconnect: %w", err)
	}

	clm.isInitialized = false
	clm.logger.Info("Connection lifecycle manager shut down")

	return nil
}

// GetStatus returns the current connection status
func (clm *ConnectionLifecycleManager) GetStatus() *ConnectionStatus {
	metrics := clm.pool.GetMetrics()

	return &ConnectionStatus{
		IsConnected:         clm.pool.IsConnected(),
		TotalConnections:    metrics.TotalConnections,
		ActiveConnections:   metrics.ActiveConnections,
		IdleConnections:     metrics.IdleConnections,
		LastHealthCheck:     metrics.LastHealthCheck,
		HealthCheckFailures: int(metrics.HealthCheckErrors),
		IsReconnecting:      false,                   // TODO: Track reconnection state
		Uptime:              time.Since(time.Time{}), // TODO: Track actual uptime
	}
}

// ExecuteWithRetry executes a function with automatic retry on connection errors
func (clm *ConnectionLifecycleManager) ExecuteWithRetry(
	ctx context.Context,
	fn func() error,
	maxRetries int,
	retryDelay time.Duration,
) error {
	var lastErr error

	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			clm.logger.Warn("Retrying database operation",
				zap.Int("attempt", attempt+1),
				zap.Duration("delay", retryDelay),
				zap.Error(lastErr))

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(retryDelay):
			}
		}

		// Check if database is connected
		if !clm.pool.IsConnected() {
			clm.logger.Warn("Database not connected, attempting to reconnect")
			if err := clm.reconnectDatabase(ctx); err != nil {
				lastErr = err
				continue
			}
		}

		// Execute the function
		if err := fn(); err != nil {
			lastErr = err

			// Check if it's a connection error that warrants retry
			if clm.isConnectionError(err) {
				clm.logger.Warn("Connection error detected", zap.Error(err))
				continue
			}

			// Not a connection error, don't retry
			return err
		}

		// Success
		return nil
	}

	return fmt.Errorf("operation failed after %d attempts: %w", maxRetries, lastErr)
}

// reconnectDatabase attempts to reconnect to the database
func (clm *ConnectionLifecycleManager) reconnectDatabase(ctx context.Context) error {
	clm.mu.Lock()
	defer clm.mu.Unlock()

	// Disconnect first
	if err := clm.pool.Disconnect(ctx); err != nil {
		clm.logger.Error("Failed to disconnect before reconnection", zap.Error(err))
	}

	// Reconnect
	if err := clm.pool.Connect(ctx); err != nil {
		clm.logger.Error("Failed to reconnect to database", zap.Error(err))
		return err
	}

	clm.logger.Info("Successfully reconnected to database")
	return nil
}

// isConnectionError checks if an error is a connection-related error
func (clm *ConnectionLifecycleManager) isConnectionError(err error) bool {
	if err == nil {
		return false
	}

	errStr := err.Error()
	connectionErrors := []string{
		"connection refused",
		"connection reset",
		"connection timed out",
		"broken pipe",
		"connection lost",
		"database is locked",
		"too many connections",
		"connection aborted",
		"network is unreachable",
	}

	for _, connErr := range connectionErrors {
		if contains(errStr, connErr) {
			return true
		}
	}

	return false
}

// contains checks if a string contains a substring (case-insensitive)
func contains(s, substr string) bool {
	return len(s) >= len(substr) &&
		(s == substr ||
			(len(s) > len(substr) &&
				s[:len(substr)] == substr ||
				s[len(s)-len(substr):] == substr ||
				findSubstring(s, substr)))
}

// findSubstring finds a substring in a string (case-insensitive)
func findSubstring(s, substr string) bool {
	s = toLower(s)
	substr = toLower(substr)

	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// toLower converts a string to lowercase
func toLower(s string) string {
	result := make([]rune, len([]rune(s)))
	for i, r := range []rune(s) {
		if r >= 'A' && r <= 'Z' {
			result[i] = r + ('a' - 'A')
		} else {
			result[i] = r
		}
	}
	return string(result)
}

// startHealthCheckRoutine starts the health check routine
func (clm *ConnectionLifecycleManager) startHealthCheckRoutine(config *LifecycleConfig) {
	go func() {
		ticker := time.NewTicker(config.HealthCheckInterval)
		defer ticker.Stop()

		for {
			select {
			case <-clm.healthCheckCtx.Done():
				return
			case <-ticker.C:
				clm.performHealthCheck(config)
			}
		}
	}()
}

// performHealthCheck performs a health check on the database connection
func (clm *ConnectionLifecycleManager) performHealthCheck(config *LifecycleConfig) {
	ctx, cancel := context.WithTimeout(clm.healthCheckCtx, config.HealthCheckTimeout)
	defer cancel()

	if err := clm.pool.HealthCheck(ctx); err != nil {
		clm.logger.Error("Database health check failed", zap.Error(err))

		// Attempt reconnection if health check fails
		if err := clm.reconnectDatabase(clm.healthCheckCtx); err != nil {
			clm.logger.Error("Failed to reconnect after health check failure", zap.Error(err))
		}
	}
}

// startMetricsCollection starts the metrics collection routine
func (clm *ConnectionLifecycleManager) startMetricsCollection(config *LifecycleConfig) {
	clm.metricsTicker = time.NewTicker(config.MetricsInterval)

	go func() {
		defer clm.metricsTicker.Stop()

		for {
			select {
			case <-clm.healthCheckCtx.Done():
				return
			case <-clm.metricsTicker.C:
				clm.collectMetrics()
			}
		}
	}()
}

// collectMetrics collects and logs database metrics
func (clm *ConnectionLifecycleManager) collectMetrics() {
	metrics := clm.pool.GetMetrics()

	clm.logger.Debug("Database metrics",
		zap.Int64("total_connections", metrics.TotalConnections),
		zap.Int64("active_connections", metrics.ActiveConnections),
		zap.Int64("idle_connections", metrics.IdleConnections),
		zap.Int64("acquire_count", metrics.AcquireCount),
		zap.Duration("acquire_duration", metrics.AcquireDuration),
		zap.Int64("failed_queries", metrics.FailedQueries))
}

// startCleanupRoutine starts the cleanup routine
func (clm *ConnectionLifecycleManager) startCleanupRoutine(config *LifecycleConfig) {
	clm.cleanupTicker = time.NewTicker(config.CleanupInterval)

	go func() {
		defer clm.cleanupTicker.Stop()

		for {
			select {
			case <-clm.healthCheckCtx.Done():
				return
			case <-clm.cleanupTicker.C:
				clm.performCleanup()
			}
		}
	}()
}

// performCleanup performs cleanup operations
func (clm *ConnectionLifecycleManager) performCleanup() {
	// This is a placeholder for cleanup operations
	// In a real implementation, you might:
	// - Clean up idle connections
	// - Clear expired sessions
	// - Compact logs
	// - Clear temporary tables

	clm.logger.Debug("Performing database cleanup")
}

// GetConnectionManager returns the underlying connection pool manager
func (clm *ConnectionLifecycleManager) GetConnectionManager() *PostgreSQLPoolManager {
	return clm.pool
}

// GetMigrator returns the migration manager
func (clm *ConnectionLifecycleManager) GetMigrator() *Migrator {
	return clm.migrator
}

// GetTransactionManager returns the transaction manager
func (clm *ConnectionLifecycleManager) GetTransactionManager() *TransactionManager {
	return clm.transactionMgr
}
