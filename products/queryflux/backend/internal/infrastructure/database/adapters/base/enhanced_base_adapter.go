package base

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/sirupsen/logrus"
)

// EnhancedBaseAdapter provides common functionality for all database adapters
type EnhancedBaseAdapter struct {
	conn        *entities.Connection
	config      types.ConnectionConfig
	mutex       sync.RWMutex
	logger      *logrus.Logger
	metrics     *types.ConnectionMetrics
	healthMutex sync.RWMutex
	lastHealth  *types.HealthStatus

	// Performance tracking
	queryStats *QueryStats
	statsMutex sync.RWMutex
}

// QueryStats tracks query performance
type QueryStats struct {
	TotalQueries       int64         `json:"total_queries"`
	FailedQueries      int64         `json:"failed_queries"`
	SlowQueries        int64         `json:"slow_queries"`
	TotalDuration      time.Duration `json:"total_duration"`
	LastQueryTime      time.Time     `json:"last_query_time"`
	SlowQueryThreshold time.Duration `json:"slow_query_threshold"`
}

// NewEnhancedBaseAdapter creates a new enhanced base adapter
func NewEnhancedBaseAdapter(conn *entities.Connection, logger *logrus.Logger) *EnhancedBaseAdapter {
	if logger == nil {
		logger = logrus.New()
		logger.SetLevel(logrus.InfoLevel)
	}

	config := types.DefaultConnectionConfig()

	// Apply connection-specific configurations
	if conn != nil && conn.Options != nil {
		if maxOpenStr, ok := conn.Options["max_open_conns"]; ok {
			if maxOpen, err := strconv.Atoi(maxOpenStr); err == nil {
				config.MaxOpenConns = maxOpen
			}
		}
		if maxIdleStr, ok := conn.Options["max_idle_conns"]; ok {
			if maxIdle, err := strconv.Atoi(maxIdleStr); err == nil {
				config.MaxIdleConns = maxIdle
			}
		}
		if connTimeout, ok := conn.Options["connect_timeout"]; ok {
			if duration, err := time.ParseDuration(connTimeout); err == nil {
				config.ConnectTimeout = duration
			}
		}
		if queryTimeout, ok := conn.Options["query_timeout"]; ok {
			if duration, err := time.ParseDuration(queryTimeout); err == nil {
				config.QueryTimeout = duration
			}
		}
	}

	return &EnhancedBaseAdapter{
		conn:   conn,
		config: config,
		logger: logger,
		metrics: &types.ConnectionMetrics{
			LastUpdated: time.Now(),
		},
		queryStats: &QueryStats{
			SlowQueryThreshold: time.Second * 1, // Default 1 second threshold
		},
	}
}

// GetConnection returns the connection entity
func (b *EnhancedBaseAdapter) GetConnection() *entities.Connection {
	b.mutex.RLock()
	defer b.mutex.RUnlock()
	return b.conn
}

// GetConfig returns the connection configuration
func (b *EnhancedBaseAdapter) GetConfig() types.ConnectionConfig {
	b.mutex.RLock()
	defer b.mutex.RUnlock()
	return b.config
}

// SetSSLMode sets the SSL mode for the connection
func (b *EnhancedBaseAdapter) SetSSLMode(mode string) {
	b.mutex.Lock()
	defer b.mutex.Unlock()
	b.config.SSLMode = mode
}

// GetLogger returns the logger
func (b *EnhancedBaseAdapter) GetLogger() *logrus.Logger {
	return b.logger
}

// TrackQueryStart records the start of a query execution
func (b *EnhancedBaseAdapter) TrackQueryStart(query string) time.Time {
	b.statsMutex.Lock()
	defer b.statsMutex.Unlock()

	b.queryStats.LastQueryTime = time.Now()
	return b.queryStats.LastQueryTime
}

// TrackQueryEnd records the end of a query execution
func (b *EnhancedBaseAdapter) TrackQueryEnd(startTime time.Time, success bool, err error) {
	duration := time.Since(startTime)

	b.statsMutex.Lock()
	defer b.statsMutex.Unlock()

	b.queryStats.TotalQueries++
	b.queryStats.TotalDuration += duration
	b.queryStats.LastQueryTime = time.Now()

	if !success {
		b.queryStats.FailedQueries++
	}

	if duration > b.queryStats.SlowQueryThreshold {
		b.queryStats.SlowQueries++
		b.logger.Warnf("Slow query detected: %v (threshold: %v)", duration, b.queryStats.SlowQueryThreshold)
	}

	// Update metrics
	b.updateQueryPerformanceMetrics()
}

// GetQueryStats returns current query statistics
func (b *EnhancedBaseAdapter) GetQueryStats() *QueryStats {
	b.statsMutex.RLock()
	defer b.statsMutex.RUnlock()

	// Return a copy to avoid concurrent modification
	stats := *b.queryStats
	return &stats
}

// updateQueryPerformanceMetrics updates the query performance metrics
func (b *EnhancedBaseAdapter) updateQueryPerformanceMetrics() {
	b.mutex.Lock()
	defer b.mutex.Unlock()

	stats := b.queryStats
	perf := &b.metrics.QueryPerformance

	perf.TotalQueriesCount = stats.TotalQueries
	perf.FailedQueriesCount = stats.FailedQueries
	perf.SlowQueriesCount = stats.SlowQueries

	if stats.TotalQueries > 0 {
		perf.AverageQueryTime = time.Duration(int64(stats.TotalDuration) / stats.TotalQueries)

		// Calculate queries per second based on last minute
		if time.Since(stats.LastQueryTime) < time.Minute {
			perf.QueriesPerSecond = float64(stats.TotalQueries) / time.Since(stats.LastQueryTime).Seconds()
		}
	}

	b.metrics.LastUpdated = time.Now()
}

// RecordHealthCheck records the result of a health check
func (b *EnhancedBaseAdapter) RecordHealthCheck(healthy bool, responseTime time.Duration, err error) {
	b.healthMutex.Lock()
	defer b.healthMutex.Unlock()

	status := &types.HealthStatus{
		Healthy:      healthy,
		LastChecked:  time.Now(),
		ResponseTime: responseTime,
	}

	if !healthy && err != nil {
		status.ErrorMessage = err.Error()
	}

	b.lastHealth = status
}

// GetLastHealthCheck returns the last health check result
func (b *EnhancedBaseAdapter) GetLastHealthCheck() *types.HealthStatus {
	b.healthMutex.RLock()
	defer b.healthMutex.RUnlock()

	if b.lastHealth == nil {
		return &types.HealthStatus{
			Healthy:      false,
			LastChecked:  time.Time{},
			ErrorMessage: "No health check performed",
		}
	}

	// Return a copy
	status := *b.lastHealth
	return &status
}

// IsHealthy returns true if the last health check was successful and recent
func (b *EnhancedBaseAdapter) IsHealthy() bool {
	b.healthMutex.RLock()
	defer b.healthMutex.RUnlock()

	if b.lastHealth == nil {
		return false
	}

	// Consider healthy if last check was within 2 * health check interval
	recent := time.Since(b.lastHealth.LastChecked) < 2*b.config.HealthCheckInterval
	return b.lastHealth.Healthy && recent
}

// CreateError creates a standardized adapter error
func (b *EnhancedBaseAdapter) CreateError(code, message, details string, query string, params ...interface{}) *types.AdapterError {
	err := types.NewAdapterError(code, message, details)

	if query != "" {
		err.WithQuery(query, params...)
	}

	// Add connection context
	err.WithContext("connection_id", b.conn.ID).
		WithContext("database_type", b.conn.Type).
		WithContext("host", b.conn.Host).
		WithContext("port", b.conn.Port)

	return err
}

// ShouldRetry determines if an operation should be retried based on the error
func (b *EnhancedBaseAdapter) ShouldRetry(err error, attempt int) bool {
	if attempt >= b.config.MaxRetries {
		return false
	}

	if adapterErr, ok := err.(*types.AdapterError); ok {
		return adapterErr.Retryable
	}

	// Default retryable errors
	retryableErrors := map[string]bool{
		types.ErrCodeConnectionFailed:  true,
		types.ErrCodeConnectionLost:    true,
		types.ErrCodeConnectionTimeout: true,
		types.ErrCodeQueryTimeout:      true,
		types.ErrCodePoolExhausted:     true,
		types.ErrCodeDatabaseError:     true,
	}

	if adapterErr, ok := err.(*types.AdapterError); ok {
		return retryableErrors[adapterErr.Code]
	}

	return false
}

// GetRetryDelay calculates the delay before the next retry attempt
func (b *EnhancedBaseAdapter) GetRetryDelay(attempt int) time.Duration {
	if b.config.RetryBackoff > 0 {
		// Exponential backoff
		return b.config.RetryDelay + time.Duration(attempt)*b.config.RetryBackoff
	}
	return b.config.RetryDelay
}

// ExecuteWithRetry executes a function with retry logic
func (b *EnhancedBaseAdapter) ExecuteWithRetry(ctx context.Context, fn func() error) error {
	var lastErr error

	for attempt := 0; attempt <= b.config.MaxRetries; attempt++ {
		// Check context before attempting
		if ctx.Err() != nil {
			return ctx.Err()
		}

		if attempt > 0 {
			// Wait before retry
			delay := b.GetRetryDelay(attempt - 1)
			b.logger.Debugf("Retrying operation after %v (attempt %d/%d)", delay, attempt, b.config.MaxRetries)

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
			}
		}

		if err := fn(); err != nil {
			lastErr = err

			if !b.ShouldRetry(err, attempt) {
				break
			}

			b.logger.Warnf("Operation failed (attempt %d/%d): %v", attempt+1, b.config.MaxRetries+1, err)
			continue
		}

		return nil
	}

	return lastErr
}

// UpdateMetrics updates the connection metrics
func (b *EnhancedBaseAdapter) UpdateMetrics(poolStats types.ConnectionPoolStats, dbInfo types.DatabaseInfo) {
	b.mutex.Lock()
	defer b.mutex.Unlock()

	b.metrics.ConnectionPoolStats = poolStats
	b.metrics.DatabaseInfo = dbInfo
	b.metrics.LastUpdated = time.Now()
}

// GetMetrics returns the current connection metrics
func (b *EnhancedBaseAdapter) GetMetrics() *types.ConnectionMetrics {
	b.mutex.RLock()
	defer b.mutex.RUnlock()

	// Return a copy to avoid concurrent modification
	metrics := *b.metrics
	return &metrics
}

// ValidateConnection validates the connection configuration
func (b *EnhancedBaseAdapter) ValidateConnection() error {
	if b.conn == nil {
		return fmt.Errorf("connection is nil")
	}

	if b.conn.Host == "" {
		return fmt.Errorf("host is required")
	}

	if b.conn.Port <= 0 {
		return fmt.Errorf("port must be greater than 0")
	}

	if b.conn.Type == "" {
		return fmt.Errorf("database type is required")
	}

	return nil
}

// BuildConnectionString builds a connection string with SSL options
func (b *EnhancedBaseAdapter) BuildConnectionString(baseConnStr string) string {
	connStr := baseConnStr

	// Add SSL options if SSL mode is configured
	if b.config.SSLMode != "" && b.config.SSLMode != "prefer" {
		separator := "?"
		if strings.Contains(connStr, "?") {
			separator = "&"
		}
		if len(connStr) == 0 {
			connStr = "?sslmode=" + b.config.SSLMode
		} else {
			connStr += separator + "sslmode=" + b.config.SSLMode
		}

		if b.config.SSLCert != "" {
			connStr += "&sslcert=" + b.config.SSLCert
		}

		if b.config.SSLKey != "" {
			connStr += "&sslkey=" + b.config.SSLKey
		}

		if b.config.SSLRootCert != "" {
			connStr += "&sslrootcert=" + b.config.SSLRootCert
		}
	}

	return connStr
}

// Close performs cleanup when the adapter is no longer needed
func (b *EnhancedBaseAdapter) Close() {
	b.mutex.Lock()
	defer b.mutex.Unlock()

	b.logger.Infof("Closing adapter for connection %s", b.conn.Name)
}

// GetSlowQueryThreshold returns the current slow query threshold
func (b *EnhancedBaseAdapter) GetSlowQueryThreshold() time.Duration {
	b.statsMutex.RLock()
	defer b.statsMutex.RUnlock()
	return b.queryStats.SlowQueryThreshold
}

// SetSlowQueryThreshold updates the slow query threshold
func (b *EnhancedBaseAdapter) SetSlowQueryThreshold(threshold time.Duration) {
	b.statsMutex.Lock()
	defer b.statsMutex.Unlock()
	b.queryStats.SlowQueryThreshold = threshold
	b.logger.Infof("Slow query threshold updated to %v", threshold)
}
