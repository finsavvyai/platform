package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
)

// oauthStateRepository implements the OAuthStateRepository interface for PostgreSQL
type oauthStateRepository struct {
	db PgxIface
}

// NewOAuthStateRepository creates a new PostgreSQL OAuth state repository
func NewOAuthStateRepository(db PgxIface) repositories.OAuthStateRepository {
	return &oauthStateRepository{db: db}
}

// Create creates a new OAuth state
func (r *oauthStateRepository) Create(ctx context.Context, state *entities.OAuthState) error {
	query := `
		INSERT INTO oauth_states (id, state, provider, redirect_uri, user_id, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	_, err := r.db.Exec(ctx, query,
		state.ID,
		state.State,
		state.Provider,
		state.RedirectURI,
		state.UserID,
		state.ExpiresAt,
		state.CreatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to create OAuth state: %w", err)
	}

	return nil
}

// GetByState retrieves an OAuth state by state string
func (r *oauthStateRepository) GetByState(ctx context.Context, state string) (*entities.OAuthState, error) {
	query := `
		SELECT id, state, provider, redirect_uri, user_id, expires_at, created_at
		FROM oauth_states
		WHERE state = $1
	`

	var oauthState entities.OAuthState
	err := r.db.QueryRow(ctx, query, state).Scan(
		&oauthState.ID,
		&oauthState.State,
		&oauthState.Provider,
		&oauthState.RedirectURI,
		&oauthState.UserID,
		&oauthState.ExpiresAt,
		&oauthState.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("OAuth state not found")
		}
		return nil, fmt.Errorf("failed to get OAuth state: %w", err)
	}

	return &oauthState, nil
}

// Delete deletes an OAuth state
func (r *oauthStateRepository) Delete(ctx context.Context, state string) error {
	query := `DELETE FROM oauth_states WHERE state = $1`

	result, err := r.db.Exec(ctx, query, state)
	if err != nil {
		return fmt.Errorf("failed to delete OAuth state: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("OAuth state not found")
	}

	return nil
}

// DeleteExpired removes expired states
func (r *oauthStateRepository) DeleteExpired(ctx context.Context) (int64, error) {
	query := `DELETE FROM oauth_states WHERE expires_at < NOW()`

	result, err := r.db.Exec(ctx, query)
	if err != nil {
		return 0, fmt.Errorf("failed to delete expired states: %w", err)
	}

	return result.RowsAffected(), nil
}

// CleanupOldStates removes states older than specified duration
func (r *oauthStateRepository) CleanupOldStates(ctx context.Context, olderThan int) (int64, error) {
	cutoffDate := time.Now().AddDate(0, 0, -olderThan)
	query := `DELETE FROM oauth_states WHERE created_at < $1`

	result, err := r.db.Exec(ctx, query, cutoffDate)
	if err != nil {
		return 0, fmt.Errorf("failed to cleanup old states: %w", err)
	}

	return result.RowsAffected(), nil
}
