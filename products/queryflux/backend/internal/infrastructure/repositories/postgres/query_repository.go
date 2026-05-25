package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
)

// queryRepository implements the QueryRepository interface for PostgreSQL
type queryRepository struct {
	db *sql.DB
}

// NewQueryRepository creates a new PostgreSQL query repository
func NewQueryRepository(db *sql.DB) repositories.QueryRepository {
	return &queryRepository{db: db}
}

// Create creates a new query record
func (r *queryRepository) Create(ctx context.Context, query *entities.Query) error {
	querySQL := `
		INSERT INTO queries (id, user_id, connection_id, name, sql, results, row_count, duration_ms, status, error, executed_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`

	// Convert results to JSON for storage
	resultsJSON, err := json.Marshal(query.Results)
	if err != nil {
		return fmt.Errorf("failed to marshal results: %w", err)
	}

	_, err = r.db.ExecContext(ctx, querySQL,
		query.ID,
		query.UserID,
		query.ConnectionID,
		query.Name,
		query.SQL,
		resultsJSON,
		query.RowCount,
		query.Duration,
		query.Status,
		query.Error,
		query.ExecutedAt,
		query.CreatedAt,
	)

	return err
}

// GetByID retrieves a query by ID
func (r *queryRepository) GetByID(ctx context.Context, id string) (*entities.Query, error) {
	querySQL := `
		SELECT id, user_id, connection_id, name, sql, results, row_count, duration_ms, status, error, executed_at, created_at
		FROM queries
		WHERE id = $1
	`

	var query entities.Query
	var resultsJSON string

	err := r.db.QueryRowContext(ctx, querySQL, id).Scan(
		&query.ID,
		&query.UserID,
		&query.ConnectionID,
		&query.Name,
		&query.SQL,
		&resultsJSON,
		&query.RowCount,
		&query.Duration,
		&query.Status,
		&query.Error,
		&query.ExecutedAt,
		&query.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("query not found")
		}
		return nil, fmt.Errorf("failed to scan query: %w", err)
	}

	// Parse results JSON
	if resultsJSON != "" {
		if err := json.Unmarshal([]byte(resultsJSON), &query.Results); err != nil {
			return nil, fmt.Errorf("failed to parse results: %w", err)
		}
	}

	return &query, nil
}

// Update updates an existing query
func (r *queryRepository) Update(ctx context.Context, query *entities.Query) error {
	// TODO: Implement actual database update
	return fmt.Errorf("not implemented")
}

// Delete deletes a query by ID
func (r *queryRepository) Delete(ctx context.Context, id string) error {
	// TODO: Implement actual database deletion
	return fmt.Errorf("not implemented")
}

// GetHistory retrieves query history for a connection with pagination
func (r *queryRepository) GetHistory(ctx context.Context, connectionID string, limit, offset int) ([]*entities.Query, error) {
	// TODO: Implement actual database query
	return nil, fmt.Errorf("not implemented")
}

// GetUserHistory retrieves query history for a user with pagination
func (r *queryRepository) GetUserHistory(ctx context.Context, userID string, limit, offset int) ([]*entities.Query, error) {
	querySQL := `
		SELECT id, user_id, connection_id, name, sql, results, row_count, duration_ms, status, error, executed_at, created_at
		FROM queries
		WHERE user_id = $1
		ORDER BY executed_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.QueryContext(ctx, querySQL, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query user history: %w", err)
	}
	defer rows.Close()

	var queries []*entities.Query
	for rows.Next() {
		var query entities.Query
		var resultsJSON string

		err := rows.Scan(
			&query.ID,
			&query.UserID,
			&query.ConnectionID,
			&query.Name,
			&query.SQL,
			&resultsJSON,
			&query.RowCount,
			&query.Duration,
			&query.Status,
			&query.Error,
			&query.ExecutedAt,
			&query.CreatedAt,
		)

		if err != nil {
			return nil, fmt.Errorf("failed to scan query: %w", err)
		}

		// Parse results JSON
		if resultsJSON != "" {
			if err := json.Unmarshal([]byte(resultsJSON), &query.Results); err != nil {
				return nil, fmt.Errorf("failed to parse results: %w", err)
			}
		}

		queries = append(queries, &query)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error during rows iteration: %w", err)
	}

	return queries, nil
}

// GetByStatus retrieves queries by status
func (r *queryRepository) GetByStatus(ctx context.Context, status string, limit, offset int) ([]*entities.Query, error) {
	// TODO: Implement actual database query
	return nil, fmt.Errorf("not implemented")
}

// GetRunningQueries retrieves all currently running queries
func (r *queryRepository) GetRunningQueries(ctx context.Context) ([]*entities.Query, error) {
	// TODO: Implement actual database query
	return nil, fmt.Errorf("not implemented")
}

// GetUserRunningQueries retrieves running queries for a specific user
func (r *queryRepository) GetUserRunningQueries(ctx context.Context, userID string) ([]*entities.Query, error) {
	// TODO: Implement actual database query
	return nil, fmt.Errorf("not implemented")
}

// GetSavedQueries retrieves saved (named) queries for a user
func (r *queryRepository) GetSavedQueries(ctx context.Context, userID string, limit, offset int) ([]*entities.Query, error) {
	// TODO: Implement actual database query
	return nil, fmt.Errorf("not implemented")
}

// GetByConnectionAndName retrieves a saved query by connection and name
func (r *queryRepository) GetByConnectionAndName(ctx context.Context, connectionID, name string) (*entities.Query, error) {
	// TODO: Implement actual database query
	return nil, fmt.Errorf("not implemented")
}

// Search searches queries by SQL content or name
func (r *queryRepository) Search(ctx context.Context, userID, searchTerm string, limit, offset int) ([]*entities.Query, error) {
	// TODO: Implement actual database search
	return nil, fmt.Errorf("not implemented")
}

// GetByDateRange retrieves queries within a date range
func (r *queryRepository) GetByDateRange(ctx context.Context, userID string, startDate, endDate time.Time, limit, offset int) ([]*entities.Query, error) {
	// TODO: Implement actual database query
	return nil, fmt.Errorf("not implemented")
}

// GetByType retrieves queries by type (SELECT, INSERT, etc.)
func (r *queryRepository) GetByType(ctx context.Context, userID, queryType string, limit, offset int) ([]*entities.Query, error) {
	// TODO: Implement actual database query
	return nil, fmt.Errorf("not implemented")
}

// Count returns the total number of queries for a user
func (r *queryRepository) Count(ctx context.Context, userID string) (int64, error) {
	// TODO: Implement actual database count
	return 0, fmt.Errorf("not implemented")
}

// CountByConnection returns the number of queries for a connection
func (r *queryRepository) CountByConnection(ctx context.Context, connectionID string) (int64, error) {
	// TODO: Implement actual database count
	return 0, fmt.Errorf("not implemented")
}

// CountByStatus returns the number of queries by status
func (r *queryRepository) CountByStatus(ctx context.Context, userID, status string) (int64, error) {
	// TODO: Implement actual database count
	return 0, fmt.Errorf("not implemented")
}

// GetExecutionStats retrieves execution statistics for a user
func (r *queryRepository) GetExecutionStats(ctx context.Context, userID string, days int) (*repositories.QueryExecutionStats, error) {
	// TODO: Implement actual database aggregation
	return nil, fmt.Errorf("not implemented")
}

// GetSlowQueries retrieves queries that took longer than specified duration
func (r *queryRepository) GetSlowQueries(ctx context.Context, userID string, minDuration int64, limit, offset int) ([]*entities.Query, error) {
	// TODO: Implement actual database query
	return nil, fmt.Errorf("not implemented")
}

// GetFrequentQueries retrieves most frequently executed queries
func (r *queryRepository) GetFrequentQueries(ctx context.Context, userID string, limit int) ([]*repositories.FrequentQuery, error) {
	// TODO: Implement actual database aggregation
	return nil, fmt.Errorf("not implemented")
}

// DeleteOldQueries deletes queries older than specified days
func (r *queryRepository) DeleteOldQueries(ctx context.Context, olderThanDays int) (int64, error) {
	// TODO: Implement actual database deletion
	return 0, fmt.Errorf("not implemented")
}

// Exists checks if a query exists by ID
func (r *queryRepository) Exists(ctx context.Context, id string) (bool, error) {
	// TODO: Implement actual database check
	return false, fmt.Errorf("not implemented")
}

// ExistsByConnectionAndName checks if a saved query exists by connection and name
func (r *queryRepository) ExistsByConnectionAndName(ctx context.Context, connectionID, name string) (bool, error) {
	// TODO: Implement actual database check
	return false, fmt.Errorf("not implemented")
}
