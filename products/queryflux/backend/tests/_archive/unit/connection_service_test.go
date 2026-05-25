package services_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/services"
	"github.com/queryflux/backend/tests/testutils"
)

// MockConnectionRepository is a mock implementation of the connection repository
type MockConnectionRepository struct {
	mock.Mock
}

func (m *MockConnectionRepository) Create(ctx context.Context, conn *entities.Connection) error {
	args := m.Called(ctx, conn)
	return args.Error(0)
}

func (m *MockConnectionRepository) GetByID(ctx context.Context, id string) (*entities.Connection, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*entities.Connection), args.Error(1)
}

func (m *MockConnectionRepository) GetByUserID(ctx context.Context, userID string) ([]*entities.Connection, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*entities.Connection), args.Error(1)
}

func (m *MockConnectionRepository) Update(ctx context.Context, conn *entities.Connection) error {
	args := m.Called(ctx, conn)
	return args.Error(0)
}

func (m *MockConnectionRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockConnectionRepository) TestConnection(ctx context.Context, conn *entities.Connection) error {
	args := m.Called(ctx, conn)
	return args.Error(0)
}

// MockDatabaseAdapter is a mock implementation of the database adapter
type MockDatabaseAdapter struct {
	mock.Mock
}

func (m *MockDatabaseAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	args := m.Called(ctx, conn)
	return args.Error(0)
}

func (m *MockDatabaseAdapter) Disconnect(ctx context.Context) error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockDatabaseAdapter) IsConnected() bool {
	args := m.Called()
	return args.Bool(0)
}

func (m *MockDatabaseAdapter) TestConnection(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockDatabaseAdapter) ExecuteQuery(ctx context.Context, query string) (*entities.QueryResult, error) {
	args := m.Called(ctx, query)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*entities.QueryResult), args.Error(1)
}

func (m *MockDatabaseAdapter) GetSchema(ctx context.Context) (*entities.Schema, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*entities.Schema), args.Error(1)
}

func (m *MockDatabaseAdapter) GetTableInfo(ctx context.Context, tableName string) (*entities.TableInfo, error) {
	args := m.Called(ctx, tableName)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*entities.TableInfo), args.Error(1)
}

// MockAdapterFactory is a mock implementation of the adapter factory
type MockAdapterFactory struct {
	mock.Mock
}

func (m *MockAdapterFactory) CreateAdapter(conn *entities.Connection) (interface{}, error) {
	args := m.Called(conn)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0), args.Error(1)
}

// ConnectionServiceTestSuite contains tests for the connection service
type ConnectionServiceTestSuite struct {
	suite.Suite
	ctx                   context.Context
	mockRepo              *MockConnectionRepository
	mockAdapterFactory    *MockAdapterFactory
	mockAdapter           *MockDatabaseAdapter
	service               *services.ConnectionService
}

func (suite *ConnectionServiceTestSuite) SetupTest() {
	suite.ctx = context.Background()
	suite.mockRepo = new(MockConnectionRepository)
	suite.mockAdapterFactory = new(MockAdapterFactory)
	suite.mockAdapter = new(MockDatabaseAdapter)
	suite.service = services.NewConnectionService(suite.mockRepo, suite.mockAdapterFactory)
}

func (suite *ConnectionServiceTestSuite) TestCreateConnection_Success() {
	// Arrange
	conn := suite.createTestConnection()

	suite.mockAdapterFactory.On("CreateAdapter", conn).Return(suite.mockAdapter, nil)
	suite.mockAdapter.On("TestConnection", suite.ctx).Return(nil)
	suite.mockRepo.On("Create", suite.ctx, conn).Return(nil)
	suite.mockAdapter.On("Disconnect", suite.ctx).Return(nil)

	// Act
	err := suite.service.CreateConnection(suite.ctx, conn)

	// Assert
	assert.NoError(suite.T(), err)
	suite.mockAdapterFactory.AssertExpectations(suite.T())
	suite.mockAdapter.AssertExpectations(suite.T())
	suite.mockRepo.AssertExpectations(suite.T())
}

func (suite *ConnectionServiceTestSuite) TestCreateConnection_AdapterCreationFails() {
	// Arrange
	conn := suite.createTestConnection()
	expectedError := assert.AnError

	suite.mockAdapterFactory.On("CreateAdapter", conn).Return(nil, expectedError)

	// Act
	err := suite.service.CreateConnection(suite.ctx, conn)

	// Assert
	assert.Error(suite.T(), err)
	assert.Equal(suite.T(), expectedError, err)
	suite.mockAdapterFactory.AssertExpectations(suite.T())
	suite.mockRepo.AssertNotCalled(suite.T(), "Create")
	suite.mockAdapter.AssertNotCalled(suite.T(), "TestConnection")
}

func (suite *ConnectionServiceTestSuite) TestCreateConnection_ConnectionTestFails() {
	// Arrange
	conn := suite.createTestConnection()
	expectedError := assert.AnError

	suite.mockAdapterFactory.On("CreateAdapter", conn).Return(suite.mockAdapter, nil)
	suite.mockAdapter.On("TestConnection", suite.ctx).Return(expectedError)
	suite.mockAdapter.On("Disconnect", suite.ctx).Return(nil)

	// Act
	err := suite.service.CreateConnection(suite.ctx, conn)

	// Assert
	assert.Error(suite.T(), err)
	assert.Equal(suite.T(), expectedError, err)
	suite.mockAdapterFactory.AssertExpectations(suite.T())
	suite.mockAdapter.AssertExpectations(suite.T())
	suite.mockRepo.AssertNotCalled(suite.T(), "Create")
}

func (suite *ConnectionServiceTestSuite) TestCreateConnection_RepositoryFails() {
	// Arrange
	conn := suite.createTestConnection()
	expectedError := assert.AnError

	suite.mockAdapterFactory.On("CreateAdapter", conn).Return(suite.mockAdapter, nil)
	suite.mockAdapter.On("TestConnection", suite.ctx).Return(nil)
	suite.mockRepo.On("Create", suite.ctx, conn).Return(expectedError)
	suite.mockAdapter.On("Disconnect", suite.ctx).Return(nil)

	// Act
	err := suite.service.CreateConnection(suite.ctx, conn)

	// Assert
	assert.Error(suite.T(), err)
	assert.Equal(suite.T(), expectedError, err)
	suite.mockAdapterFactory.AssertExpectations(suite.T())
	suite.mockAdapter.AssertExpectations(suite.T())
	suite.mockRepo.AssertExpectations(suite.T())
}

func (suite *ConnectionServiceTestSuite) TestGetConnection_Success() {
	// Arrange
	connID := "test-connection-id"
	expectedConn := suite.createTestConnection()
	expectedConn.ID = connID

	suite.mockRepo.On("GetByID", suite.ctx, connID).Return(expectedConn, nil)

	// Act
	conn, err := suite.service.GetConnection(suite.ctx, connID)

	// Assert
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), expectedConn, conn)
	suite.mockRepo.AssertExpectations(suite.T())
}

func (suite *ConnectionServiceTestSuite) TestGetConnection_NotFound() {
	// Arrange
	connID := "non-existent-id"
	expectedError := assert.AnError

	suite.mockRepo.On("GetByID", suite.ctx, connID).Return(nil, expectedError)

	// Act
	conn, err := suite.service.GetConnection(suite.ctx, connID)

	// Assert
	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), conn)
	suite.mockRepo.AssertExpectations(suite.T())
}

func (suite *ConnectionServiceTestSuite) TestGetConnectionsByUser_Success() {
	// Arrange
	userID := "test-user-id"
	expectedConns := []*entities.Connection{
		suite.createTestConnection(),
		suite.createTestConnection(),
	}

	suite.mockRepo.On("GetByUserID", suite.ctx, userID).Return(expectedConns, nil)

	// Act
	conns, err := suite.service.GetConnectionsByUser(suite.ctx, userID)

	// Assert
	assert.NoError(suite.T(), err)
	assert.Equal(suite.T(), expectedConns, conns)
	suite.mockRepo.AssertExpectations(suite.T())
}

func (suite *ConnectionServiceTestSuite) TestUpdateConnection_Success() {
	// Arrange
	conn := suite.createTestConnection()

	suite.mockRepo.On("Update", suite.ctx, conn).Return(nil)

	// Act
	err := suite.service.UpdateConnection(suite.ctx, conn)

	// Assert
	assert.NoError(suite.T(), err)
	suite.mockRepo.AssertExpectations(suite.T())
}

func (suite *ConnectionServiceTestSuite) TestDeleteConnection_Success() {
	// Arrange
	connID := "test-connection-id"

	suite.mockRepo.On("Delete", suite.ctx, connID).Return(nil)

	// Act
	err := suite.service.DeleteConnection(suite.ctx, connID)

	// Assert
	assert.NoError(suite.T(), err)
	suite.mockRepo.AssertExpectations(suite.T())
}

func (suite *ConnectionServiceTestSuite) TestTestConnection_Success() {
	// Arrange
	conn := suite.createTestConnection()

	suite.mockAdapterFactory.On("CreateAdapter", conn).Return(suite.mockAdapter, nil)
	suite.mockAdapter.On("TestConnection", suite.ctx).Return(nil)
	suite.mockAdapter.On("Disconnect", suite.ctx).Return(nil)

	// Act
	err := suite.service.TestConnection(suite.ctx, conn)

	// Assert
	assert.NoError(suite.T(), err)
	suite.mockAdapterFactory.AssertExpectations(suite.T())
	suite.mockAdapter.AssertExpectations(suite.T())
}

func (suite *ConnectionServiceTestSuite) TestTestConnection_Fails() {
	// Arrange
	conn := suite.createTestConnection()
	expectedError := assert.AnError

	suite.mockAdapterFactory.On("CreateAdapter", conn).Return(suite.mockAdapter, nil)
	suite.mockAdapter.On("TestConnection", suite.ctx).Return(expectedError)
	suite.mockAdapter.On("Disconnect", suite.ctx).Return(nil)

	// Act
	err := suite.service.TestConnection(suite.ctx, conn)

	// Assert
	assert.Error(suite.T(), err)
	assert.Equal(suite.T(), expectedError, err)
	suite.mockAdapterFactory.AssertExpectations(suite.T())
	suite.mockAdapter.AssertExpectations(suite.T())
}

// Helper function to create a test connection
func (suite *ConnectionServiceTestSuite) createTestConnection() *entities.Connection {
	return &entities.Connection{
		ID:       "test-connection-id",
		UserID:   "test-user-id",
		Name:     "Test Connection",
		Type:     entities.TypePostgreSQL,
		Host:     "localhost",
		Port:     5432,
		Database: "test_db",
		Username: "test_user",
		Password: "test_password",
		SSLMode:  "disable",
		Timeout:  30 * time.Second,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// Benchmark tests
func BenchmarkConnectionService_CreateConnection(b *testing.B) {
	service := services.NewConnectionService(nil, nil)
	ctx := context.Background()
	conn := &entities.Connection{
		ID:       "benchmark-connection",
		UserID:   "benchmark-user",
		Name:     "Benchmark Connection",
		Type:     entities.TypePostgreSQL,
		Host:     "localhost",
		Port:     5432,
		Database: "benchmark_db",
		Username: "benchmark_user",
		Password: "benchmark_password",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		conn.ID = fmt.Sprintf("benchmark-connection-%d", i)
		_ = service.CreateConnection(ctx, conn)
	}
}

// TestConnectionService_Integration performs integration tests
func TestConnectionService_Integration(t *testing.T) {
	testutils.SkipIfShort(t)

	suite.Run(t, new(ConnectionServiceIntegrationTestSuite))
}

// ConnectionServiceIntegrationTestSuite performs integration tests
type ConnectionServiceIntegrationTestSuite struct {
	testutils.TestSuite
	service *services.ConnectionService
}

func (suite *ConnectionServiceIntegrationTestSuite) SetupSuite() {
	suite.TestSuite.SetupSuite()

	// Create service with real dependencies
	repo := suite.Container.GetConnectionRepository()
	factory := suite.Container.GetAdapterFactory()
	suite.service = services.NewConnectionService(repo, factory)
}

func (suite *ConnectionServiceIntegrationTestSuite) TestConnectionLifecycle() {
	// Test create
	conn := suite.CreateTestConnection(entities.TypePostgreSQL)
	err := suite.service.CreateConnection(suite.Ctx, conn)
	require.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), conn.ID)

	// Test get
	retrieved, err := suite.service.GetConnection(suite.Ctx, conn.ID)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), conn.Name, retrieved.Name)
	assert.Equal(suite.T(), conn.Type, retrieved.Type)

	// Test update
	conn.Name = "Updated Connection Name"
	err = suite.service.UpdateConnection(suite.Ctx, conn)
	require.NoError(suite.T(), err)

	// Test delete
	err = suite.service.DeleteConnection(suite.Ctx, conn.ID)
	require.NoError(suite.T(), err)
}

func TestConnectionService_Unit(t *testing.T) {
	suite.Run(t, new(ConnectionServiceTestSuite))
}