package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"

	"github.com/jackc/pgx/v5/pgxpool"
)

// sessionRepository implements the SessionRepository interface for PostgreSQL
type sessionRepository struct {
	db *pgxpool.Pool
}

// NewSessionRepository creates a new PostgreSQL session repository
func NewSessionRepository(db *pgxpool.Pool) repositories.SessionRepository {
	return &sessionRepository{
		db: db,
	}
}

// Create creates a new session
func (r *sessionRepository) Create(ctx context.Context, session *entities.Session) error {
	query := `
		INSERT INTO sessions (id, user_id, token, refresh_token, expires_at, refresh_expires_at, 
		                     created_at, updated_at, ip_address, user_agent, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	_, err := r.db.Exec(ctx, query,
		session.ID,
		session.UserID,
		session.Token,
		session.RefreshToken,
		session.ExpiresAt,
		session.RefreshExpiresAt,
		session.CreatedAt,
		session.UpdatedAt,
		session.IPAddress,
		session.UserAgent,
		session.IsActive,
	)

	if err != nil {
		return fmt.Errorf("failed to create session: %w", err)
	}

	return nil
}

// GetByID retrieves a session by ID
func (r *sessionRepository) GetByID(ctx context.Context, id string) (*entities.Session, error) {
	query := `
		SELECT id, user_id, token, refresh_token, expires_at, refresh_expires_at,
		       created_at, updated_at, ip_address, user_agent, is_active
		FROM sessions
		WHERE id = $1
	`

	var session entities.Session
	err := r.db.QueryRow(ctx, query, id).Scan(
		&session.ID,
		&session.UserID,
		&session.Token,
		&session.RefreshToken,
		&session.ExpiresAt,
		&session.RefreshExpiresAt,
		&session.CreatedAt,
		&session.UpdatedAt,
		&session.IPAddress,
		&session.UserAgent,
		&session.IsActive,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("session not found")
		}
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	return &session, nil
}

// GetByToken retrieves a session by token
func (r *sessionRepository) GetByToken(ctx context.Context, token string) (*entities.Session, error) {
	query := `
		SELECT id, user_id, token, refresh_token, expires_at, refresh_expires_at,
		       created_at, updated_at, ip_address, user_agent, is_active
		FROM sessions
		WHERE token = $1
	`

	var session entities.Session
	err := r.db.QueryRow(ctx, query, token).Scan(
		&session.ID,
		&session.UserID,
		&session.Token,
		&session.RefreshToken,
		&session.ExpiresAt,
		&session.RefreshExpiresAt,
		&session.CreatedAt,
		&session.UpdatedAt,
		&session.IPAddress,
		&session.UserAgent,
		&session.IsActive,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("session not found")
		}
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	return &session, nil
}

// GetByRefreshToken retrieves a session by refresh token
func (r *sessionRepository) GetByRefreshToken(ctx context.Context, refreshToken string) (*entities.Session, error) {
	query := `
		SELECT id, user_id, token, refresh_token, expires_at, refresh_expires_at,
		       created_at, updated_at, ip_address, user_agent, is_active
		FROM sessions
		WHERE refresh_token = $1
	`

	var session entities.Session
	err := r.db.QueryRow(ctx, query, refreshToken).Scan(
		&session.ID,
		&session.UserID,
		&session.Token,
		&session.RefreshToken,
		&session.ExpiresAt,
		&session.RefreshExpiresAt,
		&session.CreatedAt,
		&session.UpdatedAt,
		&session.IPAddress,
		&session.UserAgent,
		&session.IsActive,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("session not found")
		}
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	return &session, nil
}

// GetByUserID retrieves active sessions for a user
func (r *sessionRepository) GetByUserID(ctx context.Context, userID string) ([]*entities.Session, error) {
	query := `
		SELECT id, user_id, token, refresh_token, expires_at, refresh_expires_at,
		       created_at, updated_at, ip_address, user_agent, is_active
		FROM sessions
		WHERE user_id = $1 AND is_active = true
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get sessions: %w", err)
	}
	defer rows.Close()

	var sessions []*entities.Session
	for rows.Next() {
		var session entities.Session
		err := rows.Scan(
			&session.ID,
			&session.UserID,
			&session.Token,
			&session.RefreshToken,
			&session.ExpiresAt,
			&session.RefreshExpiresAt,
			&session.CreatedAt,
			&session.UpdatedAt,
			&session.IPAddress,
			&session.UserAgent,
			&session.IsActive,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan session: %w", err)
		}
		sessions = append(sessions, &session)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate sessions: %w", err)
	}

	return sessions, nil
}

// Update updates an existing session
func (r *sessionRepository) Update(ctx context.Context, session *entities.Session) error {
	query := `
		UPDATE sessions
		SET token = $2, refresh_token = $3, expires_at = $4, refresh_expires_at = $5,
		    updated_at = $6, ip_address = $7, user_agent = $8, is_active = $9
		WHERE id = $1
	`

	result, err := r.db.Exec(ctx, query,
		session.ID,
		session.Token,
		session.RefreshToken,
		session.ExpiresAt,
		session.RefreshExpiresAt,
		session.UpdatedAt,
		session.IPAddress,
		session.UserAgent,
		session.IsActive,
	)

	if err != nil {
		return fmt.Errorf("failed to update session: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("session not found")
	}

	return nil
}

// Delete deletes a session by ID
func (r *sessionRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM sessions WHERE id = $1`

	result, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("session not found")
	}

	return nil
}

// DeleteByToken deletes a session by token
func (r *sessionRepository) DeleteByToken(ctx context.Context, token string) error {
	query := `DELETE FROM sessions WHERE token = $1`

	result, err := r.db.Exec(ctx, query, token)
	if err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("session not found")
	}

	return nil
}

// DeleteByUserID deletes all sessions for a user
func (r *sessionRepository) DeleteByUserID(ctx context.Context, userID string) error {
	query := `DELETE FROM sessions WHERE user_id = $1`

	_, err := r.db.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("failed to delete user sessions: %w", err)
	}

	return nil
}

// DeleteExpired deletes all expired sessions
func (r *sessionRepository) DeleteExpired(ctx context.Context) error {
	query := `
		DELETE FROM sessions 
		WHERE expires_at < $1 OR refresh_expires_at < $1
	`

	_, err := r.db.Exec(ctx, query, time.Now())
	if err != nil {
		return fmt.Errorf("failed to delete expired sessions: %w", err)
	}

	return nil
}

// Exists checks if a session exists by ID
func (r *sessionRepository) Exists(ctx context.Context, id string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM sessions WHERE id = $1)`

	var exists bool
	err := r.db.QueryRow(ctx, query, id).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check session existence: %w", err)
	}

	return exists, nil
}

// ExistsByToken checks if a session exists by token
func (r *sessionRepository) ExistsByToken(ctx context.Context, token string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM sessions WHERE token = $1)`

	var exists bool
	err := r.db.QueryRow(ctx, query, token).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check session existence: %w", err)
	}

	return exists, nil
}

// Count returns the total number of active sessions
func (r *sessionRepository) Count(ctx context.Context) (int64, error) {
	query := `SELECT COUNT(*) FROM sessions WHERE is_active = true`

	var count int64
	err := r.db.QueryRow(ctx, query).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count sessions: %w", err)
	}

	return count, nil
}

// CountByUserID returns the number of active sessions for a user
func (r *sessionRepository) CountByUserID(ctx context.Context, userID string) (int64, error) {
	query := `SELECT COUNT(*) FROM sessions WHERE user_id = $1 AND is_active = true`

	var count int64
	err := r.db.QueryRow(ctx, query, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count user sessions: %w", err)
	}

	return count, nil
}