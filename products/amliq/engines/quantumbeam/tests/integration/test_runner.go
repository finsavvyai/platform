package integration

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/stretchr/testify/suite"
)

// Test configuration
type TestConfig struct {
	DatabaseURL          string
	ServerHost           string
	ServerPort           int
	TestTimeout          time.Duration
	CleanupAfterTest     bool
	ParallelTests        bool
	Verbose              bool
	SkipDatabaseTests    bool
	SkipPerformanceTests bool
	TestEnvironment      string
}

var (
	config = &TestConfig{
		DatabaseURL:          "postgres://postgres:password@localhost:5432/quantumbeam_test?sslmode=disable",
		ServerHost:           "localhost",
		ServerPort:           8081,
		TestTimeout:          30 * time.Minute,
		CleanupAfterTest:     true,
		ParallelTests:        false,
		Verbose:              false,
		SkipDatabaseTests:    false,
		SkipPerformanceTests: false,
		TestEnvironment:      "test",
	}
)

// Parse command line flags
func init() {
	flag.StringVar(&config.DatabaseURL, "database-url", config.DatabaseURL, "Database connection URL")
	flag.StringVar(&config.ServerHost, "host", config.ServerHost, "Test server host")
	flag.IntVar(&config.ServerPort, "port", config.ServerPort, "Test server port")
	flag.DurationVar(&config.TestTimeout, "timeout", config.TestTimeout, "Test suite timeout")
	flag.BoolVar(&config.CleanupAfterTest, "cleanup", config.CleanupAfterTest, "Cleanup test data after tests")
	flag.BoolVar(&config.ParallelTests, "parallel", config.ParallelTests, "Run tests in parallel")
	flag.BoolVar(&config.Verbose, "verbose", config.Verbose, "Verbose output")
	flag.BoolVar(&config.SkipDatabaseTests, "skip-db", config.SkipDatabaseTests, "Skip database-dependent tests")
	flag.BoolVar(&config.SkipPerformanceTests, "skip-perf", config.SkipPerformanceTests, "Skip performance tests")
	flag.StringVar(&config.TestEnvironment, "env", config.TestEnvironment, "Test environment (test, staging)")
}

// TestMain is the entry point for integration tests
func TestMain(m *testing.M) {
	flag.Parse()

	// Setup test environment
	if err := setupTestEnvironment(); err != nil {
		log.Fatalf("Failed to setup test environment: %v", err)
	}

	// Create context for timeout and cancellation
	ctx, cancel := context.WithTimeout(context.Background(), config.TestTimeout)
	defer cancel()

	// Setup signal handling for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Run tests in a goroutine to handle timeout
	resultChan := make(chan int, 1)
	go func() {
		resultChan <- m.Run()
	}()

	// Wait for tests to complete or timeout/signal
	select {
	case result := <-resultChan:
		// Tests completed
		teardownTestEnvironment()
		os.Exit(result)

	case <-ctx.Done():
		// Timeout occurred
		log.Printf("Test suite timed out after %v", config.TestTimeout)
		teardownTestEnvironment()
		os.Exit(1)

	case sig := <-sigChan:
		// Signal received
		log.Printf("Test suite interrupted by signal: %v", sig)
		teardownTestEnvironment()
		os.Exit(130)
	}
}

func setupTestEnvironment() error {
	log.Println("Setting up integration test environment...")

	// Check if required dependencies are available
	if !checkDependencies() {
		return fmt.Errorf("required dependencies not available")
	}

	// Setup test database if needed
	if !config.SkipDatabaseTests {
		if err := setupTestDatabase(); err != nil {
			return fmt.Errorf("failed to setup test database: %w", err)
		}
	}

	// Set environment variables for testing
	os.Setenv("APP_ENV", config.TestEnvironment)
	os.Setenv("LOG_LEVEL", "debug")
	os.Setenv("DB_URL", config.DatabaseURL)
	os.Setenv("SERVER_HOST", config.ServerHost)
	os.Setenv("SERVER_PORT", fmt.Sprintf("%d", config.ServerPort))

	log.Println("Integration test environment setup complete")
	return nil
}

func teardownTestEnvironment() {
	log.Println("Tearing down integration test environment...")

	if config.CleanupAfterTest && !config.SkipDatabaseTests {
		if err := cleanupTestDatabase(); err != nil {
			log.Printf("Warning: Failed to cleanup test database: %v", err)
		}
	}

	log.Println("Integration test environment teardown complete")
}

func checkDependencies() bool {
	log.Println("Checking dependencies...")

	// Check if PostgreSQL is available
	if !config.SkipDatabaseTests {
		if !isCommandAvailable("psql") {
			log.Println("Warning: psql not found, database tests may fail")
		}
	}

	// Check if Docker is available (optional)
	if isCommandAvailable("docker") {
		log.Println("Docker is available")
	} else {
		log.Println("Docker not found - some tests may be skipped")
	}

	// Check system resources
	if runtime.NumCPU() < 2 {
		log.Println("Warning: Low CPU count detected, performance tests may be slow")
	}

	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	if m.Alloc < 100*1024*1024 { // Less than 100MB available
		log.Println("Warning: Low memory detected, some tests may be skipped")
	}

	log.Println("Dependency check complete")
	return true
}

func isCommandAvailable(cmd string) bool {
	_, err := exec.LookPath(cmd)
	return err == nil
}

func setupTestDatabase() error {
	log.Println("Setting up test database...")

	// For now, we assume the test database already exists
	// In a real setup, you would create the database here
	log.Printf("Using test database: %s", config.DatabaseURL)

	// Test database connection
	// This will be done in the test suite setup
	return nil
}

func cleanupTestDatabase() error {
	log.Println("Cleaning up test database...")

	// Clean up test data
	// This would typically involve dropping test tables or data
	return nil
}

// IntegrationTestSuiteRunner manages running all integration tests
type IntegrationTestSuiteRunner struct {
	config *TestConfig
	logger *log.Logger
}

// NewIntegrationTestSuiteRunner creates a new test suite runner
func NewIntegrationTestSuiteRunner(config *TestConfig) *IntegrationTestSuiteRunner {
	return &IntegrationTestSuiteRunner{
		config: config,
		logger: log.New(os.Stdout, "[INTEGRATION-TESTS] ", log.LstdFlags),
	}
}

// RunAllTests runs all integration test suites
func (r *IntegrationTestSuiteRunner) RunAllTests(m *testing.M) int {
	r.logger.Println("Starting integration test suite...")

	// Configure test parallelization
	if r.config.ParallelTests {
		r.logger.Println("Running tests in parallel")
		testing.Short()
	} else {
		r.logger.Println("Running tests sequentially")
		testing.Short()
	}

	// Run the tests
	start := time.Now()
	result := m.Run()
	duration := time.Since(start)

	r.logger.Printf("Integration tests completed in %v", duration)
	r.logger.Printf("Test result: %d", result)

	if result == 0 {
		r.logger.Println("✅ All integration tests passed!")
	} else {
		r.logger.Println("❌ Some integration tests failed!")
	}

	return result
}

// GenerateTestReport generates a comprehensive test report
func (r *IntegrationTestSuiteRunner) GenerateTestReport(testResults []TestResult) error {
	r.logger.Println("Generating test report...")

	report := TestReport{
		GeneratedAt:  time.Now(),
		TestSuite:    "QuantumBeam Integration Tests",
		Version:      "1.0.0",
		Environment:  r.config.TestEnvironment,
		TotalTests:   len(testResults),
		PassedTests:  0,
		FailedTests:  0,
		SkippedTests: 0,
		Duration:     0,
		TestResults:  testResults,
	}

	for _, result := range testResults {
		switch result.Status {
		case "passed":
			report.PassedTests++
		case "failed":
			report.FailedTests++
		case "skipped":
			report.SkippedTests++
		}
		report.Duration += result.Duration
	}

	// Generate report in various formats
	if err := r.generateJSONReport(report); err != nil {
		return fmt.Errorf("failed to generate JSON report: %w", err)
	}

	if err := r.generateHTMLReport(report); err != nil {
		return fmt.Errorf("failed to generate HTML report: %w", err)
	}

	r.logger.Printf("Test report generated: %d passed, %d failed, %d skipped",
		report.PassedTests, report.FailedTests, report.SkippedTests)

	return nil
}

// TestResult represents the result of a single test
type TestResult struct {
	Name     string        `json:"name"`
	Status   string        `json:"status"` // passed, failed, skipped
	Duration time.Duration `json:"duration"`
	Error    string        `json:"error,omitempty"`
	Logs     []string      `json:"logs,omitempty"`
	Metrics  TestMetrics   `json:"metrics,omitempty"`
}

// TestMetrics represents performance metrics for a test
type TestMetrics struct {
	ResponseTime    time.Duration `json:"response_time,omitempty"`
	Throughput      float64       `json:"throughput,omitempty"`
	ErrorRate       float64       `json:"error_rate,omitempty"`
	MemoryUsage     uint64        `json:"memory_usage,omitempty"`
	DatabaseQueries int           `json:"database_queries,omitempty"`
}

// TestReport represents a comprehensive test report
type TestReport struct {
	GeneratedAt  time.Time     `json:"generated_at"`
	TestSuite    string        `json:"test_suite"`
	Version      string        `json:"version"`
	Environment  string        `json:"environment"`
	TotalTests   int           `json:"total_tests"`
	PassedTests  int           `json:"passed_tests"`
	FailedTests  int           `json:"failed_tests"`
	SkippedTests int           `json:"skipped_tests"`
	Duration     time.Duration `json:"duration"`
	TestResults  []TestResult  `json:"test_results"`
	Summary      string        `json:"summary"`
}

func (r *IntegrationTestSuiteRunner) generateJSONReport(report TestReport) error {
	reportPath := "test_results/integration_report.json"

	// Ensure directory exists
	if err := os.MkdirAll("test_results", 0755); err != nil {
		return err
	}

	file, err := os.Create(reportPath)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	return encoder.Encode(report)
}

func (r *IntegrationTestSuiteRunner) generateHTMLReport(report TestReport) error {
	reportPath := "test_results/integration_report.html"

	// Ensure directory exists
	if err := os.MkdirAll("test_results", 0755); err != nil {
		return err
	}

	file, err := os.Create(reportPath)
	if err != nil {
		return err
	}
	defer file.Close()

	// Generate HTML report
	htmlTemplate := `<!DOCTYPE html>
<html>
<head>
    <title>Integration Test Report - {{.TestSuite}}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #e9ecef; padding: 15px; border-radius: 5px; text-align: center; }
        .passed { background: #d4edda; color: #155724; }
        .failed { background: #f8d7da; color: #721c24; }
        .skipped { background: #fff3cd; color: #856404; }
        .test-results { margin-top: 20px; }
        .test-result { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .test-name { font-weight: bold; font-size: 18px; }
        .test-duration { color: #666; }
        .test-error { color: #721c24; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{.TestSuite}} - Integration Test Report</h1>
        <p>Generated: {{.GeneratedAt}} | Environment: {{.Environment}} | Version: {{.Version}}</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>{{.TotalTests}}</h3>
            <p>Total Tests</p>
        </div>
        <div class="metric passed">
            <h3>{{.PassedTests}}</h3>
            <p>Passed</p>
        </div>
        <div class="metric failed">
            <h3>{{.FailedTests}}</h3>
            <p>Failed</p>
        </div>
        <div class="metric skipped">
            <h3>{{.SkippedTests}}</h3>
            <p>Skipped</p>
        </div>
        <div class="metric">
            <h3>{{.Duration}}</h3>
            <p>Total Duration</p>
        </div>
    </div>

    <div class="test-results">
        <h2>Test Results</h2>
        {{range .TestResults}}
        <div class="test-result {{.Status}}">
            <div class="test-name">{{.Name}}</div>
            <div class="test-duration">Duration: {{.Duration}}</div>
            {{if .Error}}<div class="test-error">Error: {{.Error}}</div>{{end}}
        </div>
        {{end}}
    </div>
</body>
</html>`

	// Simple template replacement (in production, use html/template)
	html := strings.ReplaceAll(htmlTemplate, "{{.TestSuite}}", report.TestSuite)
	html = strings.ReplaceAll(html, "{{.GeneratedAt}}", report.GeneratedAt.Format(time.RFC3339))
	html = strings.ReplaceAll(html, "{{.Environment}}", report.Environment)
	html = strings.ReplaceAll(html, "{{.Version}}", report.Version)
	html = strings.ReplaceAll(html, "{{.TotalTests}}", fmt.Sprintf("%d", report.TotalTests))
	html = strings.ReplaceAll(html, "{{.PassedTests}}", fmt.Sprintf("%d", report.PassedTests))
	html = strings.ReplaceAll(html, "{{.FailedTests}}", fmt.Sprintf("%d", report.FailedTests))
	html = strings.ReplaceAll(html, "{{.SkippedTests}}", fmt.Sprintf("%d", report.SkippedTests))
	html = strings.ReplaceAll(html, "{{.Duration}}", report.Duration.String())

	// Add test results
	var resultsHTML strings.Builder
	for _, result := range report.TestResults {
		resultsHTML.WriteString(fmt.Sprintf(`
        <div class="test-result %s">
            <div class="test-name">%s</div>
            <div class="test-duration">Duration: %s</div>`, result.Status, result.Name, result.Duration.String()))

		if result.Error != "" {
			resultsHTML.WriteString(fmt.Sprintf(`<div class="test-error">Error: %s</div>`, result.Error))
		}

		resultsHTML.WriteString("</div>")
	}

	html = strings.ReplaceAll(html, `{{range .TestResults}}
        <div class="test-result {{.Status}}">
            <div class="test-name">{{.Name}}</div>
            <div class="test-duration">Duration: {{.Duration}}</div>
            {{if .Error}}<div class="test-error">Error: {{.Error}}</div>{{end}}
        </div>
        {{end}}`, resultsHTML.String())

	_, err = file.WriteString(html)
	return err
}

// RunIntegrationTests runs all integration tests with proper setup and teardown
func RunIntegrationTests(m *testing.M) int {
	runner := NewIntegrationTestSuiteRunner(config)
	return runner.RunAllTests(m)
}

// Performance benchmark tests
func BenchmarkAuthentication(b *testing.B) {
	suite := &IntegrationTestSuite{}
	suite.SetupSuite()
	defer suite.TearDownSuite()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		loginData := map[string]string{
			"username": suite.testUser.Username,
			"password": suite.testUser.Password,
		}

		w := suite.makeRequest("POST", "/auth/login", loginData, nil)
		if w.Code != http.StatusOK {
			b.Fatalf("Expected status 200, got %d", w.Code)
		}
	}
}

func BenchmarkFraudAnalysis(b *testing.B) {
	suite := &IntegrationTestSuite{}
	suite.SetupSuite()
	suite.createAPIKey()
	defer suite.TearDownSuite()

	transaction := map[string]interface{}{
		"transaction_id": "benchmark_txn",
		"user_id":        suite.testUser.ID,
		"merchant_id":    "test-merchant-id",
		"amount":         1000.00,
		"currency":       "USD",
		"description":    "Benchmark test transaction",
	}

	headers := map[string]string{
		"Authorization": "Bearer " + suite.testAPIKey.Key,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		transaction["transaction_id"] = fmt.Sprintf("benchmark_txn_%d", i)
		w := suite.makeRequest("POST", "/fraud/analyze", transaction, headers)
		if w.Code != http.StatusOK {
			b.Fatalf("Expected status 200, got %d", w.Code)
		}
	}
}
