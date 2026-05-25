package testing

import (
	"context"
	"database/sql"
	"reflect"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/golang/mock/gomock"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
	"go.uber.org/zap"
	"go.uber.org/zap/zaptest"
)

// Connection represents a test database connection
type Connection struct {
	ID        string
	Name      string
	Type      string
	Host      string
	Port      int
	Database  string
	Username  string
	Status    string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// User represents a test user
type User struct {
	ID        string
	Email     string
	Name      string
	Status    string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// PaginationParams represents pagination parameters
type PaginationParams struct {
	Page     int
	PageSize int
	OrderBy  string
	OrderDir string
}

// FilterParams represents filter parameters
type FilterParams struct {
	Status   string
	Search   string
	Tags     []string
	FromDate *time.Time
	ToDate   *time.Time
}

// TestSuite provides a base test suite with common utilities
type TestSuite struct {
	suite.Suite
	Ctx        context.Context
	Cancel     context.CancelFunc
	Logger     *zap.Logger
	MockCtrl   *gomock.Controller
	DB         *sql.DB
	DBMock     sqlmock.Sqlmock
	PgxPool    *pgxpool.Pool
}

// SetupSuite sets up the test suite
func (s *TestSuite) SetupSuite() {
	s.Ctx, s.Cancel = context.WithCancel(context.Background())
	s.Logger = zaptest.NewLogger(s.T())
	s.MockCtrl = gomock.NewController(s.T())
}

// TearDownSuite tears down the test suite
func (s *TestSuite) TearDownSuite() {
	s.Cancel()
	s.MockCtrl.Finish()
	if s.DB != nil {
		s.DB.Close()
	}
	if s.PgxPool != nil {
		s.PgxPool.Close()
	}
}

// SetupTest sets up each test
func (s *TestSuite) SetupTest() {
	// Reset context and mocks
	s.Ctx, s.Cancel = context.WithCancel(context.Background())
}

// TearDownTest tears down each test
func (s *TestSuite) TearDownTest() {
	s.Cancel()
}

// WithSQLDB creates a test with mocked SQL database
func (s *TestSuite) WithSQLDB() {
	db, mock, err := sqlmock.New()
	require.NoError(s.T(), err)
	s.DB = db
	s.DBMock = mock
}

// WithLogger returns a test logger
func (s *TestSuite) WithLogger() *zap.Logger {
	return zaptest.NewLogger(s.T())
}

// AssertEventually asserts that a condition eventually becomes true
func (s *TestSuite) AssertEventually(condition func() bool, timeout time.Duration, msg string) {
	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()
	timeoutChan := time.After(timeout)

	for {
		select {
		case <-timeoutChan:
			s.Fail(msg)
			return
		case <-ticker.C:
			if condition() {
				return
			}
		}
	}
}

// AssertEqualDeep asserts deep equality with helpful error messages
func (s *TestSuite) AssertEqualDeep(expected, actual interface{}) {
	if !reflect.DeepEqual(expected, actual) {
		s.T().Fatalf("Values not equal:\nExpected: %+v\nActual:   %+v", expected, actual)
	}
}

// AssertErrorType asserts that an error is of a specific type
func (s *TestSuite) AssertErrorType(err error, expectedType interface{}) {
	s.T().Errorf("Expected error type %v, got: %v", expectedType, err)
}

// AssertPanic asserts that a function panics
func (s *TestSuite) AssertPanic(fn func(), expectedPanic interface{}) {
	defer func() {
		if r := recover(); r != nil {
			if expectedPanic != nil {
				s.AssertEqualDeep(expectedPanic, r)
			}
		} else {
			s.T().Fatalf("Expected panic but function didn't panic")
		}
	}()
	fn()
}

// TestDataFactory creates test data
type TestDataFactory struct{}

// NewTestDataFactory creates a new test data factory
func NewTestDataFactory() *TestDataFactory {
	return &TestDataFactory{}
}

// CreateConnection creates a test connection
func (f *TestDataFactory) CreateConnection(overrides map[string]interface{}) Connection {
	conn := Connection{
		ID:        "test-connection-id",
		Name:      "Test Connection",
		Type:      "postgresql",
		Host:      "localhost",
		Port:      5432,
		Database:  "testdb",
		Username:  "testuser",
		Status:    "active",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Apply overrides
	for key, value := range overrides {
		v := reflect.ValueOf(&conn).Elem()
		field := v.FieldByName(key)
		if field.IsValid() && field.CanSet() {
			field.Set(reflect.ValueOf(value))
		}
	}

	return conn
}

// CreateUser creates a test user
func (f *TestDataFactory) CreateUser(overrides map[string]interface{}) User {
	user := User{
		ID:        "test-user-id",
		Email:     "test@example.com",
		Name:      "Test User",
		Status:    "active",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Apply overrides
	for key, value := range overrides {
		v := reflect.ValueOf(&user).Elem()
		field := v.FieldByName(key)
		if field.IsValid() && field.CanSet() {
			field.Set(reflect.ValueOf(value))
		}
	}

	return user
}

// CreatePagination creates test pagination params
func (f *TestDataFactory) CreatePagination(overrides map[string]interface{}) PaginationParams {
	pagination := PaginationParams{
		Page:     1,
		PageSize: 20,
		OrderBy:  "created_at",
		OrderDir: "desc",
	}

	// Apply overrides
	for key, value := range overrides {
		v := reflect.ValueOf(&pagination).Elem()
		field := v.FieldByName(key)
		if field.IsValid() && field.CanSet() {
			field.Set(reflect.ValueOf(value))
		}
	}

	return pagination
}

// CreateFilter creates test filter params
func (f *TestDataFactory) CreateFilter(overrides map[string]interface{}) FilterParams {
	filter := FilterParams{
		Status:   "active",
		Search:   "test",
		Tags:     []string{"test", "example"},
		FromDate: nil,
		ToDate:   nil,
	}

	// Apply overrides
	for key, value := range overrides {
		v := reflect.ValueOf(&filter).Elem()
		field := v.FieldByName(key)
		if field.IsValid() && field.CanSet() {
			if field.Type() == reflect.TypeOf([]string{}) {
				field.Set(reflect.ValueOf(value))
			} else {
				field.Set(reflect.ValueOf(value))
			}
		}
	}

	return filter
}

// IntegrationTestSuite provides utilities for integration tests
type IntegrationTestSuite struct {
	TestSuite
	TestContainers *TestContainers
}

// TestContainers manages test containers
type TestContainers struct {
	PostgreSQLContainer *PostgreSQLContainer
	RedisContainer      *RedisContainer
}

// PostgreSQLContainer manages PostgreSQL test container
type PostgreSQLContainer struct {
	Host     string
	Port     int
	Database string
	Username string
	Password string
}

// RedisContainer manages Redis test container
type RedisContainer struct {
	Host string
	Port int
}

// SetupIntegrationTest sets up integration test environment
func (s *IntegrationTestSuite) SetupIntegrationTest() {
	s.TestContainers = &TestContainers{
		PostgreSQLContainer: &PostgreSQLContainer{
			Host:     "localhost",
			Port:     5432,
			Database: "test_queryflux",
			Username: "test",
			Password: "test",
		},
		RedisContainer: &RedisContainer{
			Host: "localhost",
			Port: 6379,
		},
	}
}

// PropertyBasedTest provides property-based testing utilities
type PropertyBasedTest struct {
	T         *testing.T
	Generator RandomGenerator
}

// RandomGenerator generates random test data
type RandomGenerator struct {
	Seed int64
}

// NewRandomGenerator creates a new random generator
func NewRandomGenerator(seed int64) *RandomGenerator {
	return &RandomGenerator{Seed: seed}
}

// GenerateString generates a random string
func (g *RandomGenerator) GenerateString(minLength, maxLength int) string {
	// Implementation for random string generation
	return "random-string"
}

// GenerateInt generates a random integer
func (g *RandomGenerator) GenerateInt(min, max int) int {
	// Implementation for random int generation
	return min + (max-min)/2
}

// GenerateBool generates a random boolean
func (g *RandomGenerator) GenerateBool() bool {
	// Implementation for random bool generation
	return true
}

// TestReporter provides test reporting utilities
type TestReporter struct {
	Coverage      map[string]float64
	Performance   map[string]time.Duration
	Failures      []TestFailure
	Warnings      []TestWarning
}

// TestFailure represents a test failure
type TestFailure struct {
	TestName string
	Error    string
	Duration time.Duration
}

// TestWarning represents a test warning
type TestWarning struct {
	TestName string
	Message  string
}

// NewTestReporter creates a new test reporter
func NewTestReporter() *TestReporter {
	return &TestReporter{
		Coverage:    make(map[string]float64),
		Performance: make(map[string]time.Duration),
		Failures:    make([]TestFailure, 0),
		Warnings:    make([]TestWarning, 0),
	}
}

// RecordCoverage records test coverage
func (r *TestReporter) RecordCoverage(packageName string, coverage float64) {
	r.Coverage[packageName] = coverage
}

// RecordPerformance records test performance
func (r *TestReporter) RecordPerformance(testName string, duration time.Duration) {
	r.Performance[testName] = duration
}

// RecordFailure records a test failure
func (r *TestReporter) RecordFailure(testName, errorMsg string, duration time.Duration) {
	r.Failures = append(r.Failures, TestFailure{
		TestName: testName,
		Error:    errorMsg,
		Duration: duration,
	})
}

// RecordWarning records a test warning
func (r *TestReporter) RecordWarning(testName, message string) {
	r.Warnings = append(r.Warnings, TestWarning{
		TestName: testName,
		Message:  message,
	})
}

// GenerateReport generates a test report
func (r *TestReporter) GenerateReport() string {
	// Implementation for generating test report
	return "Test Report"
}

// BenchmarkSuite provides benchmark testing utilities
type BenchmarkSuite struct {
	suite.Suite
	Benchmarks map[string]BenchmarkResult
}

// BenchmarkResult represents benchmark results
type BenchmarkResult struct {
	Name         string
	Iterations   int
	NsPerOp      int64
	AllocsPerOp  int64
	BytesPerOp   int64
	MemoryMB     float64
}

// RunBenchmark runs a benchmark
func (s *BenchmarkSuite) RunBenchmark(name string, fn func(b *testing.B)) {
	result := testing.Benchmark(fn)

	s.Benchmarks[name] = BenchmarkResult{
		Name:        name,
		Iterations:  result.N,
		NsPerOp:     result.NsPerOp(),
		AllocsPerOp: result.AllocsPerOp(),
		BytesPerOp:  result.AllocedBytesPerOp(),
		MemoryMB:    float64(result.AllocedBytesPerOp()) / 1024 / 1024,
	}
}

// AssertPerformance asserts performance requirements
func (s *BenchmarkSuite) AssertPerformance(benchmarkName string, maxNsPerOp int64) {
	result, exists := s.Benchmarks[benchmarkName]
	require.True(s.T(), exists, "Benchmark %s not found", benchmarkName)

	if result.NsPerOp > maxNsPerOp {
		s.T().Fatalf("Performance requirement not met for %s: got %d ns/op, want < %d ns/op",
			benchmarkName, result.NsPerOp, maxNsPerOp)
	}
}

// CoverageReporter provides detailed coverage reporting
type CoverageReporter struct {
	Packages map[string]PackageCoverage
}

// PackageCoverage represents coverage for a package
type PackageCoverage struct {
	Name               string
	TotalLines         int
	CoveredLines       int
	CoveragePercentage float64
	Functions          map[string]FunctionCoverage
}

// FunctionCoverage represents coverage for a function
type FunctionCoverage struct {
	Name         string
	TotalLines   int
	CoveredLines int
	Covered      bool
}

// NewCoverageReporter creates a new coverage reporter
func NewCoverageReporter() *CoverageReporter {
	return &CoverageReporter{
		Packages: make(map[string]PackageCoverage),
	}
}

// GenerateCoverageReport generates coverage report
func (r *CoverageReporter) GenerateCoverageReport() string {
	// Implementation for generating coverage report
	return "Coverage Report"
}

// AssertMinimumCoverage asserts minimum coverage requirements
func (r *CoverageReporter) AssertMinimumCoverage(t *testing.T, packageName string, minCoverage float64) {
	pkg, exists := r.Packages[packageName]
	require.True(t, exists, "Package %s not found in coverage report", packageName)

	if pkg.CoveragePercentage < minCoverage {
		t.Fatalf("Coverage requirement not met for %s: got %.2f%%, want >= %.2f%%",
			packageName, pkg.CoveragePercentage, minCoverage)
	}
}

// Test Helpers

// AssertNoError asserts no error with helpful message
func AssertNoError(t *testing.T, err error) {
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
}

// AssertError asserts error with helpful message
func AssertError(t *testing.T, err error, expectedMsg string) {
	if err == nil {
		t.Fatal("Expected error but got nil")
	}
	if expectedMsg != "" && err.Error() != expectedMsg {
		t.Fatalf("Expected error message %q, got %q", expectedMsg, err.Error())
	}
}

// AssertEqual asserts equality with helpful message
func AssertEqual(t *testing.T, expected, actual interface{}) {
	if !assert.Equal(t, expected, actual) {
		t.Fatalf("Values not equal: expected %v, got %v", expected, actual)
	}
}

// AssertNotEqual asserts inequality with helpful message
func AssertNotEqual(t *testing.T, expected, actual interface{}) {
	if assert.Equal(t, expected, actual) {
		t.Fatalf("Values should not be equal: both are %v", expected)
	}
}

// AssertTrue asserts true with helpful message
func AssertTrue(t *testing.T, value bool) {
	if !value {
		t.Fatal("Expected true, got false")
	}
}

// AssertFalse asserts false with helpful message
func AssertFalse(t *testing.T, value bool) {
	if value {
		t.Fatal("Expected false, got true")
	}
}

// AssertNil asserts nil with helpful message
func AssertNil(t *testing.T, value interface{}) {
	if !assert.Nil(t, value) {
		t.Fatalf("Expected nil, got %v", value)
	}
}

// AssertNotNil asserts not nil with helpful message
func AssertNotNil(t *testing.T, value interface{}) {
	if assert.Nil(t, value) {
		t.Fatal("Expected not nil, got nil")
	}
}

// AssertContains asserts that a slice contains a value
func AssertContains(t *testing.T, slice interface{}, value interface{}) {
	if !assert.Contains(t, slice, value) {
		t.Fatalf("Expected slice %v to contain %v", slice, value)
	}
}

// AssertNotContains asserts that a slice does not contain a value
func AssertNotContains(t *testing.T, slice interface{}, value interface{}) {
	if assert.Contains(t, slice, value) {
		t.Fatalf("Expected slice %v not to contain %v", slice, value)
	}
}

// Test Utilities

// SetupTestDB sets up a test database
func SetupTestDB(t *testing.T) (*sql.DB, func()) {
	db, _, err := sqlmock.New()
	require.NoError(t, err)

	cleanup := func() {
		db.Close()
	}

	return db, cleanup
}

// SetupTestContext sets up a test context with timeout
func SetupTestContext(t *testing.T) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 30*time.Second)
}

// WaitForCondition waits for a condition to be true
func WaitForCondition(t *testing.T, condition func() bool, timeout time.Duration) {
	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()
	timeoutChan := time.After(timeout)

	for {
		select {
		case <-timeoutChan:
			t.Fatal("Condition not met within timeout")
		case <-ticker.C:
			if condition() {
				return
			}
		}
	}
}