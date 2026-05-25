# Database Adapter Integration Tests

This directory contains comprehensive integration tests for all database adapters in QueryFlux. The test suite validates that each adapter can properly connect to its target database, execute queries, retrieve schema information, and handle errors correctly.

## Overview

The integration test framework is designed to test 20+ database adapters across multiple categories:

### Relational Databases
- **PostgreSQL** - Advanced open-source RDBMS
- **MySQL** - Popular open-source RDBMS
- **MariaDB** - Community-developed fork of MySQL
- **CockroachDB** - Distributed SQL database
- **SQLite** - Serverless embedded database
- **SQL Server** - Microsoft's RDBMS
- **Oracle** - Enterprise RDBMS

### Time-Series Databases
- **TimescaleDB** - PostgreSQL extension for time-series
- **QuestDB** - High-performance time-series database
- **InfluxDB** - Time-series database built for IoT

### NoSQL Databases
- **MongoDB** - Document-oriented database
- **Cassandra** - Wide-column NoSQL database
- **CouchDB** - Document-oriented database with REST API
- **ArangoDB** - Multi-model database
- **Neo4j** - Graph database
- **Elasticsearch** - Search and analytics engine

### Cache & Key-Value Stores
- **Redis** - In-memory data structure store
- **Memcached** - Distributed memory caching system

### Cloud Database Services
- **PlanetScale** - MySQL-compatible serverless database
- **Neon** - PostgreSQL-compatible serverless database
- **AWS RDS** - Relational Database Service
- **AWS Aurora** - MySQL and PostgreSQL-compatible
- **AWS Redshift** - Data warehouse
- **AWS DocumentDB** - MongoDB-compatible
- **AWS ElastiCache** - Redis/Memcached service
- **AWS DynamoDB** - NoSQL key-value store

## Architecture

### Test Framework Components

1. **Test Configuration** (`test_config.go`)
   - Connection parameters for all databases
   - Environment variable mapping
   - Database type to entity type mapping

2. **Integration Test Framework** (`integration_test_framework.go`)
   - `DatabaseTestSuite` struct for each database type
   - Standardized test methods for all adapter capabilities
   - Database-specific query generation
   - Error handling and performance testing

3. **Test Scripts** (`run_tests.sh`)
   - Automated Docker environment setup
   - Database health checking
   - Parallel test execution
   - Cleanup and log management

4. **Database Initialization Scripts**
   - SQL/JS scripts for each database type
   - Sample data and schema creation
   - Database-specific features and optimizations

### Test Categories

#### Connection Lifecycle Tests
- Database connection establishment
- Connection validation and health checks
- Connection disconnection and cleanup
- Connection timeout handling

#### Query Execution Tests
- Basic SELECT queries
- INSERT/UPDATE/DELETE operations (where supported)
- JOIN operations (SQL databases)
- Aggregation functions
- Database-specific functions and syntax

#### Schema Retrieval Tests
- Database schema introspection
- Table and column information
- Index and constraint information
- Database-specific metadata

#### Transaction Support Tests
- Transaction begin/commit/rollback (SQL databases)
- Isolation level testing
- Concurrent transaction handling
- Error recovery scenarios

#### Error Handling Tests
- Invalid SQL syntax
- Non-existent tables/columns
- Permission denied scenarios
- Network connectivity issues

#### Performance Tests
- Query execution time benchmarks
- Connection pool performance
- Memory usage monitoring
- Concurrent operation testing

## Quick Start

### Prerequisites

1. **Docker** - All test databases run in Docker containers
2. **Go 1.21+** - For running the test suite
3. **Docker Compose** - For orchestrating test environments

### Running All Tests

```bash
# From the backend directory
./tests/integration/database/run_tests.sh
```

### Running Tests for Specific Database

```bash
# Test only PostgreSQL
./tests/integration/database/run_tests.sh --db postgresql

# Test only MongoDB
./tests/integration/database/run_tests.sh --db mongodb
```

### Running Tests with Different Options

```bash
# Skip Docker setup (if databases are already running)
./tests/integration/database/run_tests.sh --skip-setup

# Don't clean up containers after tests
./tests/integration/database/run_tests.sh --no-cleanup

# Run tests sequentially (not in parallel)
./tests/integration/database/run_tests.sh --sequential

# Run with benchmarks
./tests/integration/database/run_tests.sh --bench
```

### Manual Test Execution

```bash
# Set up environment variables first
export POSTGRES_TEST_URL="postgres://test_user:test_password@localhost:5433/test_db?sslmode=disable"
export MYSQL_TEST_URL="test_user:test_password@tcp(localhost:3307)/test_db"
# ... set other environment variables

# Run tests manually
go test -v ./tests/integration/database/... -run "TestAllNewAdapters_Integration"
```

## Docker Compose Test Environment

The `docker-compose.test.yml` file defines all test databases with the following features:

- **Health Checks** - Ensures databases are ready before testing
- **Custom Networks** - Isolated test network with custom subnet
- **Persistent Volumes** - Data persistence for test databases
- **Port Mapping** - Non-conflicting ports for local testing
- **Initialization Scripts** - Database setup on container start

### Database Port Mapping

| Database | Container Port | Host Port |
|----------|----------------|-----------|
| PostgreSQL | 5432 | 5433 |
| MySQL | 3306 | 3307 |
| MariaDB | 3306 | 3308 |
| MongoDB | 27017 | 27018 |
| Redis | 6379 | 6380 |
| CockroachDB | 26257 | 26257 |
| Cassandra | 9042 | 9043 |
| CouchDB | 5984 | 5985 |
| ArangoDB | 8529 | 8530 |
| InfluxDB | 8086 | 8087 |
| QuestDB | 8812 | 8812 |
| TimescaleDB | 5432 | 5434 |
| Neo4j (Bolt) | 7687 | 7688 |
| Neo4j (HTTP) | 7474 | 7475 |
| DynamoDB | 8000 | 8001 |
| Elasticsearch | 9200 | 9201 |
| SQL Server | 1433 | 1434 |
| Oracle | 1521 | 1522 |

## Environment Variables

Each database type requires a specific environment variable to enable its tests:

```bash
# SQL Databases
export POSTGRES_TEST_URL="postgres://user:pass@host:port/db?sslmode=disable"
export MYSQL_TEST_URL="user:pass@tcp(host:port)/db"
export MARIADB_TEST_URL="user:pass@tcp(host:port)/db"
export COCKROACHDB_TEST_URL="postgres://user@host:port/db?sslmode=disable"
export SQLSERVER_TEST_URL="sqlserver://user:pass@host:port?database=db"
export ORACLE_TEST_URL="oracle://user:pass@host:port/SID"

# NoSQL Databases
export MONGODB_TEST_URL="mongodb://user:pass@host:port/db"
export CASSANDRA_TEST_URL="cassandra://user:pass@host:port/db"
export COUCHDB_TEST_URL="http://user:pass@host:port/db"
export ARANGODB_TEST_URL="http://user:pass@host:port"
export NEO4J_TEST_URL="bolt://user:pass@host:port"
export ELASTICSEARCH_TEST_URL="http://host:port"

# Time-Series Databases
export INFLUXDB_TEST_URL="http://host:port"
export QUESTDB_TEST_URL="postgres://user:pass@host:port/db"
export TIMESCALEDB_TEST_URL="postgres://user:pass@host:port/db?sslmode=disable"

# Cache & Key-Value
export REDIS_TEST_URL="redis://:pass@host:port/db"
export MEMCACHED_TEST_URL="host:port"

# Cloud Services
export DYNAMODB_TEST_URL="http://host:port"
```

## Test Data

Each database is initialized with test data including:

- **Users Table** - Sample user records with various data types
- **Departments/Employees** - Relational data with foreign keys
- **Time-Series Data** - Metrics and weather data for time-series databases
- **Document Collections** - JSON documents for document databases
- **Key-Value Pairs** - Sample cache data for Redis/Memcached

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```
   Error: Port 5433 is already in use
   Solution: Stop existing containers or change port mapping in docker-compose.test.yml
   ```

2. **Docker Not Running**
   ```
   Error: Cannot connect to Docker daemon
   Solution: Start Docker Desktop or Docker Engine
   ```

3. **Insufficient Memory**
   ```
   Error: Container killed due to memory limit
   Solution: Increase Docker memory allocation to 4GB+
   ```

4. **Database Health Check Failures**
   ```
   Error: Database health check failed
   Solution: Wait longer for databases to initialize, check logs with `docker-compose logs`
   ```

### Debugging

#### View Container Logs
```bash
# View all logs
docker-compose -f docker-compose.test.yml logs

# View specific database logs
docker-compose -f docker-compose.test.yml logs postgres-test
docker-compose -f docker-compose.test.yml logs mongodb-test
```

#### Access Database Directly
```bash
# PostgreSQL
docker exec -it queryflux-postgres-test psql -U test_user -d test_db

# MongoDB
docker exec -it queryflux-mongodb-test mongosh -u test_user -p test_password

# Redis
docker exec -it queryflux-redis-test redis-cli -a test_password
```

#### Manual Database Connection
```bash
# Test PostgreSQL connection
docker exec queryflux-postgres-test pg_isready -U test_user -d test_db

# Test MongoDB connection
docker exec queryflux-mongodb-test mongosh --eval "db.adminCommand('ping')"
```

## Performance Considerations

### Test Optimization

1. **Parallel Execution** - Tests run in parallel by default for faster execution
2. **Connection Pooling** - Reuses connections within test suites
3. **Resource Limits** - Docker containers have resource limits to prevent system overload
4. **Selective Testing** - Can test specific databases to reduce runtime

### Benchmarks

Performance benchmarks are included for:
- Query execution time
- Connection establishment time
- Schema retrieval performance
- Memory usage patterns

Run benchmarks with:
```bash
go test -bench=. -benchmem ./tests/integration/database/... -count=3
```

## Continuous Integration

The integration tests are designed to run in CI/CD environments:

### GitHub Actions Example
```yaml
name: Database Integration Tests

on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    services:
      docker:
        image: docker:24
        options: --privileged

    steps:
    - uses: actions/checkout@v3

    - name: Set up Go
      uses: actions/setup-go@v4
      with:
        go-version: '1.21'

    - name: Run Integration Tests
      run: |
        cd backend
        ./tests/integration/database/run_tests.sh --sequential
```

### CI Considerations

1. **Resource Limits** - CI environments may have limited memory/CPU
2. **Timeout Settings** - Increase timeouts for slower database initialization
3. **Parallel Execution** - Use sequential mode in resource-constrained environments
4. **Cache Docker Images** - Cache database images for faster test runs

## Contributing

When adding new database adapters:

1. **Update docker-compose.test.yml** - Add new database service
2. **Create initialization script** - Add schema and test data setup
3. **Update test_config.go** - Add connection parameters
4. **Add database-specific queries** - Update integration_test_framework.go
5. **Add test case** - Create test function in new_adapters_integration_test.go
6. **Update documentation** - Add database-specific information to README

## License

This integration test framework is part of the QueryFlux project and follows the same license terms.