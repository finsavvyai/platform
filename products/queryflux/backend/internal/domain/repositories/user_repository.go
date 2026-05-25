package repositories

import (
	"context"
	"github.com/queryflux/backend/internal/domain/entities"
)

// UserRepository defines the interface for user data operations
type UserRepository interface {
	// Create creates a new user
	Create(ctx context.Context, user *entities.User) error

	// GetByID retrieves a user by ID
	GetByID(ctx context.Context, id string) (*entities.User, error)

	// GetByEmail retrieves a user by email address
	GetByEmail(ctx context.Context, email string) (*entities.User, error)

	// Update updates an existing user
	Update(ctx context.Context, user *entities.User) error

	// Delete deletes a user by ID
	Delete(ctx context.Context, id string) error

	// List retrieves users with pagination
	List(ctx context.Context, limit, offset int) ([]*entities.User, error)

	// Count returns the total number of users
	Count(ctx context.Context) (int64, error)

	// GetByRole retrieves users by role with pagination
	GetByRole(ctx context.Context, role string, limit, offset int) ([]*entities.User, error)

	// GetByPlan retrieves users by plan with pagination
	GetByPlan(ctx context.Context, plan string, limit, offset int) ([]*entities.User, error)

	// UpdateLastLogin updates the user's last login timestamp
	UpdateLastLogin(ctx context.Context, userID string) error

	// Exists checks if a user exists by ID
	Exists(ctx context.Context, id string) (bool, error)

	// ExistsByEmail checks if a user exists by email
	ExistsByEmail(ctx context.Context, email string) (bool, error)
}