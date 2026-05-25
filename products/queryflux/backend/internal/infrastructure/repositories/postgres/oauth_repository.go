package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
)

// oauthRepository implements the OAuthRepository interface for PostgreSQL
type oauthRepository struct {
	db PgxIface
}

// NewOAuthRepository creates a new PostgreSQL OAuth repository
func NewOAuthRepository(db PgxIface) repositories.OAuthRepository {
	return &oauthRepository{db: db}
}

// Create creates a new OAuth account link
func (r *oauthRepository) Create(ctx context.Context, account *entities.OAuthAccount) error {
	query := `
		INSERT INTO oauth_accounts (id, user_id, provider, provider_id, email, access_token, refresh_token, token_expiry, scopes, metadata, created_at, updated_at, last_used_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`

	_, err := r.db.Exec(ctx, query,
		account.ID,
		account.UserID,
		account.Provider,
		account.ProviderID,
		account.Email,
		account.AccessToken,
		account.RefreshToken,
		account.TokenExpiry,
		account.Scopes,
		account.Metadata,
		account.CreatedAt,
		account.UpdatedAt,
		account.LastUsedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to create OAuth account: %w", err)
	}

	return nil
}

// GetByID retrieves an OAuth account by ID
func (r *oauthRepository) GetByID(ctx context.Context, id string) (*entities.OAuthAccount, error) {
	query := `
		SELECT id, user_id, provider, provider_id, email, access_token, refresh_token, token_expiry, scopes, metadata, created_at, updated_at, last_used_at
		FROM oauth_accounts
		WHERE id = $1
	`

	var account entities.OAuthAccount
	err := r.db.QueryRow(ctx, query, id).Scan(
		&account.ID,
		&account.UserID,
		&account.Provider,
		&account.ProviderID,
		&account.Email,
		&account.AccessToken,
		&account.RefreshToken,
		&account.TokenExpiry,
		&account.Scopes,
		&account.Metadata,
		&account.CreatedAt,
		&account.UpdatedAt,
		&account.LastUsedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("OAuth account not found")
		}
		return nil, fmt.Errorf("failed to get OAuth account: %w", err)
	}

	return &account, nil
}

// GetByProviderAndID retrieves an OAuth account by provider and provider ID
func (r *oauthRepository) GetByProviderAndID(ctx context.Context, provider entities.OAuthProvider, providerID string) (*entities.OAuthAccount, error) {
	query := `
		SELECT id, user_id, provider, provider_id, email, access_token, refresh_token, token_expiry, scopes, metadata, created_at, updated_at, last_used_at
		FROM oauth_accounts
		WHERE provider = $1 AND provider_id = $2
	`

	var account entities.OAuthAccount
	err := r.db.QueryRow(ctx, query, provider, providerID).Scan(
		&account.ID,
		&account.UserID,
		&account.Provider,
		&account.ProviderID,
		&account.Email,
		&account.AccessToken,
		&account.RefreshToken,
		&account.TokenExpiry,
		&account.Scopes,
		&account.Metadata,
		&account.CreatedAt,
		&account.UpdatedAt,
		&account.LastUsedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("OAuth account not found")
		}
		return nil, fmt.Errorf("failed to get OAuth account: %w", err)
	}

	return &account, nil
}

// GetByUserID retrieves all OAuth accounts for a user
func (r *oauthRepository) GetByUserID(ctx context.Context, userID string) ([]*entities.OAuthAccount, error) {
	query := `
		SELECT id, user_id, provider, provider_id, email, access_token, refresh_token, token_expiry, scopes, metadata, created_at, updated_at, last_used_at
		FROM oauth_accounts
		WHERE user_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get OAuth accounts: %w", err)
	}
	defer rows.Close()

	var accounts []*entities.OAuthAccount
	for rows.Next() {
		var account entities.OAuthAccount
		err := rows.Scan(
			&account.ID,
			&account.UserID,
			&account.Provider,
			&account.ProviderID,
			&account.Email,
			&account.AccessToken,
			&account.RefreshToken,
			&account.TokenExpiry,
			&account.Scopes,
			&account.Metadata,
			&account.CreatedAt,
			&account.UpdatedAt,
			&account.LastUsedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan OAuth account: %w", err)
		}
		accounts = append(accounts, &account)
	}

	return accounts, nil
}

// GetByUserAndProvider retrieves a specific OAuth account for a user
func (r *oauthRepository) GetByUserAndProvider(ctx context.Context, userID string, provider entities.OAuthProvider) (*entities.OAuthAccount, error) {
	query := `
		SELECT id, user_id, provider, provider_id, email, access_token, refresh_token, token_expiry, scopes, metadata, created_at, updated_at, last_used_at
		FROM oauth_accounts
		WHERE user_id = $1 AND provider = $2
	`

	var account entities.OAuthAccount
	err := r.db.QueryRow(ctx, query, userID, provider).Scan(
		&account.ID,
		&account.UserID,
		&account.Provider,
		&account.ProviderID,
		&account.Email,
		&account.AccessToken,
		&account.RefreshToken,
		&account.TokenExpiry,
		&account.Scopes,
		&account.Metadata,
		&account.CreatedAt,
		&account.UpdatedAt,
		&account.LastUsedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("OAuth account not found")
		}
		return nil, fmt.Errorf("failed to get OAuth account: %w", err)
	}

	return &account, nil
}

// Update updates an OAuth account
func (r *oauthRepository) Update(ctx context.Context, account *entities.OAuthAccount) error {
	query := `
		UPDATE oauth_accounts
		SET access_token = $2, refresh_token = $3, token_expiry = $4, scopes = $5, metadata = $6, updated_at = $7, last_used_at = $8
		WHERE id = $1
	`

	result, err := r.db.Exec(ctx, query,
		account.ID,
		account.AccessToken,
		account.RefreshToken,
		account.TokenExpiry,
		account.Scopes,
		account.Metadata,
		account.UpdatedAt,
		account.LastUsedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to update OAuth account: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("OAuth account not found")
	}

	return nil
}

// Delete deletes an OAuth account
func (r *oauthRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM oauth_accounts WHERE id = $1`

	result, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete OAuth account: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("OAuth account not found")
	}

	return nil
}

// UpdateTokens updates the tokens for an OAuth account
func (r *oauthRepository) UpdateTokens(ctx context.Context, accountID, accessToken, refreshToken string, expiry *time.Time) error {
	query := `
		UPDATE oauth_accounts
		SET access_token = $2, refresh_token = $3, token_expiry = $4, updated_at = $5, last_used_at = $5
		WHERE id = $1
	`

	now := time.Now()
	result, err := r.db.Exec(ctx, query, accountID, accessToken, refreshToken, expiry, now)
	if err != nil {
		return fmt.Errorf("failed to update OAuth tokens: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("OAuth account not found")
	}

	return nil
}

// DeleteByUserID removes all OAuth accounts for a user
func (r *oauthRepository) DeleteByUserID(ctx context.Context, userID string) error {
	query := `DELETE FROM oauth_accounts WHERE user_id = $1`

	_, err := r.db.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("failed to delete OAuth accounts: %w", err)
	}

	return nil
}

// CountByUserID returns the number of OAuth accounts for a user
func (r *oauthRepository) CountByUserID(ctx context.Context, userID string) (int64, error) {
	query := `SELECT COUNT(*) FROM oauth_accounts WHERE user_id = $1`

	var count int64
	err := r.db.QueryRow(ctx, query, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count OAuth accounts: %w", err)
	}

	return count, nil
}

// ExistsByProviderAndID checks if an OAuth account exists
func (r *oauthRepository) ExistsByProviderAndID(ctx context.Context, provider entities.OAuthProvider, providerID string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM oauth_accounts WHERE provider = $1 AND provider_id = $2)`

	var exists bool
	err := r.db.QueryRow(ctx, query, provider, providerID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check OAuth account existence: %w", err)
	}

	return exists, nil
}
