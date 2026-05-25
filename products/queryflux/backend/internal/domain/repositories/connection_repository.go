package repositories

import (
	"context"
	"github.com/queryflux/backend/internal/domain/entities"
)

// ConnectionRepository defines the interface for database connection operations
type ConnectionRepository interface {
	// Create creates a new database connection
	Create(ctx context.Context, connection *entities.Connection) error

	// GetByID retrieves a connection by ID
	GetByID(ctx context.Context, id string) (*entities.Connection, error)

	// GetByUserID retrieves all connections for a user with pagination
	GetByUserID(ctx context.Context, userID string, limit, offset int) ([]*entities.Connection, error)

	// Update updates an existing connection
	Update(ctx context.Context, connection *entities.Connection) error

	// Delete deletes a connection by ID
	Delete(ctx context.Context, id string) error

	// GetByUserAndName retrieves a connection by user ID and name
	GetByUserAndName(ctx context.Context, userID, name string) (*entities.Connection, error)

	// GetActiveConnections retrieves all active connections for a user
	GetActiveConnections(ctx context.Context, userID string) ([]*entities.Connection, error)

	// GetByType retrieves connections by database type for a user
	GetByType(ctx context.Context, userID, dbType string, limit, offset int) ([]*entities.Connection, error)

	// UpdateStatus updates the connection status
	UpdateStatus(ctx context.Context, connectionID, status string) error

	// UpdateLastUsed updates the last used timestamp
	UpdateLastUsed(ctx context.Context, connectionID string) error

	// Count returns the total number of connections for a user
	Count(ctx context.Context, userID string) (int64, error)

	// CountByType returns the number of connections by type for a user
	CountByType(ctx context.Context, userID, dbType string) (int64, error)

	// GetRecentlyUsed retrieves recently used connections for a user
	GetRecentlyUsed(ctx context.Context, userID string, limit int) ([]*entities.Connection, error)

	// Exists checks if a connection exists by ID
	Exists(ctx context.Context, id string) (bool, error)

	// ExistsByUserAndName checks if a connection exists by user ID and name
	ExistsByUserAndName(ctx context.Context, userID, name string) (bool, error)

	// GetConnectionsRequiringHealthCheck retrieves connections that need health checks
	GetConnectionsRequiringHealthCheck(ctx context.Context, olderThan int) ([]*entities.Connection, error)
}