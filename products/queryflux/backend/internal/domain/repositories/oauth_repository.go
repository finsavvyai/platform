package repositories

import (
	"context"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
)

// OAuthRepository defines the interface for OAuth account operations
type OAuthRepository interface {
	// Create creates a new OAuth account link
	Create(ctx context.Context, account *entities.OAuthAccount) error

	// GetByID retrieves an OAuth account by ID
	GetByID(ctx context.Context, id string) (*entities.OAuthAccount, error)

	// GetByProviderAndID retrieves an OAuth account by provider and provider ID
	GetByProviderAndID(ctx context.Context, provider entities.OAuthProvider, providerID string) (*entities.OAuthAccount, error)

	// GetByUserID retrieves all OAuth accounts for a user
	GetByUserID(ctx context.Context, userID string) ([]*entities.OAuthAccount, error)

	// GetByUserAndProvider retrieves a specific OAuth account for a user
	GetByUserAndProvider(ctx context.Context, userID string, provider entities.OAuthProvider) (*entities.OAuthAccount, error)

	// Update updates an OAuth account
	Update(ctx context.Context, account *entities.OAuthAccount) error

	// Delete deletes an OAuth account
	Delete(ctx context.Context, id string) error

	// UpdateTokens updates the tokens for an OAuth account
	UpdateTokens(ctx context.Context, accountID, accessToken, refreshToken string, expiry *time.Time) error

	// DeleteByUserID removes all OAuth accounts for a user
	DeleteByUserID(ctx context.Context, userID string) error

	// CountByUserID returns the number of OAuth accounts for a user
	CountByUserID(ctx context.Context, userID string) (int64, error)

	// ExistsByProviderAndID checks if an OAuth account exists
	ExistsByProviderAndID(ctx context.Context, provider entities.OAuthProvider, providerID string) (bool, error)
}

// OAuthStateRepository defines the interface for OAuth state operations
type OAuthStateRepository interface {
	// Create creates a new OAuth state
	Create(ctx context.Context, state *entities.OAuthState) error

	// GetByState retrieves an OAuth state by state string
	GetByState(ctx context.Context, state string) (*entities.OAuthState, error)

	// Delete deletes an OAuth state
	Delete(ctx context.Context, state string) error

	// DeleteExpired removes expired states
	DeleteExpired(ctx context.Context) (int64, error)

	// CleanupOldStates removes states older than specified duration
	CleanupOldStates(ctx context.Context, olderThan int) (int64, error)
}
