# Tests

This directory contains comprehensive tests for the QueryFlux backend, covering all database adapters and core functionality.

## Structure

```
tests/
├── unit/                           # Unit tests
│   ├── domain/                    # Domain layer tests
│   │   └── entities/              # Entity validation tests
│   ├── infrastructure/            # Infrastructure layer tests
│   │   └── database/              # Database layer tests
│   │       └── adapters/          # Database adapter tests
│   │           ├── sql/           # SQL adapter tests
│   │           ├── nosql/         # NoSQL adapter tests
│   │           ├── cache/         # Cache adapter tests
│   │           ├── timeseries/    # Time-series adapter tests
│   │           ├── aws/           # AWS service adapter tests
│   │           └── factory_test.go # Adapter factory tests
│   └── services/                  # Service layer tests
├── integration/                   # Integration tests
│   └── database/                  # Database integration tests
├── mocks/                         # Mock implementations
│   └── infrastructure/
│       └── database/              # Database mocks
└── README.md                      # This file
```

## Supported Database Adapters Tests

### SQL Databases ✅
- **PostgreSQL** - Full unit and integration tests
- **MySQL** - Full unit and integration tests
- **MariaDB** - Unit tests (uses MySQL adapter)
- **SQLite** - Full unit and integration tests
- **SQL Server** - Unit tests
- **Oracle** - Unit tests
- **CockroachDB** - Unit tests (uses PostgreSQL adapter)
- **TimescaleDB** - Unit tests (uses PostgreSQL adapter)

### NoSQL Databases ✅
- **MongoDB** - Full unit and integration tests
- **Cassandra** - Full unit tests
- **Neo4j** - Full unit tests

### Cache Databases ✅
- **Redis** - Full unit and integration tests
- **Memcached** - Full unit tests

### Time Series ✅
- **InfluxDB** - Full unit tests
- **QuestDB** - Unit tests (uses PostgreSQL adapter)

### Cloud Services ✅
- **Supabase** - Unit tests (uses PostgreSQL adapter)

### AWS Services ✅
- **DynamoDB** - Full unit tests
- **RDS** - Unit tests (multi-engine support)
- **Redshift** - Unit tests (uses PostgreSQL adapter)
- **Aurora** - Unit tests (multi-engine support)

## Running Tests

### All Tests
```bash
go test ./...
```

### Unit Tests Only
```bash
go test ./tests/unit/...
```

### Integration Tests Only
```bash
go test ./tests/integration/...
```

### Specific Adapter Tests
```bash
# PostgreSQL adapter tests
go test ./tests/unit/infrastructure/database/adapters/sql/

# NoSQL adapter tests
go test ./tests/unit/infrastructure/database/adapters/nosql/

# Cache adapter tests
go test ./tests/unit/infrastructure/database/adapters/cache/

# Time series adapter tests
go test ./tests/unit/infrastructure/database/adapters/timeseries/

# AWS adapter tests
go test ./tests/unit/infrastructure/database/adapters/aws/

# Factory tests
go test ./tests/unit/infrastructure/database/adapters/ -run TestFactory
```

### With Coverage
```bash
go test -cover ./...
```

### Coverage Report
```bash
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html
```

### Verbose Output
```bash
go test -v ./...
```

### Benchmark Tests
```bash
go test -bench=. ./tests/integration/database/
```

### Short Mode (Skip Integration Tests)
```bash
go test -short ./...
```

## Test Categories

### Unit Tests
- **Purpose**: Test individual components in isolation
- **Dependencies**: Mock external dependencies
- **Execution**: Fast (< 1s per test)
- **Requirements**: No external services required
- **Coverage**: >90% code coverage target

**What's Tested:**
- Adapter initialization and configuration
- Connection parameter validation
- Query parsing and validation
- Error handling scenarios
- Schema information processing
- Connection state management

### Integration Tests
- **Purpose**: Test component interactions with real services
- **Dependencies**: Real database instances
- **Execution**: Slower (varies by database)
- **Requirements**: External service setup required
- **Coverage**: End-to-end functionality validation

**What's Tested:**
- Real database connections
- Query execution against live databases
- Schema discovery with actual data
- Performance benchmarks
- Connection pooling behavior
- Error scenarios with real services

### Mock Tests
- **Purpose**: Test service interactions without external dependencies
- **Implementation**: Using testify/mock framework
- **Benefits**: Fast, reliable, isolated testing
- **Use Cases**: Service layer testing, dependency injection validation

## Environment Variables for Integration Tests

Integration tests require running database instances. Set these environment variables to enable specific integration tests:

```bash
# PostgreSQL
export POSTGRES_TEST_URL="postgres://postgres:password@localhost:5432/test_db?sslmode=disable"

# MySQL
export MYSQL_TEST_URL="root:password@tcp(localhost:3306)/test_db"

# MongoDB
export MONGODB_TEST_URL="mongodb://localhost:27017/test_db"

# Redis
export REDIS_TEST_URL="redis://localhost:6379/0"

# Cassandra
export CASSANDRA_TEST_URL="localhost:9042"

# Neo4j
export NEO4J_TEST_URL="bolt://neo4j:password@localhost:7687"

# InfluxDB
export INFLUXDB_TEST_URL="http://localhost:8086"
export INFLUXDB_TOKEN="your-token"
export INFLUXDB_ORG="your-org"

# Memcached
export MEMCACHED_TEST_URL="localhost:11211"

# AWS Services (for local testing)
export AWS_ACCESS_KEY_ID="test"
export AWS_SECRET_ACCESS_KEY="test"
export AWS_REGION="us-east-1"
export DYNAMODB_ENDPOINT="http://localhost:8000"  # For local DynamoDB
```

## Docker Setup for Integration Tests

Use Docker Compose to run test databases:

```yaml
# docker-compose.test.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: test_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: test_db
      MYSQL_ROOT_PASSWORD: password
    ports:
      - "3306:3306"

  mongodb:
    image: mongo:6.0
    ports:
      - "27017:27017"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  cassandra:
    image: cassandra:4.0
    ports:
      - "9042:9042"

  neo4j:
    image: neo4j:5.0
    environment:
      NEO4J_AUTH: neo4j/password
    ports:
      - "7687:7687"
      - "7474:7474"

  influxdb:
    image: influxdb:2.7
    environment:
      INFLUXDB_DB: test_db
      INFLUXDB_ADMIN_USER: admin
      INFLUXDB_ADMIN_PASSWORD: password
    ports:
      - "8086:8086"

  memcached:
    image: memcached:1.6-alpine
    ports:
      - "11211:11211"

  dynamodb:
    image: amazon/dynamodb-local
    ports:
      - "8000:8000"
```

Start test databases:
```bash
docker-compose -f docker-compose.test.yml up -d
```

## Writing Tests

### Unit Test Example
```go
func TestPostgreSQLAdapter_Connect_InvalidHost(t *testing.T) {
    conn := &entities.Connection{
        ID:       "test-id",
        UserID:   "user-1",
        Name:     "Test PostgreSQL",
        Type:     entities.TypePostgreSQL,
        Host:     "invalid-host",
        Port:     5432,
        Database: "test_db",
        Username: "postgres",
        Password: "password",
    }

    adapter := sql.NewPostgreSQLAdapter(conn)
    ctx := context.Background()

    err := adapter.Connect(ctx, conn)
    assert.Error(t, err)
    assert.False(t, adapter.IsConnected())
    assert.Contains(t, err.Error(), "CONNECTION_FAILED")
}
```

### Integration Test Example
```go
func TestPostgreSQLAdapter_Integration(t *testing.T) {
    if os.Getenv("POSTGRES_TEST_URL") == "" {
        t.Skip("Skipping PostgreSQL integration test - POSTGRES_TEST_URL not set")
    }

    factory := adapters.NewFactory()
    conn := &entities.Connection{
        ID:       "test-postgres",
        UserID:   "user-1",
        Name:     "Test PostgreSQL Integration",
        Type:     entities.TypePostgreSQL,
        Host:     "localhost",
        Port:     5432,
        Database: "test_db",
        Username: "postgres",
        Password: "password",
    }

    adapter, err := factory.CreateAdapter(conn)
    require.NoError(t, err)

    ctx := context.Background()
    err = adapter.Connect(ctx, conn)
    if err != nil {
        t.Skipf("Could not connect to PostgreSQL: %v", err)
    }
    defer adapter.Disconnect(ctx)

    // Test query execution
    result, err := adapter.ExecuteQuery(ctx, "SELECT 1 as test_column")
    assert.NoError(t, err)
    assert.NotNil(t, result)
    assert.Len(t, result.Columns, 1)
    assert.Equal(t, "test_column", result.Columns[0])
}
```

### Mock Test Example
```go
func TestDatabaseManager_Connect_Success(t *testing.T) {
    // Arrange
    mockAdapter := mocks.NewMockDatabaseAdapter()
    mockFactory := mocks.NewMockAdapterFactory()
    
    conn := &entities.Connection{
        ID:   "test-id",
        Type: entities.TypePostgreSQL,
    }
    
    mockFactory.On("CreateAdapter", conn).Return(mockAdapter, nil)
    mockAdapter.On("Connect", mock.Anything, conn).Return(nil)
    mockAdapter.On("IsConnected").Return(true)
    
    manager := database.NewManager(mockFactory)
    
    // Act
    err := manager.Connect(context.Background(), conn)
    
    // Assert
    assert.NoError(t, err)
    mockFactory.AssertExpectations(t)
    mockAdapter.AssertExpectations(t)
}
```

## Test Utilities

### Mock Generators
```bash
# Generate mocks for interfaces
go generate ./...
```

### Test Helpers
```go
// Common test setup functions
func setupTestConnection(dbType string) *entities.Connection {
    return &entities.Connection{
        ID:       uuid.New().String(),
        UserID:   "test-user",
        Name:     fmt.Sprintf("Test %s", dbType),
        Type:     dbType,
        Host:     "localhost",
        // ... other fields
    }
}
```

## Best Practices

### Test Organization
- One test file per source file
- Group related tests in subtests
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### Test Coverage Goals
- **Unit Tests**: >90% code coverage
- **Integration Tests**: All critical paths covered
- **Error Scenarios**: All error conditions tested
- **Performance**: Benchmark tests for all adapters