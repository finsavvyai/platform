package performance

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// BenchmarkAPIEndpoints benchmarks individual API endpoints
func BenchmarkAPIEndpoints(b *testing.B) {
	tests := []struct {
		name           string
		endpoint       string
		method         string
		body           interface{}
		requiresAuth   bool
		setup          func() string // Returns auth token
		teardown       func(string)
	}{
		{
			name:   "HealthCheck",
			method: "GET",
			endpoint: "/health",
			requiresAuth: false,
		},
		{
			name:   "GetConnections",
			method: "GET",
			endpoint: "/api/connections",
			requiresAuth: true,
			setup: setupTestUser,
			teardown: cleanupTestUser,
		},
		{
			name:   "CreateConnection",
			method: "POST",
			endpoint: "/api/connections",
			body: map[string]interface{}{
				"name": "benchmark-connection",
				"type": "postgresql",
				"host": "localhost",
				"port": 5432,
				"database": "test",
				"username": "test",
				"password": "test",
			},
			requiresAuth: true,
			setup: setupTestUser,
			teardown: cleanupTestUser,
		},
		{
			name:   "ExecuteQuery",
			method: "POST",
			endpoint: "/api/queries/execute",
			body: map[string]interface{}{
				"connection_id": "test-conn",
				"query":        "SELECT 1 as test_value",
			},
			requiresAuth: true,
			setup: setupTestUser,
			teardown: cleanupTestUser,
		},
		{
			name:   "GetQueryHistory",
			method: "GET",
			endpoint: "/api/queries/history",
			requiresAuth: true,
			setup: setupTestUser,
			teardown: cleanupTestUser,
		},
	}

	for _, tt := range tests {
		b.Run(tt.name, func(b *testing.B) {
			var authToken string
			if tt.requiresAuth && tt.setup != nil {
				authToken = tt.setup()
				defer tt.teardown(authToken)
			}

			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				start := time.Now()

				resp, err := makeBenchmarkRequest(tt.method, tt.endpoint, tt.body, authToken)

				duration := time.Since(start)

				if err != nil {
					b.Errorf("Request failed: %v", err)
					continue
				}

				if resp != nil {
					resp.Body.Close()

					// Report timing metrics
					b.ReportMetric(float64(duration.Nanoseconds())/1e6, "ms/op")

					// Report memory allocations
					b.ReportMetric(float64(b.ReportAllocs()), "allocs/op")
				}
			}
		})
	}
}

// BenchmarkDatabaseOperations benchmarks database-specific operations
func BenchmarkDatabaseOperations(b *testing.B) {
	if !isTestDatabaseAvailable() {
		b.Skip("Test database not available")
	}

	tests := []struct {
		name        string
		query       string
		setup       func() string
		teardown    func(string)
	}{
		{
			name:  "SimpleSelect",
			query: "SELECT 1",
			setup: setupTestConnection,
			teardown: cleanupTestConnection,
		},
		{
			name:  "ComplexSelect",
			query: "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' LIMIT 100",
			setup: setupTestConnection,
			teardown: cleanupTestConnection,
		},
		{
			name:  "InsertOperation",
			query: "INSERT INTO benchmark_test (name, created_at) VALUES ('test', NOW())",
			setup: setupTestConnection,
			teardown: cleanupTestConnection,
		},
		{
			name:  "UpdateOperation",
			query: "UPDATE benchmark_test SET name = 'updated' WHERE name = 'test'",
			setup: setupTestConnection,
			teardown: cleanupTestConnection,
		},
		{
			name:  "DeleteOperation",
			query: "DELETE FROM benchmark_test WHERE name = 'updated'",
			setup: setupTestConnection,
			teardown: cleanupTestConnection,
		},
	}

	for _, tt := range tests {
		b.Run(tt.name, func(b *testing.B) {
			connID := tt.setup()
			defer tt.teardown(connID)

			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				start := time.Now()

				result, err := executeBenchmarkQuery(connID, tt.query)

				duration := time.Since(start)

				if err != nil {
					b.Errorf("Query execution failed: %v", err)
					continue
				}

				// Report metrics
				b.ReportMetric(float64(duration.Nanoseconds())/1e6, "ms/op")
				b.ReportMetric(float64(result.RowCount), "rows/op")

				if result.ExecutionTime > 0 {
					b.ReportMetric(float64(result.ExecutionTime.Nanoseconds())/1e6, "db_ms/op")
				}
			}
		})
	}
}

// BenchmarkConcurrentOperations benchmarks concurrent API operations
func BenchmarkConcurrentOperations(b *testing.B) {
	concurrencyLevels := []int{1, 5, 10, 25, 50, 100}

	for _, concurrency := range concurrencyLevels {
		b.Run(fmt.Sprintf("Concurrency-%d", concurrency), func(b *testing.B) {
			b.SetParallelism(concurrency)

			authToken := setupTestUser()
			defer cleanupTestUser(authToken)

			b.ResetTimer()
			b.ReportAllocs()

			b.RunParallel(func(pb *testing.PB) {
				for pb.Next() {
					start := time.Now()

					resp, err := makeBenchmarkRequest("GET", "/api/connections", nil, authToken)

					duration := time.Since(start)

					if err != nil {
						b.Errorf("Concurrent request failed: %v", err)
						continue
					}

					if resp != nil {
						resp.Body.Close()
						b.ReportMetric(float64(duration.Nanoseconds())/1e6, "ms/op")
					}
				}
			})
		})
	}
}

// BenchmarkWebSocketPerformance benchmarks WebSocket operations
func BenchmarkWebSocketPerformance(b *testing.B) {
	if !isWebSocketServerRunning() {
		b.Skip("WebSocket server not running")
	}

	tests := []struct {
		name        string
		messageType string
		messageSize int
		operations  []string
	}{
		{
			name:        "SmallMessages",
			messageType: "metrics_update",
			messageSize: 100,
			operations:  []string{"subscribe", "unsubscribe"},
		},
		{
			name:        "LargeMessages",
			messageType: "query_result",
			messageSize: 10000,
			operations:  []string{"send", "receive"},
		},
		{
			name:        "FrequentOperations",
			messageType: "ping",
			messageSize: 50,
			operations:  []string{"ping", "pong"},
		},
	}

	for _, tt := range tests {
		b.Run(tt.name, func(b *testing.B) {
			wsConn := setupWebSocketConnection()
			defer wsConn.Close()

			b.ResetTimer()
			b.ReportAllocs()

			for i := 0; i < b.N; i++ {
				for _, op := range tt.operations {
					start := time.Now()

					err := performWebSocketOperation(wsConn, op, tt.messageType, tt.messageSize)

					duration := time.Since(start)

					if err != nil {
						b.Errorf("WebSocket operation failed: %v", err)
						continue
					}

					b.ReportMetric(float64(duration.Nanoseconds())/1e6, "ms/op")
				}
			}
		})
	}
}

// BenchmarkMemoryUsage benchmarks memory usage patterns
func BenchmarkMemoryUsage(b *testing.B) {
	tests := []struct {
		name        string
		operation   func() error
		description string
	}{
		{
			name: "LargeResultSet",
			operation: func() error {
				return processLargeResultSet()
			},
			description: "Processing 10000 row result set",
		},
		{
			name: "ComplexQueryParsing",
			operation: func() error {
				return parseComplexQuery()
			},
			description: "Parsing complex SQL query",
		},
		{
			name: "SchemaIntrospection",
			operation: func() error {
				return introspectSchema()
			},
			description: "Database schema introspection",
		},
		{
			name: "ConnectionPoolOperations",
			operation: func() error {
				return simulateConnectionPoolOperations()
			},
			description: "Connection pool operations",
		},
	}

	for _, tt := range tests {
		b.Run(tt.name, func(b *testing.B) {
			b.ResetTimer()
			b.ReportAllocs()

			var totalMemory uint64
			var maxMemory uint64

			for i := 0; i < b.N; i++ {
				// Measure memory before operation
				memBefore := getCurrentMemoryUsage()

				err := tt.operation()

				// Measure memory after operation
				memAfter := getCurrentMemoryUsage()

				if err != nil {
					b.Errorf("Operation failed: %v", err)
					continue
				}

				operationMemory := memAfter - memBefore
				totalMemory += operationMemory

				if operationMemory > maxMemory {
					maxMemory = operationMemory
				}

				b.ReportMetric(float64(operationMemory)/1024, "KB/op")
			}

			avgMemory := totalMemory / uint64(b.N)
			b.ReportMetric(float64(avgMemory)/1024, "KB_avg/op")
			b.ReportMetric(float64(maxMemory)/1024, "KB_max/op")
		})
	}
}

// BenchmarkStressTest performs stress testing with increasing load
func BenchmarkStressTest(b *testing.B) {
	loadLevels := []struct {
		concurrency int
		duration    time.Duration
	}{
		{10, 10 * time.Second},
		{25, 20 * time.Second},
		{50, 30 * time.Second},
		{100, 60 * time.Second},
	}

	for _, level := range loadLevels {
		b.Run(fmt.Sprintf("Stress-%dconcurrent-%ds", level.concurrency, int(level.duration.Seconds())), func(b *testing.B) {
			if testing.Short() && level.concurrency > 25 {
				b.Skip("Skipping high concurrency stress test in short mode")
			}

			authToken := setupTestUser()
			defer cleanupTestUser(authToken)

			ctx, cancel := context.WithTimeout(context.Background(), level.duration)
			defer cancel()

			var requestsSent int64
			var errorsEncountered int64
			var totalResponseTime time.Duration

			done := make(chan struct{})

			// Start workers
			for i := 0; i < level.concurrency; i++ {
				go func() {
					defer func() { done <- struct{}{} }()

					for {
						select {
						case <-ctx.Done():
							return
						default:
							start := time.Now()

							resp, err := makeBenchmarkRequest("GET", "/health", nil, "")

							responseTime := time.Since(start)

							atomic.AddInt64(&requestsSent, 1)
							atomic.AddInt64((*int64)(&totalResponseTime), int64(responseTime))

							if err != nil || (resp != nil && resp.StatusCode >= 400) {
								atomic.AddInt64(&errorsEncountered, 1)
							}

							if resp != nil {
								resp.Body.Close()
							}

							// Small delay to prevent overwhelming
							time.Sleep(10 * time.Millisecond)
						}
					}
				}()
			}

			// Wait for all workers to complete
			for i := 0; i < level.concurrency; i++ {
				<-done
			}

			// Calculate and report metrics
			successRate := float64(requestsSent-errorsEncountered) / float64(requestsSent) * 100
			avgResponseTime := totalResponseTime / time.Duration(requestsSent)

			b.ReportMetric(float64(requestsSent)/level.duration.Seconds(), "RPS")
			b.ReportMetric(successRate, "success_rate_%")
			b.ReportMetric(float64(avgResponseTime.Nanoseconds())/1e6, "avg_ms")
			b.ReportMetric(float64(errorsEncountered)/level.duration.Seconds(), "errors_per_sec")

			// Assert performance requirements
			require.Greater(b, successRate, 95.0, "Success rate should be above 95%")
			require.Less(b, avgResponseTime, time.Second, "Average response time should be under 1 second")
		})
	}
}

// Helper functions for benchmarking

func makeBenchmarkRequest(method, endpoint string, body interface{}, authToken string) (*http.Response, error) {
	client := &http.Client{Timeout: 10 * time.Second}

	var req *http.Request
	var err error

	if body != nil {
		bodyBytes, _ := json.Marshal(body)
		req, err = http.NewRequest(method, "http://localhost:8080"+endpoint, bytes.NewReader(bodyBytes))
	} else {
		req, err = http.NewRequest(method, "http://localhost:8080"+endpoint, nil)
	}

	if err != nil {
		return nil, err
	}

	if authToken != "" {
		req.Header.Set("Authorization", "Bearer "+authToken)
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	return client.Do(req)
}

func setupTestUser() string {
	// Create a test user and return auth token
	// This would make an actual API call to create/authenticate a user
	return "test-auth-token"
}

func cleanupTestUser(token string) {
	// Clean up test user
	// This would make an API call to delete the test user
}

func setupTestConnection() string {
	// Setup a test database connection and return connection ID
	return "test-connection-id"
}

func cleanupTestConnection(connID string) {
	// Clean up test database connection
}

func isTestDatabaseAvailable() bool {
	// Check if test database is available for benchmarking
	return false // Default to false to skip database benchmarks
}

func executeBenchmarkQuery(connID, query string) QueryResult {
	// Execute a benchmark query and return results
	return QueryResult{
		RowCount:      1,
		ExecutionTime: 10 * time.Millisecond,
	}
}

type QueryResult struct {
	RowCount      int
	ExecutionTime time.Duration
}

func isWebSocketServerRunning() bool {
	// Check if WebSocket server is running
	return false // Default to false to skip WebSocket benchmarks
}

func setupWebSocketConnection() WebSocketConn {
	// Setup a WebSocket connection for benchmarking
	return WebSocketConn{}
}

type WebSocketConn struct{}

func (ws WebSocketConn) Close() error {
	// Close WebSocket connection
	return nil
}

func performWebSocketOperation(ws WebSocketConn, operation, messageType string, messageSize int) error {
	// Perform a WebSocket operation for benchmarking
	return nil
}

func processLargeResultSet() error {
	// Simulate processing a large result set
	data := make([][]interface{}, 10000)
	for i := range data {
		data[i] = make([]interface{}, 10)
		for j := range data[i] {
			data[i][j] = fmt.Sprintf("value-%d-%d", i, j)
		}
	}
	_ = data
	return nil
}

func parseComplexQuery() error {
	// Simulate parsing a complex SQL query
	complexQuery := `
		SELECT
			u.id, u.name, u.email,
			COUNT(o.id) as order_count,
			SUM(o.total) as total_spent,
			AVG(o.total) as avg_order_value,
			MAX(o.created_at) as last_order_date
		FROM users u
		LEFT JOIN orders o ON u.id = o.user_id
		WHERE u.created_at >= '2023-01-01'
			AND u.status = 'active'
		GROUP BY u.id, u.name, u.email
		HAVING COUNT(o.id) > 5
		ORDER BY total_spent DESC
		LIMIT 100
	`
	_ = complexQuery
	return nil
}

func introspectSchema() error {
	// Simulate database schema introspection
	schema := map[string][]string{
		"users":   {"id", "name", "email", "created_at"},
		"orders":  {"id", "user_id", "total", "created_at"},
		"products": {"id", "name", "price", "category"},
	}
	_ = schema
	return nil
}

func simulateConnectionPoolOperations() error {
	// Simulate connection pool operations
	connections := make([]interface{}, 10)
	for i := 0; i < 100; i++ {
		conn := connections[i%10]
		_ = conn // Simulate using connection
	}
	return nil
}

func getCurrentMemoryUsage() uint64 {
	// Get current memory usage (simplified)
	return 1024 * 1024 // 1MB placeholder
}