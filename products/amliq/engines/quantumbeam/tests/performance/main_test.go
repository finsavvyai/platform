package performance

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// TestPerformanceSuite runs the complete performance test suite
func TestPerformanceSuite(t *testing.T) {
	// Skip tests in short mode
	if testing.Short() {
		t.Skip("Skipping performance tests in short mode")
	}

	// Load configuration
	config, err := LoadBenchmarkConfig("tests/performance/config.yaml")
	if err != nil {
		t.Fatalf("Failed to load benchmark config: %v", err)
	}

	// Override for testing
	config.ConcurrentUsers = 2
	config.TestDuration = 30 * time.Second
	config.RampUpPeriod = 5 * time.Second
	config.EnableVerboseLogging = true

	// Setup logger
	logger, err := zap.NewDevelopment()
	if err != nil {
		t.Fatalf("Failed to create logger: %v", err)
	}
	defer logger.Sync()

	// Setup database and Redis (use test instances)
	db, redis, err := setupTestInfrastructure()
	if err != nil {
		t.Fatalf("Failed to setup test infrastructure: %v", err)
	}
	defer cleanupTestInfrastructure(db, redis)

	// Create benchmark engine
	engine := NewBenchmarkEngine(config, logger, db, redis)

	// Run different test scenarios
	testCases := []struct {
		name      string
		scenarios []LoadTestScenario
		config    *BenchmarkConfig
	}{
		{
			name:      "Basic Load Test",
			scenarios: GetDefaultScenarios(),
			config:    GetLoadTestConfig("smoke"),
		},
		{
			name:      "Transaction Analysis Focus",
			scenarios: []LoadTestScenario{GetDefaultScenarios()[2]}, // Transaction analysis scenario
			config:    GetLoadTestConfig("load"),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Merge configurations
			mergedConfig := config.MergeWith(tc.config)

			// Update engine config
			engine.config = mergedConfig

			// Run benchmark
			result, err := engine.RunBenchmark(tc.name, tc.scenarios)

			// Validate results
			if err != nil {
				t.Errorf("Benchmark failed: %v", err)
				return
			}

			if !result.Success {
				t.Errorf("Benchmark was not successful: %s", result.Error)
				return
			}

			// Basic assertions
			if result.Metrics.Summary.TotalRequests == 0 {
				t.Error("No requests were made")
			}

			if result.Metrics.Summary.SuccessRate < 0.5 {
				t.Errorf("Success rate too low: %.2f", result.Metrics.Summary.SuccessRate)
			}

			t.Logf("Test completed successfully:")
			t.Logf("  Total requests: %d", result.Metrics.Summary.TotalRequests)
			t.Logf("  Success rate: %.2f%%", result.Metrics.Summary.SuccessRate*100)
			t.Logf("  Average response time: %v", result.Metrics.Summary.AverageResponseTime)
			t.Logf("  Average RPS: %.2f", result.Metrics.Summary.AverageRPS)
		})
	}
}

// BenchmarkTransactionAnalysis benchmarks the transaction analysis endpoint
func BenchmarkTransactionAnalysis(b *testing.B) {
	// Setup
	config := &BenchmarkConfig{
		ConcurrentUsers:      1,
		TestDuration:         10 * time.Second,
		RampUpPeriod:         1 * time.Second,
		RequestsPerSecond:    10,
		Timeout:              30 * time.Second,
		EnableVerboseLogging: false,
	}

	logger, _ := zap.NewProduction()
	defer logger.Sync()

	db, redis, err := setupTestInfrastructure()
	if err != nil {
		b.Fatalf("Failed to setup test infrastructure: %v", err)
	}
	defer cleanupTestInfrastructure(db, redis)

	engine := NewBenchmarkEngine(config, logger, db, redis)

	// Use only transaction analysis scenario
	scenarios := []LoadTestScenario{GetDefaultScenarios()[2]}

	// Reset timer
	b.ResetTimer()

	// Run benchmark
	for i := 0; i < b.N; i++ {
		result, err := engine.RunBenchmark(fmt.Sprintf("benchmark_run_%d", i), scenarios)
		if err != nil {
			b.Errorf("Benchmark failed: %v", err)
			continue
		}

		if !result.Success {
			b.Errorf("Benchmark was not successful: %s", result.Error)
		}
	}
}

// BenchmarkUserAuthentication benchmarks the authentication endpoints
func BenchmarkUserAuthentication(b *testing.B) {
	// Setup
	config := &BenchmarkConfig{
		ConcurrentUsers:      1,
		TestDuration:         10 * time.Second,
		RampUpPeriod:         1 * time.Second,
		RequestsPerSecond:    20,
		Timeout:              15 * time.Second,
		EnableVerboseLogging: false,
	}

	logger, _ := zap.NewProduction()
	defer logger.Sync()

	db, redis, err := setupTestInfrastructure()
	if err != nil {
		b.Fatalf("Failed to setup test infrastructure: %v", err)
	}
	defer cleanupTestInfrastructure(db, redis)

	engine := NewBenchmarkEngine(config, logger, db, redis)

	// Use only authentication scenario
	scenarios := []LoadTestScenario{GetDefaultScenarios()[1]}

	// Reset timer
	b.ResetTimer()

	// Run benchmark
	for i := 0; i < b.N; i++ {
		result, err := engine.RunBenchmark(fmt.Sprintf("auth_benchmark_%d", i), scenarios)
		if err != nil {
			b.Errorf("Benchmark failed: %v", err)
			continue
		}

		if !result.Success {
			b.Errorf("Benchmark was not successful: %s", result.Error)
		}
	}
}

// TestConfigurationValidation tests configuration validation
func TestConfigurationValidation(t *testing.T) {
	testCases := []struct {
		name        string
		config      *BenchmarkConfig
		expectError bool
		errorMsg    string
	}{
		{
			name: "Valid config",
			config: &BenchmarkConfig{
				ConcurrentUsers:   10,
				TestDuration:      5 * time.Minute,
				RequestsPerSecond: 100,
				Timeout:           30 * time.Second,
				OutputFormat:      "json",
				ReportDirectory:   "./reports",
			},
			expectError: false,
		},
		{
			name: "Invalid concurrent users",
			config: &BenchmarkConfig{
				ConcurrentUsers:   0, // Invalid
				TestDuration:      5 * time.Minute,
				RequestsPerSecond: 100,
				Timeout:           30 * time.Second,
				OutputFormat:      "json",
				ReportDirectory:   "./reports",
			},
			expectError: true,
			errorMsg:    "concurrent_users must be between 1 and 1000",
		},
		{
			name: "Invalid test duration",
			config: &BenchmarkConfig{
				ConcurrentUsers:   10,
				TestDuration:      30 * time.Second, // Too short
				RequestsPerSecond: 100,
				Timeout:           30 * time.Second,
				OutputFormat:      "json",
				ReportDirectory:   "./reports",
			},
			expectError: true,
			errorMsg:    "test_duration must be at least 1 minute",
		},
		{
			name: "Invalid output format",
			config: &BenchmarkConfig{
				ConcurrentUsers:   10,
				TestDuration:      5 * time.Minute,
				RequestsPerSecond: 100,
				Timeout:           30 * time.Second,
				OutputFormat:      "xml", // Invalid
				ReportDirectory:   "./reports",
			},
			expectError: true,
			errorMsg:    "output_format must be one of: json, csv, html",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.config.Validate()

			if tc.expectError {
				if err == nil {
					t.Error("Expected error but got none")
				} else if tc.errorMsg != "" && err.Error() != tc.errorMsg {
					t.Errorf("Expected error message '%s', got '%s'", tc.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
			}
		})
	}
}

// TestScenarioValidation tests scenario validation
func TestScenarioValidation(t *testing.T) {
	// Test default scenarios
	scenarios := GetDefaultScenarios()

	if len(scenarios) == 0 {
		t.Error("No scenarios returned")
	}

	for i, scenario := range scenarios {
		t.Run(fmt.Sprintf("Scenario_%d_%s", i, scenario.Name), func(t *testing.T) {
			if scenario.Name == "" {
				t.Error("Scenario name is empty")
			}

			if scenario.Weight <= 0 {
				t.Errorf("Invalid scenario weight: %d", scenario.Weight)
			}

			if len(scenario.Requests) == 0 {
				t.Error("No requests in scenario")
			}

			for j, request := range scenario.Requests {
				if request.Method == "" {
					t.Errorf("Request %d: method is empty", j)
				}

				if request.Path == "" {
					t.Errorf("Request %d: path is empty", j)
				}

				if request.Timeout <= 0 {
					t.Errorf("Request %d: timeout must be positive", j)
				}
			}
		})
	}
}

// TestLoadTestConfigurations tests predefined load test configurations
func TestLoadTestConfigurations(t *testing.T) {
	configTypes := []string{"smoke", "load", "stress", "spike", "endurance", "capacity", "volume"}

	for _, configType := range configTypes {
		t.Run(configType, func(t *testing.T) {
			config := GetLoadTestConfig(configType)

			// Validate configuration
			err := config.Validate()
			if err != nil {
				t.Errorf("Invalid %s config: %v", configType, err)
			}

			// Basic sanity checks
			if config.ConcurrentUsers < 1 {
				t.Errorf("%s config: invalid concurrent users: %d", configType, config.ConcurrentUsers)
			}

			if config.TestDuration < time.Minute {
				t.Errorf("%s config: test duration too short: %v", configType, config.TestDuration)
			}

			t.Logf("%s config: users=%d, duration=%v, rps=%d",
				configType, config.ConcurrentUsers, config.TestDuration, config.RequestsPerSecond)
		})
	}
}

// TestConfigurationMerging tests configuration merging functionality
func TestConfigurationMerging(t *testing.T) {
	baseConfig := &BenchmarkConfig{
		ConcurrentUsers:   10,
		TestDuration:      5 * time.Minute,
		RequestsPerSecond: 100,
		Timeout:           30 * time.Second,
		OutputFormat:      "json",
		ReportDirectory:   "./reports",
	}

	overrideConfig := &BenchmarkConfig{
		ConcurrentUsers:      50,
		TestDuration:         10 * time.Minute,
		EnableVerboseLogging: true,
	}

	merged := baseConfig.MergeWith(overrideConfig)

	// Check that overridden values are applied
	if merged.ConcurrentUsers != 50 {
		t.Errorf("Expected concurrent users to be 50, got %d", merged.ConcurrentUsers)
	}

	if merged.TestDuration != 10*time.Minute {
		t.Errorf("Expected test duration to be 10m, got %v", merged.TestDuration)
	}

	if !merged.EnableVerboseLogging {
		t.Error("Expected verbose logging to be enabled")
	}

	// Check that non-overridden values are preserved
	if merged.RequestsPerSecond != 100 {
		t.Errorf("Expected requests per second to be 100, got %d", merged.RequestsPerSecond)
	}

	if merged.OutputFormat != "json" {
		t.Errorf("Expected output format to be json, got %s", merged.OutputFormat)
	}
}

// Helper functions

// setupTestInfrastructure sets up test database and Redis instances
func setupTestInfrastructure() (*sqlx.DB, *redis.Client, error) {
	// For testing, we can use in-memory SQLite or mock connections
	// This is a simplified setup for demonstration

	// Mock database connection
	db, err := sqlx.Open("postgres", "postgres://test:test@localhost/testdb?sslmode=disable")
	if err != nil {
		// Fallback to in-memory setup for testing
		log.Printf("Warning: Could not connect to test database: %v", err)
		db = nil
	}

	// Mock Redis connection
	rdb := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "",
		DB:       0,
	})

	// Test Redis connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		// Fallback for testing
		log.Printf("Warning: Could not connect to Redis: %v", err)
		rdb = nil
	}

	return db, rdb, nil
}

// cleanupTestInfrastructure cleans up test infrastructure
func cleanupTestInfrastructure(db *sqlx.DB, redis *redis.Client) {
	if db != nil {
		db.Close()
	}

	if redis != nil {
		redis.Close()
	}
}

// ensureReportDirectory creates the report directory if it doesn't exist
func ensureReportDirectory(dir string) error {
	return os.MkdirAll(dir, 0755)
}

// TestMain is the main test entry point
func TestMain(m *testing.M) {
	// Ensure report directory exists
	reportDir := "./reports"
	if err := ensureReportDirectory(reportDir); err != nil {
		log.Fatalf("Failed to create report directory: %v", err)
	}

	// Run tests
	code := m.Run()

	// Cleanup
	os.Exit(code)
}

// Example usage functions

// ExampleBenchmarkRun shows how to run a benchmark programmatically
func ExampleBenchmarkRun() {
	// Load configuration
	config, err := LoadBenchmarkConfig("")
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Create logger
	logger, err := zap.NewProduction()
	if err != nil {
		log.Fatalf("Failed to create logger: %v", err)
	}
	defer logger.Sync()

	// Setup infrastructure (in production, these would be real connections)
	db, redis, err := setupTestInfrastructure()
	if err != nil {
		log.Fatalf("Failed to setup infrastructure: %v", err)
	}
	defer cleanupTestInfrastructure(db, redis)

	// Create benchmark engine
	engine := NewBenchmarkEngine(config, logger, db, redis)

	// Run benchmark
	result, err := engine.RunBenchmark("example-test", GetDefaultScenarios())
	if err != nil {
		log.Fatalf("Benchmark failed: %v", err)
	}

	if !result.Success {
		log.Fatalf("Benchmark was not successful: %s", result.Error)
	}

	log.Printf("Benchmark completed successfully")
	log.Printf("Total requests: %d", result.Metrics.Summary.TotalRequests)
	log.Printf("Success rate: %.2f%%", result.Metrics.Summary.SuccessRate*100)
	log.Printf("Average response time: %v", result.Metrics.Summary.AverageResponseTime)
	log.Printf("Report saved to: %s", result.ReportPath)
}

// ExampleCustomScenario shows how to create a custom test scenario
func ExampleCustomScenario() {
	customScenario := LoadTestScenario{
		Name:        "Custom API Test",
		Description: "Testing custom endpoint",
		Weight:      100,
		Requests: []RequestDefinition{
			{
				Method: "POST",
				Path:   "/api/v1/custom/endpoint",
				Headers: map[string]string{
					"Content-Type":  "application/json",
					"Authorization": "Bearer custom-token",
				},
				Body: map[string]interface{}{
					"param1": "value1",
					"param2": 123,
				},
				Timeout: 30 * time.Second,
				Weight:  100,
				Assertions: []Assertion{
					{
						Type:     "status_code",
						Value:    200,
						Operator: "equals",
					},
					{
						Type:     "response_time",
						Value:    5000,
						Operator: "less_than",
					},
				},
			},
		},
		ExpectedResults: ExpectedResults{
			ResponseTime: 2000 * time.Millisecond,
			SuccessRate:  0.95,
			Throughput:   50,
			ErrorRate:    0.05,
		},
		Timeout: 30 * time.Second,
		RetryPolicy: RetryPolicy{
			MaxAttempts: 3,
			BackoffType: "exponential",
			BaseDelay:   1 * time.Second,
			MaxDelay:    10 * time.Second,
		},
	}

	log.Printf("Created custom scenario: %s", customScenario.Name)
	log.Printf("Number of requests: %d", len(customScenario.Requests))
	log.Printf("Expected success rate: %.2f%%", customScenario.ExpectedResults.SuccessRate*100)
}
