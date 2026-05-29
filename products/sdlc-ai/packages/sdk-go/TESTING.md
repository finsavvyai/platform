# Go SDK Testing Framework

This document provides a comprehensive overview of the testing framework for the SDLC Go SDK.

## Overview

The testing framework is designed to ensure reliability, security, and performance across all SDK components. It includes unit tests, integration tests, benchmarks, and specialized testing for security and concurrency.

## Test Structure

### Core Components

```
pkg/
├── sdln/
│   ├── testing_test.go          # Core testing infrastructure
│   ├── vector_service_test.go   # Vector service tests
│   ├── policies_service_test.go # Policies service tests
│   ├── llm_service_test.go      # LLM service tests
│   ├── monitoring_service_test.go # Monitoring service tests
│   ├── websocket_service_test.go  # WebSocket service tests
│   ├── http_wrappers_test.go    # HTTP wrapper tests
│   ├── crypto_test.go           # Cryptographic utility tests
│   ├── validation_test.go       # Validation utility tests
│   └── integration_test.go      # Integration scenario tests
├── auth/
│   └── auth_test.go             # Authentication handler tests
├── middleware/
│   └── middleware_test.go       # Middleware system tests
└── retry/
    └── retry_test.go            # Retry mechanism tests
```

### Test Categories

#### 1. Unit Tests
- **Purpose**: Test individual components in isolation
- **Coverage**: All public interfaces and internal logic
- **Features**: Mock infrastructure, error simulation, edge cases

#### 2. Integration Tests
- **Purpose**: Test component interactions and end-to-end workflows
- **Coverage**: Complete user scenarios and service interactions
- **Features**: Real-world usage patterns, multi-service workflows

#### 3. Performance Tests
- **Purpose**: Validate performance characteristics and identify bottlenecks
- **Coverage**: API response times, memory usage, concurrent operations
- **Features**: Benchmarking, profiling, load testing

#### 4. Security Tests
- **Purpose**: Validate security features and identify vulnerabilities
- **Coverage**: Authentication, encryption, input validation, access control
- **Features**: Cryptographic validation, security property testing

#### 5. Concurrency Tests
- **Purpose**: Ensure thread safety and identify race conditions
- **Coverage**: Concurrent API calls, shared resource access
- **Features**: Race detection, deadlock prevention, atomic operations

## Testing Infrastructure

### Mock Framework

The testing framework includes a comprehensive mock infrastructure:

```go
// Mock HTTP client for API testing
type MockHTTPClient struct {
    responses map[string]*HTTPResponse
    errors    map[string]error
    requests  []*HTTPRequest
    mutex     sync.Mutex
}

// Mock server for integration testing
type MockServer struct {
    server   *httptest.Server
    handler  http.Handler
    requests []*HTTPRequest
}
```

### Test Utilities

Common test utilities include:
- **Response builders**: Create mock API responses
- **Request validators**: Verify HTTP requests
- **Error simulators**: Simulate various error conditions
- **Data generators**: Generate test data and fixtures

### Assertion Helpers

Custom assertion functions for common test scenarios:
- **API response validation**: Verify HTTP responses
- **Error type checking**: Validate error types and messages
- **Data integrity checks**: Ensure data consistency
- **Performance assertions**: Validate timing and resource usage

## Running Tests

### Quick Start

```bash
# Run all tests
./scripts/test_runner.sh

# Run specific package tests
go test ./pkg/sdln -v

# Run tests with coverage
go test -cover ./pkg/sdln

# Run benchmarks
go test -bench=. ./pkg/sdln

# Run race condition tests
go test -race ./pkg/sdln
```

### Test Runner Script

The `scripts/test_runner.sh` script provides comprehensive testing:

```bash
./scripts/test_runner.sh
```

This script performs:
1. **Unit tests** for all packages
2. **Coverage analysis** with HTML reports
3. **Benchmark testing** with performance metrics
4. **Race condition detection**
5. **Memory profiling**
6. **Integration testing**
7. **Build validation**
8. **Code quality checks**

### Coverage Reports

Generate detailed coverage reports:

```bash
# Generate coverage profile
go test -coverprofile=coverage.out ./pkg/sdln

# View coverage in terminal
go tool cover -func=coverage.out

# Generate HTML report
go tool cover -html=coverage.out -o coverage.html
```

## Test Scenarios

### Vector Service Tests

**Coverage:**
- Similarity search operations
- Vector indexing and management
- Mathematical operations
- Bulk operations
- Error handling and validation

**Key Test Cases:**
```go
func TestVectorService_SimilaritySearch(t *testing.T)
func TestVectorService_IndexVectors(t *testing.T)
func TestVectorService_DeleteVectors(t *testing.T)
func TestVectorService_BulkOperations(t *testing.T)
```

### Policies Service Tests

**Coverage:**
- Policy creation and management
- Policy evaluation engine
- Template-based policy creation
- Batch operations
- Rule validation

**Key Test Cases:**
```go
func TestPoliciesService_CreatePolicy(t *testing.T)
func TestPoliciesService_EvaluatePolicy(t *testing.T)
func TestPoliciesService_CreateFromTemplate(t *testing.T)
func TestPoliciesService_BatchEvaluate(t *testing.T)
```

### LLM Service Tests

**Coverage:**
- Chat completions
- Embedding generation
- Fine-tuning operations
- Streaming responses
- Error handling

**Key Test Cases:**
```go
func TestLLMService_CreateChatCompletion(t *testing.T)
func TestLLMService_GenerateEmbeddings(t *testing.T)
func TestLLMService_CreateFineTuningJob(t *testing.T)
func TestLLMService_StreamChatCompletion(t *testing.T)
```

### Monitoring Service Tests

**Coverage:**
- Metrics collection and querying
- Alert management
- Health checks
- Dashboard data
- Log querying

**Key Test Cases:**
```go
func TestMonitoringService_RecordMetric(t *testing.T)
func TestMonitoringService_QueryMetrics(t *testing.T)
func TestMonitoringService_CreateAlert(t *testing.T)
func TestMonitoringService_HealthCheck(t *testing.T)
```

### WebSocket Service Tests

**Coverage:**
- Connection management
- Message sending and receiving
- Channel subscriptions
- Broadcasting
- Connection lifecycle

**Key Test Cases:**
```go
func TestWebSocketService_Connect(t *testing.T)
func TestWebSocketService_SendMessage(t *testing.T)
func TestWebSocketService_Subscribe(t *testing.T)
func TestWebSocketService_Broadcast(t *testing.T)
```

### Integration Tests

**Coverage:**
- End-to-end workflows
- Service interactions
- Authentication flows
- Error propagation
- Performance validation

**Key Test Cases:**
```go
func TestClientIntegration(t *testing.T)
func TestMiddlewareIntegration(t *testing.T)
func TestRetryIntegration(t *testing.T)
func TestAuthenticationIntegration(t *testing.T)
func TestConcurrencyIntegration(t *testing.T)
```

## Performance Testing

### Benchmark Tests

Performance is validated through comprehensive benchmarks:

```go
func BenchmarkVectorService_SimilaritySearch(b *testing.B)
func BenchmarkPoliciesService_Evaluate(b *testing.B)
func BenchmarkLLMService_ChatCompletion(b *testing.B)
func BenchmarkMonitoringService_RecordMetric(b *testing.B)
```

### Memory Profiling

Memory usage is monitored and optimized:

```bash
# Run with memory profiling
go test -memprofile=mem.prof ./pkg/sdln

# Analyze memory profile
go tool pprof mem.prof
```

### CPU Profiling

CPU performance is analyzed for optimization:

```bash
# Run with CPU profiling
go test -cpuprofile=cpu.prof ./pkg/sdln

# Analyze CPU profile
go tool pprof cpu.prof
```

## Security Testing

### Cryptographic Validation

Security features are thoroughly tested:

```go
func TestCrypto_EncryptDecrypt(t *testing.T)
func TestCrypto_PasswordHashing(t *testing.T)
func TestCrypto_KeyGeneration(t *testing.T)
func TestCrypto_SecurityProperties(t *testing.T)
```

### Authentication Testing

Authentication mechanisms are validated:

```go
func TestAuth_APIKeyAuthentication(t *testing.T)
func TestAuth_JWTAuthentication(t *testing.T)
func TestAuth_OAuthAuthentication(t *testing.T)
func TestAuth_MTLSAuthentication(t *testing.T)
```

### Input Validation

Input validation prevents security vulnerabilities:

```go
func TestValidation_SQLInjectionPrevention(t *testing.T)
func TestValidation_XSSPrevention(t *testing.T)
func TestValidation_InputSanitization(t *testing.T)
```

## Continuous Integration

### CI/CD Pipeline

The testing framework is designed for CI/CD integration:

```yaml
# Example GitHub Actions workflow
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-go@v2
        with:
          go-version: 1.21
      - run: ./scripts/test_runner.sh
```

### Coverage Requirements

Maintain high code coverage:
- **Target**: 90%+ coverage across all packages
- **Critical paths**: 100% coverage for security-sensitive code
- **Integration paths**: 95% coverage for public APIs

### Performance Benchmarks

Establish performance baselines:
- **API response times**: < 100ms for 95th percentile
- **Memory usage**: < 50MB for typical operations
- **Concurrent operations**: Support 1000+ concurrent requests

## Best Practices

### Test Organization

1. **Package structure**: Keep tests close to implementation
2. **Naming conventions**: Use descriptive test function names
3. **Test data**: Use table-driven tests for multiple scenarios
4. **Documentation**: Add comments for complex test logic

### Mock Usage

1. **Interface-based design**: Use interfaces for testability
2. **Realistic mocks**: Mock behavior should match real implementations
3. **Validation**: Verify mock interactions and expectations

### Error Testing

1. **Comprehensive coverage**: Test all error paths
2. **Error types**: Validate specific error types and messages
3. **Recovery scenarios**: Test error recovery and retry logic

### Performance Testing

1. **Baseline establishment**: Create performance baselines
2. **Regression detection**: Monitor performance over time
3. **Resource limits**: Test under various resource constraints

## Troubleshooting

### Common Issues

1. **Race conditions**: Use `-race` flag to detect
2. **Memory leaks**: Use memory profiling to identify
3. **Slow tests**: Use benchmarks to optimize
4. **Flaky tests**: Ensure deterministic test behavior

### Debugging Tools

1. **Verbose output**: Use `-v` flag for detailed test output
2. **Test filtering**: Use `-run` to execute specific tests
3. **Coverage analysis**: Use coverage tools to identify gaps
4. **Profiling**: Use profiling tools for performance issues

## Contributing

### Adding New Tests

1. **Follow patterns**: Use existing test patterns and conventions
2. **Mock appropriately**: Create mocks for external dependencies
3. **Cover edge cases**: Test error conditions and edge cases
4. **Document complex logic**: Add comments for test understanding

### Test Maintenance

1. **Keep tests updated**: Update tests when implementation changes
2. **Monitor coverage**: Maintain or improve test coverage
3. **Review performance**: Monitor benchmark performance
4. **Fix flaky tests**: Address test reliability issues

This comprehensive testing framework ensures the SDLC Go SDK meets high standards for reliability, security, and performance.