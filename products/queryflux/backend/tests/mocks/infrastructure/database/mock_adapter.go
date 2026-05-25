package database

import (
	"context"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database"

	"github.com/stretchr/testify/mock"
)

// MockDatabaseAdapter is a mock implementation of DatabaseAdapter for testing
type MockDatabaseAdapter struct {
	mock.Mock
}

// Connect mocks the Connect method
func (m *MockDatabaseAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	args := m.Called(ctx, conn)
	return args.Error(0)
}

// Disconnect mocks the Disconnect method
func (m *MockDatabaseAdapter) Disconnect(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

// IsConnected mocks the IsConnected method
func (m *MockDatabaseAdapter) IsConnected() bool {
	args := m.Called()
	return args.Bool(0)
}

// TestConnection mocks the TestConnection method
func (m *MockDatabaseAdapter) TestConnection(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

// ExecuteQuery mocks the ExecuteQuery method
func (m *MockDatabaseAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*database.QueryResult, error) {
	args := m.Called(ctx, query, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*database.QueryResult), args.Error(1)
}

// GetSchema mocks the GetSchema method
func (m *MockDatabaseAdapter) GetSchema(ctx context.Context) (*database.SchemaInfo, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*database.SchemaInfo), args.Error(1)
}

// GetTableInfo mocks the GetTableInfo method
func (m *MockDatabaseAdapter) GetTableInfo(ctx context.Context, tableName string) (*database.TableInfo, error) {
	args := m.Called(ctx, tableName)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*database.TableInfo), args.Error(1)
}

// GetConnectionInfo mocks the GetConnectionInfo method
func (m *MockDatabaseAdapter) GetConnectionInfo() *entities.Connection {
	args := m.Called()
	if args.Get(0) == nil {
		return nil
	}
	return args.Get(0).(*entities.Connection)
}

// MockAdapterFactory is a mock implementation of AdapterFactory for testing
type MockAdapterFactory struct {
	mock.Mock
}

// CreateAdapter mocks the CreateAdapter method
func (m *MockAdapterFactory) CreateAdapter(conn *entities.Connection) (database.DatabaseAdapter, error) {
	args := m.Called(conn)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(database.DatabaseAdapter), args.Error(1)
}

// NewMockDatabaseAdapter creates a new mock database adapter
func NewMockDatabaseAdapter() *MockDatabaseAdapter {
	return &MockDatabaseAdapter{}
}

// NewMockAdapterFactory creates a new mock adapter factory
func NewMockAdapterFactory() *MockAdapterFactory {
	return &MockAdapterFactory{}
}