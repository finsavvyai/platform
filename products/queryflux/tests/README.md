# QueryFlux Database Adapter Tests

This directory contains comprehensive integration tests for all database adapters in QueryFlux.

## Test Structure

### Integration Tests (`tests/integration/`)

1. **`database_adapters_test.go`**
   - Tests all database adapters (PostgreSQL, MySQL, MongoDB, Redis)
   - Validates connection, query execution, schema introspection
   - Tests concurrent connections and error handling
   - Validates adapter factory functionality

2. **`docker_compose_test.go`**
   - Tests database adapters via Docker containers
   - Validates container health and connectivity
   - Tests each database type individually
   - Monitors container logs and resource usage

3. **`performance_test.go`**
   - Performance benchmarking for all adapters
   - Sequential and concurrent query execution tests
   - Memory usage validation
   - Performance regression detection

### Test Fixtures (`tests/fixtures/`)

Database initialization scripts for each database type:

- **`postgres/init.sql`** - PostgreSQL schema and test data
- **`mysql/init.sql`** - MySQL schema and test data
- **`mongodb/init.js`** - MongoDB collections and test data
- **`redis/redis.conf`** - Redis configuration for testing
- **`mariadb/init.sql`** - MariaDB schema and test data
- **`timescaledb/init.sql`** - TimescaleDB hypertables and time-series data

## Supported Databases

### SQL Databases
- **PostgreSQL** (Port 5432)
- **MySQL** (Port 3306)
- **MariaDB** (Port 3307)
- **YugabyteDB** (Port 5433)
- **TimescaleDB** (Port 5434)
- **TiDB** (Port 4000)
- **SingleStore** (Port 3308)

### NoSQL Databases
- **MongoDB** (Port 27017)
- **ScyllaDB** (Port 9042)

### Cache Databases
- **Redis** (Port 6379)

### Search Databases
- **Elasticsearch** (Ports 9200, 9300)

### Time Series Databases
- **InfluxDB** (Port 8086)

### Graph Databases
- **Neo4j** (Ports 7474, 7687)

## Quick Start

### 1. Start Test Environment

```bash
# Using the test runner script
./tests/run-tests.sh

# Or manually
docker-compose -f docker-compose.test.yml -p queryflux-test up -d
```

### 2. Run Tests

```bash
# Run all tests with containers
./tests/run-tests.sh

# Skip Docker management (if containers already running)
./tests/run-tests.sh --skip-docker

# Run specific test suites
go test -v -tags=integration ./tests/integration/...
```

### 3. Stop Test Environment

```bash
docker-compose -f docker-compose.test.yml -p queryflux-test down -v
```

## Test Configuration

### Environment Variables

Tests use the following environment variables (with defaults):

```bash
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=testuser
POSTGRES_PASSWORD=testpass
POSTGRES_DATABASE=queryflux_test

# MySQL
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=testuser
MYSQL_PASSWORD=testpass
MYSQL_DATABASE=queryflux_test

# MongoDB
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_USERNAME=testuser
MONGODB_PASSWORD=testpass
MONGODB_DATABASE=queryflux_test

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

## Running Individual Tests

### Database Adapter Tests

```bash
# Test all adapters
go test -v -tags=integration -run=TestDatabaseAdapters ./tests/integration/

# Test specific adapter
go test -v -tags=integration -run=TestPostgreSQLAdapter ./tests/integration/
go test -v -tags=integration -run=TestMongoDBAdapter ./tests/integration/
go test -v -tags=integration -run=TestRedisAdapter ./tests/integration/
```

### Docker Compose Tests

```bash
# Test Docker container setup
go test -v -tags=integration -run=TestDockerCompose ./tests/integration/

# Test specific database container
go test -v -tags=integration -run=TestPostgreSQLViaDocker ./tests/integration/
go test -v -tags=integration -run=TestMySQLViaDocker ./tests/integration/
```

### Performance Tests

```bash
# Run all performance tests
go test -v -tags=integration -run=TestAdapterPerformance ./tests/integration/

# Test specific database performance
go test -v -tags=integration -run=TestPostgreSQLPerformance ./tests/integration/
go test -v -tags=integration -run=TestMongoDBPerformance ./tests/integration/
```

## Test Coverage

```bash
# Run tests with coverage
go test -v -tags=integration -coverprofile=coverage.out ./tests/integration/

# View coverage report
go tool cover -html=coverage.out -o coverage.html
go tool cover -func=coverage.out
```

## Test Data

### PostgreSQL Schema
```sql
users (id, username, email, created_at, is_active)
connections (id, user_id, name, database_type, host, port, database_name, username, ...)
queries (id, user_id, connection_id, query_text, query_type, execution_time_ms, ...)
```

### MongoDB Collections
```javascript
users (username, email, created_at, is_active)
connections (user_id, name, database_type, host, port, ...)
queries (user_id, connection_id, query_text, query_type, execution_time_ms, ...)
```

### Redis Keys
```
test:key (basic string operations)
test:perf:* (performance testing)
test:conc:* (concurrency testing)
```

## Troubleshooting

### Common Issues

1. **Docker containers not starting**
   ```bash
   docker system prune
   docker-compose -f docker-compose.test.yml -p queryflux-test up -d
   ```

2. **Connection timeouts**
   ```bash
   # Check if containers are running
   docker-compose -f docker-compose.test.yml -p queryflux-test ps

   # Check container logs
   docker-compose -f docker-compose.test.yml -p queryflux-test logs
   ```

3. **Port conflicts**
   ```bash
   # Check what's using the ports
   lsof -i :5432  # PostgreSQL
   lsof -i :3306  # MySQL
   lsof -i :27017 # MongoDB
   ```

4. **Permission issues**
   ```bash
   # Fix Docker socket permissions
   sudo chmod 666 /var/run/docker.sock
   ```

### Debug Mode

```bash
# Enable verbose test output
go test -v -tags=integration -count=1 ./tests/integration/

# Run with race detection
go test -race -v -tags=integration ./tests/integration/

# Run with timeout
go test -timeout=30m -v -tags=integration ./tests/integration/
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Database Adapter Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: testpass
          POSTGRES_USER: testuser
          POSTGRES_DB: queryflux_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
    - uses: actions/checkout@v3

    - name: Setup Go
      uses: actions/setup-go@v4
      with:
        go-version: '1.21'

    - name: Install Docker Compose
      run: |
        sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose

    - name: Start Test Databases
      run: |
        docker-compose -f docker-compose.test.yml -p queryflux-test up -d
        sleep 30

    - name: Run Integration Tests
      env:
        POSTGRES_HOST: localhost
        POSTGRES_PORT: 5432
        POSTGRES_USER: testuser
        POSTGRES_PASSWORD: testpass
        POSTGRES_DATABASE: queryflux_test
      run: |
        go test -v -tags=integration -timeout=30m ./tests/integration/

    - name: Stop Test Databases
      if: always()
      run: docker-compose -f docker-compose.test.yml -p queryflux-test down -v
```

## Contributing

When adding new database adapters:

1. Add Docker container configuration to `docker-compose.test.yml`
2. Create test fixture in `tests/fixtures/{database}/`
3. Add test cases to `database_adapters_test.go`
4. Add Docker-specific tests to `docker_compose_test.go`
5. Add performance tests to `performance_test.go`
6. Update this README with new database information

## Performance Benchmarks

### Target Performance Metrics

- **PostgreSQL**: <100ms average query time
- **MySQL**: <150ms average query time
- **MongoDB**: <200ms average query time
- **Redis**: <5ms average operation time
- **Concurrent Connections**: 10+ concurrent operations
- **Memory Usage**: <100MB per adapter
- **Connection Setup**: <5 seconds

### Running Benchmarks

```bash
# Run full benchmark suite
./tests/run-tests.sh --skip-docker --skip-coverage

# Generate performance report
go test -v -tags=integration -run=TestAdapterPerformance -bench=. ./tests/integration/
```

This comprehensive test suite ensures that all database adapters work correctly across different environments and maintain performance standards.