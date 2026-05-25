package repositories

import (
	"context"
	"github.com/queryflux/backend/internal/domain/entities"
	"time"
)

// QueryRepository defines the interface for query data operations
type QueryRepository interface {
	// Create creates a new query record
	Create(ctx context.Context, query *entities.Query) error

	// GetByID retrieves a query by ID
	GetByID(ctx context.Context, id string) (*entities.Query, error)

	// Update updates an existing query
	Update(ctx context.Context, query *entities.Query) error

	// Delete deletes a query by ID
	Delete(ctx context.Context, id string) error

	// GetHistory retrieves query history for a connection with pagination
	GetHistory(ctx context.Context, connectionID string, limit, offset int) ([]*entities.Query, error)

	// GetUserHistory retrieves query history for a user with pagination
	GetUserHistory(ctx context.Context, userID string, limit, offset int) ([]*entities.Query, error)

	// GetByStatus retrieves queries by status
	GetByStatus(ctx context.Context, status string, limit, offset int) ([]*entities.Query, error)

	// GetRunningQueries retrieves all currently running queries
	GetRunningQueries(ctx context.Context) ([]*entities.Query, error)

	// GetUserRunningQueries retrieves running queries for a specific user
	GetUserRunningQueries(ctx context.Context, userID string) ([]*entities.Query, error)

	// GetSavedQueries retrieves saved (named) queries for a user
	GetSavedQueries(ctx context.Context, userID string, limit, offset int) ([]*entities.Query, error)

	// GetByConnectionAndName retrieves a saved query by connection and name
	GetByConnectionAndName(ctx context.Context, connectionID, name string) (*entities.Query, error)

	// Search searches queries by SQL content or name
	Search(ctx context.Context, userID, searchTerm string, limit, offset int) ([]*entities.Query, error)

	// GetByDateRange retrieves queries within a date range
	GetByDateRange(ctx context.Context, userID string, startDate, endDate time.Time, limit, offset int) ([]*entities.Query, error)

	// GetByType retrieves queries by type (SELECT, INSERT, etc.)
	GetByType(ctx context.Context, userID, queryType string, limit, offset int) ([]*entities.Query, error)

	// Count returns the total number of queries for a user
	Count(ctx context.Context, userID string) (int64, error)

	// CountByConnection returns the number of queries for a connection
	CountByConnection(ctx context.Context, connectionID string) (int64, error)

	// CountByStatus returns the number of queries by status
	CountByStatus(ctx context.Context, userID, status string) (int64, error)

	// GetExecutionStats retrieves execution statistics for a user
	GetExecutionStats(ctx context.Context, userID string, days int) (*QueryExecutionStats, error)

	// GetSlowQueries retrieves queries that took longer than specified duration
	GetSlowQueries(ctx context.Context, userID string, minDuration int64, limit, offset int) ([]*entities.Query, error)

	// GetFrequentQueries retrieves most frequently executed queries
	GetFrequentQueries(ctx context.Context, userID string, limit int) ([]*FrequentQuery, error)

	// DeleteOldQueries deletes queries older than specified days
	DeleteOldQueries(ctx context.Context, olderThanDays int) (int64, error)

	// Exists checks if a query exists by ID
	Exists(ctx context.Context, id string) (bool, error)

	// ExistsByConnectionAndName checks if a saved query exists by connection and name
	ExistsByConnectionAndName(ctx context.Context, connectionID, name string) (bool, error)
}

// QueryExecutionStats represents query execution statistics
type QueryExecutionStats struct {
	TotalQueries     int64   `json:"total_queries"`
	SuccessfulQueries int64   `json:"successful_queries"`
	FailedQueries    int64   `json:"failed_queries"`
	AverageExecutionTime float64 `json:"average_execution_time"`
	TotalExecutionTime   int64   `json:"total_execution_time"`
	QueriesPerDay       []DailyQueryCount `json:"queries_per_day"`
}

// DailyQueryCount represents query count for a specific day
type DailyQueryCount struct {
	Date  time.Time `json:"date"`
	Count int64     `json:"count"`
}

// FrequentQuery represents a frequently executed query
type FrequentQuery struct {
	SQL           string `json:"sql"`
	ExecutionCount int64  `json:"execution_count"`
	AverageTime   float64 `json:"average_time"`
	LastExecuted  time.Time `json:"last_executed"`
}