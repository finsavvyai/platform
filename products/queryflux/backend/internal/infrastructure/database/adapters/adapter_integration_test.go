package adapters

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// AdapterIntegrationTestSuite tests the complete adapter system
type AdapterIntegrationTestSuite struct {
	suite.Suite
	factory *EnhancedFactory
	logger  *logrus.Logger
}

func (suite *AdapterIntegrationTestSuite) SetupSuite() {
	// Configure logger for tests
	suite.logger = logrus.New()
	suite.logger.SetLevel(logrus.WarnLevel) // Reduce noise in tests

	// Create enhanced factory with custom configuration
	config := FactoryConfig{
		EnableCaching:       true,
		EnablePooling:       true,
		DefaultTimeout:      time.Second * 10,
		HealthCheckInterval: time.Second * 5,
		MaxCacheSize:        10,
		CacheTTL:            time.Minute * 5,
	}

	suite.factory = NewEnhancedFactory(config, suite.logger)
}

func (suite *AdapterIntegrationTestSuite) TearDownSuite() {
	if suite.factory != nil {
		err := suite.factory.Close()
		suite.Require().NoError(err)
	}
}

func (suite *AdapterIntegrationTestSuite) TestFactoryRegistration() {

	// Test that built-in adapters are registered
	registered := suite.factory.GetRegisteredAdapters()

	expectedAdapters := []string{"postgresql", "mysql", "mongodb", "redis"}
	for _, expected := range expectedAdapters {
		assert.Contains(suite.T(), registered, expected, "Expected adapter %s to be registered", expected)
	}
}

func (suite *AdapterIntegrationTestSuite) TestAdapterFactory() {

	testCases := []struct {
		name        string
		conn        *entities.Connection
		expectError bool
		errorType   string
	}{
		{
			name: "Valid PostgreSQL Connection",
			conn: &entities.Connection{
				ID:       "pg-test-1",
				Type:     entities.TypePostgreSQL,
				Host:     "localhost",
				Port:     5432,
				Database: "testdb",
				Username: "testuser",
				Password: "testpass",
			},
			expectError: false,
		},
		{
			name: "Valid MySQL Connection",
			conn: &entities.Connection{
				ID:       "mysql-test-1",
				Type:     entities.TypeMySQL,
				Host:     "localhost",
				Port:     3306,
				Database: "testdb",
				Username: "testuser",
				Password: "testpass",
			},
			expectError: false,
		},
		{
			name: "Valid MongoDB Connection",
			conn: &entities.Connection{
				ID:       "mongo-test-1",
				Type:     entities.TypeMongoDB,
				Host:     "localhost",
				Port:     27017,
				Database: "testdb",
			},
			expectError: false,
		},
		{
			name: "Valid Redis Connection",
			conn: &entities.Connection{
				ID:       "redis-test-1",
				Type:     entities.TypeRedis,
				Host:     "localhost",
				Port:     6379,
				Database: "0",
			},
			expectError: false,
		},
		{
			name: "Unsupported Database Type",
			conn: &entities.Connection{
				ID:   "unsupported-test-1",
				Type: "unsupported_db",
				Host: "localhost",
				Port: 1234,
			},
			expectError: true,
			errorType:   types.ErrCodeUnsupportedOperation,
		},
		{
			name:        "Nil Connection",
			conn:        nil,
			expectError: true,
			errorType:   types.ErrCodeInternalError,
		},
	}

	for _, tc := range testCases {
		suite.Run(tc.name, func() {
			adapter, err := suite.factory.CreateAdapter(tc.conn)

			if tc.expectError {
				suite.Assert().Error(err)
				suite.Assert().Nil(adapter)

				if tc.errorType != "" {
					if adapterErr, ok := err.(*types.AdapterError); ok {
						suite.Assert().Equal(tc.errorType, adapterErr.Code)
					}
				}
			} else {
				suite.Assert().NoError(err)
				suite.Assert().NotNil(adapter)
				suite.Assert().Equal(tc.conn, adapter.GetConnectionInfo())
			}
		})
	}
}

func (suite *AdapterIntegrationTestSuite) TestAdapterCaching() {
	// Register mock adapter for testing
	mockConstructor := func(conn *entities.Connection, logger *logrus.Logger) (types.DatabaseAdapter, error) {
		return &MockAdapter{conn: conn}, nil
	}

	err := suite.factory.RegisterAdapter("mock_type", mockConstructor, AdapterMetadata{
		Name:        "Mock",
		Description: "Mock adapter for testing",
		SupportedTypes: []string{
			"mock_type",
		},
	})
	suite.Require().NoError(err)
	defer suite.factory.UnregisterAdapter("mock_type")

	conn := &entities.Connection{
		ID:       "cache-test-1",
		Type:     "mock_type",
		Host:     "localhost",
		Port:     5432,
		Database: "testdb",
	}

	// Create first adapter
	adapter1, err := suite.factory.CreateAdapter(conn)
	suite.Require().NoError(err)
	suite.Require().NotNil(adapter1)

	// Create second adapter with same connection - should return cached version
	adapter2, err := suite.factory.CreateAdapter(conn)
	suite.Require().NoError(err)
	suite.Require().NotNil(adapter2)

	// Should be the same instance (cached)
	suite.Assert().Same(adapter1, adapter2)

	// Get factory stats to verify caching
	stats := suite.factory.GetStats()
	suite.Assert().True(stats.CacheEnabled)
	suite.Assert().Equal(1, stats.CachedAdapters) // One cached adapter
}

func (suite *AdapterIntegrationTestSuite) TestFactoryStats() {

	stats := suite.factory.GetStats()

	// Verify basic stats
	suite.Assert().NotEmpty(stats.RegisteredAdapters)
	suite.Assert().True(stats.CacheEnabled)
	suite.Assert().True(stats.PoolingEnabled)
	suite.Assert().GreaterOrEqual(stats.MaxCacheSize, 0)
}

func (suite *AdapterIntegrationTestSuite) TestAdapterInterface() {

	conn := &entities.Connection{
		ID:       "interface-test-1",
		Type:     entities.TypePostgreSQL,
		Host:     "localhost",
		Port:     5432,
		Database: "testdb",
	}

	adapter, err := suite.factory.CreateAdapter(conn)
	suite.Require().NoError(err)
	suite.Require().NotNil(adapter)

	// Test that adapter implements all required interface methods
	suite.Assert().Implements((*types.DatabaseAdapter)(nil), adapter)

	// Test basic methods that don't require actual connection
	suite.Assert().Equal(conn, adapter.GetConnectionInfo())
	suite.Assert().False(adapter.IsConnected()) // Should be false initially
}

func (suite *AdapterIntegrationTestSuite) TestErrorHandling() {

	// Test adapter error creation
	err := types.NewAdapterError("TEST_CODE", "Test message", "Test details")

	suite.Assert().Equal("TEST_CODE", err.Code)
	suite.Assert().Equal("Test message", err.Message)
	suite.Assert().Equal("Test details", err.Details)
	suite.Assert().False(err.Retryable)

	// Test error chaining
	err.WithQuery("SELECT * FROM users", 1, 2, 3).
		WithContext("host", "localhost").
		WithRetryable(true)

	suite.Assert().Equal("SELECT * FROM users", err.Query)
	suite.Assert().Equal("localhost", err.Context["host"])
	suite.Assert().True(err.Retryable)
}

func (suite *AdapterIntegrationTestSuite) TestConnectionConfig() {

	// Test default configuration
	config := types.DefaultConnectionConfig()

	suite.Assert().Equal(10, config.MaxOpenConns)
	suite.Assert().Equal(2, config.MaxIdleConns)
	suite.Assert().Equal(time.Hour, config.ConnMaxLifetime)
	suite.Assert().Equal(time.Second*10, config.ConnectTimeout)
	suite.Assert().Equal(3, config.MaxRetries)
	suite.Assert().Equal("prefer", config.SSLMode)
}

func TestAdapterIntegrationTestSuite(t *testing.T) {
	suite.Run(t, new(AdapterIntegrationTestSuite))
}

// TestPerformance runs performance benchmarks
func TestPerformance(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	config := FactoryConfig{
		EnableCaching: true,
		MaxCacheSize:  100,
	}

	factory := NewEnhancedFactory(config, logger)
	defer factory.Close()

	conn := &entities.Connection{
		ID:       "perf-test",
		Type:     entities.TypePostgreSQL,
		Host:     "localhost",
		Port:     5432,
		Database: "testdb",
	}

	t.Run("BenchmarkAdapterCreation", func(t *testing.T) {
		iterations := 1000
		start := time.Now()

		for i := 0; i < iterations; i++ {
			adapter, err := factory.CreateAdapter(conn)
			if err != nil {
				t.Fatalf("Failed to create adapter: %v", err)
			}
			if adapter == nil {
				t.Fatal("Adapter is nil")
			}
		}

		duration := time.Since(start)
		avgDuration := duration / time.Duration(iterations)

		t.Logf("Created %d adapters in %v (avg: %v per adapter)",
			iterations, duration, avgDuration)

		// Performance assertion - should be fast
		assert.Less(t, avgDuration, time.Millisecond)
	})

	t.Run("BenchmarkCaching", func(t *testing.T) {
		// Create an adapter first (to populate cache)
		_, err := factory.CreateAdapter(conn)
		require.NoError(t, err)

		iterations := 1000
		start := time.Now()

		for i := 0; i < iterations; i++ {
			adapter, err := factory.CreateAdapter(conn)
			if err != nil {
				t.Fatalf("Failed to create cached adapter: %v", err)
			}
			if adapter == nil {
				t.Fatal("Cached adapter is nil")
			}
		}

		duration := time.Since(start)
		avgDuration := duration / time.Duration(iterations)

		t.Logf("Retrieved %d cached adapters in %v (avg: %v per retrieval)",
			iterations, duration, avgDuration)

		// Cached retrieval should be even faster
		assert.Less(t, avgDuration, time.Microsecond*100)
	})
}

// TestErrorCodes validates all error codes are properly defined
func TestErrorCodes(t *testing.T) {
	errorCodes := []string{
		types.ErrCodeConnectionFailed,
		types.ErrCodeConnectionLost,
		types.ErrCodeConnectionTimeout,
		types.ErrCodeNotConnected,
		types.ErrCodeQueryExecution,
		types.ErrCodeQueryTimeout,
		types.ErrCodeInvalidQuery,
		types.ErrCodeEmptyQuery,
		types.ErrCodeUnauthorized,
		types.ErrCodeForbidden,
		types.ErrCodeResourceNotFound,
		types.ErrCodeResourceLocked,
		types.ErrCodeConstraintViolation,
		types.ErrCodeDuplicateKey,
		types.ErrCodeForeignKeyViolation,
		types.ErrCodeInvalidCredentials,
		types.ErrCodeDatabaseError,
		types.ErrCodeInternalError,
		types.ErrCodeUnsupportedOperation,
		types.ErrCodePoolExhausted,
		types.ErrCodeSchemaQueryFailed,
	}

	// Ensure all error codes are non-empty strings
	for _, code := range errorCodes {
		assert.NotEmpty(t, code, "Error code should not be empty")
		assert.NotContains(t, code, " ", "Error code should not contain spaces")
		assert.Equal(t, code, strings.ToUpper(code), "Error code should be uppercase")
	}
}

// TestDataStructures validates all data structures can be properly created
func TestDataStructures(t *testing.T) {
	t.Run("QueryResult", func(t *testing.T) {
		result := &types.QueryResult{
			Columns: []types.ColumnInfo{
				{Name: "id", Type: "integer"},
				{Name: "name", Type: "text"},
			},
			Rows: []map[string]interface{}{
				{"id": 1, "name": "test"},
			},
			Count: 1,
		}

		assert.Equal(t, 2, len(result.Columns))
		assert.Equal(t, 1, len(result.Rows))
		assert.Equal(t, int64(1), result.Count)
	})

	t.Run("SchemaInfo", func(t *testing.T) {
		schema := &types.SchemaInfo{
			Tables: []types.TableInfo{
				{
					Name:   "users",
					Schema: "public",
					Columns: []types.ColumnInfo{
						{Name: "id", Type: "integer", IsPrimaryKey: true},
					},
				},
			},
		}

		assert.Equal(t, 1, len(schema.Tables))
		assert.Equal(t, "users", schema.Tables[0].Name)
		assert.Equal(t, 1, len(schema.Tables[0].Columns))
	})

	t.Run("HealthStatus", func(t *testing.T) {
		status := &types.HealthStatus{
			Healthy:      true,
			LastChecked:  time.Now(),
			ResponseTime: time.Millisecond * 50,
		}

		assert.True(t, status.Healthy)
		assert.Equal(t, time.Millisecond*50, status.ResponseTime)
		assert.False(t, status.LastChecked.IsZero())
	})

	t.Run("ConnectionMetrics", func(t *testing.T) {
		metrics := &types.ConnectionMetrics{
			ConnectionPoolStats: types.ConnectionPoolStats{
				MaxOpenConnections: 20,
				OpenConnections:    5,
			},
			QueryPerformance: types.QueryPerformance{
				TotalQueriesCount: 100,
				AverageQueryTime:  time.Millisecond * 25,
			},
			DatabaseInfo: types.DatabaseInfo{
				Version:    "13.0",
				Engine:     "PostgreSQL",
				TableCount: 10,
			},
			LastUpdated: time.Now(),
		}

		assert.Equal(t, 20, metrics.ConnectionPoolStats.MaxOpenConnections)
		assert.Equal(t, 5, metrics.ConnectionPoolStats.OpenConnections)
		assert.Equal(t, int64(100), metrics.QueryPerformance.TotalQueriesCount)
		assert.Equal(t, "13.0", metrics.DatabaseInfo.Version)
		assert.False(t, metrics.LastUpdated.IsZero())
	})
}

// MockAdapter for testing caching without real connections
type MockAdapter struct {
	conn *entities.Connection
}

func (m *MockAdapter) Connect(ctx context.Context, conn *entities.Connection) error { return nil }
func (m *MockAdapter) Disconnect(ctx context.Context) error                         { return nil }
func (m *MockAdapter) TestConnection(ctx context.Context) error                     { return nil }
func (m *MockAdapter) IsConnected() bool                                            { return true }
func (m *MockAdapter) GetConnectionInfo() *entities.Connection                      { return m.conn }
func (m *MockAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	return nil, nil
}
func (m *MockAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) { return nil, nil }
func (m *MockAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return m.GetSchema(ctx)
}
func (m *MockAdapter) Stream(ctx context.Context, query string, opts types.StreamOptions, params ...interface{}) (<-chan types.StreamRow, <-chan error) {
	return types.NewNotImplementedStream("mock adapter stream not implemented")
}
func (m *MockAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	return nil, nil
}
func (m *MockAdapter) HealthCheck(ctx context.Context) error { return nil }
func (m *MockAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return nil, nil
}
func (m *MockAdapter) Ping(ctx context.Context) error { return nil }
func (m *MockAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	return nil, nil
}
