package services

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/adapters/database"
	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
	"go.uber.org/zap"
)

// DatabaseMetricsService manages database metrics collection for all active connections
type DatabaseMetricsService struct {
	logger      *zap.Logger
	collectors  map[string]ports.DatabaseMetricsCollector
	connections map[string]*sql.DB
	mu          sync.RWMutex
	ctx         context.Context
	cancel      context.CancelFunc
	wg          sync.WaitGroup
}

// NewDatabaseMetricsService creates a new database metrics service
func NewDatabaseMetricsService(logger *zap.Logger) *DatabaseMetricsService {
	ctx, cancel := context.WithCancel(context.Background())

	return &DatabaseMetricsService{
		logger:      logger,
		collectors:  make(map[string]ports.DatabaseMetricsCollector),
		connections: make(map[string]*sql.DB),
		ctx:         ctx,
		cancel:      cancel,
	}
}

// RegisterConnection registers a database connection for metrics collection
func (s *DatabaseMetricsService) RegisterConnection(ctx context.Context, connectionID string, db *sql.DB, dbType string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Store connection
	s.connections[connectionID] = db

	// Create appropriate collector based on database type
	var collector ports.DatabaseMetricsCollector
	var err error

	switch dbType {
	case "postgresql", "postgres":
		collector, err = database.NewPostgreSQLMetricsCollector(s.logger, db, connectionID)
	case "mysql":
		collector, err = database.NewMySQLMetricsCollector(s.logger, db, connectionID)
	case "sqlite":
		collector, err = database.NewSQLiteMetricsCollector(s.logger, db, connectionID)
	default:
		return fmt.Errorf("unsupported database type: %s", dbType)
	}

	if err != nil {
		return fmt.Errorf("failed to create metrics collector for %s: %w", dbType, err)
	}

	s.collectors[connectionID] = collector

	s.logger.Info("Database connection registered for metrics collection",
		zap.String("connection_id", connectionID),
		zap.String("database_type", dbType))

	return nil
}

// UnregisterConnection removes a database connection from metrics collection
func (s *DatabaseMetricsService) UnregisterConnection(ctx context.Context, connectionID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.connections, connectionID)
	delete(s.collectors, connectionID)

	s.logger.Info("Database connection unregistered from metrics collection",
		zap.String("connection_id", connectionID))

	return nil
}

// CollectAllMetrics collects metrics from all registered database connections
func (s *DatabaseMetricsService) CollectAllMetrics(ctx context.Context) ([]*domain.DatabaseMetrics, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var allMetrics []*domain.DatabaseMetrics
	var wg sync.WaitGroup
	resultsChan := make(chan *domain.DatabaseMetrics, len(s.collectors))

	// Collect metrics concurrently from all connections
	for connectionID, collector := range s.collectors {
		wg.Add(1)
		go func(id string, c ports.DatabaseMetricsCollector) {
			defer wg.Done()
			metrics, err := c.CollectDatabaseMetrics(ctx, id)
			if err != nil {
				s.logger.Error("Failed to collect database metrics",
					zap.Error(err),
					zap.String("connection_id", id))
				return
			}
			resultsChan <- metrics
		}(connectionID, collector)
	}

	// Wait for all collections to complete
	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	// Collect results
	for metrics := range resultsChan {
		allMetrics = append(allMetrics, metrics)
	}

	return allMetrics, nil
}

// CollectMetrics collects metrics from a specific database connection
func (s *DatabaseMetricsService) CollectMetrics(ctx context.Context, connectionID string) (*domain.DatabaseMetrics, error) {
	s.mu.RLock()
	collector, exists := s.collectors[connectionID]
	s.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("no collector registered for connection: %s", connectionID)
	}

	return collector.CollectDatabaseMetrics(ctx, connectionID)
}

// CollectConnectionMetrics collects connection-specific metrics
func (s *DatabaseMetricsService) CollectConnectionMetrics(ctx context.Context, connectionID string) (*ports.ConnectionMetrics, error) {
	s.mu.RLock()
	collector, exists := s.collectors[connectionID]
	s.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("no collector registered for connection: %s", connectionID)
	}

	return collector.CollectConnectionMetrics(ctx, connectionID)
}

// CollectQueryMetrics collects query execution metrics
func (s *DatabaseMetricsService) CollectQueryMetrics(ctx context.Context, connectionID string, limit int) ([]*domain.QueryMetric, error) {
	s.mu.RLock()
	collector, exists := s.collectors[connectionID]
	s.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("no collector registered for connection: %s", connectionID)
	}

	return collector.CollectQueryMetrics(ctx, connectionID, limit)
}

// CollectTableMetrics collects table-level metrics
func (s *DatabaseMetricsService) CollectTableMetrics(ctx context.Context, connectionID string) ([]*domain.TableMetric, error) {
	s.mu.RLock()
	collector, exists := s.collectors[connectionID]
	s.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("no collector registered for connection: %s", connectionID)
	}

	return collector.CollectTableMetrics(ctx, connectionID)
}

// CollectIndexMetrics collects index usage metrics
func (s *DatabaseMetricsService) CollectIndexMetrics(ctx context.Context, connectionID string) ([]*domain.IndexMetric, error) {
	s.mu.RLock()
	collector, exists := s.collectors[connectionID]
	s.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("no collector registered for connection: %s", connectionID)
	}

	return collector.CollectIndexMetrics(ctx, connectionID)
}

// EnablePeriodicCollection enables periodic metrics collection for all connections
func (s *DatabaseMetricsService) EnablePeriodicCollection(ctx context.Context, interval time.Duration) error {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-s.ctx.Done():
				return
			case <-ticker.C:
				if err := s.collectAndStoreMetrics(ctx); err != nil {
					s.logger.Error("Failed to collect and store metrics", zap.Error(err))
				}
			}
		}
	}()

	s.logger.Info("Periodic database metrics collection enabled",
		zap.Duration("interval", interval))

	return nil
}

// DisablePeriodicCollection stops periodic metrics collection
func (s *DatabaseMetricsService) DisablePeriodicCollection() {
	s.cancel()
	s.wg.Wait()
	s.logger.Info("Periodic database metrics collection disabled")
}

// GetRegisteredConnections returns a list of all registered connection IDs
func (s *DatabaseMetricsService) GetRegisteredConnections() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	connections := make([]string, 0, len(s.collectors))
	for connectionID := range s.collectors {
		connections = append(connections, connectionID)
	}
	return connections
}

// GetConnectionType returns the database type for a connection ID
func (s *DatabaseMetricsService) GetConnectionType(connectionID string) (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	collector, exists := s.collectors[connectionID]
	if !exists {
		return "", fmt.Errorf("no collector registered for connection: %s", connectionID)
	}

	// This is a simplified way to get the database type
	// In practice, you might want to store the database type when registering
	switch collector.(type) {
	case *database.PostgreSQLMetricsCollector:
		return "postgresql", nil
	case *database.MySQLMetricsCollector:
		return "mysql", nil
	case *database.SQLiteMetricsCollector:
		return "sqlite", nil
	default:
		return "unknown", nil
	}
}

// GetConnectionStats returns statistics about registered connections
func (s *DatabaseMetricsService) GetConnectionStats() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	stats := make(map[string]interface{})
	stats["total_connections"] = len(s.collectors)
	stats["active_collectors"] = len(s.collectors)

	// Count by database type
	dbTypes := make(map[string]int)
	for _, collector := range s.collectors {
		switch collector.(type) {
		case *database.PostgreSQLMetricsCollector:
			dbTypes["postgresql"]++
		case *database.MySQLMetricsCollector:
			dbTypes["mysql"]++
		case *database.SQLiteMetricsCollector:
			dbTypes["sqlite"]++
		}
	}
	stats["database_types"] = dbTypes

	return stats
}

// TestConnection tests if a database connection is healthy
func (s *DatabaseMetricsService) TestConnection(ctx context.Context, connectionID string) error {
	s.mu.RLock()
	db, exists := s.connections[connectionID]
	s.mu.RUnlock()

	if !exists {
		return fmt.Errorf("no connection registered for: %s", connectionID)
	}

	return db.PingContext(ctx)
}

// CleanupConnection performs cleanup for a connection being removed
func (s *DatabaseMetricsService) CleanupConnection(ctx context.Context, connectionID string) error {
	// Disable periodic collection for this connection if needed
	if err := s.UnregisterConnection(ctx, connectionID); err != nil {
		return fmt.Errorf("failed to unregister connection: %w", err)
	}

	// Close the database connection
	s.mu.Lock()
	defer s.mu.Unlock()

	if db, exists := s.connections[connectionID]; exists {
		if err := db.Close(); err != nil {
			s.logger.Error("Failed to close database connection",
				zap.Error(err),
				zap.String("connection_id", connectionID))
		}
		delete(s.connections, connectionID)
	}

	return nil
}

// Private helper methods

func (s *DatabaseMetricsService) collectAndStoreMetrics(ctx context.Context) error {
	metrics, err := s.CollectAllMetrics(ctx)
	if err != nil {
		return fmt.Errorf("failed to collect all metrics: %w", err)
	}

	// Convert to domain metrics for storage
	domainMetrics := make([]*domain.Metric, 0)
	for _, dbMetrics := range metrics {
		domainMetrics = append(domainMetrics, s.databaseMetricsToDomainMetrics(dbMetrics)...)
	}

	// This would normally store metrics in the metrics storage
	// For now, just log the collection
	s.logger.Debug("Collected database metrics",
		zap.Int("connections_count", len(metrics)),
		zap.Int("total_metrics", len(domainMetrics)))

	return nil
}

func (s *DatabaseMetricsService) databaseMetricsToDomainMetrics(dbMetrics *domain.DatabaseMetrics) []*domain.Metric {
	var metrics []*domain.Metric
	timestamp := dbMetrics.Timestamp

	// Connection metrics
	metrics = append(metrics, &domain.Metric{
		ID:      fmt.Sprintf("%s_connections_active", dbMetrics.ConnectionID),
		Name:    "database_connections_active",
		Type:    domain.MetricTypeGauge,
		Value:   float64(dbMetrics.ActiveConnections),
		Labels: map[string]string{
			"connection_id": dbMetrics.ConnectionID,
			"database_type": dbMetrics.DatabaseType,
		},
		Timestamp: timestamp,
		Unit:      "count",
	})

	metrics = append(metrics, &domain.Metric{
		ID:      fmt.Sprintf("%s_connections_total", dbMetrics.ConnectionID),
		Name:    "database_connections_total",
		Type:    domain.MetricTypeGauge,
		Value:   float64(dbMetrics.TotalConnections),
		Labels: map[string]string{
			"connection_id": dbMetrics.ConnectionID,
			"database_type": dbMetrics.DatabaseType,
		},
		Timestamp: timestamp,
		Unit:      "count",
	})

	// Query metrics
	metrics = append(metrics, &domain.Metric{
		ID:      fmt.Sprintf("%s_queries_total", dbMetrics.ConnectionID),
		Name:    "database_queries_total",
		Type:    domain.MetricTypeCounter,
		Value:   float64(dbMetrics.QueryCount),
		Labels: map[string]string{
			"connection_id": dbMetrics.ConnectionID,
			"database_type": dbMetrics.DatabaseType,
		},
		Timestamp: timestamp,
		Unit:      "count",
	})

	metrics = append(metrics, &domain.Metric{
		ID:      fmt.Sprintf("%s_slow_queries", dbMetrics.ConnectionID),
		Name:    "database_slow_queries_total",
		Type:    domain.MetricTypeCounter,
		Value:   float64(dbMetrics.SlowQueryCount),
		Labels: map[string]string{
			"connection_id": dbMetrics.ConnectionID,
			"database_type": dbMetrics.DatabaseType,
		},
		Timestamp: timestamp,
		Unit:      "count",
	})

	// Performance metrics
	metrics = append(metrics, &domain.Metric{
		ID:      fmt.Sprintf("%s_cache_hit_ratio", dbMetrics.ConnectionID),
		Name:    "database_cache_hit_ratio",
		Type:    domain.MetricTypeGauge,
		Value:   dbMetrics.CacheHitRatio,
		Labels: map[string]string{
			"connection_id": dbMetrics.ConnectionID,
			"database_type": dbMetrics.DatabaseType,
		},
		Timestamp: timestamp,
		Unit:      "percent",
	})

	// Resource metrics
	metrics = append(metrics, &domain.Metric{
		ID:      fmt.Sprintf("%s_cpu_usage", dbMetrics.ConnectionID),
		Name:    "database_cpu_usage",
		Type:    domain.MetricTypeGauge,
		Value:   dbMetrics.CPUUsage,
		Labels: map[string]string{
			"connection_id": dbMetrics.ConnectionID,
			"database_type": dbMetrics.DatabaseType,
		},
		Timestamp: timestamp,
		Unit:      "percent",
	})

	metrics = append(metrics, &domain.Metric{
		ID:      fmt.Sprintf("%s_memory_usage", dbMetrics.ConnectionID),
		Name:    "database_memory_usage",
		Type:    domain.MetricTypeGauge,
		Value:   float64(dbMetrics.MemoryUsage),
		Labels: map[string]string{
			"connection_id": dbMetrics.ConnectionID,
			"database_type": dbMetrics.DatabaseType,
		},
		Timestamp: timestamp,
		Unit:      "bytes",
	})

	return metrics
}