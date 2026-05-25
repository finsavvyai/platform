package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
)

// queryService implements the QueryService interface
type queryService struct {
	queryRepo      repositories.QueryRepository
	connectionRepo repositories.ConnectionRepository
}

// NewQueryService creates a new query service
func NewQueryService(queryRepo repositories.QueryRepository, connectionRepo repositories.ConnectionRepository) QueryService {
	return &queryService{
		queryRepo:      queryRepo,
		connectionRepo: connectionRepo,
	}
}

// Execute executes a SQL query
func (s *queryService) Execute(ctx context.Context, userID, connectionID, sql string) (*entities.Query, error) {
	// Verify connection exists and belongs to user
	connection, err := s.connectionRepo.GetByID(ctx, connectionID)
	if err != nil {
		return nil, fmt.Errorf("connection not found: %w", err)
	}
	if connection.UserID != userID {
		return nil, fmt.Errorf("access denied to connection")
	}

	// Create query entity
	query, err := entities.NewQuery(userID, connectionID, sql)
	if err != nil {
		return nil, fmt.Errorf("failed to create query entity: %w", err)
	}

	// Set execution start time
	startTime := time.Now()
	query.ExecutedAt = startTime
	query.Status = "running"

	// Save initial query record
	if err := s.queryRepo.Create(ctx, query); err != nil {
		return nil, fmt.Errorf("failed to save query: %w", err)
	}

	// Phase-1: the legacy mock executor path is intentionally disabled so
	// FIX-E cannot accidentally leave fake "Sample Data" / "Another Row"
	// rows on a production HTTP path. Execution must go through
	// application/services/query.SafeQueryRunner.
	_ = startTime
	return nil, errors.New("query_service: not implemented - use SafeQueryRunner")
}

// GetByID retrieves a query by ID
func (s *queryService) GetByID(ctx context.Context, id string) (*entities.Query, error) {
	query, err := s.queryRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get query: %w", err)
	}
	return query, nil
}

// GetHistory retrieves query history
func (s *queryService) GetHistory(ctx context.Context, connectionID string, limit, offset int) ([]*entities.Query, error) {
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	queries, err := s.queryRepo.GetHistory(ctx, connectionID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get query history: %w", err)
	}

	return queries, nil
}

// GetUserHistory retrieves user query history
func (s *queryService) GetUserHistory(ctx context.Context, userID string, limit, offset int) ([]*entities.Query, error) {
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	queries, err := s.queryRepo.GetUserHistory(ctx, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get user query history: %w", err)
	}

	return queries, nil
}

// Save saves a query with a name
func (s *queryService) Save(ctx context.Context, userID, connectionID, name, sql string) (*entities.Query, error) {
	// Verify connection exists and belongs to user
	connection, err := s.connectionRepo.GetByID(ctx, connectionID)
	if err != nil {
		return nil, fmt.Errorf("connection not found: %w", err)
	}
	if connection.UserID != userID {
		return nil, fmt.Errorf("access denied to connection")
	}

	// Check if saved query with same name already exists
	exists, err := s.queryRepo.ExistsByConnectionAndName(ctx, connectionID, name)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing saved query: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("saved query with name '%s' already exists", name)
	}

	// Create query entity
	query, err := entities.NewQuery(userID, connectionID, sql)
	if err != nil {
		return nil, fmt.Errorf("failed to create query entity: %w", err)
	}

	query.Name = name
	query.Status = "saved"
	query.ExecutedAt = time.Now()

	// Save query
	if err := s.queryRepo.Create(ctx, query); err != nil {
		return nil, fmt.Errorf("failed to save query: %w", err)
	}

	return query, nil
}

// GetSavedQueries retrieves saved queries
func (s *queryService) GetSavedQueries(ctx context.Context, userID string, limit, offset int) ([]*entities.Query, error) {
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	queries, err := s.queryRepo.GetSavedQueries(ctx, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get saved queries: %w", err)
	}

	return queries, nil
}

// Delete deletes a query
func (s *queryService) Delete(ctx context.Context, id string) error {
	// Check if query exists
	exists, err := s.queryRepo.Exists(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to check query existence: %w", err)
	}
	if !exists {
		return fmt.Errorf("query not found")
	}

	// Delete the query
	if err := s.queryRepo.Delete(ctx, id); err != nil {
		return fmt.Errorf("failed to delete query: %w", err)
	}

	return nil
}

// Cancel cancels a running query
func (s *queryService) Cancel(ctx context.Context, queryID string) error {
	// Get the query
	query, err := s.queryRepo.GetByID(ctx, queryID)
	if err != nil {
		return fmt.Errorf("query not found: %w", err)
	}

	// Check if query is running
	if query.Status != "running" {
		return fmt.Errorf("query is not running")
	}

	// Update query status to cancelled
	query.Status = "cancelled"
	query.Error = "Query was cancelled by user"

	if err := s.queryRepo.Update(ctx, query); err != nil {
		return fmt.Errorf("failed to update query status: %w", err)
	}

	// TODO: Implement actual query cancellation in database adapter

	return nil
}

// GetRunningQueries retrieves running queries for a user
func (s *queryService) GetRunningQueries(ctx context.Context, userID string) ([]*entities.Query, error) {
	queries, err := s.queryRepo.GetUserRunningQueries(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get running queries: %w", err)
	}

	return queries, nil
}

// GetExecutionStats retrieves query execution statistics
func (s *queryService) GetExecutionStats(ctx context.Context, userID string, days int) (*repositories.QueryExecutionStats, error) {
	if days <= 0 {
		days = 30
	}

	stats, err := s.queryRepo.GetExecutionStats(ctx, userID, days)
	if err != nil {
		return nil, fmt.Errorf("failed to get execution stats: %w", err)
	}

	return stats, nil
}

// Search searches queries by SQL content or name
func (s *queryService) Search(ctx context.Context, userID, searchTerm string, limit, offset int) ([]*entities.Query, error) {
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	queries, err := s.queryRepo.Search(ctx, userID, searchTerm, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to search queries: %w", err)
	}

	return queries, nil
}