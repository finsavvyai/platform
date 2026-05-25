# QuantumBeam Integration Tests

This directory contains comprehensive integration tests for the QuantumBeam fraud detection platform. The test suite validates end-to-end functionality, performance, security, and reliability of the entire system.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running Tests](#running-tests)
- [Test Suites](#test-suites)
- [Test Reports](#test-reports)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

The integration test suite covers:

- **Authentication & Authorization**: User registration, login, token validation, API key management
- **Fraud Detection**: Transaction analysis, AI-enhanced detection, quantum analysis, fraud rules
- **API Management**: API key creation, permissions, rate limiting, revocation
- **Performance**: Load testing, stress testing, response times, memory usage
- **Error Handling**: Validation errors, authentication errors, service failures
- **Security**: Input validation, SQL injection prevention, XSS protection
- **Database**: Migration testing, data consistency, transaction handling

## ✅ Prerequisites

- **Go 1.21+**: Required for running tests
- **PostgreSQL**: Test database (default: `quantumbeam_test`)
- **Docker** (optional): For running test dependencies
- **Make**: For using the Makefile commands

### Database Setup

Create a test database:

```sql
CREATE DATABASE quantumbeam_test;
CREATE USER postgres WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE quantumbeam_test TO postgres;
```

## 🚀 Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd quantumbeam.io/tests/integration
   ```

2. **Install dependencies**:
   ```bash
   make setup
   ```

3. **Start test dependencies**:
   ```bash
   make start-deps
   ```

## ⚙️ Configuration

Edit `test_config.yaml` to customize test settings:

```yaml
# Database Configuration
database:
  host: "localhost"
  port: 5432
  user: "postgres"
  password: "password"
  dbname: "quantumbeam_test"

# Test Configuration
test:
  timeout: "30m"
  cleanup_after: true
  parallel_tests: false
  skip_database_tests: false
  skip_performance_tests: false
```

### Environment Variables

Override configuration with environment variables:

```bash
export DATABASE_URL="postgres://user:pass@host:5432/dbname"
export TEST_TIMEOUT="60m"
export SKIP_PERFORMANCE="true"
```

## 🏃 Running Tests

### Using Make (Recommended)

```bash
# Run all tests
make test-all

# Run only integration tests
make test-integration

# Run performance tests
make test-performance

# Run security tests
make test-security

# Quick tests (skip performance/heavy tests)
make test-quick

# Run tests with coverage
make test-coverage

# Run tests in CI mode
make test-ci
```

### Using Go directly

```bash
# Run all integration tests
go test -v -tags=integration ./tests/integration/...

# Run specific test suite
go test -v -tags=integration -run TestAuthentication ./tests/integration/...

# Run with timeout
go test -v -timeout 30m -tags=integration ./tests/integration/...

# Run with coverage
go test -v -coverprofile=coverage.out -tags=integration ./tests/integration/...
```

### Command Line Options

```bash
# Custom configuration file
go test -config=custom_config.yaml ./tests/integration/...

# Skip database tests
go test -skip-db=true ./tests/integration/...

# Skip performance tests
go test -skip-perf=true ./tests/integration/...

# Enable verbose output
go test -verbose=true ./tests/integration/...

# Set custom timeout
go test -timeout=60m ./tests/integration/...
```

## 🧪 Test Suites

### Authentication Tests (`auth_test.go`)

Tests user authentication and authorization:

- User registration and validation
- Login and token generation
- Token validation and refresh
- Password reset flow
- Rate limiting on auth endpoints
- Account management (profile updates, deletion)

### Fraud Detection Tests (`fraud_detection_test.go`)

Tests fraud detection and analysis:

- Transaction analysis (basic, AI-enhanced, quantum)
- Fraud rules management
- Fraud alerts and resolution
- Risk scoring
- Batch transaction analysis
- Performance under high volume

### API Management Tests (`api_management_test.go`)

Tests API key management and permissions:

- API key creation and management
- Permission validation
- Rate limiting per API key
- Admin functionality
- Audit logging

### Performance Tests (`performance_test.go`)

Tests system performance:

- API response times
- Concurrent request handling
- High-volume fraud analysis
- Memory usage patterns
- Database performance
- Load and stress testing

### Error Handling Tests (`error_handling_test.go`)

Tests error scenarios and resilience:

- HTTP error responses
- Validation errors
- Authentication/authorization errors
- Rate limiting errors
- Database constraint violations
- Service unavailability scenarios

## 📊 Test Reports

After running tests, reports are generated in `test_results/`:

- **JSON Report**: `integration_report.json` - Machine-readable results
- **HTML Report**: `integration_report.html` - Human-readable summary
- **Coverage Report**: `coverage.html` - Code coverage visualization
- **JUnit Report**: `junit.xml` - CI/CD integration

### Report Contents

- Test execution summary
- Pass/fail statistics
- Performance metrics
- Error details and logs
- Coverage percentages
- Historical comparisons

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
name: Integration Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: password
          POSTGRES_DB: quantumbeam_test
        ports:
          - 5432:5432

    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-go@v3
      with:
        go-version: '1.21'

    - name: Run integration tests
      run: |
        cd tests/integration
        make test-ci

    - name: Upload test results
      uses: actions/upload-artifact@v3
      with:
        name: test-results
        path: tests/integration/test_results/
```

### Docker Integration

```bash
# Build test image
make build-test-image

# Run tests in Docker
make test-docker
```

### Custom Scripts

```bash
#!/bin/bash
# custom-test-runner.sh

set -e

echo "Setting up test environment..."
make setup

echo "Starting dependencies..."
make start-deps

echo "Running tests..."
make test-all

echo "Generating reports..."
make generate-reports

echo "Cleaning up..."
make stop-deps

echo "Test pipeline completed!"
```

## 🔧 Test Configuration

### Performance Test Settings

```yaml
performance:
  concurrent_requests: 50
  requests_per_second: 100
  test_duration: "30s"
  memory_limit_mb: 512
  response_time_threshold_ms: 500
```

### Error Scenarios

```yaml
error_scenarios:
  - name: "invalid_authentication"
    endpoint: "/protected"
    method: "GET"
    expected_status: 401

  - name: "rate_limit_exceeded"
    endpoint: "/api/endpoint"
    method: "GET"
    rapid_requests: 100
    expected_status: 429
```

### Test Data

```yaml
test_data:
  users:
    - username: "testuser"
      email: "test@example.com"
      password: "testpassword123"

  transactions:
    - amount: 100.00
      currency: "USD"
      risk_level: "low"
```

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Check PostgreSQL is running
   pg_isready -h localhost -p 5432

   # Test connection
   psql -h localhost -p 5432 -U postgres -d quantumbeam_test
   ```

2. **Test Timeout Errors**
   ```bash
   # Increase timeout
   make test-all TEST_TIMEOUT=60m

   # Skip performance tests
   make test-all SKIP_PERFORMANCE=true
   ```

3. **Port Conflicts**
   ```bash
   # Change test server port
   make test-all SERVER_PORT=8082
   ```

4. **Memory Issues**
   ```bash
   # Run with smaller concurrent load
   go test -parallel=1 ./tests/integration/...

   # Increase memory limits
   export GOMEMLIMIT=1GiB
   ```

### Debug Mode

Enable verbose logging and debugging:

```bash
# Verbose output
make test-all TEST_VERBOSE=true

# Debug logging
export LOG_LEVEL=debug
make test-all

# Race detection
make test-race
```

### Test Database Issues

Reset test database:

```bash
# Drop and recreate test database
dropdb quantumbeam_test
createdb quantumbeam_test

# Run migrations
make test-migrations
```

### Performance Test Failures

If performance tests fail:

1. Check system resources:
   ```bash
   top -p $(pgrep -f "test")
   ```

2. Reduce load:
   ```bash
   make test-performance CONCURRENT_REQUESTS=10
   ```

3. Skip performance tests:
   ```bash
   make test-all SKIP_PERFORMANCE=true
   ```

## 📝 Writing New Tests

### Test Structure

```go
func (suite *IntegrationTestSuite) TestNewFeature() {
    suite.Run("Test Case 1", func() {
        // Setup
        testData := map[string]interface{}{...}

        // Execute
        w := suite.makeRequest("POST", "/endpoint", testData, headers)

        // Assert
        assert.Equal(suite.T(), http.StatusOK, w.Code)

        var response map[string]interface{}
        err := json.Unmarshal(w.Body.Bytes(), &response)
        require.NoError(suite.T(), err)

        // Additional assertions...
    })
}
```

### Best Practices

1. **Use test helpers**: `suite.makeRequest()`, `suite.authenticateUser()`
2. **Clean up after tests**: Use `SetupTest()` and `TearDownTest()`
3. **Assert on response structure**: Verify status codes and response format
4. **Test error cases**: Verify proper error handling and status codes
5. **Use table-driven tests**: For multiple similar test cases
6. **Mock external services**: Use configuration to enable mock mode
7. **Parallelize when safe**: Use `t.Parallel()` for independent tests

### Adding New Test Suites

1. Create new test file: `new_feature_test.go`
2. Add test methods to `IntegrationTestSuite`
3. Update `Makefile` with new targets if needed
4. Add configuration options to `test_config.yaml`
5. Update documentation

## 📚 Additional Resources

- [Go Testing Documentation](https://golang.org/pkg/testing/)
- [Testify Suite Documentation](https://pkg.go.dev/github.com/stretchr/testify/suite)
- [Gin Testing Guide](https://gin-gonic.com/docs/examples/testing)
- [Docker Compose for Testing](https://docs.docker.com/compose/)

## 🤝 Contributing

When contributing to the integration tests:

1. Write tests for new features
2. Ensure all tests pass locally
3. Update documentation
4. Add configuration options as needed
5. Consider performance implications
6. Test on different environments

## 📞 Support

For questions or issues with the integration tests:

1. Check this README for common solutions
2. Review test logs in `test_results/`
3. Enable verbose logging for debugging
4. Check GitHub Issues for known problems
5. Create a new issue with detailed information

---

**Note**: Integration tests require a properly configured test environment. Ensure all prerequisites are met before running tests.