package services

import (
	"context"
	"fmt"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
	"github.com/queryflux/backend/internal/infrastructure/database"
)

// databaseService implements the DatabaseService interface
type databaseService struct {
	manager        *database.Manager
	connectionRepo repositories.ConnectionRepository
}

// NewDatabaseService creates a new database service
func NewDatabaseService(manager *database.Manager, connectionRepo repositories.ConnectionRepository) DatabaseService {
	return &databaseService{
		manager:        manager,
		connectionRepo: connectionRepo,
	}
}

// Connect connects to a database
func (s *databaseService) Connect(ctx context.Context, connection *entities.Connection) error {
	if err := s.manager.Connect(ctx, connection); err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// Update connection status
	if err := s.connectionRepo.UpdateStatus(ctx, connection.ID, "active"); err != nil {
		return fmt.Errorf("failed to update connection status: %w", err)
	}

	return nil
}

// Disconnect disconnects from a database
func (s *databaseService) Disconnect(ctx context.Context, connectionID string) error {
	if err := s.manager.Disconnect(connectionID); err != nil {
		return fmt.Errorf("failed to disconnect from database: %w", err)
	}

	// Update connection status
	if err := s.connectionRepo.UpdateStatus(ctx, connectionID, "inactive"); err != nil {
		return fmt.Errorf("failed to update connection status: %w", err)
	}

	return nil
}

// ExecuteQuery executes a query on a database
func (s *databaseService) ExecuteQuery(ctx context.Context, connectionID, sql string) ([]map[string]interface{}, error) {
	result, err := s.manager.ExecuteQuery(ctx, connectionID, sql)
	if err != nil {
		return nil, fmt.Errorf("failed to execute query: %w", err)
	}

	// Convert QueryResult to the expected format
	return result.Rows, nil
}

// GetSchema retrieves database schema information
func (s *databaseService) GetSchema(ctx context.Context, connectionID string) (*DatabaseSchema, error) {
	schemaInfo, err := s.manager.GetSchema(ctx, connectionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get database schema: %w", err)
	}

	// Convert database.SchemaInfo to services.DatabaseSchema
	schema := &DatabaseSchema{
		Tables: make([]TableSchema, len(schemaInfo.Tables)),
	}

	for i, table := range schemaInfo.Tables {
		tableSchema := TableSchema{
			Name:    table.Name,
			Columns: make([]ColumnSchema, len(table.Columns)),
			Indexes: make([]IndexSchema, len(table.Indexes)),
		}

		for j, col := range table.Columns {
			tableSchema.Columns[j] = ColumnSchema{
				Name:         col.Name,
				Type:         col.Type,
				Nullable:     col.Nullable,
				DefaultValue: col.DefaultValue,
				IsPrimaryKey: col.IsPrimaryKey,
				IsForeignKey: col.IsForeignKey,
			}
		}

		for j, idx := range table.Indexes {
			tableSchema.Indexes[j] = IndexSchema{
				Name:    idx.Name,
				Columns: idx.Columns,
				Unique:  idx.Unique,
			}
		}

		schema.Tables[i] = tableSchema
	}

	return schema, nil
}

// TestConnection tests a database connection
func (s *databaseService) TestConnection(ctx context.Context, connection *entities.Connection) error {
	// First connect to the database
	if err := s.manager.Connect(ctx, connection); err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}

	// Test the connection
	if err := s.manager.TestConnection(ctx, connection.ID); err != nil {
		return fmt.Errorf("connection test failed: %w", err)
	}

	return nil
}

// GetConnectionInfo retrieves connection information
func (s *databaseService) GetConnectionInfo(ctx context.Context, connectionID string) (*ConnectionInfo, error) {
	// Get basic metrics
	metrics, err := s.manager.GetMetrics(connectionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get connection metrics: %w", err)
	}

	// TODO: Implement actual connection info retrieval
	// For now, return basic information
	info := &ConnectionInfo{
		Version:         "Unknown",
		ServerInfo:      "Database Server",
		DatabaseSize:    0,
		TableCount:      0,
		ConnectionCount: metrics.ActiveConnections,
	}

	return info, nil
}

// IsConnected checks if a connection is active
func (s *databaseService) IsConnected(ctx context.Context, connectionID string) bool {
	return s.manager.IsConnected(connectionID)
}