package repositories

import (
	"context"
	"github.com/queryflux/backend/internal/domain/entities"
	"time"
)

// MetricsRepository defines the interface for database metrics operations
type MetricsRepository interface {
	// Create creates a new metrics record
	Create(ctx context.Context, metrics *entities.DatabaseMetrics) error

	// GetByID retrieves metrics by ID
	GetByID(ctx context.Context, id string) (*entities.DatabaseMetrics, error)

	// GetLatest retrieves the latest metrics for a connection
	GetLatest(ctx context.Context, connectionID string) (*entities.DatabaseMetrics, error)

	// GetByConnectionID retrieves metrics for a connection with pagination
	GetByConnectionID(ctx context.Context, connectionID string, limit, offset int) ([]*entities.DatabaseMetrics, error)

	// GetByDateRange retrieves metrics within a date range
	GetByDateRange(ctx context.Context, connectionID string, startTime, endTime time.Time, limit, offset int) ([]*entities.DatabaseMetrics, error)

	// GetAverageMetrics calculates average metrics over a time period
	GetAverageMetrics(ctx context.Context, connectionID string, startTime, endTime time.Time) (*entities.DatabaseMetrics, error)

	// Delete deletes metrics by ID
	Delete(ctx context.Context, id string) error

	// DeleteOldMetrics deletes metrics older than specified days
	DeleteOldMetrics(ctx context.Context, olderThanDays int) (int64, error)

	// Count returns the total number of metrics records for a connection
	Count(ctx context.Context, connectionID string) (int64, error)

	// GetMetricsSummary retrieves metrics summary for a connection
	GetMetricsSummary(ctx context.Context, connectionID string, days int) (*MetricsSummary, error)

	// Exists checks if metrics exist by ID
	Exists(ctx context.Context, id string) (bool, error)
}

// MetricsSummary represents metrics summary information
type MetricsSummary struct {
	ConnectionID        string    `json:"connection_id"`
	AverageCPUUsage     float64   `json:"average_cpu_usage"`
	AverageMemoryUsage  float64   `json:"average_memory_usage"`
	AverageConnections  float64   `json:"average_connections"`
	AverageQueryTime    float64   `json:"average_query_time"`
	MaxCPUUsage         float64   `json:"max_cpu_usage"`
	MaxMemoryUsage      float64   `json:"max_memory_usage"`
	MaxConnections      int       `json:"max_connections"`
	TotalQueries        int64     `json:"total_queries"`
	StartTime           time.Time `json:"start_time"`
	EndTime             time.Time `json:"end_time"`
}