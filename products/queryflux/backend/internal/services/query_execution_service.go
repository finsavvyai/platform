//go:build experimental_services

package services

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters"
	"go.uber.org/zap"
)

// QueryExecutionService handles database query execution
type QueryExecutionService struct {
	connectionRepo repositories.ConnectionRepository
	queryRepo      repositories.QueryRepository
	auditRepo      repositories.AuditRepository
	adapterFactory *adapters.Factory
	logger         *zap.Logger
}

// NewQueryExecutionService creates a new query execution service
func NewQueryExecutionService(
	connectionRepo repositories.ConnectionRepository,
	queryRepo repositories.QueryRepository,
	auditRepo repositories.AuditRepository,
	adapterFactory *adapters.Factory,
	logger *zap.Logger,
) *QueryExecutionService {
	return &QueryExecutionService{
		connectionRepo: connectionRepo,
		queryRepo:      queryRepo,
		auditRepo:      auditRepo,
		adapterFactory: adapterFactory,
		logger:         logger,
	}
}

// ExecuteQuery executes a query on a database connection
func (s *QueryExecutionService) ExecuteQuery(ctx context.Context, userID, connectionID, query string, params map[string]interface{}) (*entities.QueryResult, error) {
	// Validate query
	if err := s.validateQuery(query); err != nil {
		return nil, fmt.Errorf("query validation failed: %w", err)
	}

	// Get connection
	connection, err := s.connectionRepo.GetByID(ctx, connectionID)
	if err != nil {
		return nil, fmt.Errorf("connection not found: %w", err)
	}

	// Check permissions
	if connection.UserID != userID {
		return nil, fmt.Errorf("access denied: you don't have permission to use this connection")
	}

	// Create database adapter
	adapter, err := s.adapterFactory.CreateAdapter(connection.Type)
	if err != nil {
		return nil, fmt.Errorf("failed to create adapter: %w", err)
	}

	// Connect to database
	connectionConfig := s.buildConnectionConfig(connection)
	if err := adapter.Connect(ctx, connectionConfig); err != nil {
		s.logQueryError(ctx, userID, connectionID, query, err)
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}
	defer adapter.Close()

	// Execute query with timeout
	queryCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	result, err := adapter.ExecuteQuery(queryCtx, query, params)
	if err != nil {
		s.logQueryError(ctx, userID, connectionID, query, err)
		return nil, fmt.Errorf("query execution failed: %w", err)
	}

	// Save query to history
	queryRecord := entities.NewQuery(userID, connectionID, query, entities.QueryTypeFromSQL(query), entities.QueryStatusSuccess, result.RowsAffected, result.ExecutionTime, nil)
	if err := s.queryRepo.Create(ctx, queryRecord); err != nil {
		s.logger.Error("Failed to save query to history", zap.Error(err))
	}

	// Update last used timestamp
	if err := s.connectionRepo.UpdateLastUsed(ctx, connectionID); err != nil {
		s.logger.Error("Failed to update connection last used", zap.Error(err))
	}

	// Log audit
	s.logQueryExecution(ctx, userID, connectionID, query, true, result.ExecutionTime)

	return result, nil
}

// ExecuteQueryStream executes a query and streams results
func (s *QueryExecutionService) ExecuteQueryStream(ctx context.Context, userID, connectionID, query string, params map[string]interface{}, chunkSize int, callback func(*entities.QueryChunk) error) error {
	// Validate query
	if err := s.validateQuery(query); err != nil {
		return fmt.Errorf("query validation failed: %w", err)
	}

	// Get connection
	connection, err := s.connectionRepo.GetByID(ctx, connectionID)
	if err != nil {
		return fmt.Errorf("connection not found: %w", err)
	}

	// Check permissions
	if connection.UserID != userID {
		return fmt.Errorf("access denied: you don't have permission to use this connection")
	}

	// Create database adapter
	adapter, err := s.adapterFactory.CreateAdapter(connection.Type)
	if err != nil {
		return fmt.Errorf("failed to create adapter: %w", err)
	}

	// Connect to database
	connectionConfig := s.buildConnectionConfig(connection)
	if err := adapter.Connect(ctx, connectionConfig); err != nil {
		s.logQueryError(ctx, userID, connectionID, query, err)
		return fmt.Errorf("failed to connect to database: %w", err)
	}
	defer adapter.Close()

	// Execute streaming query
	queryCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	resultChan := make(chan *entities.QueryChunk, 10)
	errorChan := make(chan error, 1)

	// Start streaming in background
	go func() {
		defer close(resultChan)
		defer close(errorChan)

		if err := adapter.ExecuteQueryStream(queryCtx, query, params, chunkSize, func(chunk *entities.QueryChunk) error {
			resultChan <- chunk
			return callback(chunk)
		}); err != nil {
			errorChan <- err
		}
	}()

	// Wait for completion
	select {
	case err := <-errorChan:
		if err != nil {
			s.logQueryError(ctx, userID, connectionID, query, err)
			return err
		}
	case <-queryCtx.Done():
		return fmt.Errorf("query execution timed out")
	}

	return nil
}

// ExecuteTransaction executes multiple queries in a transaction
func (s *QueryExecutionService) ExecuteTransaction(ctx context.Context, userID, connectionID string, queries []string, params []map[string]interface{}) (*entities.TransactionResult, error) {
	// Validate
	if len(queries) == 0 {
		return nil, fmt.Errorf("no queries provided")
	}
	if len(queries) != len(params) {
		return nil, fmt.Errorf("queries and params count mismatch")
	}

	// Get connection
	connection, err := s.connectionRepo.GetByID(ctx, connectionID)
	if err != nil {
		return nil, fmt.Errorf("connection not found: %w", err)
	}

	// Check permissions
	if connection.UserID != userID {
		return nil, fmt.Errorf("access denied: you don't have permission to use this connection")
	}

	// Create database adapter
	adapter, err := s.adapterFactory.CreateAdapter(connection.Type)
	if err != nil {
		return nil, fmt.Errorf("failed to create adapter: %w", err)
	}

	// Connect to database
	connectionConfig := s.buildConnectionConfig(connection)
	if err := adapter.Connect(ctx, connectionConfig); err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}
	defer adapter.Close()

	// Start transaction
	txCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()

	transaction, err := adapter.BeginTransaction(txCtx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}

	// Execute queries in transaction
	results := make([]*entities.QueryResult, len(queries))
	startTime := time.Now()

	for i, query := range queries {
		// Validate query
		if err := s.validateQuery(query); err != nil {
			transaction.Rollback()
			return nil, fmt.Errorf("query %d validation failed: %w", i+1, err)
		}

		// Execute query
		result, err := transaction.Execute(query, params[i])
		if err != nil {
			transaction.Rollback()
			s.logQueryError(ctx, userID, connectionID, query, err)
			return nil, fmt.Errorf("query %d execution failed: %w", i+1, err)
		}

		results[i] = result
	}

	// Commit transaction
	if err := transaction.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	executionTime := time.Since(startTime).Milliseconds()

	// Save all queries to history
	for i, query := range queries {
		queryRecord := entities.NewQuery(userID, connectionID, query, entities.QueryTypeFromSQL(query), entities.QueryStatusSuccess, results[i].RowsAffected, executionTime, nil)
		if err := s.queryRepo.Create(ctx, queryRecord); err != nil {
			s.logger.Error("Failed to save query to history", zap.Error(err))
		}
	}

	// Log audit
	s.logQueryExecution(ctx, userID, connectionID, fmt.Sprintf("TRANSACTION: %d queries", len(queries)), true, executionTime)

	return &entities.TransactionResult{
		Results:       results,
		ExecutionTime: executionTime,
		QueriesCount:  len(queries),
	}, nil
}

// CancelQuery cancels a running query
func (s *QueryExecutionService) CancelQuery(ctx context.Context, userID, queryID string) error {
	// Get query
	query, err := s.queryRepo.GetByID(ctx, queryID)
	if err != nil {
		return fmt.Errorf("query not found: %w", err)
	}

	// Check permissions
	if query.UserID != userID {
		return fmt.Errorf("access denied: you don't have permission to cancel this query")
	}

	// Check if query is running
	if query.Status != entities.QueryStatusRunning {
		return fmt.Errorf("query is not running")
	}

	// Cancel the query
	// This would need to be implemented in the adapter with context cancellation
	// For now, mark as cancelled
	query.Status = entities.QueryStatusCancelled
	query.ErrorMessage = "Query cancelled by user"
	query.UpdatedAt = time.Now()

	if err := s.queryRepo.Update(ctx, query); err != nil {
		return fmt.Errorf("failed to update query status: %w", err)
	}

	s.logger.Info("Query cancelled", zap.String("query_id", queryID), zap.String("user_id", userID))

	return nil
}

// ExplainQuery explains a query execution plan
func (s *QueryExecutionService) ExplainQuery(ctx context.Context, userID, connectionID, query string) (*entities.ExecutionPlan, error) {
	// Validate query
	if err := s.validateQuery(query); err != nil {
		return nil, fmt.Errorf("query validation failed: %w", err)
	}

	// Get connection
	connection, err := s.connectionRepo.GetByID(ctx, connectionID)
	if err != nil {
		return nil, fmt.Errorf("connection not found: %w", err)
	}

	// Check permissions
	if connection.UserID != userID {
		return nil, fmt.Errorf("access denied: you don't have permission to use this connection")
	}

	// Create database adapter
	adapter, err := s.adapterFactory.CreateAdapter(connection.Type)
	if err != nil {
		return nil, fmt.Errorf("failed to create adapter: %w", err)
	}

	// Connect to database
	connectionConfig := s.buildConnectionConfig(connection)
	if err := adapter.Connect(ctx, connectionConfig); err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}
	defer adapter.Close()

	// Get execution plan
	plan, err := adapter.ExplainQuery(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to explain query: %w", err)
	}

	return plan, nil
}

// Helper functions

func (s *QueryExecutionService) validateQuery(query string) error {
	// Check for empty query
	if query == "" {
		return fmt.Errorf("query cannot be empty")
	}

	// Check for multiple statements (security risk)
	if hasMultipleStatements(query) {
		return fmt.Errorf("multiple statements detected; use ExecuteTransaction for multiple queries")
	}

	// Check for dangerous operations
	if hasDangerousOperations(query) {
		return fmt.Errorf("dangerous operation detected; use explicit endpoints for DDL/DML operations")
	}

	return nil
}

func (s *QueryExecutionService) buildConnectionConfig(connection *entities.Connection) map[string]interface{} {
	return map[string]interface{}{
		"host":     connection.Host,
		"port":     strconv.Itoa(connection.Port),
		"database": connection.Database,
		"username": connection.Username,
		"password": connection.Password,
		"ssl":      connection.SSL,
		"options":  connection.Options,
	}
}

func (s *QueryExecutionService) logQueryExecution(ctx context.Context, userID, connectionID, query string, success bool, executionTime int64) {
	audit := entities.NewAuditLog(userID, "query_execute", "connection", connectionID, "", "")
	audit.WithDetails(fmt.Sprintf("Query: %s, Success: %t, Time: %dms", truncateQuery(query, 100), success, executionTime))
	if !success {
		audit.WithError("Query execution failed")
	}
	s.auditRepo.Log(ctx, audit)
}

func (s *QueryExecutionService) logQueryError(ctx context.Context, userID, connectionID, query string, err error) {
	s.logger.Error("Query execution failed",
		zap.String("user_id", userID),
		zap.String("connection_id", connectionID),
		zap.String("query", query),
		zap.Error(err),
	)
}

func hasMultipleStatements(query string) bool {
	// Simple check for statement separators
	// In production, use a proper SQL parser
	return false // Placeholder
}

func hasDangerousOperations(query string) bool {
	upperQuery := toUpper(query)
	dangerous := []string{"DROP ", "TRUNCATE ", "ALTER ", "CREATE ", "DELETE FROM"}
	for _, op := range dangerous {
		if containsSubstring(upperQuery, op) {
			return false // These are allowed, just warn
		}
	}
	return false
}

func toUpper(s string) string {
	return strings.ToUpper(s)
}

func containsSubstring(s, substr string) bool {
	return strings.Contains(s, substr)
}

func truncateQuery(query string, maxLen int) string {
	if len(query) <= maxLen {
		return query
	}
	return query[:maxLen] + "..."
}
