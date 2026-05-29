package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

// TestConfig holds configuration for API testing
type TestConfig struct {
	// API configuration
	BaseURL     string `yaml:"base_url" json:"base_url"`
	APIVersion  string `yaml:"api_version" json:"api_version"`
	OpenAPIPath string `yaml:"openapi_path" json:"openapi_path"`

	// Authentication
	AuthCreds AuthCredentials `yaml:"auth" json:"auth"`

	// Test configuration
	TestTimeout    time.Duration `yaml:"test_timeout" json:"test_timeout"`
	MaxConcurrency int           `yaml:"max_concurrency" json:"max_concurrency"`
	RetryAttempts  int           `yaml:"retry_attempts" json:"retry_attempts"`
	RetryDelay     time.Duration `yaml:"retry_delay" json:"retry_delay"`

	// Output configuration
	OutputFormat  string `yaml:"output_format" json:"output_format"` // json, yaml, junit, html
	OutputFile    string `yaml:"output_file" json:"output_file"`
	VerboseOutput bool   `yaml:"verbose" json:"verbose"`

	// Filters
	IncludeTags  []string `yaml:"include_tags" json:"include_tags"`
	ExcludeTags  []string `yaml:"exclude_tags" json:"exclude_tags"`
	IncludePaths []string `yaml:"include_paths" json:"include_paths"`
	ExcludePaths []string `yaml:"exclude_paths" json:"exclude_paths"`

	// Environment variables
	EnvVars map[string]string `yaml:"env_vars" json:"env_vars"`

	// Custom test data
	TestData map[string]interface{} `yaml:"test_data" json:"test_data"`
}

// AuthCredentials holds authentication information
type AuthCredentials struct {
	Type         string `yaml:"type" json:"type"` // bearer, apikey, basic, oauth2
	Token        string `yaml:"token" json:"token"`
	APIKey       string `yaml:"api_key" json:"api_key"`
	Username     string `yaml:"username" json:"username"`
	Password     string `yaml:"password" json:"password"`
	ClientID     string `yaml:"client_id" json:"client_id"`
	ClientSecret string `yaml:"client_secret" json:"client_secret"`
}

// TestResult represents the result of a single test
type TestResult struct {
	Name           string                 `json:"name"`
	Method         string                 `json:"method"`
	Path           string                 `json:"path"`
	Status         string                 `json:"status"` // passed, failed, skipped, error
	Duration       time.Duration          `json:"duration"`
	StatusCode     int                    `json:"status_code"`
	ExpectedStatus int                    `json:"expected_status"`
	Error          string                 `json:"error,omitempty"`
	Request        RequestInfo            `json:"request"`
	Response       ResponseInfo           `json:"response"`
	Validation     ValidationResult       `json:"validation"`
	Tags           []string               `json:"tags"`
	Timestamp      time.Time              `json:"timestamp"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

// RequestInfo holds information about the request
type RequestInfo struct {
	Headers    map[string]string `json:"headers"`
	Body       interface{}       `json:"body,omitempty"`
	Query      map[string]string `json:"query,omitempty"`
	PathParams map[string]string `json:"path_params,omitempty"`
}

// ResponseInfo holds information about the response
type ResponseInfo struct {
	Headers  map[string]string `json:"headers"`
	Body     interface{}       `json:"body,omitempty"`
	Size     int64             `json:"size"`
	Duration time.Duration     `json:"duration"`
}

// ValidationResult holds validation results
type ValidationResult struct {
	OpenAPIValid bool     `json:"openapi_valid"`
	SchemaValid  bool     `json:"schema_valid"`
	HeadersValid bool     `json:"headers_valid"`
	Errors       []string `json:"errors,omitempty"`
	Warnings     []string `json:"warnings,omitempty"`
}

// TestSuite represents a collection of test results
type TestSuite struct {
	Name        string                 `json:"name"`
	Version     string                 `json:"version"`
	StartedAt   time.Time              `json:"started_at"`
	CompletedAt time.Time              `json:"completed_at"`
	Duration    time.Duration          `json:"duration"`
	Results     []TestResult           `json:"results"`
	Summary     TestSummary            `json:"summary"`
	Config      TestConfig             `json:"config"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// TestSummary provides a summary of test results
type TestSummary struct {
	Total           int           `json:"total"`
	Passed          int           `json:"passed"`
	Failed          int           `json:"failed"`
	Skipped         int           `json:"skipped"`
	Errors          int           `json:"errors"`
	SuccessRate     float64       `json:"success_rate"`
	Duration        time.Duration `json:"duration"`
	AvgResponseTime time.Duration `json:"avg_response_time"`
}

// TestRunner runs API tests
type TestRunner struct {
	config     TestConfig
	logger     *logrus.Logger
	client     *http.Client
	openAPIDoc *openapi3.T
	authToken  string
	mu         sync.RWMutex
}

// NewTestRunner creates a new test runner
func NewTestRunner(config TestConfig) (*TestRunner, error) {
	// Initialize logger
	logger := logrus.New()
	if config.VerboseOutput {
		logger.SetLevel(logrus.DebugLevel)
	}

	// Create HTTP client
	client := &http.Client{
		Timeout: config.TestTimeout,
	}

	// Load OpenAPI specification
	doc, err := openapi3.NewLoader().LoadFromFile(config.OpenAPIPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load OpenAPI spec: %w", err)
	}

	runner := &TestRunner{
		config:     config,
		logger:     logger,
		client:     client,
		openAPIDoc: doc,
	}

	return runner, nil
}

// RunTests runs all API tests
func (tr *TestRunner) RunTests(ctx context.Context) (*TestSuite, error) {
	suite := &TestSuite{
		Name:      "SDLC.ai API Tests",
		Version:   tr.config.APIVersion,
		StartedAt: time.Now(),
		Config:    tr.config,
		Results:   make([]TestResult, 0),
	}

	// Authenticate if credentials provided
	if tr.config.AuthCreds.Type != "" {
		if err := tr.authenticate(ctx); err != nil {
			return nil, fmt.Errorf("authentication failed: %w", err)
		}
	}

	// Collect test cases
	testCases := tr.collectTestCases()
	tr.logger.Infof("Found %d test cases", len(testCases))

	// Run tests with concurrency control
	sem := make(chan struct{}, tr.config.MaxConcurrency)
	var wg sync.WaitGroup

	for _, tc := range testCases {
		wg.Add(1)
		go func(testCase TestCase) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			result := tr.runSingleTest(ctx, testCase)
			suite.Results = append(suite.Results, result)
		}(tc)
	}

	wg.Wait()

	// Update summary
	suite.CompletedAt = time.Now()
	suite.Duration = suite.CompletedAt.Sub(suite.StartedAt)
	suite.Summary = tr.calculateSummary(suite.Results)

	// Output results
	if err := tr.outputResults(suite); err != nil {
		tr.logger.Errorf("Failed to output results: %v", err)
	}

	return suite, nil
}

// TestCase represents a single test case
type TestCase struct {
	Name           string
	Method         string
	Path           string
	OperationID    string
	Tags           []string
	ExpectedStatus int
	RequestData    map[string]interface{}
	ResponseTests  []ValidationTest
}

// ValidationTest represents a validation test
type ValidationTest struct {
	Type     string      `json:"type"` // status, header, schema, body
	Field    string      `json:"field"`
	Expected interface{} `json:"expected"`
	Message  string      `json:"message"`
}

// collectTestCases collects test cases from OpenAPI spec
func (tr *TestRunner) collectTestCases() []TestCase {
	var testCases []TestCase

	for path, pathItem := range tr.openAPIDoc.Paths.Map() {
		operations := map[string]*openapi3.Operation{
			"GET":     pathItem.Get,
			"POST":    pathItem.Post,
			"PUT":     pathItem.Put,
			"DELETE":  pathItem.Delete,
			"PATCH":   pathItem.Patch,
			"HEAD":    pathItem.Head,
			"OPTIONS": pathItem.Options,
		}

		for method, op := range operations {
			if op == nil {
				continue
			}

			// Check tags
			if !tr.shouldIncludeTest(op.Tags) {
				continue
			}

			// Check path
			if !tr.shouldIncludePath(path) {
				continue
			}

			// Create test case
			tc := TestCase{
				Name:           op.OperationID,
				Method:         method,
				Path:           path,
				OperationID:    op.OperationID,
				Tags:           op.Tags,
				ExpectedStatus: 200,
				RequestData:    make(map[string]interface{}),
				ResponseTests:  tr.createValidationTests(op),
			}

			// Generate test data
			tr.generateTestData(&tc, op)

			testCases = append(testCases, tc)
		}
	}

	return testCases
}

// runSingleTest runs a single test case
func (tr *TestRunner) runSingleTest(ctx context.Context, tc TestCase) TestResult {
	startTime := time.Now()

	result := TestResult{
		Name:           tc.Name,
		Method:         tc.Method,
		Path:           tc.Path,
		Tags:           tc.Tags,
		ExpectedStatus: tc.ExpectedStatus,
		Timestamp:      startTime,
		Request: RequestInfo{
			Headers:    make(map[string]string),
			Query:      make(map[string]string),
			PathParams: make(map[string]string),
		},
	}

	// Build request URL
	requestURL, err := tr.buildRequestURL(tc)
	if err != nil {
		result.Status = "error"
		result.Error = fmt.Sprintf("Failed to build request URL: %v", err)
		return result
	}

	// Prepare request body
	var body io.Reader
	if tc.Method != "GET" && tc.Method != "HEAD" && tc.RequestData != nil {
		bodyBytes, err := json.Marshal(tc.RequestData)
		if err != nil {
			result.Status = "error"
			result.Error = fmt.Sprintf("Failed to marshal request body: %v", err)
			return result
		}
		body = bytes.NewReader(bodyBytes)
		result.Request.Body = tc.RequestData
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, tc.Method, requestURL.String(), body)
	if err != nil {
		result.Status = "error"
		result.Error = fmt.Sprintf("Failed to create request: %v", err)
		return result
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "sdlc-api-test/1.0.0")

	// Add authentication
	if tr.authToken != "" {
		req.Header.Set("Authorization", "Bearer "+tr.authToken)
	}

	// Add custom headers
	for k, v := range result.Request.Headers {
		req.Header.Set(k, v)
	}

	// Add request ID
	req.Header.Set("X-Request-ID", fmt.Sprintf("test_%d", time.Now().UnixNano()))

	// Execute request with retries
	var resp *http.Response
	for attempt := 0; attempt <= tr.config.RetryAttempts; attempt++ {
		if attempt > 0 {
			time.Sleep(tr.config.RetryDelay)
			tr.logger.Debugf("Retrying test %s (attempt %d)", tc.Name, attempt)
		}

		resp, err = tr.client.Do(req)
		if err == nil {
			break
		}

		if attempt == tr.config.RetryAttempts {
			result.Status = "error"
			result.Error = fmt.Sprintf("Request failed after %d attempts: %v", tr.config.RetryAttempts+1, err)
			return result
		}
	}
	defer resp.Body.Close()

	// Read response body
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		result.Status = "error"
		result.Error = fmt.Sprintf("Failed to read response body: %v", err)
		return result
	}

	// Parse response JSON
	var respData interface{}
	if len(respBody) > 0 {
		if err := json.Unmarshal(respBody, &respData); err != nil {
			// Not JSON, store as string
			respData = string(respBody)
		}
	}

	// Populate response info
	result.StatusCode = resp.StatusCode
	result.Response = ResponseInfo{
		Headers:  make(map[string]string),
		Body:     respData,
		Size:     int64(len(respBody)),
		Duration: time.Since(startTime),
	}
	result.Duration = result.Response.Duration

	// Copy response headers
	for k, v := range resp.Header {
		if len(v) > 0 {
			result.Response.Headers[k] = v[0]
		}
	}

	// Validate response
	result.Validation = tr.validateResponse(tc, resp, respData)

	// Determine test status
	if resp.StatusCode == tc.ExpectedStatus {
		if len(result.Validation.Errors) == 0 {
			result.Status = "passed"
		} else {
			result.Status = "failed"
		}
	} else {
		result.Status = "failed"
		if result.Error == "" {
			result.Error = fmt.Sprintf("Expected status %d, got %d", tc.ExpectedStatus, resp.StatusCode)
		}
	}

	// Log result
	if tr.config.VerboseOutput || result.Status != "passed" {
		tr.logger.WithFields(logrus.Fields{
			"test":     tc.Name,
			"method":   tc.Method,
			"path":     tc.Path,
			"status":   result.Status,
			"code":     resp.StatusCode,
			"duration": result.Duration.Milliseconds(),
		}).Info("Test completed")
	}

	return result
}

// authenticate performs authentication
func (tr *TestRunner) authenticate(ctx context.Context) error {
	switch tr.config.AuthCreds.Type {
	case "basic":
		return tr.authenticateBasic(ctx)
	case "bearer":
		tr.authToken = tr.config.AuthCreds.Token
		return nil
	case "apikey":
		return tr.authenticateAPIKey(ctx)
	case "oauth2":
		return tr.authenticateOAuth2(ctx)
	default:
		return fmt.Errorf("unsupported auth type: %s", tr.config.AuthCreds.Type)
	}
}

// authenticateBasic performs basic authentication
func (tr *TestRunner) authenticateBasic(ctx context.Context) error {
	// Basic auth would be handled per request
	return nil
}

// authenticateAPIKey performs API key authentication
func (tr *TestRunner) authenticateAPIKey(ctx context.Context) error {
	// API key would be handled per request
	return nil
}

// authenticateOAuth2 performs OAuth2 authentication
func (tr *TestRunner) authenticateOAuth2(ctx context.Context) error {
	// Implement OAuth2 flow
	return nil
}

// Helper methods

func (tr *TestRunner) shouldIncludeTest(tags []string) bool {
	if len(tr.config.IncludeTags) > 0 {
		for _, include := range tr.config.IncludeTags {
			for _, tag := range tags {
				if tag == include {
					return true
				}
			}
		}
		return false
	}

	for _, exclude := range tr.config.ExcludeTags {
		for _, tag := range tags {
			if tag == exclude {
				return false
			}
		}
	}

	return true
}

func (tr *TestRunner) shouldIncludePath(path string) bool {
	if len(tr.config.IncludePaths) > 0 {
		for _, include := range tr.config.IncludePaths {
			if strings.Contains(path, include) {
				return true
			}
		}
		return false
	}

	for _, exclude := range tr.config.ExcludePaths {
		if strings.Contains(path, exclude) {
			return false
		}
	}

	return true
}

func (tr *TestRunner) buildRequestURL(tc TestCase) (*url.URL, error) {
	baseURL, err := url.Parse(tr.config.BaseURL)
	if err != nil {
		return nil, err
	}

	path := tc.Path

	// Replace path parameters with test data
	for param, value := range tr.config.TestData {
		placeholder := fmt.Sprintf("{%s}", param)
		if strings.Contains(path, placeholder) {
			if strValue, ok := value.(string); ok {
				path = strings.ReplaceAll(path, placeholder, strValue)
			}
		}
	}

	// Parse full URL
	fullURL, err := url.Parse(baseURL.String() + path)
	if err != nil {
		return nil, err
	}

	return fullURL, nil
}

func (tr *TestRunner) generateTestData(tc *TestCase, op *openapi3.Operation) {
	// Generate test data based on OpenAPI schema
	if op.RequestBody != nil {
		for mediaType, media := range op.RequestBody.Value.Content {
			if mediaType == "application/json" && media.Schema != nil {
				tc.RequestData = tr.generateExampleData(media.Schema.Value)
				break
			}
		}
	}

	// Set expected status based on operation
	if tc.ExpectedStatus == 200 {
		switch tc.Method {
		case "POST":
			tc.ExpectedStatus = 201
		case "DELETE":
			tc.ExpectedStatus = 204
		}
	}
}

func (tr *TestRunner) generateExampleData(schema *openapi3.Schema) map[string]interface{} {
	data := make(map[string]interface{})

	for propName, propSchema := range schema.Properties {
		if propSchema.Value != nil {
			data[propName] = tr.generateValueForSchema(propSchema.Value)
		}
	}

	return data
}

func (tr *TestRunner) generateValueForSchema(schema *openapi3.Schema) interface{} {
	if schema.Type == nil {
		return nil
	}
	schemaType := schema.Type.Slice()
	if len(schemaType) == 0 {
		return nil
	}
	switch schemaType[0] {
	case "string":
		if schema.Example != nil {
			return schema.Example
		}
		if schema.Format == "email" {
			return "test@example.com"
		}
		if schema.Format == "uuid" {
			return "123e4567-e89b-12d3-a456-426614174000"
		}
		if schema.Format == "date-time" {
			return time.Now().Format(time.RFC3339)
		}
		return "test_string"
	case "integer":
		if schema.Example != nil {
			return schema.Example
		}
		return 123
	case "number":
		if schema.Example != nil {
			return schema.Example
		}
		return 123.45
	case "boolean":
		if schema.Example != nil {
			return schema.Example
		}
		return true
	case "array":
		return []interface{}{}
	case "object":
		return make(map[string]interface{})
	default:
		return nil
	}
}

func (tr *TestRunner) createValidationTests(op *openapi3.Operation) []ValidationTest {
	var tests []ValidationTest

	// Status code validation
	tests = append(tests, ValidationTest{
		Type:     "status",
		Expected: 200,
		Message:  "Response status code should be 200",
	})

	// Content-Type validation
	tests = append(tests, ValidationTest{
		Type:     "header",
		Field:    "Content-Type",
		Expected: "application/json",
		Message:  "Response should be JSON",
	})

	return tests
}

func (tr *TestRunner) validateResponse(tc TestCase, resp *http.Response, body interface{}) ValidationResult {
	validation := ValidationResult{
		OpenAPIValid: true,
		SchemaValid:  true,
		HeadersValid: true,
		Errors:       []string{},
		Warnings:     []string{},
	}

	// Validate status code
	if resp.StatusCode != tc.ExpectedStatus {
		validation.Errors = append(validation.Errors,
			fmt.Sprintf("Expected status %d, got %d", tc.ExpectedStatus, resp.StatusCode))
	}

	// Validate headers
	for _, test := range tc.ResponseTests {
		if test.Type == "header" {
			if value := resp.Header.Get(test.Field); value != test.Expected.(string) {
				validation.HeadersValid = false
				validation.Errors = append(validation.Errors,
					fmt.Sprintf("Header %s: expected %s, got %s", test.Field, test.Expected, value))
			}
		}
	}

	// Validate response body schema if OpenAPI response is defined
	// This would require more complex OpenAPI validation logic

	return validation
}

func (tr *TestRunner) calculateSummary(results []TestResult) TestSummary {
	summary := TestSummary{
		Total: len(results),
	}

	var totalDuration time.Duration
	var totalResponseTime time.Duration

	for _, result := range results {
		switch result.Status {
		case "passed":
			summary.Passed++
		case "failed":
			summary.Failed++
		case "skipped":
			summary.Skipped++
		case "error":
			summary.Errors++
		}

		totalDuration += result.Duration
		totalResponseTime += result.Response.Duration
	}

	if summary.Total > 0 {
		summary.SuccessRate = float64(summary.Passed) / float64(summary.Total) * 100
		summary.AvgResponseTime = totalResponseTime / time.Duration(summary.Total)
	}

	return summary
}

func (tr *TestRunner) outputResults(suite *TestSuite) error {
	// Create output directory if needed
	if tr.config.OutputFile != "" {
		dir := filepath.Dir(tr.config.OutputFile)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create output directory: %w", err)
		}
	}

	// Output based on format
	switch tr.config.OutputFormat {
	case "json":
		return tr.outputJSON(suite)
	case "yaml":
		return tr.outputYAML(suite)
	case "junit":
		return tr.outputJUnit(suite)
	case "html":
		return tr.outputHTML(suite)
	default:
		return tr.outputJSON(suite)
	}
}

func (tr *TestRunner) outputJSON(suite *TestSuite) error {
	data, err := json.MarshalIndent(suite, "", "  ")
	if err != nil {
		return err
	}

	if tr.config.OutputFile != "" {
		return os.WriteFile(tr.config.OutputFile, data, 0644)
	}

	fmt.Println(string(data))
	return nil
}

func (tr *TestRunner) outputYAML(suite *TestSuite) error {
	data, err := yaml.Marshal(suite)
	if err != nil {
		return err
	}

	if tr.config.OutputFile != "" {
		return os.WriteFile(tr.config.OutputFile, data, 0644)
	}

	fmt.Println(string(data))
	return nil
}

func (tr *TestRunner) outputJUnit(suite *TestSuite) error {
	// JUnit XML output implementation
	return nil
}

func (tr *TestRunner) outputHTML(suite *TestSuite) error {
	// HTML report implementation
	return nil
}

// CLI command
func NewTestCommand() *cobra.Command {
	var configFile string

	cmd := &cobra.Command{
		Use:   "test",
		Short: "Run API tests",
		Long:  "Run comprehensive API tests based on OpenAPI specification",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Load configuration
			config := TestConfig{
				BaseURL:        "http://localhost:8080/v1",
				APIVersion:     "v1",
				OpenAPIPath:    "./api/openapi.yaml",
				TestTimeout:    30 * time.Second,
				MaxConcurrency: 10,
				RetryAttempts:  3,
				RetryDelay:     1 * time.Second,
				OutputFormat:   "json",
				VerboseOutput:  false,
			}

			if configFile != "" {
				data, err := os.ReadFile(configFile)
				if err != nil {
					return fmt.Errorf("failed to read config file: %w", err)
				}

				if err := yaml.Unmarshal(data, &config); err != nil {
					return fmt.Errorf("failed to parse config file: %w", err)
				}
			}

			// Create test runner
			runner, err := NewTestRunner(config)
			if err != nil {
				return fmt.Errorf("failed to create test runner: %w", err)
			}

			// Run tests
			ctx := context.Background()
			suite, err := runner.RunTests(ctx)
			if err != nil {
				return fmt.Errorf("test execution failed: %w", err)
			}

			// Print summary
			fmt.Printf("\nTest Summary:\n")
			fmt.Printf("=============\n")
			fmt.Printf("Total:     %d\n", suite.Summary.Total)
			fmt.Printf("Passed:    %d\n", suite.Summary.Passed)
			fmt.Printf("Failed:    %d\n", suite.Summary.Failed)
			fmt.Printf("Skipped:   %d\n", suite.Summary.Skipped)
			fmt.Printf("Errors:    %d\n", suite.Summary.Errors)
			fmt.Printf("Success:   %.2f%%\n", suite.Summary.SuccessRate)
			fmt.Printf("Duration:  %v\n", suite.Duration)
			fmt.Printf("Avg Time:  %v\n", suite.Summary.AvgResponseTime)

			// Exit with error code if tests failed
			if suite.Summary.Failed > 0 || suite.Summary.Errors > 0 {
				return fmt.Errorf("%d tests failed", suite.Summary.Failed+suite.Summary.Errors)
			}

			return nil
		},
	}

	cmd.Flags().StringVarP(&configFile, "config", "c", "", "Configuration file path")

	return cmd
}
