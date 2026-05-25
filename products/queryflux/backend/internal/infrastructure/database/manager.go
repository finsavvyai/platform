package database

import (
	"context"
	"fmt"
	"os"
	"github.com/queryflux/backend/internal/domain/entities"

	"github.com/sirupsen/logrus"
)

// Manager manages multiple database connections for user databases
// This is a wrapper around PoolManager for backward compatibility
type Manager struct {
	poolManager *PoolManager
	logger      *logrus.Logger
}

// NewManager creates a new database manager
func NewManager() (*Manager, error) {
	// Get encryption key from environment or generate one
	encryptionKey := os.Getenv("DB_ENCRYPTION_KEY")
	if encryptionKey == "" {
		// In production, this should be properly configured
		encryptionKey = "default-encryption-key-change-in-production"
		logrus.Warn("Using default encryption key. Set DB_ENCRYPTION_KEY environment variable in production.")
	}

	// Create encryption service
	encryptionSvc, err := NewEncryptionService(encryptionKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create encryption service: %w", err)
	}

	// Create pool manager with default config
	poolManager := NewPoolManager(DefaultPoolConfig(), encryptionSvc)

	return &Manager{
		poolManager: poolManager,
		logger:      logrus.New(),
	}, nil
}

// Connect establishes a connection to a user database
func (m *Manager) Connect(ctx context.Context, conn *entities.Connection) error {
	return m.poolManager.Connect(ctx, conn)
}

// Disconnect closes a database connection
func (m *Manager) Disconnect(connectionID string) error {
	return m.poolManager.Disconnect(context.Background(), connectionID)
}

// ExecuteQuery executes a query on the specified connection
func (m *Manager) ExecuteQuery(ctx context.Context, connectionID, query string, params ...interface{}) (*QueryResult, error) {
	return m.poolManager.ExecuteQuery(ctx, connectionID, query, params...)
}

// GetSchema retrieves database schema information
func (m *Manager) GetSchema(ctx context.Context, connectionID string) (*SchemaInfo, error) {
	return m.poolManager.GetSchema(ctx, connectionID)
}

// GetTableInfo retrieves information about a specific table
func (m *Manager) GetTableInfo(ctx context.Context, connectionID, tableName string) (*TableInfo, error) {
	return m.poolManager.GetTableInfo(ctx, connectionID, tableName)
}

// TestConnection tests if a connection is valid
func (m *Manager) TestConnection(ctx context.Context, connectionID string) error {
	return m.poolManager.TestConnection(ctx, connectionID)
}

// IsConnected checks if a connection exists
func (m *Manager) IsConnected(connectionID string) bool {
	return m.poolManager.IsConnected(connectionID)
}

// Close closes all database connections
func (m *Manager) Close() error {
	return m.poolManager.Close(context.Background())
}

// GetActiveConnections returns the number of active connections
func (m *Manager) GetActiveConnections() int {
	return len(m.poolManager.GetActiveConnections())
}

// GetConnectionIDs returns all active connection IDs
func (m *Manager) GetConnectionIDs() []string {
	return m.poolManager.GetActiveConnections()
}

// GetMetrics returns connection pool metrics
func (m *Manager) GetMetrics(connectionID string) (*PoolMetrics, error) {
	return m.poolManager.GetMetrics(connectionID)
}

// GetAllMetrics returns metrics for all connections
func (m *Manager) GetAllMetrics() map[string]*PoolMetrics {
	return m.poolManager.GetAllMetrics()
}