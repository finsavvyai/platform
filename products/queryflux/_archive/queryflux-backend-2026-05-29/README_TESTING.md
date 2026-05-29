# QueryFlux Backend - Testing Guide

## Test Coverage

```bash
go test ./... -cover
```

### Current Coverage (February 28, 2026)

| Package | Coverage | Status |
|---------|----------|--------|
| `internal/service` | **100%** | ✅ |
| `internal/adapter` | **90%+** | ✅ |
| `pkg/config` | **100%** | ✅ |
| **Overall** | **85%+** | ✅ |

## Running Tests

### All Tests
```bash
go test ./...
```

### With Verbose Output
```bash
go test ./... -v
```

### With Coverage
```bash
go test ./... -cover
```

### Coverage Report (HTML)
```bash
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

### Specific Package
```bash
go test ./internal/service/...
go test ./internal/adapter/...
go test ./pkg/config/...
go test ./tests/...  # Integration tests
```

## Test Structure

### Unit Tests

**Service Layer** (`internal/service/*_test.go`):
- Mock database port
- Test business logic
- 100% coverage of all use cases

**Config Layer** (`pkg/config/*_test.go`):
- Environment variable handling
- Validation logic
- Default values

**Adapter Layer** (`internal/adapter/*_test.go`):
- HTTP endpoint testing
- Request/response validation
- Error handling

### Integration Tests

**End-to-End** (`tests/integration_test.go`):
- Full request/response cycle
- Multiple components working together
- Realistic scenarios

## Test Cases Covered

### Query Service
- ✅ Successful query execution
- ✅ Dry run mode (validation only)
- ✅ Database errors
- ✅ Empty results
- ✅ Complex queries with joins

### Schema Service
- ✅ Schema introspection
- ✅ Multiple tables
- ✅ Indexes and constraints
- ✅ Empty databases
- ✅ Error handling

### HTTP API
- ✅ Health check endpoint
- ✅ Query execution endpoint
- ✅ Schema endpoint
- ✅ Invalid JSON handling
- ✅ Missing required fields
- ✅ CORS headers

### Configuration
- ✅ All environment variables
- ✅ Default values
- ✅ Missing required config
- ✅ Production vs development mode
- ✅ JWT secret validation

### Integration
- ✅ End-to-end query execution
- ✅ End-to-end schema introspection
- ✅ Dry run queries
- ✅ Health checks

## Writing New Tests

### Unit Test Template

```go
package mypackage

import "testing"

func TestMyFunction_Success(t *testing.T) {
    // Arrange
    input := "test input"
    expected := "expected output"

    // Act
    result := MyFunction(input)

    // Assert
    if result != expected {
        t.Errorf("Expected %q, got %q", expected, result)
    }
}
```

### Mock Template

```go
type mockDB struct {
    executeQueryFunc func(query string) (*domain.QueryResponse, error)
}

func (m *mockDB) ExecuteQuery(ctx context.Context, query string) (*domain.QueryResponse, error) {
    if m.executeQueryFunc != nil {
        return m.executeQueryFunc(query)
    }
    return nil, nil
}
```

## Continuous Integration

Tests run automatically on:
- Every commit
- Pull requests
- Pre-deployment

Required:
- All tests must pass
- Coverage must be >= 80%
- No race conditions

## Performance Benchmarks

```bash
go test -bench=. -benchmem
```

## Test Data

- Mock data in test files
- No external dependencies
- Isolated test environments

## Best Practices

1. **One assertion per test** - Keep tests focused
2. **Descriptive names** - TestMyFunction_WhenCondition_ThenBehavior
3. **Arrange-Act-Assert** - Clear test structure
4. **No side effects** - Tests should not affect each other
5. **Fast execution** - All tests run in < 1 second

## Coverage Goals

- **Critical paths**: 100% (auth, data writes, security)
- **Business logic**: 100% (services)
- **Adapters**: 90%+
- **Overall**: 85%+

## Troubleshooting

### Tests Failing Locally

```bash
# Clear test cache
go clean -testcache

# Run specific test
go test -v -run TestMyFunction

# See full output
go test -v ./...
```

### Coverage Not Updating

```bash
# Remove old coverage file
rm coverage.out

# Regenerate
go test ./... -coverprofile=coverage.out
```

---

**Last Updated**: February 28, 2026
**Test Count**: 20+ tests
**Coverage**: 85%+
