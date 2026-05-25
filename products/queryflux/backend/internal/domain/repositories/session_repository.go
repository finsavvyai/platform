package repositories

import (
	"context"
	"github.com/queryflux/backend/internal/domain/entities"
)

// SessionRepository defines the interface for session data operations
type SessionRepository interface {
	// Create creates a new session
	Create(ctx context.Context, session *entities.Session) error

	// GetByID retrieves a session by ID
	GetByID(ctx context.Context, id string) (*entities.Session, error)

	// GetByToken retrieves a session by token
	GetByToken(ctx context.Context, token string) (*entities.Session, error)

	// GetByRefreshToken retrieves a session by refresh token
	GetByRefreshToken(ctx context.Context, refreshToken string) (*entities.Session, error)

	// GetByUserID retrieves active sessions for a user
	GetByUserID(ctx context.Context, userID string) ([]*entities.Session, error)

	// Update updates an existing session
	Update(ctx context.Context, session *entities.Session) error

	// Delete deletes a session by ID
	Delete(ctx context.Context, id string) error

	// DeleteByToken deletes a session by token
	DeleteByToken(ctx context.Context, token string) error

	// DeleteByUserID deletes all sessions for a user
	DeleteByUserID(ctx context.Context, userID string) error

	// DeleteExpired deletes all expired sessions
	DeleteExpired(ctx context.Context) error

	// Exists checks if a session exists by ID
	Exists(ctx context.Context, id string) (bool, error)

	// ExistsByToken checks if a session exists by token
	ExistsByToken(ctx context.Context, token string) (bool, error)

	// Count returns the total number of active sessions
	Count(ctx context.Context) (int64, error)

	// CountByUserID returns the number of active sessions for a user
	CountByUserID(ctx context.Context, userID string) (int64, error)
}