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

// connectionRepository implements the ConnectionRepository interface for PostgreSQL
type connectionRepository struct {
	db *sql.DB
}

// NewConnectionRepository creates a new PostgreSQL connection repository
func NewConnectionRepository(db *sql.DB) repositories.ConnectionRepository {
	return &connectionRepository{db: db}
}

// Create creates a new database connection
func (r *connectionRepository) Create(ctx context.Context, connection *entities.Connection) error {
	query := `
		INSERT INTO connections (id, user_id, name, type, host, port, database, username, password, ssl, options, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`

	_, err := r.db.ExecContext(ctx, query,
		connection.ID,
		connection.UserID,
		connection.Name,
		connection.Type,
		connection.Host,
		connection.Port,
		connection.Database,
		connection.Username,
		connection.Password, // Should be encrypted before storing
		connection.SSL,
		connection.Options, // Will be marshaled to JSON
		connection.Status,
		connection.CreatedAt,
		connection.UpdatedAt,
	)

	return err
}

// GetByID retrieves a connection by ID
func (r *connectionRepository) GetByID(ctx context.Context, id string) (*entities.Connection, error) {
	query := `
		SELECT id, user_id, name, type, host, port, database, username, password, ssl, options, status, last_used, created_at, updated_at
		FROM connections
		WHERE id = $1
	`

	var connection entities.Connection
	var optionsJSON string
	var lastUsed *time.Time

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&connection.ID,
		&connection.UserID,
		&connection.Name,
		&connection.Type,
		&connection.Host,
		&connection.Port,
		&connection.Database,
		&connection.Username,
		&connection.Password,
		&connection.SSL,
		&optionsJSON,
		&connection.Status,
		&lastUsed,
		&connection.CreatedAt,
		&connection.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("connection not found")
		}
		return nil, fmt.Errorf("failed to scan connection: %w", err)
	}

	// Parse options JSON
	if optionsJSON != "" {
		if err := json.Unmarshal([]byte(optionsJSON), &connection.Options); err != nil {
			return nil, fmt.Errorf("failed to parse options: %w", err)
		}
	}

	connection.LastUsed = lastUsed
	return &connection, nil
}

// GetByUserID retrieves all connections for a user with pagination
func (r *connectionRepository) GetByUserID(ctx context.Context, userID string, limit, offset int) ([]*entities.Connection, error) {
	query := `
		SELECT id, user_id, name, type, host, port, database, username, password, ssl, options, status, last_used, created_at, updated_at
		FROM connections
		WHERE user_id = $1
		ORDER BY last_used DESC NULLS LAST, created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.QueryContext(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query connections: %w", err)
	}
	defer rows.Close()

	var connections []*entities.Connection
	for rows.Next() {
		var connection entities.Connection
		var optionsJSON string
		var lastUsed *time.Time

		err := rows.Scan(
			&connection.ID,
			&connection.UserID,
			&connection.Name,
			&connection.Type,
			&connection.Host,
			&connection.Port,
			&connection.Database,
			&connection.Username,
			&connection.Password,
			&connection.SSL,
			&optionsJSON,
			&connection.Status,
			&lastUsed,
			&connection.CreatedAt,
			&connection.UpdatedAt,
		)

		if err != nil {
			return nil, fmt.Errorf("failed to scan connection: %w", err)
		}

		// Parse options JSON
		if optionsJSON != "" {
			if err := json.Unmarshal([]byte(optionsJSON), &connection.Options); err != nil {
				return nil, fmt.Errorf("failed to parse options: %w", err)
			}
		}

		connection.LastUsed = lastUsed
		connections = append(connections, &connection)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error during rows iteration: %w", err)
	}

	return connections, nil
}

// Update updates an existing connection
func (r *connectionRepository) Update(ctx context.Context, connection *entities.Connection) error {
	query := `
		UPDATE connections
		SET name = $2, type = $3, host = $4, port = $5, database = $6, username = $7, password = $8, ssl = $9, options = $10, status = $11, updated_at = $12
		WHERE id = $1
	`

	optionsJSON, err := json.Marshal(connection.Options)
	if err != nil {
		return fmt.Errorf("failed to marshal options: %w", err)
	}

	_, err = r.db.ExecContext(ctx, query,
		connection.ID,
		connection.Name,
		connection.Type,
		connection.Host,
		connection.Port,
		connection.Database,
		connection.Username,
		connection.Password,
		connection.SSL,
		optionsJSON,
		connection.Status,
		connection.UpdatedAt,
	)

	return err
}

// Delete deletes a connection by ID
func (r *connectionRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM connections WHERE id = $1`

	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

// GetByUserAndName retrieves a connection by user ID and name
func (r *connectionRepository) GetByUserAndName(ctx context.Context, userID, name string) (*entities.Connection, error) {
	query := `
		SELECT id, user_id, name, type, host, port, database, username, password, ssl, options, status, last_used, created_at, updated_at
		FROM connections
		WHERE user_id = $1 AND name = $2
	`

	var connection entities.Connection
	var optionsJSON string
	var lastUsed *time.Time

	err := r.db.QueryRowContext(ctx, query, userID, name).Scan(
		&connection.ID,
		&connection.UserID,
		&connection.Name,
		&connection.Type,
		&connection.Host,
		&connection.Port,
		&connection.Database,
		&connection.Username,
		&connection.Password,
		&connection.SSL,
		&optionsJSON,
		&connection.Status,
		&lastUsed,
		&connection.CreatedAt,
		&connection.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("connection not found")
		}
		return nil, fmt.Errorf("failed to scan connection: %w", err)
	}

	// Parse options JSON
	if optionsJSON != "" {
		if err := json.Unmarshal([]byte(optionsJSON), &connection.Options); err != nil {
			return nil, fmt.Errorf("failed to parse options: %w", err)
		}
	}

	connection.LastUsed = lastUsed
	return &connection, nil
}

// GetActiveConnections retrieves all active connections for a user
func (r *connectionRepository) GetActiveConnections(ctx context.Context, userID string) ([]*entities.Connection, error) {
	// TODO: Implement actual database query
	return nil, fmt.Errorf("not implemented")
}

// GetByType retrieves connections by database type for a user
func (r *connectionRepository) GetByType(ctx context.Context, userID, dbType string, limit, offset int) ([]*entities.Connection, error) {
	// TODO: Implement actual database query
	return nil, fmt.Errorf("not implemented")
}

// UpdateStatus updates the connection status
func (r *connectionRepository) UpdateStatus(ctx context.Context, connectionID, status string) error {
	query := `UPDATE connections SET status = $1, updated_at = NOW() WHERE id = $2`

	_, err := r.db.ExecContext(ctx, query, status, connectionID)
	return err
}

// UpdateLastUsed updates the last used timestamp
func (r *connectionRepository) UpdateLastUsed(ctx context.Context, connectionID string) error {
	query := `UPDATE connections SET last_used = NOW(), updated_at = NOW() WHERE id = $1`

	_, err := r.db.ExecContext(ctx, query, connectionID)
	return err
}

// Count returns the total number of connections for a user
func (r *connectionRepository) Count(ctx context.Context, userID string) (int64, error) {
	query := `SELECT COUNT(*) FROM connections WHERE user_id = $1`

	var count int64
	err := r.db.QueryRowContext(ctx, query, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count connections: %w", err)
	}

	return count, nil
}

// CountByType returns the number of connections by type for a user
func (r *connectionRepository) CountByType(ctx context.Context, userID, dbType string) (int64, error) {
	// TODO: Implement actual database count
	return 0, fmt.Errorf("not implemented")
}

// GetRecentlyUsed retrieves recently used connections for a user
func (r *connectionRepository) GetRecentlyUsed(ctx context.Context, userID string, limit int) ([]*entities.Connection, error) {
	// TODO: Implement actual database query
	return nil, fmt.Errorf("not implemented")
}

// Exists checks if a connection exists by ID
func (r *connectionRepository) Exists(ctx context.Context, id string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM connections WHERE id = $1)`

	var exists bool
	err := r.db.QueryRowContext(ctx, query, id).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check connection existence: %w", err)
	}

	return exists, nil
}

// ExistsByUserAndName checks if a connection exists by user ID and name
func (r *connectionRepository) ExistsByUserAndName(ctx context.Context, userID, name string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM connections WHERE user_id = $1 AND name = $2)`

	var exists bool
	err := r.db.QueryRowContext(ctx, query, userID, name).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check connection existence: %w", err)
	}

	return exists, nil
}

// GetConnectionsRequiringHealthCheck retrieves connections that need health checks
func (r *connectionRepository) GetConnectionsRequiringHealthCheck(ctx context.Context, olderThan int) ([]*entities.Connection, error) {
	// TODO: Implement actual database query
	return nil, fmt.Errorf("not implemented")
}
