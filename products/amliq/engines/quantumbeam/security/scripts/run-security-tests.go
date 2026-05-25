package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/quantumbeam/security/testing"
)

// SecurityTestConfig holds configuration for security testing
type SecurityTestConfig struct {
	TargetURL           string            `json:"target_url"`
	OutputFile          string            `json:"output_file"`
	TestTimeout         time.Duration     `json:"test_timeout"`
	ConcurrentRequests  int               `json:"concurrent_requests"`
	AuthToken           string            `json:"auth_token"`
	APIKey              string            `json:"api_key"`
	TestEndpoints       []string          `json:"test_endpoints"`
	SkipTests           []string          `json:"skip_tests"`
	OnlyTests           []string          `json:"only_tests"`
	Environment         string            `json:"environment"`
	EnableVerbose       bool              `json:"enable_verbose"`
	GenerateReport      bool              `json:"generate_report"`
	ReportTemplate      string            `json:"report_template"`
	NotificationWebhook string            `json:"notification_webhook"`
	Tags                map[string]string `json:"tags"`
}

// SecurityTestRunner runs comprehensive security tests
type SecurityTestRunner struct {
	config SecurityTestConfig
	logger *log.Logger
	suite  *testing.SecurityTestSuite
}

// NewSecurityTestRunner creates a new security test runner
func NewSecurityTestRunner(config SecurityTestConfig) *SecurityTestRunner {
	logger := log.New(os.Stdout, "[SECURITY-TESTS] ", log.LstdFlags|log.Lmsgprefix)

	// Create security test suite configuration
	suiteConfig := testing.SecurityTestConfig{
		BaseURL:               config.TargetURL,
		AuthenticationToken:   config.AuthToken,
		APIKey:                config.APIKey,
		TestEndpoints:         config.TestEndpoints,
		TestTimeout:           config.TestTimeout,
		ConcurrentRequests:    config.ConcurrentRequests,
		EnableTLSVerification: true,
		AdditionalHeaders:     make(map[string]string),
	}

	// Add user agent header
	suiteConfig.AdditionalHeaders["User-Agent"] = "QuantumBeam-Security-Scanner/1.0"

	suite := testing.NewSecurityTestSuite(suiteConfig)

	return &SecurityTestRunner{
		config: config,
		logger: logger,
		suite:  suite,
	}
}

// RunTests executes all security tests
func (r *SecurityTestRunner) RunTests(ctx context.Context) error {
	r.logger.Printf("Starting security tests for %s", r.config.TargetURL)
	r.logger.Printf("Test configuration: Timeout=%v, Concurrent=%d", r.config.TestTimeout, r.config.ConcurrentRequests)

	startTime := time.Now()

	// Run comprehensive security tests
	report, err := r.suite.RunAllTests(ctx)
	if err != nil {
		return fmt.Errorf("failed to run security tests: %w", err)
	}

	duration := time.Since(startTime)

	// Add metadata to report
	if report.EnvironmentInfo == nil {
		report.EnvironmentInfo = make(map[string]interface{})
	}
	report.EnvironmentInfo["test_duration"] = duration.String()
	report.EnvironmentInfo["test_timestamp"] = startTime.Format(time.RFC3339)
	report.EnvironmentInfo["environment"] = r.config.Environment
	report.EnvironmentInfo["tags"] = r.config.Tags

	// Generate summary
	r.logger.Printf("Security tests completed in %v", duration)
	r.logger.Printf("Results: %d total, %d passed, %d failed, %d warnings",
		report.Summary.TotalTests,
		report.Summary.PassedTests,
		report.Summary.FailedTests,
		report.Summary.WarningTests)
	r.logger.Printf("Risk levels: %d critical, %d high, %d medium, %d low",
		report.Summary.CriticalIssues,
		report.Summary.HighRiskIssues,
		report.Summary.MediumRiskIssues,
		report.Summary.LowRiskIssues)

	// Save results
	if err := r.saveResults(report); err != nil {
		return fmt.Errorf("failed to save results: %w", err)
	}

	// Generate HTML report if requested
	if r.config.GenerateReport {
		if err := r.generateHTMLReport(report); err != nil {
			r.logger.Printf("Warning: Failed to generate HTML report: %v", err)
		}
	}

	// Send notifications if configured
	if r.config.NotificationWebhook != "" {
		if err := r.sendNotification(report); err != nil {
			r.logger.Printf("Warning: Failed to send notification: %v", err)
		}
	}

	// Check if any critical issues were found
	if report.Summary.CriticalIssues > 0 {
		return fmt.Errorf("security tests failed: %d critical issues found", report.Summary.CriticalIssues)
	}

	if report.Summary.HighRiskIssues > 5 {
		return fmt.Errorf("security tests failed: %d high-risk issues found (threshold: 5)", report.Summary.HighRiskIssues)
	}

	return nil
}

// saveResults saves test results to file
func (r *SecurityTestRunner) saveResults(report *testing.SecurityTestReport) error {
	// Create output directory if it doesn't exist
	outputDir := filepath.Dir(r.config.OutputFile)
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// Save JSON report
	jsonFile := strings.TrimSuffix(r.config.OutputFile, filepath.Ext(r.config.OutputFile)) + ".json"
	jsonData, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON report: %w", err)
	}

	if err := os.WriteFile(jsonFile, jsonData, 0644); err != nil {
		return fmt.Errorf("failed to save JSON report: %w", err)
	}

	r.logger.Printf("Security test results saved to %s", jsonFile)
	return nil
}

// generateHTMLReport generates HTML security report
func (r *SecurityTestRunner) generateHTMLReport(report *testing.SecurityTestReport) error {
	htmlFile := strings.TrimSuffix(r.config.OutputFile, filepath.Ext(r.config.OutputFile)) + ".html"

	template := r.config.ReportTemplate
	if template == "" {
		template = r.getDefaultHTMLTemplate()
	}

	// Generate HTML report
	if err := r.suite.GenerateSecurityTestReport(context.Background(),
		strings.TrimSuffix(r.config.OutputFile, filepath.Ext(r.config.OutputFile))); err != nil {
		return fmt.Errorf("failed to generate HTML report: %w", err)
	}

	r.logger.Printf("HTML security report generated at %s", htmlFile)
	return nil
}

// getDefaultHTMLTemplate returns default HTML template
func (r *SecurityTestRunner) getDefaultHTMLTemplate() string {
	return `
<!DOCTYPE html>
<html>
<head>
    <title>QuantumBeam Security Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 5px; }
        .summary { display: flex; justify-content: space-around; margin: 20px 0; }
        .metric { text-align: center; padding: 15px; background: #f8f9fa; border-radius: 5px; }
        .test-result { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .pass { background: #d4edda; border-color: #c3e6cb; }
        .fail { background: #f8d7da; border-color: #f5c6cb; }
        .warn { background: #fff3cd; border-color: #ffeaa7; }
        .risk-critical { border-left: 5px solid #dc3545; }
        .risk-high { border-left: 5px solid #fd7e14; }
        .risk-medium { border-left: 5px solid #ffc107; }
        .risk-low { border-left: 5px solid #28a745; }
    </style>
</head>
<body>
    <div class="header">
        <h1>QuantumBeam Security Test Report</h1>
        <p>Generated: {{.GeneratedAt}}</p>
        <p>Total Duration: {{.TotalDuration}}</p>
    </div>
    <div class="summary">
        <div class="metric"><h3>Total Tests</h3><p>{{.Summary.TotalTests}}</p></div>
        <div class="metric"><h3>Passed</h3><p>{{.Summary.PassedTests}}</p></div>
        <div class="metric"><h3>Failed</h3><p>{{.Summary.FailedTests}}</p></div>
        <div class="metric"><h3>Critical Issues</h3><p>{{.Summary.CriticalIssues}}</p></div>
    </div>
    <h2>Test Results</h2>
    {{range .TestResults}}
    <div class="test-result {{.Status}} risk-{{.RiskLevel | toLower}}">
        <h3>{{.TestName}}</h3>
        <p><strong>Status:</strong> {{.Status}} | <strong>Risk Level:</strong> {{.RiskLevel}} | <strong>Duration:</strong> {{.Duration}}</p>
        <p>{{.Description}}</p>
        {{if .Recommendations}}
        <h4>Recommendations:</h4>
        <ul>{{range .Recommendations}}
            <li>{{.}}</li>{{end}}
        </ul>{{end}}
    </div>{{end}}
</body>
</html>`
}

// sendNotification sends security test notification
func (r *SecurityTestRunner) sendNotification(report *testing.SecurityTestReport) error {
	// Prepare notification payload
	payload := map[string]interface{}{
		"text": fmt.Sprintf("🔒 Security Test Results for QuantumBeam"),
		"attachments": []map[string]interface{}{
			{
				"color": r.getNotificationColor(report),
				"fields": []map[string]interface{}{
					{
						"title": "Environment",
						"value": r.config.Environment,
						"short": true,
					},
					{
						"title": "Status",
						"value": r.getOverallStatus(report),
						"short": true,
					},
					{
						"title": "Total Tests",
						"value": fmt.Sprintf("%d", report.Summary.TotalTests),
						"short": true,
					},
					{
						"title": "Critical Issues",
						"value": fmt.Sprintf("%d", report.Summary.CriticalIssues),
						"short": true,
					},
					{
						"title": "High Risk Issues",
						"value": fmt.Sprintf("%d", report.Summary.HighRiskIssues),
						"short": true,
					},
					{
						"title": "Duration",
						"value": report.TotalDuration.String(),
						"short": true,
					},
				},
				"actions": []map[string]interface{}{
					{
						"type": "button",
						"text": "View Full Report",
						"url":  fmt.Sprintf("file://%s", r.config.OutputFile),
					},
				},
			},
		},
	}

	// Convert to JSON
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal notification payload: %w", err)
	}

	// Send HTTP request
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(r.config.NotificationWebhook, "application/json", strings.NewReader(string(jsonData)))
	if err != nil {
		return fmt.Errorf("failed to send notification: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("notification request failed with status: %d", resp.StatusCode)
	}

	r.logger.Printf("Security test notification sent successfully")
	return nil
}

// getNotificationColor returns appropriate color for notification
func (r *SecurityTestRunner) getNotificationColor(report *testing.SecurityTestReport) string {
	if report.Summary.CriticalIssues > 0 {
		return "danger"
	}
	if report.Summary.HighRiskIssues > 5 {
		return "warning"
	}
	if report.Summary.FailedTests > 0 {
		return "warning"
	}
	return "good"
}

// getOverallStatus returns overall status string
func (r *SecurityTestRunner) getOverallStatus(report *testing.SecurityTestReport) string {
	if report.Summary.CriticalIssues > 0 {
		return "❌ FAILED"
	}
	if report.Summary.HighRiskIssues > 5 {
		return "⚠️ WARNING"
	}
	if report.Summary.FailedTests > 0 {
		return "⚠️ WARNING"
	}
	return "✅ PASSED"
}

// loadConfigFromFile loads configuration from JSON file
func loadConfigFromFile(filename string) (SecurityTestConfig, error) {
	var config SecurityTestConfig

	data, err := os.ReadFile(filename)
	if err != nil {
		return config, fmt.Errorf("failed to read config file: %w", err)
	}

	if err := json.Unmarshal(data, &config); err != nil {
		return config, fmt.Errorf("failed to parse config file: %w", err)
	}

	// Set defaults for missing values
	if config.TestTimeout == 0 {
		config.TestTimeout = 5 * time.Minute
	}
	if config.ConcurrentRequests == 0 {
		config.ConcurrentRequests = 10
	}
	if config.Environment == "" {
		config.Environment = "test"
	}
	if config.Tags == nil {
		config.Tags = make(map[string]string)
	}

	return config, nil
}

func main() {
	// Parse command line flags
	var (
		configFile     = flag.String("config", "", "Configuration file path")
		targetURL      = flag.String("target", "", "Target URL for security testing")
		outputFile     = flag.String("output", "security-test-results", "Output file path (without extension)")
		timeout        = flag.Duration("timeout", 5*time.Minute, "Test timeout")
		concurrent     = flag.Int("concurrent", 10, "Number of concurrent requests")
		authToken      = flag.String("token", "", "Authentication token")
		apiKey         = flag.String("api-key", "", "API key")
		env            = flag.String("env", "test", "Environment name")
		verbose        = flag.Bool("verbose", false, "Enable verbose logging")
		generateReport = flag.Bool("html", true, "Generate HTML report")
		webhook        = flag.String("webhook", "", "Notification webhook URL")
	)
	flag.Parse()

	// Load configuration
	var config SecurityTestConfig
	var err error

	if *configFile != "" {
		config, err = loadConfigFromFile(*configFile)
		if err != nil {
			log.Fatalf("Failed to load configuration: %v", err)
		}
	} else {
		// Create config from command line arguments
		config = SecurityTestConfig{
			TargetURL:           *targetURL,
			OutputFile:          *outputFile,
			TestTimeout:         *timeout,
			ConcurrentRequests:  *concurrent,
			AuthToken:           *authToken,
			APIKey:              *apiKey,
			Environment:         *env,
			EnableVerbose:       *verbose,
			GenerateReport:      *generateReport,
			NotificationWebhook: *webhook,
			Tags:                make(map[string]string),
		}
	}

	// Validate configuration
	if config.TargetURL == "" {
		log.Fatal("Target URL is required (use -target or specify in config file)")
	}

	// Create test runner
	runner := NewSecurityTestRunner(config)

	// Setup context with cancellation
	ctx, cancel := context.WithTimeout(context.Background(), config.TestTimeout+time.Minute)
	defer cancel()

	// Setup signal handling for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Run tests in goroutine
	resultChan := make(chan error, 1)
	go func() {
		resultChan <- runner.RunTests(ctx)
	}()

	// Wait for completion or interruption
	select {
	case err := <-resultChan:
		if err != nil {
			log.Printf("Security tests failed: %v", err)
			os.Exit(1)
		}
		log.Println("Security tests completed successfully")
		os.Exit(0)

	case sig := <-sigChan:
		log.Printf("Received signal %v, cancelling security tests", sig)
		cancel()
		os.Exit(130)

	case <-ctx.Done():
		log.Println("Security tests timed out")
		os.Exit(124)
	}
}
