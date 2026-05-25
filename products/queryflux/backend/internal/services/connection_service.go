package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
)

// connectionService implements the ConnectionService interface
type connectionService struct {
	connectionRepo repositories.ConnectionRepository
	userRepo       repositories.UserRepository
}

// NewConnectionService creates a new connection service
func NewConnectionService(connectionRepo repositories.ConnectionRepository, userRepo repositories.UserRepository) ConnectionService {
	return &connectionService{
		connectionRepo: connectionRepo,
		userRepo:       userRepo,
	}
}

// Create creates a new database connection
func (s *connectionService) Create(ctx context.Context, userID, name, dbType, host string, port int, database, username, password string) (*entities.Connection, error) {
	// Verify user exists
	_, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Check if connection with same name already exists for user
	exists, err := s.connectionRepo.ExistsByUserAndName(ctx, userID, name)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing connection: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("connection with name '%s' already exists", name)
	}

	// Create new connection entity
	connection, err := entities.NewConnection(userID, name, dbType, host, port, database, username, password)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection entity: %w", err)
	}

	// Save to repository
	if err := s.connectionRepo.Create(ctx, connection); err != nil {
		return nil, fmt.Errorf("failed to save connection: %w", err)
	}

	return connection, nil
}

// GetByID retrieves a connection by ID
func (s *connectionService) GetByID(ctx context.Context, id string) (*entities.Connection, error) {
	connection, err := s.connectionRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get connection: %w", err)
	}
	return connection, nil
}

// GetByUserID retrieves connections for a user
func (s *connectionService) GetByUserID(ctx context.Context, userID string, limit, offset int) ([]*entities.Connection, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	connections, err := s.connectionRepo.GetByUserID(ctx, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get user connections: %w", err)
	}

	return connections, nil
}

// Update updates a connection
func (s *connectionService) Update(ctx context.Context, connection *entities.Connection) error {
	// Validate the connection
	if err := connection.Validate(); err != nil {
		return fmt.Errorf("connection validation failed: %w", err)
	}

	// Check if connection exists
	exists, err := s.connectionRepo.Exists(ctx, connection.ID)
	if err != nil {
		return fmt.Errorf("failed to check connection existence: %w", err)
	}
	if !exists {
		return fmt.Errorf("connection not found")
	}

	// Update the connection
	if err := s.connectionRepo.Update(ctx, connection); err != nil {
		return fmt.Errorf("failed to update connection: %w", err)
	}

	return nil
}

// Delete deletes a connection
func (s *connectionService) Delete(ctx context.Context, id string) error {
	// Check if connection exists
	exists, err := s.connectionRepo.Exists(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to check connection existence: %w", err)
	}
	if !exists {
		return fmt.Errorf("connection not found")
	}

	// Delete the connection
	if err := s.connectionRepo.Delete(ctx, id); err != nil {
		return fmt.Errorf("failed to delete connection: %w", err)
	}

	return nil
}

// Test tests a database connection.
//
// Phase-1: the legacy "always-nil after sleep" stub is intentionally removed
// so FIX-E must wire a real adapter.HealthCheck via the connection factory
// before any HTTP handler can claim the connection works. Returning an
// explicit error preserves the contract surface while preventing credential
// validation false positives.
func (s *connectionService) Test(ctx context.Context, connection *entities.Connection) error {
	_ = ctx
	// Validate the connection first
	if err := connection.Validate(); err != nil {
		return fmt.Errorf("connection validation failed: %w", err)
	}

	return errors.New("connection_service.Test: not implemented - use adapter.HealthCheck")
}

// GetActiveConnections retrieves active connections for a user
func (s *connectionService) GetActiveConnections(ctx context.Context, userID string) ([]*entities.Connection, error) {
	connections, err := s.connectionRepo.GetActiveConnections(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get active connections: %w", err)
	}

	return connections, nil
}

// UpdateStatus updates connection status
func (s *connectionService) UpdateStatus(ctx context.Context, connectionID, status string) error {
	// Validate status
	validStatuses := []string{"active", "inactive", "error", "testing"}
	isValid := false
	for _, validStatus := range validStatuses {
		if status == validStatus {
			isValid = true
			break
		}
	}
	if !isValid {
		return fmt.Errorf("invalid status: %s", status)
	}

	if err := s.connectionRepo.UpdateStatus(ctx, connectionID, status); err != nil {
		return fmt.Errorf("failed to update connection status: %w", err)
	}

	return nil
}

// MarkAsUsed marks connection as recently used
func (s *connectionService) MarkAsUsed(ctx context.Context, connectionID string) error {
	if err := s.connectionRepo.UpdateLastUsed(ctx, connectionID); err != nil {
		return fmt.Errorf("failed to mark connection as used: %w", err)
	}

	return nil
}