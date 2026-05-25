package database_test

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/sql"
	"github.com/sirupsen/logrus"
)

// AdapterTestSuite provides integration tests for database adapters
type AdapterTestSuite struct {
	suite.Suite
	factory *database.AdapterFactory
	ctx     context.Context
}

func (suite *AdapterTestSuite) SetupSuite() {
	suite.factory = database.NewAdapterFactory(logrus.New())
	suite.ctx = context.Background()
}

func TestAdapterSuite(t *testing.T) {
	// Skip integration tests if not in CI or if explicitly disabled
	if os.Getenv("SKIP_INTEGRATION_TESTS") == "true" {
		t.Skip("Skipping integration tests")
	}

	suite.Run(t, new(AdapterTestSuite))
}

// TestPostgreSQLAdapter tests PostgreSQL adapter functionality
func (suite *AdapterTestSuite) TestPostgreSQLAdapter() {
	// Skip if PostgreSQL is not available
	if !suite.isPostgreSQLAvailable() {
		suite.T().Skip("PostgreSQL not available for testing")
	}

	conn := &entities.Connection{
		ID:       "test-postgres",
		Name:     "Test PostgreSQL",
		Type:     entities.TypePostgreSQL,
		Host:     suite.getEnvOrDefault("POSTGRES_HOST", "localhost"),
		Port:     5432,
		Database: suite.getEnvOrDefault("POSTGRES_DB", "testdb"),
		Username: suite.getEnvOrDefault("POSTGRES_USER", "postgres"),
		Password: suite.getEnvOrDefault("POSTGRES_PASSWORD", "password"),
		SSL:      false,
	}

	adapter, err := suite.factory.CreateAdapter(conn)
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), adapter)

	// Test connection
	err = adapter.Connect(suite.ctx, conn)
	require.NoError(suite.T(), err)
	defer adapter.Disconnect(suite.ctx)

	// Test connection status
	assert.True(suite.T(), adapter.IsConnected())

	// Test connection test
	err = adapter.TestConnection(suite.ctx)
	assert.NoError(suite.T(), err)

	// Test simple query
	result, err := adapter.ExecuteQuery(suite.ctx, "SELECT 1 as test_column")
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), result)
	assert.Equal(suite.T(), []string{"test_column"}, result.Columns)
	assert.Equal(suite.T(), int64(1), result.Count)
	assert.Equal(suite.T(), 1, result.Rows[0]["test_column"])

	// Test schema retrieval
	schema, err := adapter.GetSchema(suite.ctx)
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), schema)
	assert.IsType(suite.T(), &database.SchemaInfo{}, schema)

	// Test table creation and info retrieval
	_, err = adapter.ExecuteQuery(suite.ctx, `
		CREATE TABLE IF NOT EXISTS test_table (
			id SERIAL PRIMARY KEY,
			name VARCHAR(100) NOT NULL,
			created_at TIMESTAMP DEFAULT NOW()
		)
	`)
	require.NoError(suite.T(), err)

	tableInfo, err := adapter.GetTableInfo(suite.ctx, "test_table")
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), tableInfo)
	assert.Equal(suite.T(), "test_table", tableInfo.Name)
	assert.True(suite.T(), len(tableInfo.Columns) >= 3)

	// Cleanup
	_, err = adapter.ExecuteQuery(suite.ctx, "DROP TABLE IF EXISTS test_table")
	assert.NoError(suite.T(), err)
}

// TestMySQLAdapter tests MySQL adapter functionality
func (suite *AdapterTestSuite) TestMySQLAdapter() {
	// Skip if MySQL is not available
	if !suite.isMySQLAvailable() {
		suite.T().Skip("MySQL not available for testing")
	}

	conn := &entities.Connection{
		ID:       "test-mysql",
		Name:     "Test MySQL",
		Type:     entities.TypeMySQL,
		Host:     suite.getEnvOrDefault("MYSQL_HOST", "localhost"),
		Port:     3306,
		Database: suite.getEnvOrDefault("MYSQL_DATABASE", "testdb"),
		Username: suite.getEnvOrDefault("MYSQL_USER", "root"),
		Password: suite.getEnvOrDefault("MYSQL_PASSWORD", "password"),
		SSL:      false,
	}

	adapter, err := suite.factory.CreateAdapter(conn)
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), adapter)

	// Test connection
	err = adapter.Connect(suite.ctx, conn)
	require.NoError(suite.T(), err)
	defer adapter.Disconnect(suite.ctx)

	// Test connection status
	assert.True(suite.T(), adapter.IsConnected())

	// Test connection test
	err = adapter.TestConnection(suite.ctx)
	assert.NoError(suite.T(), err)

	// Test simple query
	result, err := adapter.ExecuteQuery(suite.ctx, "SELECT 1 as test_column")
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), result)
	assert.Equal(suite.T(), []string{"test_column"}, result.Columns)
	assert.Equal(suite.T(), int64(1), result.Count)

	// Test schema retrieval
	schema, err := adapter.GetSchema(suite.ctx)
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), schema)
	assert.IsType(suite.T(), &database.SchemaInfo{}, schema)

	// Test table creation and info retrieval
	_, err = adapter.ExecuteQuery(suite.ctx, `
		CREATE TABLE IF NOT EXISTS test_table (
			id INT AUTO_INCREMENT PRIMARY KEY,
			name VARCHAR(100) NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	require.NoError(suite.T(), err)

	tableInfo, err := adapter.GetTableInfo(suite.ctx, "test_table")
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), tableInfo)
	assert.Equal(suite.T(), "test_table", tableInfo.Name)
	assert.True(suite.T(), len(tableInfo.Columns) >= 3)

	// Cleanup
	_, err = adapter.ExecuteQuery(suite.ctx, "DROP TABLE IF EXISTS test_table")
	assert.NoError(suite.T(), err)
}

// TestMongoDBAdapter tests MongoDB adapter functionality
func (suite *AdapterTestSuite) TestMongoDBAdapter() {
	// Skip if MongoDB is not available
	if !suite.isMongoDBAvailable() {
		suite.T().Skip("MongoDB not available for testing")
	}

	conn := &entities.Connection{
		ID:       "test-mongodb",
		Name:     "Test MongoDB",
		Type:     entities.TypeMongoDB,
		Host:     suite.getEnvOrDefault("MONGODB_HOST", "localhost"),
		Port:     27017,
		Database: suite.getEnvOrDefault("MONGODB_DATABASE", "testdb"),
		Username: suite.getEnvOrDefault("MONGODB_USER", ""),
		Password: suite.getEnvOrDefault("MONGODB_PASSWORD", ""),
		SSL:      false,
	}

	adapter, err := suite.factory.CreateAdapter(conn)
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), adapter)

	// Test connection
	err = adapter.Connect(suite.ctx, conn)
	require.NoError(suite.T(), err)
	defer adapter.Disconnect(suite.ctx)

	// Test connection status
	assert.True(suite.T(), adapter.IsConnected())

	// Test connection test
	err = adapter.TestConnection(suite.ctx)
	assert.NoError(suite.T(), err)

	// Test simple find operation
	result, err := adapter.ExecuteQuery(suite.ctx, `{"type": "find", "collection": "test_collection", "filter": {}}`)
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), result)

	// Test schema retrieval
	schema, err := adapter.GetSchema(suite.ctx)
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), schema)
	assert.IsType(suite.T(), &database.SchemaInfo{}, schema)
}

// TestRedisAdapter tests Redis adapter functionality
func (suite *AdapterTestSuite) TestRedisAdapter() {
	// Skip if Redis is not available
	if !suite.isRedisAvailable() {
		suite.T().Skip("Redis not available for testing")
	}

	conn := &entities.Connection{
		ID:       "test-redis",
		Name:     "Test Redis",
		Type:     entities.TypeRedis,
		Host:     suite.getEnvOrDefault("REDIS_HOST", "localhost"),
		Port:     6379,
		Database: "0",
		Username: "",
		Password: suite.getEnvOrDefault("REDIS_PASSWORD", ""),
		SSL:      false,
	}

	adapter, err := suite.factory.CreateAdapter(conn)
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), adapter)

	// Test connection
	err = adapter.Connect(suite.ctx, conn)
	require.NoError(suite.T(), err)
	defer adapter.Disconnect(suite.ctx)

	// Test connection status
	assert.True(suite.T(), adapter.IsConnected())

	// Test connection test
	err = adapter.TestConnection(suite.ctx)
	assert.NoError(suite.T(), err)

	// Test PING command
	result, err := adapter.ExecuteQuery(suite.ctx, "PING")
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), result)
	assert.Equal(suite.T(), "PONG", result.Rows[0]["result"])

	// Test SET and GET commands
	_, err = adapter.ExecuteQuery(suite.ctx, "SET test_key test_value")
	require.NoError(suite.T(), err)

	result, err = adapter.ExecuteQuery(suite.ctx, "GET test_key")
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), "test_value", result.Rows[0]["value"])

	// Test schema retrieval
	schema, err := adapter.GetSchema(suite.ctx)
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), schema)

	// Cleanup
	_, err = adapter.ExecuteQuery(suite.ctx, "DEL test_key")
	assert.NoError(suite.T(), err)
}

// TestConcurrentConnections tests concurrent connection handling
func (suite *AdapterTestSuite) TestConcurrentConnections() {
	if !suite.isPostgreSQLAvailable() {
		suite.T().Skip("PostgreSQL not available for concurrent testing")
	}

	conn := &entities.Connection{
		ID:       "test-concurrent",
		Name:     "Test Concurrent",
		Type:     entities.TypePostgreSQL,
		Host:     suite.getEnvOrDefault("POSTGRES_HOST", "localhost"),
		Port:     5432,
		Database: suite.getEnvOrDefault("POSTGRES_DB", "testdb"),
		Username: suite.getEnvOrDefault("POSTGRES_USER", "postgres"),
		Password: suite.getEnvOrDefault("POSTGRES_PASSWORD", "password"),
		SSL:      false,
	}

	// Create multiple adapters
	numAdapters := 5
	adapters := make([]database.DatabaseAdapter, numAdapters)

	for i := 0; i < numAdapters; i++ {
		adapter, err := suite.factory.CreateAdapter(conn)
		require.NoError(suite.T(), err)
		adapters[i] = adapter
	}

	// Connect all adapters concurrently
	errChan := make(chan error, numAdapters)
	for i, adapter := range adapters {
		go func(idx int, a database.DatabaseAdapter) {
			connCopy := *conn
			connCopy.ID = fmt.Sprintf("test-concurrent-%d", idx)
			errChan <- a.Connect(suite.ctx, &connCopy)
		}(i, adapter)
	}

	// Wait for all connections
	for i := 0; i < numAdapters; i++ {
		err := <-errChan
		assert.NoError(suite.T(), err)
	}

	// Execute queries concurrently
	for i, adapter := range adapters {
		go func(idx int, a database.DatabaseAdapter) {
			_, err := a.ExecuteQuery(suite.ctx, fmt.Sprintf("SELECT %d as concurrent_test", idx))
			errChan <- err
		}(i, adapter)
	}

	// Wait for all queries
	for i := 0; i < numAdapters; i++ {
		err := <-errChan
		assert.NoError(suite.T(), err)
	}

	// Disconnect all adapters
	for _, adapter := range adapters {
		err := adapter.Disconnect(suite.ctx)
		assert.NoError(suite.T(), err)
	}
}

// TestOracleAdapter tests Oracle adapter functionality
func (suite *AdapterTestSuite) TestOracleAdapter() {
	// Skip if Oracle is not available
	if !suite.isOracleAvailable() {
		suite.T().Skip("Oracle not available for testing")
	}

	conn := &entities.Connection{
		ID:       "test-oracle",
		Name:     "Test Oracle",
		Type:     entities.TypeOracle,
		Host:     suite.getEnvOrDefault("ORACLE_HOST", "localhost"),
		Port:     1521,
		Database: suite.getEnvOrDefault("ORACLE_SERVICE", "XE"),
		Username: suite.getEnvOrDefault("ORACLE_USER", "system"),
		Password: suite.getEnvOrDefault("ORACLE_PASSWORD", "password"),
		SSL:      false,
	}

	adapter, err := suite.factory.CreateAdapter(conn)
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), adapter)

	// Test connection
	err = adapter.Connect(suite.ctx, conn)
	require.NoError(suite.T(), err)
	defer adapter.Disconnect(suite.ctx)

	// Test connection status
	assert.True(suite.T(), adapter.IsConnected())

	// Test connection test
	err = adapter.TestConnection(suite.ctx)
	assert.NoError(suite.T(), err)

	// Test simple query
	result, err := adapter.ExecuteQuery(suite.ctx, "SELECT 1 as test_column FROM DUAL")
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), result)
	assert.Equal(suite.T(), []string{"TEST_COLUMN"}, result.Columns)
	assert.Equal(suite.T(), int64(1), result.Count)

	// Test schema retrieval
	schema, err := adapter.GetSchema(suite.ctx)
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), schema)
	assert.IsType(suite.T(), &database.SchemaInfo{}, schema)
}

// TestSupabaseAdapter tests Supabase adapter functionality
func (suite *AdapterTestSuite) TestSupabaseAdapter() {
	// Skip if Supabase is not available
	if !suite.isSupabaseAvailable() {
		suite.T().Skip("Supabase not available for testing")
	}

	conn := &entities.Connection{
		ID:       "test-supabase",
		Name:     "Test Supabase",
		Type:     entities.TypeSupabase,
		Host:     suite.getEnvOrDefault("SUPABASE_HOST", "localhost"),
		Port:     5432,
		Database: suite.getEnvOrDefault("SUPABASE_DB", "postgres"),
		Username: suite.getEnvOrDefault("SUPABASE_USER", "postgres"),
		Password: suite.getEnvOrDefault("SUPABASE_PASSWORD", "password"),
		SSL:      true,
	}

	adapter, err := suite.factory.CreateAdapter(conn)
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), adapter)

	// Test connection
	err = adapter.Connect(suite.ctx, conn)
	require.NoError(suite.T(), err)
	defer adapter.Disconnect(suite.ctx)

	// Test connection status
	assert.True(suite.T(), adapter.IsConnected())

	// Test connection test
	err = adapter.TestConnection(suite.ctx)
	assert.NoError(suite.T(), err)

	// Test simple query
	result, err := adapter.ExecuteQuery(suite.ctx, "SELECT 1 as test_column")
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), result)
	assert.Equal(suite.T(), []string{"test_column"}, result.Columns)
	assert.Equal(suite.T(), int64(1), result.Count)

	// Test schema retrieval
	schema, err := adapter.GetSchema(suite.ctx)
	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), schema)
	assert.IsType(suite.T(), &database.SchemaInfo{}, schema)

	// Test Supabase-specific metadata (if it's a Supabase adapter)
	if supabaseAdapter, ok := adapter.(*sql.SupabaseAdapter); ok {
		metadata, err := supabaseAdapter.GetSupabaseMetadata(suite.ctx)
		require.NoError(suite.T(), err)
		require.NotNil(suite.T(), metadata)
		assert.IsType(suite.T(), &entities.SupabaseMetadata{}, metadata)
	}
}

// TestErrorHandling tests error handling scenarios
func (suite *AdapterTestSuite) TestErrorHandling() {
	// Test invalid connection
	invalidConn := &entities.Connection{
		ID:       "test-invalid",
		Name:     "Test Invalid",
		Type:     entities.TypePostgreSQL,
		Host:     "invalid-host",
		Port:     5432,
		Database: "invalid-db",
		Username: "invalid-user",
		Password: "invalid-password",
		SSL:      false,
	}

	adapter, err := suite.factory.CreateAdapter(invalidConn)
	require.NoError(suite.T(), err)

	// Connection should fail
	err = adapter.Connect(suite.ctx, invalidConn)
	assert.Error(suite.T(), err)
	assert.False(suite.T(), adapter.IsConnected())

	// Test unsupported database type
	unsupportedConn := &entities.Connection{
		Type: "unsupported",
	}

	_, err = suite.factory.CreateAdapter(unsupportedConn)
	assert.Error(suite.T(), err)
	assert.IsType(suite.T(), &database.AdapterError{}, err)
}

// Helper methods for checking service availability

func (suite *AdapterTestSuite) isPostgreSQLAvailable() bool {
	conn := &entities.Connection{
		Type:     entities.TypePostgreSQL,
		Host:     suite.getEnvOrDefault("POSTGRES_HOST", "localhost"),
		Port:     5432,
		Database: suite.getEnvOrDefault("POSTGRES_DB", "testdb"),
		Username: suite.getEnvOrDefault("POSTGRES_USER", "postgres"),
		Password: suite.getEnvOrDefault("POSTGRES_PASSWORD", "password"),
		SSL:      false,
	}

	adapter, err := suite.factory.CreateAdapter(conn)
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

func (suite *AdapterTestSuite) isMySQLAvailable() bool {
	conn := &entities.Connection{
		Type:     entities.TypeMySQL,
		Host:     suite.getEnvOrDefault("MYSQL_HOST", "localhost"),
		Port:     3306,
		Database: suite.getEnvOrDefault("MYSQL_DATABASE", "testdb"),
		Username: suite.getEnvOrDefault("MYSQL_USER", "root"),
		Password: suite.getEnvOrDefault("MYSQL_PASSWORD", "password"),
	}

	adapter, err := suite.factory.CreateAdapter(conn)
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

func (suite *AdapterTestSuite) isMongoDBAvailable() bool {
	conn := &entities.Connection{
		Type:     entities.TypeMongoDB,
		Host:     suite.getEnvOrDefault("MONGO_HOST", "localhost"),
		Port:     27017,
		Database: suite.getEnvOrDefault("MONGO_DATABASE", "testdb"),
		Username: suite.getEnvOrDefault("MONGO_USER", "root"),
		Password: suite.getEnvOrDefault("MONGO_PASSWORD", "password"),
	}

	adapter, err := suite.factory.CreateAdapter(conn)
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

func (suite *AdapterTestSuite) isRedisAvailable() bool {
	conn := &entities.Connection{
		Type:     entities.TypeRedis,
		Host:     suite.getEnvOrDefault("REDIS_HOST", "localhost"),
		Port:     6379,
		Password: suite.getEnvOrDefault("REDIS_PASSWORD", ""),
	}

	adapter, err := suite.factory.CreateAdapter(conn)
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

func (suite *AdapterTestSuite) isOracleAvailable() bool {
	// Skip Oracle by default as it's heavy
	if os.Getenv("ENABLE_ORACLE_TESTS") != "true" {
		return false
	}
	conn := &entities.Connection{
		Type:     entities.TypeOracle,
		Host:     suite.getEnvOrDefault("ORACLE_HOST", "localhost"),
		Port:     1521,
		Database: suite.getEnvOrDefault("ORACLE_SERVICE", "XE"),
		Username: suite.getEnvOrDefault("ORACLE_USER", "system"),
		Password: suite.getEnvOrDefault("ORACLE_PASSWORD", "oracle"),
	}

	adapter, err := suite.factory.CreateAdapter(conn)
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

func (suite *AdapterTestSuite) isSupabaseAvailable() bool {
	if os.Getenv("SUPABASE_URL") == "" || os.Getenv("SUPABASE_KEY") == "" {
		return false
	}
	conn := &entities.Connection{
		Type: entities.TypeSupabase,
		Host: suite.getEnvOrDefault("SUPABASE_URL", ""),
		Options: map[string]string{
			"api_key": suite.getEnvOrDefault("SUPABASE_KEY", ""),
		},
	}

	adapter, err := suite.factory.CreateAdapter(conn)
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

func (suite *AdapterTestSuite) getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
