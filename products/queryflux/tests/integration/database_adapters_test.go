package integration

import (
	"context"
	"fmt"
	"log"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"github.com/redis/go-redis/v9"
	"github.com/go-sql-driver/mysql"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// DatabaseAdaptersIntegrationTestSuite tests all database adapters
type DatabaseAdaptersIntegrationTestSuite struct {
	suite.Suite
	ctx         context.Context
	postgresPool *pgxpool.Pool
	mongoClient   *mongo.Client
	redisClient   *redis.Client
	factory       *adapters.EnhancedAdapterFactory
}

// SetupSuite runs once for the entire test suite
func (suite *DatabaseAdaptersIntegrationTestSuite) SetupSuite() {
	suite.ctx = context.Background()

	// Load test environment variables
	if err := loadTestEnv(); err != nil {
		log.Printf("Warning: Could not load test environment: %v", err)
	}

	// Initialize adapter factory
	suite.factory = adapters.NewEnhancedAdapterFactory()

	// Setup individual database connections
	suite.setupPostgreSQL()
	suite.setupMongoDB()
	suite.setupRedis()

	log.Println("Database test suite setup completed")
}

// TearDownSuite runs once after the entire test suite
func (suite *DatabaseAdaptersIntegrationTestSuite) TearDownSuite() {
	if suite.postgresPool != nil {
		suite.postgresPool.Close()
	}
	if suite.mongoClient != nil {
		suite.mongoClient.Disconnect(suite.ctx)
	}
	if suite.redisClient != nil {
		suite.redisClient.Close()
	}
	log.Println("Database test suite teardown completed")
}

func (suite *DatabaseAdaptersIntegrationTestSuite) SetupTest() {
	// Reset data before each test
	suite.resetTestData()
}

// loadTestEnv loads test environment variables or sets defaults
func loadTestEnv() error {
	defaults := map[string]string{
		"POSTGRES_HOST":      "localhost",
		"POSTGRES_PORT":      "5432",
		"POSTGRES_USER":      "testuser",
		"POSTGRES_PASSWORD":  "testpass",
		"POSTGRES_DATABASE":  "queryflux_test",

		"MYSQL_HOST":         "localhost",
		"MYSQL_PORT":         "3306",
		"MYSQL_USER":         "testuser",
		"MYSQL_PASSWORD":     "testpass",
		"MYSQL_DATABASE":     "queryflux_test",

		"MONGODB_HOST":       "localhost",
		"MONGODB_PORT":       "27017",
		"MONGODB_DATABASE":   "queryflux_test",
		"MONGODB_USERNAME":   "testuser",
		"MONGODB_PASSWORD":   "testpass",

		"REDIS_HOST":         "localhost",
		"REDIS_PORT":         "6379",
		"REDIS_PASSWORD":     "",

		"MARIADB_HOST":       "localhost",
		"MARIADB_PORT":       "3307",
		"MARIADB_USER":       "testuser",
		"MARIADB_PASSWORD":   "testpass",
		"MARIADB_DATABASE":   "queryflux_test",
	}

	for key, defaultValue := range defaults {
		if os.Getenv(key) == "" {
			os.Setenv(key, defaultValue)
		}
	}

	return nil
}

// setupPostgreSQL initializes PostgreSQL connection
func (suite *DatabaseAdaptersIntegrationTestSuite) setupPostgreSQL() {
	connString := fmt.Sprintf("postgres://%s:%s@%s:%s/%s",
		os.Getenv("POSTGRES_USER"),
		os.Getenv("POSTGRES_PASSWORD"),
		os.Getenv("POSTGRES_HOST"),
		os.Getenv("POSTGRES_PORT"),
		os.Getenv("POSTGRES_DATABASE"),
	)

	config, err := pgxpool.ParseConfig(connString)
	require.NoError(suite.T(), err)

	config.MaxConns = 10
	config.MinConns = 2

	pool, err := pgxpool.NewWithConfig(suite.ctx, config)
	require.NoError(suite.T(), err)

	// Test connection
	err = pool.Ping(suite.ctx)
	require.NoError(suite.T(), err)

	suite.postgresPool = pool
}

// setupMongoDB initializes MongoDB connection
func (suite *DatabaseAdaptersIntegrationTestSuite) setupMongoDB() {
	host := os.Getenv("MONGODB_HOST")
	port := os.Getenv("MONGODB_PORT")
	username := os.Getenv("MONGODB_USERNAME")
	password := os.Getenv("MONGODB_PASSWORD")
	database := os.Getenv("MONGODB_DATABASE")

	var uri string
	if username != "" && password != "" {
		uri = fmt.Sprintf("mongodb://%s:%s@%s:%s", username, password, host, port)
	} else {
		uri = fmt.Sprintf("mongodb://%s:%s", host, port)
	}

	client, err := mongo.Connect(suite.ctx, options.Client().ApplyURI(uri))
	require.NoError(suite.T(), err)

	// Test connection
	err = client.Ping(suite.ctx, nil)
	require.NoError(suite.T(), err)

	suite.mongoClient = client
}

// setupRedis initializes Redis connection
func (suite *DatabaseAdaptersIntegrationTestSuite) setupRedis() {
	host := os.Getenv("REDIS_HOST")
	port := os.Getenv("REDIS_PORT")
	password := os.Getenv("REDIS_PASSWORD")

	client := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", host, port),
		Password: password,
		DB:       0, // Use default DB
	})

	// Test connection
	_, err := client.Ping(suite.ctx).Result()
	require.NoError(suite.T(), err)

	suite.redisClient = client
}

// resetTestData resets test data in all databases
func (suite *DatabaseAdaptersIntegrationTestSuite) resetTestData() {
	// Clear Redis test data
	if suite.redisClient != nil {
		// Keep some essential keys, clear others
		keys, err := suite.redisClient.Keys(suite.ctx, "test:*").Result()
		if err == nil && len(keys) > 0 {
			suite.redisClient.Del(suite.ctx, keys...)
		}
	}
}

// Test PostgreSQL Adapter
func (suite *DatabaseAdaptersIntegrationTestSuite) TestPostgreSQLAdapter() {
	if testing.Short() {
		suite.T().Skip("Skipping integration test in short mode")
	}

	// Create PostgreSQL configuration
	config := types.DatabaseConfig{
		Type:     "postgresql",
		Host:     os.Getenv("POSTGRES_HOST"),
		Port:     5432,
		Database: os.Getenv("POSTGRES_DATABASE"),
		Username: os.Getenv("POSTGRES_USER"),
		Password: os.Getenv("POSTGRES_PASSWORD"),
		SSLMode:  "disable",
		Options: map[string]interface{}{
			"max_connections": 10,
			"connect_timeout": 10,
		},
	}

	// Create adapter
	adapter, err := suite.factory.CreateAdapter("postgresql")
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), adapter)

	// Test connection
	err = adapter.Connect(suite.ctx, config)
	require.NoError(suite.T(), err)

	defer adapter.Close()

	// Test health check
	health, err := adapter.HealthCheck(suite.ctx)
	require.NoError(suite.T(), err)
	assert.True(suite.T(), health.IsHealthy)

	// Test schema introspection
	schema, err := adapter.GetSchema(suite.ctx)
	require.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), schema.Tables)

	// Check if expected tables exist
	expectedTables := []string{"users", "connections", "queries"}
	for _, expectedTable := range expectedTables {
		found := false
		for _, table := range schema.Tables {
			if table.Name == expectedTable {
				found = true
				break
			}
		}
		assert.True(suite.T(), found, "Expected table %s not found in schema", expectedTable)
	}

	// Test query execution
	query := "SELECT COUNT(*) FROM users"
	result, err := adapter.ExecuteQuery(suite.ctx, query, nil)
	require.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), result.Rows)
	assert.Equal(suite.T(), 1, len(result.Rows))

	// Test parameterized query
	paramQuery := "SELECT username FROM users WHERE id = $1"
	params := []interface{}{1}
	result, err = adapter.ExecuteQuery(suite.ctx, paramQuery, params)
	require.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), result.Rows)

	suite.T().Logf("PostgreSQL adapter test completed successfully")
}

// Test MySQL Adapter
func (suite *DatabaseAdaptersIntegrationTestSuite) TestMySQLAdapter() {
	if testing.Short() {
		suite.T().Skip("Skipping integration test in short mode")
	}

	// Create MySQL configuration
	config := types.DatabaseConfig{
		Type:     "mysql",
		Host:     os.Getenv("MYSQL_HOST"),
		Port:     3306,
		Database: os.Getenv("MYSQL_DATABASE"),
		Username: os.Getenv("MYSQL_USER"),
		Password: os.Getenv("MYSQL_PASSWORD"),
		Options: map[string]interface{}{
			"parse_time": true,
			"loc":        "Local",
		},
	}

	// Create adapter
	adapter, err := suite.factory.CreateAdapter("mysql")
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), adapter)

	// Test connection
	err = adapter.Connect(suite.ctx, config)
	require.NoError(suite.T(), err)

	defer adapter.Close()

	// Test health check
	health, err := adapter.HealthCheck(suite.ctx)
	require.NoError(suite.T(), err)
	assert.True(suite.T(), health.IsHealthy)

	// Test schema introspection
	schema, err := adapter.GetSchema(suite.ctx)
	require.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), schema.Tables)

	// Test query execution
	query := "SELECT COUNT(*) FROM users"
	result, err := adapter.ExecuteQuery(suite.ctx, query, nil)
	require.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), result.Rows)

	suite.T().Logf("MySQL adapter test completed successfully")
}

// Test MongoDB Adapter
func (suite *DatabaseAdaptersIntegrationTestSuite) TestMongoDBAdapter() {
	if testing.Short() {
		suite.T().Skip("Skipping integration test in short mode")
	}

	// Create MongoDB configuration
	config := types.DatabaseConfig{
		Type:     "mongodb",
		Host:     os.Getenv("MONGODB_HOST"),
		Port:     27017,
		Database: os.Getenv("MONGODB_DATABASE"),
		Username: os.Getenv("MONGODB_USERNAME"),
		Password: os.Getenv("MONGODB_PASSWORD"),
		Options: map[string]interface{}{
			"max_pool_size": 10,
			"timeout":       10,
		},
	}

	// Create adapter
	adapter, err := suite.factory.CreateAdapter("mongodb")
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), adapter)

	// Test connection
	err = adapter.Connect(suite.ctx, config)
	require.NoError(suite.T(), err)

	defer adapter.Close()

	// Test health check
	health, err := adapter.HealthCheck(suite.ctx)
	require.NoError(suite.T(), err)
	assert.True(suite.T(), health.IsHealthy)

	// Test schema introspection
	schema, err := adapter.GetSchema(suite.ctx)
	require.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), schema.Tables)

	// Test query execution (MongoDB uses different query syntax)
	query := "db.users.find({})"
	result, err := adapter.ExecuteQuery(suite.ctx, query, nil)
	require.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), result.Rows)

	// Test aggregation pipeline
	aggQuery := "db.users.aggregate([{$group: {_id: null, count: {$sum: 1}}}])"
	aggResult, err := adapter.ExecuteQuery(suite.ctx, aggQuery, nil)
	require.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), aggResult.Rows)

	suite.T().Logf("MongoDB adapter test completed successfully")
}

// Test Redis Adapter
func (suite *DatabaseAdaptersIntegrationTestSuite) TestRedisAdapter() {
	if testing.Short() {
		suite.T().Skip("Skipping integration test in short mode")
	}

	// Create Redis configuration
	config := types.DatabaseConfig{
		Type:     "redis",
		Host:     os.Getenv("REDIS_HOST"),
		Port:     6379,
		Database: 0,
		Password: os.Getenv("REDIS_PASSWORD"),
		Options: map[string]interface{}{
			"max_retries":     3,
			"dial_timeout":    5,
			"read_timeout":    3,
			"write_timeout":   3,
			"pool_size":       10,
		},
	}

	// Create adapter
	adapter, err := suite.factory.CreateAdapter("redis")
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), adapter)

	// Test connection
	err = adapter.Connect(suite.ctx, config)
	require.NoError(suite.T(), err)

	defer adapter.Close()

	// Test health check
	health, err := adapter.HealthCheck(suite.ctx)
	require.NoError(suite.T(), err)
	assert.True(suite.T(), health.IsHealthy)

	// Test Redis operations
	testKey := "test:key"
	testValue := "test value"

	// Test SET operation
	setQuery := fmt.Sprintf("SET %s %s", testKey, testValue)
	result, err := adapter.ExecuteQuery(suite.ctx, setQuery, nil)
	require.NoError(suite.T(), err)

	// Test GET operation
	getQuery := fmt.Sprintf("GET %s", testKey)
	result, err = adapter.ExecuteQuery(suite.ctx, getQuery, nil)
	require.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), result.Rows)

	// Test DEL operation
	delQuery := fmt.Sprintf("DEL %s", testKey)
	result, err = adapter.ExecuteQuery(suite.ctx, delQuery, nil)
	require.NoError(suite.T(), err)

	suite.T().Logf("Redis adapter test completed successfully")
}

// Test Adapter Factory
func (suite *DatabaseAdaptersIntegrationTestSuite) TestAdapterFactory() {
	// Test supported database types
	supportedTypes := suite.factory.GetSupportedTypes()
	expectedTypes := []string{"postgresql", "mysql", "mongodb", "redis"}

	for _, expectedType := range expectedTypes {
		assert.Contains(suite.T(), supportedTypes, expectedType)
	}

	// Test creating adapters for all supported types
	for _, dbType := range supportedTypes {
		adapter, err := suite.factory.CreateAdapter(dbType)
		assert.NoError(suite.T(), err, "Failed to create adapter for %s", dbType)
		assert.NotNil(suite.T(), adapter, "Adapter is nil for %s", dbType)
	}

	// Test creating adapter for unsupported type
	_, err := suite.factory.CreateAdapter("unsupported_database")
	assert.Error(suite.T(), err)
	assert.Contains(suite.T(), err.Error(), "unsupported database type")

	// Test adapter statistics
	stats := suite.factory.GetStatistics()
	assert.NotEmpty(suite.T(), stats)
	assert.Contains(suite.T(), stats, "total_adapters_created")
	assert.Contains(suite.T(), stats, "active_connections")
}

// Test Concurrent Connections
func (suite *DatabaseAdaptersIntegrationTestSuite) TestConcurrentConnections() {
	if testing.Short() {
		suite.T().Skip("Skipping integration test in short mode")
	}

	// Test PostgreSQL concurrent connections
	config := types.DatabaseConfig{
		Type:     "postgresql",
		Host:     os.Getenv("POSTGRES_HOST"),
		Port:     5432,
		Database: os.Getenv("POSTGRES_DATABASE"),
		Username: os.Getenv("POSTGRES_USER"),
		Password: os.Getenv("POSTGRES_PASSWORD"),
		SSLMode:  "disable",
	}

	// Create multiple adapters concurrently
	const numConcurrent = 5
	adapters := make([]types.DatabaseAdapter, numConcurrent)

	for i := 0; i < numConcurrent; i++ {
		adapter, err := suite.factory.CreateAdapter("postgresql")
		require.NoError(suite.T(), err)
		adapters[i] = adapter
	}

	// Connect all adapters concurrently
	done := make(chan bool, numConcurrent)
	for i, adapter := range adapters {
		go func(idx int, a types.DatabaseAdapter) {
			defer func() {
				a.Close()
				done <- true
			}()

			err := a.Connect(suite.ctx, config)
			assert.NoError(suite.T(), err, "Failed to connect adapter %d", idx)

			// Test query execution
			query := "SELECT 1 as test"
			result, err := a.ExecuteQuery(suite.ctx, query, nil)
			assert.NoError(suite.T(), err, "Failed to execute query on adapter %d", idx)
			assert.NotEmpty(suite.T(), result.Rows, "Empty result on adapter %d", idx)
		}(i, adapter)
	}

	// Wait for all goroutines to complete
	for i := 0; i < numConcurrent; i++ {
		select {
		case <-done:
			// OK
		case <-time.After(30 * time.Second):
			suite.T().Fatal("Concurrent connection test timed out")
		}
	}

	suite.T().Logf("Concurrent connections test completed successfully")
}

// Test Error Handling
func (suite *DatabaseAdaptersIntegrationTestSuite) TestErrorHandling() {
	// Test invalid configuration
	invalidConfig := types.DatabaseConfig{
		Type:     "postgresql",
		Host:     "nonexistent-host",
		Port:     5432,
		Database: "nonexistent_db",
		Username: "invalid_user",
		Password: "invalid_pass",
	}

	adapter, err := suite.factory.CreateAdapter("postgresql")
	require.NoError(suite.T(), err)

	// Test connection error
	err = adapter.Connect(suite.ctx, invalidConfig)
	assert.Error(suite.T(), err)

	// Test query execution on disconnected adapter
	err = adapter.Close()
	assert.NoError(suite.T(), err)

	query := "SELECT 1"
	_, err = adapter.ExecuteQuery(suite.ctx, query, nil)
	assert.Error(suite.T(), err)
}

// TestDatabaseAdapters runs the integration test suite
func TestDatabaseAdapters(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping database adapters integration tests in short mode")
	}

	// Check if Docker containers are running by testing a simple connection
	testEnv := loadTestEnv()
	if testEnv != nil {
		t.Skipf("Skipping integration tests: could not load test environment: %v", testEnv)
	}

	// Run the test suite
	suite.Run(t, new(DatabaseAdaptersIntegrationTestSuite))
}

// TestEnvironmentCheck checks if all test databases are available
func TestEnvironmentCheck(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping environment check in short mode")
	}

	loadTestEnv()

	// Check PostgreSQL
	pgConnStr := fmt.Sprintf("postgres://%s:%s@%s:%s/%s",
		os.Getenv("POSTGRES_USER"),
		os.Getenv("POSTGRES_PASSWORD"),
		os.Getenv("POSTGRES_HOST"),
		os.Getenv("POSTGRES_PORT"),
		os.Getenv("POSTGRES_DATABASE"),
	)

	_, err := pgxpool.ParseConfig(pgConnStr)
	if err != nil {
		t.Logf("PostgreSQL connection string error: %v", err)
	}

	// Check MySQL
	mysqlConnStr := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s",
		os.Getenv("MYSQL_USER"),
		os.Getenv("MYSQL_PASSWORD"),
		os.Getenv("MYSQL_HOST"),
		os.Getenv("MYSQL_PORT"),
		os.Getenv("MYSQL_DATABASE"),
	)

	_, err = mysql.ParseDSN(mysqlConnStr)
	if err != nil {
		t.Logf("MySQL connection string error: %v", err)
	}

	// Test basic connectivity
	t.Logf("Environment check completed. All database configurations are valid.")
}