package database_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/sirupsen/logrus"
)

// DatabaseTestSuite provides a comprehensive testing framework for database adapters
type DatabaseTestSuite struct {
	t          *testing.T
	dbType     string
	config     TestConnectionConfig
	adapter    adapters.DatabaseAdapter
	connection *entities.Connection
}

// NewDatabaseTestSuite creates a new test suite for a specific database type
func NewDatabaseTestSuite(t *testing.T, dbType string) *DatabaseTestSuite {
	if !IsDatabaseAvailable(dbType) {
		t.Skipf("Skipping %s integration test - environment variable not set", dbType)
	}

	config := GetTestConfig(dbType)
	factory := adapters.NewFactory(logrus.New())

	// Create connection entity
	connection := &entities.Connection{
		ID:       fmt.Sprintf("test-%s", dbType),
		UserID:   "test-user",
		Name:     fmt.Sprintf("Test %s Integration", dbType),
		Type:     getEntityType(dbType),
		Host:     config.Host,
		Port:     config.Port,
		Database: config.Database,
		Username: config.Username,
		Password: config.Password,
		SSL:      config.SSLMode != "disable",
		Options:  map[string]string{"sslmode": config.SSLMode, "connect_timeout": fmt.Sprintf("%d", int(config.Timeout.Seconds()))},
	}

	adapter, err := factory.CreateAdapter(connection)
	require.NoError(t, err, "Failed to create adapter for %s", dbType)
	require.NotNil(t, adapter, "Adapter should not be nil for %s", dbType)

	return &DatabaseTestSuite{
		t:          t,
		dbType:     dbType,
		config:     config,
		adapter:    adapter,
		connection: connection,
	}
}

// getEntityType converts database type string to entity type
func getEntityType(dbType string) string {
	switch dbType {
	case "postgresql":
		return entities.TypePostgreSQL
	case "mysql":
		return entities.TypeMySQL
	case "mariadb":
		return entities.TypeMariaDB
	case "cockroachdb":
		return entities.TypeCockroachDB
	case "mongodb":
		return entities.TypeMongoDB
	case "redis":
		return entities.TypeRedis
	case "memcached":
		return entities.TypeMemcached
	case "cassandra":
		return entities.TypeCassandra
	case "couchdb":
		return entities.TypeCouchDB
	case "arangodb":
		return entities.TypeArangoDB
	case "influxdb":
		return entities.TypeInfluxDB
	case "questdb":
		return entities.TypeQuestDB
	case "timescaledb":
		return entities.TypeTimescaleDB
	case "neo4j":
		return entities.TypeNeo4j
	case "dynamodb":
		return entities.TypeAWSDynamoDB
	case "elasticsearch":
		return entities.TypeElasticsearch
	case "sqlserver":
		return entities.TypeSQLServer
	case "oracle":
		return entities.TypeOracle
	case "sqlite":
		return entities.TypeSQLite
	default:
		return entities.TypePostgreSQL // fallback
	}
}

// TestConnectionLifecycle tests the connection lifecycle
func (suite *DatabaseTestSuite) TestConnectionLifecycle() {
	ctx := context.Background()

	// Test connection
	err := suite.adapter.Connect(ctx, suite.connection)
	if err != nil {
		suite.t.Skipf("Could not connect to %s: %v", suite.dbType, err)
	}
	defer suite.adapter.Disconnect(ctx)

	// Verify connection is established
	assert.True(suite.t, suite.adapter.IsConnected(), "Adapter should be connected")

	// Test connection validation
	err = suite.adapter.TestConnection(ctx)
	assert.NoError(suite.t, err, "Connection validation should pass")

	// Test disconnection
	err = suite.adapter.Disconnect(ctx)
	assert.NoError(suite.t, err, "Disconnection should not fail")
	assert.False(suite.t, suite.adapter.IsConnected(), "Adapter should not be connected after disconnect")
}

// TestBasicQueryExecution tests basic query execution capabilities
func (suite *DatabaseTestSuite) TestBasicQueryExecution() {
	ctx := context.Background()

	// Connect to database
	err := suite.adapter.Connect(ctx, suite.connection)
	if err != nil {
		suite.t.Skipf("Could not connect to %s: %v", suite.dbType, err)
	}
	defer suite.adapter.Disconnect(ctx)

	// Test database-specific queries
	queries := suite.getTestQueries()

	for queryName, query := range queries {
		suite.t.Run(fmt.Sprintf("Query_%s", queryName), func(t *testing.T) {
			result, err := suite.adapter.ExecuteQuery(ctx, query)
			assert.NoError(t, err, "Query execution should not fail for %s: %s", queryName, query)
			assert.NotNil(t, result, "Query result should not be nil")

			// Verify result structure
			assert.NotNil(t, result.Columns, "Result columns should not be nil")
			assert.NotNil(t, result.Rows, "Result rows should not be nil")

			// Log query results for debugging
			t.Logf("Query '%s' returned %d rows", queryName, len(result.Rows))
		})
	}
}

// TestSchemaRetrieval tests schema retrieval capabilities
func (suite *DatabaseTestSuite) TestSchemaRetrieval() {
	ctx := context.Background()

	// Connect to database
	err := suite.adapter.Connect(ctx, suite.connection)
	if err != nil {
		suite.t.Skipf("Could not connect to %s: %v", suite.dbType, err)
	}
	defer suite.adapter.Disconnect(ctx)

	// Test schema retrieval
	schema, err := suite.adapter.GetSchema(ctx)
	assert.NoError(suite.t, err, "Schema retrieval should not fail")
	assert.NotNil(suite.t, schema, "Schema should not be nil")

	// Verify schema structure
	assert.NotNil(suite.t, schema.Tables, "Schema tables should not be nil")
	assert.NotEmpty(suite.t, schema.Tables, "Schema should contain at least one table")

	// Find test_table and verify its structure
	testTable := suite.findTable(schema, "test_table")
	if testTable != nil {
		assert.NotEmpty(suite.t, testTable.Columns, "test_table should have columns")

		// Check for expected columns
		expectedColumns := []string{"id", "name", "email"}
		for _, expectedCol := range expectedColumns {
			col := suite.findColumn(testTable, expectedCol)
			if col != nil {
				assert.NotEmpty(suite.t, col.Type, "Column %s should have a type", expectedCol)
			}
		}
	}

	// Test table info retrieval for a specific table
	if testTable != nil {
		tableInfo, err := suite.adapter.GetTableInfo(ctx, testTable.Name)
		assert.NoError(suite.t, err, "Table info retrieval should not fail")
		assert.NotNil(suite.t, tableInfo, "Table info should not be nil")
		assert.Equal(suite.t, testTable.Name, tableInfo.Name, "Table names should match")
		assert.NotEmpty(suite.t, tableInfo.Columns, "Table info should contain columns")
	}
}

// TestTransactionSupport tests transaction support if available
func (suite *DatabaseTestSuite) TestTransactionSupport() {
	ctx := context.Background()

	// Connect to database
	err := suite.adapter.Connect(ctx, suite.connection)
	if err != nil {
		suite.t.Skipf("Could not connect to %s: %v", suite.dbType, err)
	}
	defer suite.adapter.Disconnect(ctx)

	// Test if adapter supports transactions
	// This is database-specific, so we'll test basic operations that should work
	// for most SQL databases

	// Skip for NoSQL databases that don't support traditional transactions
	if suite.isNoSQLDatabase() {
		suite.t.Skip("Skipping transaction test for NoSQL database")
	}

	// For SQL databases, test basic transaction-like behavior
	// This is a simplified test since we're working through the adapter interface
	testQueries := []string{
		"INSERT INTO test_table (name, email, age) VALUES ('Transaction Test', 'trans@test.com', 25)",
		"SELECT * FROM test_table WHERE email = 'trans@test.com'",
		"DELETE FROM test_table WHERE email = 'trans@test.com'",
	}

	for i, query := range testQueries {
		suite.t.Run(fmt.Sprintf("TransactionStep_%d", i+1), func(t *testing.T) {
			result, err := suite.adapter.ExecuteQuery(ctx, query)
			if err != nil {
				// Some databases might not support INSERT/DELETE through the adapter
				t.Logf("Skipping transaction step %d: %v", i+1, err)
				t.Skip()
			}
			assert.NotNil(t, result, "Result should not be nil")
		})
	}
}

// TestErrorHandling tests error handling capabilities
func (suite *DatabaseTestSuite) TestErrorHandling() {
	ctx := context.Background()

	// Connect to database
	err := suite.adapter.Connect(ctx, suite.connection)
	if err != nil {
		suite.t.Skipf("Could not connect to %s: %v", suite.dbType, err)
	}
	defer suite.adapter.Disconnect(ctx)

	// Test invalid queries
	invalidQueries := suite.getInvalidQueries()

	for queryName, query := range invalidQueries {
		suite.t.Run(fmt.Sprintf("Error_%s", queryName), func(t *testing.T) {
			result, err := suite.adapter.ExecuteQuery(ctx, query)
			assert.Error(t, err, "Invalid query should return an error")
			assert.Nil(t, result, "Result should be nil for invalid query")
			t.Logf("Expected error for invalid query '%s': %v", queryName, err)
		})
	}
}

// TestPerformanceMetrics tests performance metrics collection if supported
func (suite *DatabaseTestSuite) TestPerformanceMetrics() {
	ctx := context.Background()

	// Connect to database
	err := suite.adapter.Connect(ctx, suite.connection)
	if err != nil {
		suite.t.Skipf("Could not connect to %s: %v", suite.dbType, err)
	}
	defer suite.adapter.Disconnect(ctx)

	// Execute multiple queries and measure performance
	query := suite.getSimpleQuery()
	iterations := 10

	start := time.Now()
	for i := 0; i < iterations; i++ {
		_, err := suite.adapter.ExecuteQuery(ctx, query)
		assert.NoError(suite.t, err, "Query execution should not fail")
	}
	duration := time.Since(start)

	avgDuration := duration / time.Duration(iterations)
	suite.t.Logf("Average query execution time for %s: %v", suite.dbType, avgDuration)

	// Performance assertion - queries should complete reasonably fast
	assert.Less(suite.t, avgDuration, 5*time.Second, "Average query time should be less than 5 seconds")
}

// getTestQueries returns database-appropriate test queries
func (suite *DatabaseTestSuite) getTestQueries() map[string]string {
	switch suite.dbType {
	case "postgresql", "cockroachdb", "timescaledb":
		return map[string]string{
			"simple_select": "SELECT 1 as test_column",
			"table_select":  "SELECT COUNT(*) as count FROM test_table",
			"join_query":    "SELECT e.name, d.name as dept FROM employees e JOIN departments d ON e.department_id = d.id LIMIT 5",
			"aggregate":     "SELECT AVG(salary) as avg_salary FROM employees",
			"date_function": "SELECT CURRENT_TIMESTAMP as current_time",
		}
	case "mysql", "mariadb":
		return map[string]string{
			"simple_select": "SELECT 1 as test_column",
			"table_select":  "SELECT COUNT(*) as count FROM test_table",
			"join_query":    "SELECT e.name, d.name as dept FROM employees e JOIN departments d ON e.department_id = d.id LIMIT 5",
			"aggregate":     "SELECT AVG(salary) as avg_salary FROM employees",
			"date_function": "SELECT NOW() as current_time",
		}
	case "sqlite":
		return map[string]string{
			"simple_select": "SELECT 1 as test_column",
			"table_select":  "SELECT COUNT(*) as count FROM test_table",
			"join_query":    "SELECT e.name, d.name as dept FROM employees e JOIN departments d ON e.department_id = d.id LIMIT 5",
			"aggregate":     "SELECT AVG(salary) as avg_salary FROM employees",
			"date_function": "SELECT datetime('now') as current_time",
		}
	case "mongodb":
		return map[string]string{
			"simple_select": `{"collection": "test_table", "operation": "find", "query": {}}`,
			"count_query":   `{"collection": "test_table", "operation": "count", "query": {}}`,
			"aggregate":     `{"collection": "employees", "operation": "aggregate", "pipeline": [{"$group": {"_id": "$department_id", "avg_salary": {"$avg": "$salary"}}}]}`,
		}
	case "redis":
		return map[string]string{
			"ping": "PING",
			"set":  "SET test_key test_value",
			"get":  "GET test_key",
			"del":  "DEL test_key",
			"info": "INFO",
		}
	case "cassandra":
		return map[string]string{
			"simple_select": "SELECT * FROM system.local LIMIT 1",
			"keyspaces":     "SELECT keyspace_name FROM system_schema.keyspaces",
		}
	case "couchdb":
		return map[string]string{
			"info":       "",
			"all_docs":   "_all_docs?limit=5",
			"find_query": `{"selector": {"name": {"$exists": true}}, "limit": 5}`,
		}
	case "arangodb":
		return map[string]string{
			"simple_select": "RETURN 1",
			"collections":   "FOR collection IN collections RETURN collection.name",
			"databases":     "SHOW DATABASES",
		}
	case "influxdb":
		return map[string]string{
			"ping":  "ping",
			"query": `SELECT mean("cpu_usage") FROM "metrics_data" WHERE time > now() - 1h GROUP BY time(1m)`,
			"show":  "SHOW MEASUREMENTS",
		}
	case "questdb":
		return map[string]string{
			"simple_select": "SELECT 1 as test_column",
			"table_select":  "SELECT COUNT(*) as count FROM test_table",
			"time_series":   "SELECT * FROM metrics_data WHERE timestamp > now() - 1h LIMIT 10",
		}
	case "neo4j":
		return map[string]string{
			"simple_select": "RETURN 1 as test_column",
			"nodes":         "MATCH (n) RETURN count(n) as node_count LIMIT 1",
			"relations":     "MATCH ()-[r]->() RETURN count(r) as rel_count LIMIT 1",
		}
	default:
		return map[string]string{
			"simple_select": "SELECT 1 as test_column",
		}
	}
}

// getInvalidQueries returns queries that should fail
func (suite *DatabaseTestSuite) getInvalidQueries() map[string]string {
	switch suite.dbType {
	case "postgresql", "cockroachdb", "mysql", "mariadb", "sqlite", "timescaledb", "questdb":
		return map[string]string{
			"syntax_error":   "SELECT FROM invalid_syntax",
			"invalid_table":  "SELECT * FROM non_existent_table_xyz",
			"invalid_column": "SELECT invalid_column_xyz FROM test_table",
		}
	case "mongodb":
		return map[string]string{
			"invalid_collection": `{"collection": "non_existent_collection_xyz", "operation": "find", "query": {}}`,
			"invalid_operation":  `{"collection": "test_table", "operation": "invalid_operation", "query": {}}`,
		}
	case "redis":
		return map[string]string{
			"invalid_command": "INVALID_COMMAND",
			"wrong_args":      "GET WRONG NUMBER OF ARGUMENTS",
		}
	default:
		return map[string]string{
			"invalid_query": "INVALID QUERY SYNTAX",
		}
	}
}

// getSimpleQuery returns a simple query for performance testing
func (suite *DatabaseTestSuite) getSimpleQuery() string {
	queries := suite.getTestQueries()
	for _, query := range queries {
		return query // Return the first available query
	}
	return "SELECT 1"
}

// isNoSQLDatabase checks if the database is a NoSQL database
func (suite *DatabaseTestSuite) isNoSQLDatabase() bool {
	nosqlDatabases := []string{
		"mongodb", "redis", "memcached", "cassandra", "couchdb",
		"arangodb", "influxdb", "neo4j", "dynamodb", "elasticsearch",
	}

	for _, nosql := range nosqlDatabases {
		if suite.dbType == nosql {
			return true
		}
	}
	return false
}

// findTable searches for a table by name in the schema
func (suite *DatabaseTestSuite) findTable(schema *adapters.SchemaInfo, tableName string) *adapters.TableInfo {
	for _, table := range schema.Tables {
		if table.Name == tableName {
			return &table
		}
	}
	return nil
}

// findColumn searches for a column by name in a table
func (suite *DatabaseTestSuite) findColumn(table *adapters.TableInfo, columnName string) *adapters.ColumnInfo {
	for _, column := range table.Columns {
		if column.Name == columnName {
			return &column
		}
	}
	return nil
}

// RunAllTests runs all test suites for the database adapter
func (suite *DatabaseTestSuite) RunAllTests() {
	suite.t.Run("TestConnectionLifecycle", func(t *testing.T) { suite.TestConnectionLifecycle() })
	suite.t.Run("TestBasicQueryExecution", func(t *testing.T) { suite.TestBasicQueryExecution() })
	suite.t.Run("TestSchemaRetrieval", func(t *testing.T) { suite.TestSchemaRetrieval() })
	suite.t.Run("TestTransactionSupport", func(t *testing.T) { suite.TestTransactionSupport() })
	suite.t.Run("TestErrorHandling", func(t *testing.T) { suite.TestErrorHandling() })
	suite.t.Run("TestPerformanceMetrics", func(t *testing.T) { suite.TestPerformanceMetrics() })
}
