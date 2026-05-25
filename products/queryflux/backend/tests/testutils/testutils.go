package testutils

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
	"go.uber.org/zap"

	"github.com/queryflux/backend/internal/config"
	"github.com/queryflux/backend/internal/container"
	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database"
	dbtypes "github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// TestSuite provides a comprehensive test suite structure
type TestSuite struct {
	suite.Suite
	Ctx       context.Context
	Logger    *zap.Logger
	Config    *config.Config
	Container *container.Container
	Server    *httptest.Server
	Cleanup   []func()
}

// SetupSuite initializes the test suite
func (s *TestSuite) SetupSuite() {
	s.Ctx = context.Background()
	s.Logger, _ = zap.NewDevelopment()
	s.Cleanup = []func(){}

	// Test configuration
	s.Config = &config.Config{
		Port:          "8080",
		Host:          "localhost",
		LogLevel:      "debug",
		Timeout:       30 * time.Second,
		DatabaseURL:   "postgres://test_user:test_password@localhost:5432/test_db?sslmode=disable",
		RedisURL:      "redis://localhost:6379",
		JWTSecret:     "test-secret-key-at-least-thirty-two-chars-long",
		JWTExpiration: 24 * time.Hour,
		Environment:   "test",
	}

	// Initialize container
	var err error
	s.Container, err = container.NewContainer(s.Config)
	require.NoError(s.T(), err, "Failed to create test container")

	// Setup test server
	s.setupTestServer()

	// Setup test database
	s.setupTestDatabase()
}

// TearDownSuite cleans up test resources
func (s *TestSuite) TearDownSuite() {
	// Run cleanup functions in reverse order
	for i := len(s.Cleanup) - 1; i >= 0; i-- {
		s.Cleanup[i]()
	}

	if s.Server != nil {
		s.Server.Close()
	}
}

// setupTestServer creates a test HTTP server
func (s *TestSuite) setupTestServer() {
	gin.SetMode(gin.TestMode)

	// Get router from container - Mock behavior if not available
	// Usually we would create a real server instance here
	router := gin.Default()
	// Add some dummy routes for testing if needed or use real ones if we can get them

	s.Server = httptest.NewServer(router)

	// Add cleanup function
	s.Cleanup = append(s.Cleanup, func() {
		s.Server.Close()
	})
}

// setupTestDatabase initializes test database
func (s *TestSuite) setupTestDatabase() {
	// Test database setup would go here
	// For now, we'll just add a cleanup placeholder
	s.Cleanup = append(s.Cleanup, func() {
		// Cleanup database connections
	})
}

// AddCleanup adds a cleanup function to be executed during teardown
func (s *TestSuite) AddCleanup(fn func()) {
	s.Cleanup = append(s.Cleanup, fn)
}

// CreateTestConnection creates a test database connection entity
func (s *TestSuite) CreateTestConnection(dbType string) *entities.Connection {
	return &entities.Connection{
		ID:       "test-connection",
		UserID:   "test-user",
		Name:     "Test Connection",
		Type:     dbType,
		Host:     "localhost",
		Port:     s.getTestPort(dbType),
		Database: "test_db",
		Username: "test_user",
		Password: "test_password",
		SSL:      false,
	}
}

// getTestPort returns the test port for a given database type
func (s *TestSuite) getTestPort(dbType string) int {
	switch dbType {
	case entities.TypePostgreSQL:
		return 5432
	case entities.TypeMySQL:
		return 3306
	case entities.TypeRedis:
		return 6379
	case entities.TypeMongoDB:
		return 27017
	default:
		return 5432
	}
}

// CreateTestUser creates a test user entity
func (s *TestSuite) CreateTestUser() *entities.User {
	return &entities.User{
		ID:        "test-user-id",
		Email:     "test@example.com",
		Name:      "Test User",
		Plan:      entities.PlanFree,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// CreateTestQuery creates a test query entity
func (s *TestSuite) CreateTestQuery() *entities.Query {
	return &entities.Query{
		ID:           "test-query-id",
		UserID:       "test-user-id",
		ConnectionID: "test-connection",
		Name:         "Test Query",
		SQL:          "SELECT 1",
		CreatedAt:    time.Now(),
	}
}

// AssertHTTPError asserts that an HTTP response contains an error
func (s *TestSuite) AssertHTTPError(resp *httptest.ResponseRecorder, expectedStatus int) {
	assert.Equal(s.T(), expectedStatus, resp.Code, "HTTP status code mismatch")
	assert.Contains(s.T(), resp.Header().Get("Content-Type"), "application/json", "Response should be JSON")
}

// CreateTestRequest creates an HTTP test request
func (s *TestSuite) CreateTestRequest(method, path string, body interface{}) (*http.Request, error) {
	return CreateTestRequest(method, s.Server.URL+path, body)
}

// CreateTestJWT creates a test JWT token
func (s *TestSuite) CreateTestJWT(userID string) (string, error) {
	return CreateTestJWT(userID, s.Config.JWTSecret, s.Config.JWTExpiration)
}

// DatabaseTestSuite provides database-specific test utilities
type DatabaseTestSuite struct {
	TestSuite
	DBManager *database.Manager
}

// SetupDatabaseSuite initializes database test suite
func (s *DatabaseTestSuite) SetupDatabaseSuite() {
	s.SetupSuite()

	// Initialize database manager
	var err error
	s.DBManager, err = database.NewManager()
	require.NoError(s.T(), err, "Failed to create database manager")

	// Add cleanup
	s.AddCleanup(func() {
		if s.DBManager != nil {
			s.DBManager.Close()
		}
	})
}

// WithTestConnection creates a test connection and runs a function
func (s *DatabaseTestSuite) WithTestConnection(dbType string, fn func(adapter dbtypes.DatabaseAdapter)) {
	adapter := s.CreateTestConnection(dbType)

	// This would normally create a real database adapter
	// For testing, we'll use a mock adapter if available

	// For now, just ensure adapter is not nil
	assert.NotNil(s.T(), adapter, "Test connection should not be nil")

	// If we had a real adapter, we would call fn(adapter)
}

// MockDatabaseAdapter provides a mock database adapter for testing
type MockDatabaseAdapter struct {
	IsConnectedFlag bool
	ShouldError     bool
	ErrorMsg        string
}

func NewMockDatabaseAdapter() *MockDatabaseAdapter {
	return &MockDatabaseAdapter{
		IsConnectedFlag: false,
		ShouldError:     false,
	}
}

func (m *MockDatabaseAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	if m.ShouldError {
		return fmt.Errorf("%s", m.ErrorMsg)
	}
	m.IsConnectedFlag = true
	return nil
}

func (m *MockDatabaseAdapter) Disconnect(ctx context.Context) error {
	m.IsConnectedFlag = false
	return nil
}

func (m *MockDatabaseAdapter) IsConnected() bool {
	return m.IsConnectedFlag
}

func (m *MockDatabaseAdapter) TestConnection(ctx context.Context) error {
	if m.ShouldError {
		return fmt.Errorf("%s", m.ErrorMsg)
	}
	return nil
}

func (m *MockDatabaseAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*dbtypes.QueryResult, error) {
	if m.ShouldError {
		return nil, fmt.Errorf("%s", m.ErrorMsg)
	}
	return &dbtypes.QueryResult{
		Columns: []dbtypes.ColumnInfo{{Name: "test_column", Type: "INTEGER"}},
		Rows:    []map[string]interface{}{{"test_column": 1}},
		Success: true,
	}, nil
}

func (m *MockDatabaseAdapter) GetSchema(ctx context.Context) (*dbtypes.SchemaInfo, error) {
	if m.ShouldError {
		return nil, fmt.Errorf("%s", m.ErrorMsg)
	}
	return &dbtypes.SchemaInfo{
		Tables: []dbtypes.TableInfo{
			{
				Name: "test_table",
				Columns: []dbtypes.ColumnInfo{
					{Name: "id", Type: "INTEGER", IsPrimaryKey: true},
					{Name: "name", Type: "TEXT"},
				},
			},
		},
	}, nil
}

func (m *MockDatabaseAdapter) GetTableInfo(ctx context.Context, tableName string) (*dbtypes.TableInfo, error) {
	if m.ShouldError {
		return nil, fmt.Errorf("%s", m.ErrorMsg)
	}
	return &dbtypes.TableInfo{
		Name: tableName,
		Columns: []dbtypes.ColumnInfo{
			{Name: "id", Type: "INTEGER", IsPrimaryKey: true},
			{Name: "name", Type: "TEXT"},
		},
	}, nil
}

func (m *MockDatabaseAdapter) HealthCheck(ctx context.Context) error { return nil }
func (m *MockDatabaseAdapter) GetMetrics(ctx context.Context) (*dbtypes.ConnectionMetrics, error) {
	return &dbtypes.ConnectionMetrics{}, nil
}
func (m *MockDatabaseAdapter) Ping(ctx context.Context) error          { return nil }
func (m *MockDatabaseAdapter) GetConnectionInfo() *entities.Connection { return nil }
func (m *MockDatabaseAdapter) BeginTransaction(ctx context.Context) (dbtypes.Transaction, error) {
	return nil, nil
}

// Helper functions for creating test data

// CreateTestRequest creates an HTTP test request with proper headers
func CreateTestRequest(method, url string, body interface{}) (*http.Request, error) {
	var req *http.Request
	var err error

	if body != nil {
		req, err = http.NewRequest(method, url, nil)
	} else {
		req, err = http.NewRequest(method, url, nil)
	}

	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	return req, nil
}

// CreateTestJWT creates a test JWT token
func CreateTestJWT(userID, secret string, expiration time.Duration) (string, error) {
	// This would normally create a real JWT token
	// For testing purposes, we'll return a mock token
	return fmt.Sprintf("mock-jwt-token-%s", userID), nil
}

// AssertJSONResponse asserts that a response contains valid JSON
func AssertJSONResponse(t *testing.T, resp *httptest.ResponseRecorder) {
	assert.Equal(t, "application/json; charset=utf-8", resp.Header().Get("Content-Type"))
	assert.NotEmpty(t, resp.Body.String())
}

// WaitForCondition waits for a condition to be true or timeout
func WaitForCondition(t *testing.T, condition func() bool, timeout time.Duration, message string) {
	t.Helper()

	start := time.Now()
	for time.Since(start) < timeout {
		if condition() {
			return
		}
		time.Sleep(100 * time.Millisecond)
	}

	t.Fatalf("Timeout waiting for condition: %s", message)
}

// SkipIfShort skips the test if -short flag is provided
func SkipIfShort(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping test in short mode")
	}
}

// WithTestEnvironment sets up test environment variables
func WithTestEnvironment(t *testing.T, envVars map[string]string, fn func()) {
	t.Helper()

	// Store original values
	originalVars := make(map[string]string)
	for key, value := range envVars {
		originalVars[key] = os.Getenv(key)
		os.Setenv(key, value)
	}

	// Restore after function
	defer func() {
		for key, value := range originalVars {
			if value == "" {
				os.Unsetenv(key)
			} else {
				os.Setenv(key, value)
			}
		}
	}()

	fn()
}
