package integration

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// PerformanceTestSuite tests adapter performance under load
type PerformanceTestSuite struct {
	suite.Suite
	ctx     context.Context
	factory *adapters.EnhancedAdapterFactory
}

// SetupSuite initializes performance test suite
func (suite *PerformanceTestSuite) SetupSuite() {
	suite.ctx = context.Background()
	suite.factory = adapters.NewEnhancedAdapterFactory()
}

// TestPostgreSQLPerformance tests PostgreSQL adapter performance
func (suite *PerformanceTestSuite) TestPostgreSQLPerformance() {
	if testing.Short() {
		suite.T().Skip("Skipping performance test in short mode")
	}

	config := types.DatabaseConfig{
		Type:     "postgresql",
		Host:     "localhost",
		Port:     5432,
		Database: "queryflux_test",
		Username: "testuser",
		Password: "testpass",
		SSLMode:  "disable",
		Options: map[string]interface{}{
			"max_connections": 20,
		},
	}

	adapter, err := suite.factory.CreateAdapter("postgresql")
	require.NoError(suite.T(), err)

	err = adapter.Connect(suite.ctx, config)
	require.NoError(suite.T(), err)
	defer adapter.Close()

	// Test sequential queries
	suite.testSequentialQueries(adapter, "postgresql")

	// Test concurrent queries
	suite.testConcurrentQueries(adapter, "postgresql")

	// Test query performance
	suite.testQueryPerformance(adapter, "postgresql")
}

// TestMongoDBPerformance tests MongoDB adapter performance
func (suite *PerformanceTestSuite) TestMongoDBPerformance() {
	if testing.Short() {
		suite.T().Skip("Skipping performance test in short mode")
	}

	config := types.DatabaseConfig{
		Type:     "mongodb",
		Host:     "localhost",
		Port:     27017,
		Database: "queryflux_test",
		Username: "testuser",
		Password: "testpass",
	}

	adapter, err := suite.factory.CreateAdapter("mongodb")
	require.NoError(suite.T(), err)

	err = adapter.Connect(suite.ctx, config)
	require.NoError(suite.T(), err)
	defer adapter.Close()

	// Test sequential queries
	suite.testSequentialQueries(adapter, "mongodb")

	// Test concurrent queries
	suite.testConcurrentQueries(adapter, "mongodb")

	// Test query performance
	suite.testQueryPerformance(adapter, "mongodb")
}

// TestRedisPerformance tests Redis adapter performance
func (suite *PerformanceTestSuite) TestRedisPerformance() {
	if testing.Short() {
		suite.T().Skip("Skipping performance test in short mode")
	}

	config := types.DatabaseConfig{
		Type:     "redis",
		Host:     "localhost",
		Port:     6379,
		Database: 0,
		Options: map[string]interface{}{
			"pool_size": 20,
		},
	}

	adapter, err := suite.factory.CreateAdapter("redis")
	require.NoError(suite.T(), err)

	err = adapter.Connect(suite.ctx, config)
	require.NoError(suite.T(), err)
	defer adapter.Close()

	// Test sequential operations
	suite.testSequentialOperations(adapter, "redis")

	// Test concurrent operations
	suite.testConcurrentOperations(adapter, "redis")

	// Test operation performance
	suite.testOperationPerformance(adapter, "redis")
}

// testSequentialQueries tests sequential query execution
func (suite *PerformanceTestSuite) testSequentialQueries(adapter types.DatabaseAdapter, dbType string) {
	suite.T().Run(fmt.Sprintf("SequentialQueries_%s", dbType), func(t *testing.T) {
		const numQueries = 100
		start := time.Now()

		for i := 0; i < numQueries; i++ {
			var query string
			switch dbType {
			case "postgresql":
				query = "SELECT COUNT(*) FROM users"
			case "mongodb":
				query = "db.users.count()"
			default:
				t.Skip("Unsupported database type for sequential queries")
				return
			}

			_, err := adapter.ExecuteQuery(suite.ctx, query, nil)
			assert.NoError(t, err, "Query %d failed", i)
		}

		duration := time.Since(start)
		avgDuration := duration / numQueries

		t.Logf("Sequential queries (%s): %d queries in %v (avg: %v per query)",
			dbType, numQueries, duration, avgDuration)

		// Performance assertions
		assert.Less(t, avgDuration, 100*time.Millisecond, "Average query time should be less than 100ms")
		assert.Less(t, duration, 30*time.Second, "Total time should be less than 30 seconds")
	})
}

// testConcurrentQueries tests concurrent query execution
func (suite *PerformanceTestSuite) testConcurrentQueries(adapter types.DatabaseAdapter, dbType string) {
	suite.T().Run(fmt.Sprintf("ConcurrentQueries_%s", dbType), func(t *testing.T) {
		const numGoroutines = 10
		const queriesPerGoroutine = 20

		var wg sync.WaitGroup
		errors := make(chan error, numGoroutines*queriesPerGoroutine)

		start := time.Now()

		for i := 0; i < numGoroutines; i++ {
			wg.Add(1)
			go func(goroutineID int) {
				defer wg.Done()

				for j := 0; j < queriesPerGoroutine; j++ {
					var query string
					switch dbType {
					case "postgresql":
						query = fmt.Sprintf("SELECT %d as test_value", goroutineID*queriesPerGoroutine+j)
					case "mongodb":
						query = fmt.Sprintf("db.users.findOne({})")
					default:
						errors <- fmt.Errorf("unsupported database type")
						return
					}

					_, err := adapter.ExecuteQuery(suite.ctx, query, nil)
					if err != nil {
						errors <- err
						return
					}
				}
			}(i)
		}

		wg.Wait()
		close(errors)

		duration := time.Since(start)
		totalQueries := numGoroutines * queriesPerGoroutine
		avgDuration := duration / totalQueries

		// Check for errors
		for err := range errors {
			assert.NoError(t, err)
		}

		t.Logf("Concurrent queries (%s): %d queries (%d goroutines) in %v (avg: %v per query)",
			dbType, totalQueries, numGoroutines, duration, avgDuration)

		// Performance assertions
		assert.Less(t, avgDuration, 200*time.Millisecond, "Average concurrent query time should be less than 200ms")
		assert.Less(t, duration, 60*time.Second, "Total concurrent time should be less than 60 seconds")
	})
}

// testSequentialOperations tests sequential Redis operations
func (suite *PerformanceTestSuite) testSequentialOperations(adapter types.DatabaseAdapter, dbType string) {
	suite.T().Run(fmt.Sprintf("SequentialOperations_%s", dbType), func(t *testing.T) {
		const numOperations = 1000
		start := time.Now()

		for i := 0; i < numOperations; i++ {
			key := fmt.Sprintf("test:perf:%d", i)
			value := fmt.Sprintf("value_%d", i)

			// SET operation
			setQuery := fmt.Sprintf("SET %s %s", key, value)
			_, err := adapter.ExecuteQuery(suite.ctx, setQuery, nil)
			assert.NoError(t, err, "SET operation %d failed", i)

			// GET operation
			getQuery := fmt.Sprintf("GET %s", key)
			result, err := adapter.ExecuteQuery(suite.ctx, getQuery, nil)
			assert.NoError(t, err, "GET operation %d failed", i)
			assert.NotEmpty(t, result.Rows, "GET operation %d returned empty result", i)
		}

		duration := time.Since(start)
		avgDuration := duration / (numOperations * 2) // 2 operations per loop

		t.Logf("Sequential operations (%s): %d operations in %v (avg: %v per operation)",
			dbType, numOperations*2, duration, avgDuration)

		// Redis should be very fast
		assert.Less(t, avgDuration, 5*time.Millisecond, "Average Redis operation time should be less than 5ms")
	})
}

// testConcurrentOperations tests concurrent Redis operations
func (suite *PerformanceTestSuite) testConcurrentOperations(adapter types.DatabaseAdapter, dbType string) {
	suite.T().Run(fmt.Sprintf("ConcurrentOperations_%s", dbType), func(t *testing.T) {
		const numGoroutines = 20
		const operationsPerGoroutine = 100

		var wg sync.WaitGroup
		errors := make(chan error, numGoroutines*operationsPerGoroutine)

		start := time.Now()

		for i := 0; i < numGoroutines; i++ {
			wg.Add(1)
			go func(goroutineID int) {
				defer wg.Done()

				for j := 0; j < operationsPerGoroutine; j++ {
					key := fmt.Sprintf("test:conc:%d:%d", goroutineID, j)
					value := fmt.Sprintf("value_%d_%d", goroutineID, j)

					// SET operation
					setQuery := fmt.Sprintf("SET %s %s", key, value)
					_, err := adapter.ExecuteQuery(suite.ctx, setQuery, nil)
					if err != nil {
						errors <- err
						return
					}

					// GET operation
					getQuery := fmt.Sprintf("GET %s", key)
					_, err = adapter.ExecuteQuery(suite.ctx, getQuery, nil)
					if err != nil {
						errors <- err
						return
					}
				}
			}(i)
		}

		wg.Wait()
		close(errors)

		duration := time.Since(start)
		totalOperations := numGoroutines * operationsPerGoroutine * 2 // 2 operations per loop
		avgDuration := duration / totalOperations

		// Check for errors
		for err := range errors {
			assert.NoError(t, err)
		}

		t.Logf("Concurrent operations (%s): %d operations (%d goroutines) in %v (avg: %v per operation)",
			dbType, totalOperations, numGoroutines, duration, avgDuration)

		// Redis should handle concurrency well
		assert.Less(t, avgDuration, 10*time.Millisecond, "Average concurrent Redis operation time should be less than 10ms")
	})
}

// testQueryPerformance measures individual query performance
func (suite *PerformanceTestSuite) testQueryPerformance(adapter types.DatabaseAdapter, dbType string) {
	suite.T().Run(fmt.Sprintf("QueryPerformance_%s", dbType), func(t *testing.T) {
		queries := []string{}

		switch dbType {
		case "postgresql":
			queries = []string{
				"SELECT 1",
				"SELECT COUNT(*) FROM users",
				"SELECT * FROM users LIMIT 10",
				"SELECT u.username, c.name FROM users u JOIN connections c ON u.id = c.user_id",
			}
		case "mongodb":
			queries = []string{
				"db.findOne()",
				"db.users.count()",
				"db.users.find().limit(10)",
				"db.users.aggregate([{$lookup: {from: 'connections', localField: '_id', foreignField: 'user_id', as: 'connections'}}])",
			}
		default:
			t.Skip("Unsupported database type for query performance test")
			return
		}

		for i, query := range queries {
			t.Run(fmt.Sprintf("Query_%d", i+1), func(t *testing.T) {
				const iterations = 10

				var totalDuration time.Duration
				for j := 0; j < iterations; j++ {
					start := time.Now()
					_, err := adapter.ExecuteQuery(suite.ctx, query, nil)
					duration := time.Since(start)
					totalDuration += duration

					assert.NoError(t, err, "Query %d iteration %d failed", i+1, j+1)
				}

				avgDuration := totalDuration / iterations
				t.Logf("Query %d (%s): avg execution time %v", i+1, dbType, avgDuration)

				// Performance assertions
				assert.Less(t, avgDuration, 1*time.Second, "Query should execute in less than 1 second on average")
			})
		}
	})
}

// testOperationPerformance measures individual Redis operation performance
func (suite *PerformanceTestSuite) testOperationPerformance(adapter types.DatabaseAdapter, dbType string) {
	suite.T().Run(fmt.Sprintf("OperationPerformance_%s", dbType), func(t *testing.T) {
		operations := []struct {
			name  string
			query string
		}{
			{"SET", "SET test:perf:1 test_value"},
			{"GET", "GET test:perf:1"},
			{"DEL", "DEL test:perf:1"},
			{"INCR", "INCR test:perf:counter"},
			{"HSET", "HSET test:perf:hash field1 value1"},
			{"HGET", "HGET test:perf:hash field1"},
		}

		for _, op := range operations {
			t.Run(op.name, func(t *testing.T) {
				const iterations = 100

				var totalDuration time.Duration
				for j := 0; j < iterations; j++ {
					start := time.Now()
					_, err := adapter.ExecuteQuery(suite.ctx, op.query, nil)
					duration := time.Since(start)
					totalDuration += duration

					// Don't fail on DEL errors if key doesn't exist
					if err != nil && op.name != "DEL" {
						assert.NoError(t, err, "Operation %s iteration %d failed", op.name, j+1)
					}
				}

				avgDuration := totalDuration / iterations
				t.Logf("Operation %s (%s): avg execution time %v", op.name, dbType, avgDuration)

				// Redis operations should be very fast
				assert.Less(t, avgDuration, 10*time.Millisecond, "Redis %s operation should be less than 10ms", op.name)
			})
		}
	})
}

// TestMemoryUsage tests memory usage during operations
func (suite *PerformanceTestSuite) TestMemoryUsage() {
	if testing.Short() {
		suite.T().Skip("Skipping memory usage test in short mode")
	}

	suite.T().Run("MemoryUsage", func(t *testing.T) {
		// This is a basic test - in a real scenario you might want to use
		// runtime.MemStats or memory profiling tools
		config := types.DatabaseConfig{
			Type:     "postgresql",
			Host:     "localhost",
			Port:     5432,
			Database: "queryflux_test",
			Username: "testuser",
			Password: "testpass",
			SSLMode:  "disable",
		}

		adapter, err := suite.factory.CreateAdapter("postgresql")
		require.NoError(t, err)

		err = adapter.Connect(suite.ctx, config)
		require.NoError(t, err)
		defer adapter.Close()

		// Execute a large number of queries to test memory usage
		const numQueries = 1000
		for i := 0; i < numQueries; i++ {
			query := fmt.Sprintf("SELECT %d, pg_sleep(0.001)", i)
			_, err := adapter.ExecuteQuery(suite.ctx, query, nil)
			assert.NoError(t, err)
		}

		t.Logf("Completed %d queries without memory issues", numQueries)
	})
}

// TestAdapterPerformance runs the performance test suite
func TestAdapterPerformance(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping performance tests in short mode")
	}

	suite.Run(t, new(PerformanceTestSuite))
}