package database_test

import (
	"context"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	"github.com/sirupsen/logrus"
)

// PoolManagerTestSuite provides tests for the PoolManager
type PoolManagerTestSuite struct {
	suite.Suite
	poolManager     *database.PoolManager
	encryptionSvc   *database.EncryptionService
	ctx             context.Context
	testConnections []*entities.Connection
}

func (suite *PoolManagerTestSuite) SetupSuite() {
	var err error
	suite.ctx = context.Background()

	// Create encryption service
	suite.encryptionSvc, err = database.NewEncryptionService("test-encryption-key-for-testing")
	require.NoError(suite.T(), err)

	// Create pool manager with test config
	config := &database.PoolConfig{
		MaxConnections:      5,
		MinConnections:      1,
		ConnectionTimeout:   10 * time.Second,
		IdleTimeout:         1 * time.Minute,
		MaxLifetime:         5 * time.Minute,
		HealthCheckInterval: 30 * time.Second,
	}

	suite.poolManager = database.NewPoolManager(config, suite.encryptionSvc)

	// Setup test connections
	suite.setupTestConnections()
}

func (suite *PoolManagerTestSuite) TearDownSuite() {
	if suite.poolManager != nil {
		suite.poolManager.Close(suite.ctx)
	}
}

func (suite *PoolManagerTestSuite) setupTestConnections() {
	suite.testConnections = []*entities.Connection{}

	// PostgreSQL connection (if available)
	if suite.isServiceAvailable("postgres") {
		pgConn := &entities.Connection{
			ID:       "test-pool-postgres",
			Name:     "Test Pool PostgreSQL",
			Type:     entities.TypePostgreSQL,
			Host:     suite.getEnvOrDefault("POSTGRES_HOST", "localhost"),
			Port:     5432,
			Database: suite.getEnvOrDefault("POSTGRES_DB", "testdb"),
			Username: suite.getEnvOrDefault("POSTGRES_USER", "postgres"),
			Password: suite.getEnvOrDefault("POSTGRES_PASSWORD", "password"),
			SSL:      false,
		}
		suite.testConnections = append(suite.testConnections, pgConn)
	}

	// Redis connection (if available)
	if suite.isServiceAvailable("redis") {
		redisConn := &entities.Connection{
			ID:       "test-pool-redis",
			Name:     "Test Pool Redis",
			Type:     entities.TypeRedis,
			Host:     suite.getEnvOrDefault("REDIS_HOST", "localhost"),
			Port:     6379,
			Database: "0",
			Username: "",
			Password: suite.getEnvOrDefault("REDIS_PASSWORD", ""),
			SSL:      false,
		}
		suite.testConnections = append(suite.testConnections, redisConn)
	}
}

func TestPoolManagerSuite(t *testing.T) {
	// Skip integration tests if not in CI or if explicitly disabled
	if os.Getenv("SKIP_INTEGRATION_TESTS") == "true" {
		t.Skip("Skipping integration tests")
	}

	suite.Run(t, new(PoolManagerTestSuite))
}

// TestBasicConnectionManagement tests basic connection operations
func (suite *PoolManagerTestSuite) TestBasicConnectionManagement() {
	if len(suite.testConnections) == 0 {
		suite.T().Skip("No test databases available")
	}

	conn := suite.testConnections[0]

	// Test connection
	err := suite.poolManager.Connect(suite.ctx, conn)
	require.NoError(suite.T(), err)

	// Verify connection is active
	assert.True(suite.T(), suite.poolManager.IsConnected(conn.ID))

	// Test connection test
	err = suite.poolManager.TestConnection(suite.ctx, conn.ID)
	assert.NoError(suite.T(), err)

	// Get metrics
	metrics, err := suite.poolManager.GetMetrics(conn.ID)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), conn.ID, metrics.ConnectionID)
	assert.True(suite.T(), metrics.ActiveConnections > 0)

	// Test disconnection
	err = suite.poolManager.Disconnect(suite.ctx, conn.ID)
	assert.NoError(suite.T(), err)

	// Verify connection is inactive
	assert.False(suite.T(), suite.poolManager.IsConnected(conn.ID))
}

// TestQueryExecution tests query execution with metrics tracking
func (suite *PoolManagerTestSuite) TestQueryExecution() {
	if len(suite.testConnections) == 0 {
		suite.T().Skip("No test databases available")
	}

	conn := suite.testConnections[0]

	// Connect
	err := suite.poolManager.Connect(suite.ctx, conn)
	require.NoError(suite.T(), err)
	defer suite.poolManager.Disconnect(suite.ctx, conn.ID)

	// Execute query based on database type
	var query string
	switch conn.Type {
	case entities.TypePostgreSQL, entities.TypeMySQL:
		query = "SELECT 1 as test_value"
	case entities.TypeRedis:
		query = "PING"
	case entities.TypeMongoDB:
		query = `{"type": "find", "collection": "test", "filter": {}}`
	}

	// Execute query
	result, err := suite.poolManager.ExecuteQuery(suite.ctx, conn.ID, query)
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), result)

	// Check metrics were updated
	metrics, err := suite.poolManager.GetMetrics(conn.ID)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(1), metrics.QueriesExecuted)
	assert.True(suite.T(), metrics.AvgQueryTime > 0)
	assert.True(suite.T(), metrics.LastActivity.After(metrics.CreatedAt))
}

// TestConcurrentConnections tests concurrent connection handling
func (suite *PoolManagerTestSuite) TestConcurrentConnections() {
	if len(suite.testConnections) == 0 {
		suite.T().Skip("No test databases available")
	}

	baseConn := suite.testConnections[0]
	numConnections := 3

	var wg sync.WaitGroup
	errChan := make(chan error, numConnections)

	// Create multiple connections concurrently
	for i := 0; i < numConnections; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()

			conn := *baseConn
			conn.ID = fmt.Sprintf("test-concurrent-%d", idx)

			// Connect
			if err := suite.poolManager.Connect(suite.ctx, &conn); err != nil {
				errChan <- err
				return
			}

			// Execute query
			var query string
			switch conn.Type {
			case entities.TypePostgreSQL, entities.TypeMySQL:
				query = fmt.Sprintf("SELECT %d as concurrent_test", idx)
			case entities.TypeRedis:
				query = "PING"
			case entities.TypeMongoDB:
				query = `{"type": "find", "collection": "test", "filter": {}}`
			}

			_, err := suite.poolManager.ExecuteQuery(suite.ctx, conn.ID, query)
			if err != nil {
				errChan <- err
				return
			}

			// Disconnect
			if err := suite.poolManager.Disconnect(suite.ctx, conn.ID); err != nil {
				errChan <- err
			}
		}(i)
	}

	wg.Wait()
	close(errChan)

	// Check for errors
	for err := range errChan {
		assert.NoError(suite.T(), err)
	}
}

// TestMetricsTracking tests metrics collection and tracking
func (suite *PoolManagerTestSuite) TestMetricsTracking() {
	if len(suite.testConnections) == 0 {
		suite.T().Skip("No test databases available")
	}

	conn := suite.testConnections[0]

	// Connect
	err := suite.poolManager.Connect(suite.ctx, conn)
	require.NoError(suite.T(), err)
	defer suite.poolManager.Disconnect(suite.ctx, conn.ID)

	// Get initial metrics
	initialMetrics, err := suite.poolManager.GetMetrics(conn.ID)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(0), initialMetrics.QueriesExecuted)

	// Execute multiple queries
	numQueries := 5
	for i := 0; i < numQueries; i++ {
		var query string
		switch conn.Type {
		case entities.TypePostgreSQL, entities.TypeMySQL:
			query = fmt.Sprintf("SELECT %d as query_num", i)
		case entities.TypeRedis:
			query = "PING"
		case entities.TypeMongoDB:
			query = `{"type": "find", "collection": "test", "filter": {}}`
		}

		_, err := suite.poolManager.ExecuteQuery(suite.ctx, conn.ID, query)
		require.NoError(suite.T(), err)
	}

	// Check updated metrics
	finalMetrics, err := suite.poolManager.GetMetrics(conn.ID)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(numQueries), finalMetrics.QueriesExecuted)
	assert.True(suite.T(), finalMetrics.AvgQueryTime > 0)
	assert.True(suite.T(), finalMetrics.LastActivity.After(initialMetrics.LastActivity))

	// Test GetAllMetrics
	allMetrics := suite.poolManager.GetAllMetrics()
	assert.Contains(suite.T(), allMetrics, conn.ID)
	assert.Equal(suite.T(), finalMetrics.QueriesExecuted, allMetrics[conn.ID].QueriesExecuted)
}

// TestErrorHandling tests error handling and metrics
func (suite *PoolManagerTestSuite) TestErrorHandling() {
	if len(suite.testConnections) == 0 {
		suite.T().Skip("No test databases available")
	}

	conn := suite.testConnections[0]

	// Connect
	err := suite.poolManager.Connect(suite.ctx, conn)
	require.NoError(suite.T(), err)
	defer suite.poolManager.Disconnect(suite.ctx, conn.ID)

	// Execute invalid query
	_, err = suite.poolManager.ExecuteQuery(suite.ctx, conn.ID, "INVALID SQL QUERY")
	assert.Error(suite.T(), err)

	// Check error metrics
	metrics, err := suite.poolManager.GetMetrics(conn.ID)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), int64(1), metrics.QueryErrors)

	// Test query on non-existent connection
	_, err = suite.poolManager.ExecuteQuery(suite.ctx, "non-existent", "SELECT 1")
	assert.Error(suite.T(), err)
	assert.IsType(suite.T(), &database.AdapterError{}, err)
}

// TestEncryption tests credential encryption/decryption
func (suite *PoolManagerTestSuite) TestEncryption() {
	// Create connection with password
	conn := &entities.Connection{
		ID:       "test-encryption",
		Name:     "Test Encryption",
		Type:     entities.TypePostgreSQL,
		Host:     "localhost",
		Port:     5432,
		Database: "testdb",
		Username: "testuser",
		Password: "secret-password",
	}

	// Encrypt credentials
	err := suite.encryptionSvc.EncryptConnectionCredentials(conn)
	require.NoError(suite.T(), err)

	// Password should be encrypted (different from original)
	assert.NotEqual(suite.T(), "secret-password", conn.Password)
	assert.NotEmpty(suite.T(), conn.Password)

	// Decrypt credentials
	err = suite.encryptionSvc.DecryptConnectionCredentials(conn)
	require.NoError(suite.T(), err)

	// Password should be back to original
	assert.Equal(suite.T(), "secret-password", conn.Password)
}

// TestHealthChecks tests health checking functionality
func (suite *PoolManagerTestSuite) TestHealthChecks() {
	if len(suite.testConnections) == 0 {
		suite.T().Skip("No test databases available")
	}

	conn := suite.testConnections[0]

	// Connect
	err := suite.poolManager.Connect(suite.ctx, conn)
	require.NoError(suite.T(), err)

	// Test health check
	err = suite.poolManager.TestConnection(suite.ctx, conn.ID)
	assert.NoError(suite.T(), err)

	// Disconnect and test health check on disconnected connection
	err = suite.poolManager.Disconnect(suite.ctx, conn.ID)
	require.NoError(suite.T(), err)

	err = suite.poolManager.TestConnection(suite.ctx, conn.ID)
	assert.Error(suite.T(), err)
}

// TestConnectionPooling tests connection pool behavior
func (suite *PoolManagerTestSuite) TestConnectionPooling() {
	if len(suite.testConnections) == 0 {
		suite.T().Skip("No test databases available")
	}

	conn := suite.testConnections[0]

	// Connect multiple times with same ID (should reuse connection)
	err := suite.poolManager.Connect(suite.ctx, conn)
	require.NoError(suite.T(), err)

	err = suite.poolManager.Connect(suite.ctx, conn)
	assert.NoError(suite.T(), err) // Should not error on duplicate connection

	// Verify only one connection is tracked
	activeConnections := suite.poolManager.GetActiveConnections()
	connectionCount := 0
	for _, id := range activeConnections {
		if id == conn.ID {
			connectionCount++
		}
	}
	assert.Equal(suite.T(), 1, connectionCount)

	// Cleanup
	err = suite.poolManager.Disconnect(suite.ctx, conn.ID)
	assert.NoError(suite.T(), err)
}

// Helper methods

func (suite *PoolManagerTestSuite) isServiceAvailable(service string) bool {
	switch service {
	case "postgres":
		return suite.isPostgreSQLAvailable()
	case "mysql":
		return suite.isMySQLAvailable()
	case "mongodb":
		return suite.isMongoDBAvailable()
	case "redis":
		return suite.isRedisAvailable()
	default:
		return false
	}
}

func (suite *PoolManagerTestSuite) isPostgreSQLAvailable() bool {
	conn := &entities.Connection{
		Type:     entities.TypePostgreSQL,
		Host:     suite.getEnvOrDefault("POSTGRES_HOST", "localhost"),
		Port:     5432,
		Database: suite.getEnvOrDefault("POSTGRES_DB", "testdb"),
		Username: suite.getEnvOrDefault("POSTGRES_USER", "postgres"),
		Password: suite.getEnvOrDefault("POSTGRES_PASSWORD", "password"),
	}

	factory := database.NewAdapterFactory(logrus.New())
	adapter, err := factory.CreateAdapter(conn)
	if err != nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = adapter.Connect(ctx, conn)
	if err == nil {
		adapter.Disconnect(ctx)
		return true
	}
	return false
}

func (suite *PoolManagerTestSuite) isMySQLAvailable() bool {
	conn := &entities.Connection{
		Type:     entities.TypeMySQL,
		Host:     suite.getEnvOrDefault("MYSQL_HOST", "localhost"),
		Port:     3306,
		Database: suite.getEnvOrDefault("MYSQL_DATABASE", "testdb"),
		Username: suite.getEnvOrDefault("MYSQL_USER", "root"),
		Password: suite.getEnvOrDefault("MYSQL_PASSWORD", "password"),
	}

	factory := database.NewAdapterFactory(logrus.New())
	adapter, err := factory.CreateAdapter(conn)
	if err != nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = adapter.Connect(ctx, conn)
	if err == nil {
		adapter.Disconnect(ctx)
		return true
	}
	return false
}

func (suite *PoolManagerTestSuite) isMongoDBAvailable() bool {
	conn := &entities.Connection{
		Type:     entities.TypeMongoDB,
		Host:     suite.getEnvOrDefault("MONGODB_HOST", "localhost"),
		Port:     27017,
		Database: suite.getEnvOrDefault("MONGODB_DATABASE", "testdb"),
		Username: suite.getEnvOrDefault("MONGODB_USER", ""),
		Password: suite.getEnvOrDefault("MONGODB_PASSWORD", ""),
	}

	factory := database.NewAdapterFactory(logrus.New())
	adapter, err := factory.CreateAdapter(conn)
	if err != nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = adapter.Connect(ctx, conn)
	if err == nil {
		adapter.Disconnect(ctx)
		return true
	}
	return false
}

func (suite *PoolManagerTestSuite) isRedisAvailable() bool {
	conn := &entities.Connection{
		Type:     entities.TypeRedis,
		Host:     suite.getEnvOrDefault("REDIS_HOST", "localhost"),
		Port:     6379,
		Database: "0",
		Password: suite.getEnvOrDefault("REDIS_PASSWORD", ""),
	}

	factory := database.NewAdapterFactory(logrus.New())
	adapter, err := factory.CreateAdapter(conn)
	if err != nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = adapter.Connect(ctx, conn)
	if err == nil {
		adapter.Disconnect(ctx)
		return true
	}
	return false
}

func (suite *PoolManagerTestSuite) getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
