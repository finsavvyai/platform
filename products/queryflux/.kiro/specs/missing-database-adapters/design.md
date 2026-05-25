# Design Document

## Overview

This design document outlines the implementation of missing database adapters for QueryFlux. The system currently has a well-established adapter pattern with a factory-based approach for creating database-specific adapters. We need to implement adapters for MariaDB, CockroachDB, PlanetScale, Neon, CouchDB, AWS RDS variants, Aurora, Redshift, DocumentDB, ElastiCache, TimescaleDB, QuestDB, and ArangoDB.

The design follows the existing architectural patterns:
- All adapters implement the `DatabaseAdapter` interface
- SQL-based adapters extend `BaseSQLAdapter` for common functionality
- NoSQL adapters implement the interface directly with database-specific logic
- Cloud service adapters handle authentication and service-specific configurations
- The factory pattern routes connection types to appropriate adapter implementations

## Architecture

### Current Architecture Analysis

The existing system uses a layered architecture:

1. **Domain Layer**: Contains `Connection` entity with database type constants and connection string generation
2. **Infrastructure Layer**: Contains adapter implementations organized by database category
3. **Factory Pattern**: Routes connection types to appropriate adapter constructors
4. **Base Classes**: `BaseSQLAdapter` provides common SQL database functionality

### Missing Components

Based on the requirements analysis, the following adapters are missing:

**SQL Databases:**
- MariaDB (partially implemented in factory but missing adapter)
- CockroachDB (partially implemented in factory but missing adapter) 
- PlanetScale (not implemented)
- Neon (not implemented)

**NoSQL Databases:**
- CouchDB (partially implemented in factory but missing adapter)
- ArangoDB (partially implemented in factory but missing adapter)

**Time Series:**
- QuestDB (uses PostgreSQL wire protocol, needs proper implementation)
- TimescaleDB (uses PostgreSQL extensions, needs proper implementation)

**AWS Services:**
- All AWS adapters are referenced in factory but missing implementations

## Components and Interfaces

### 1. SQL Adapter Implementations

#### MariaDB Adapter
```go
type MariaDBAdapter struct {
    *BaseSQLAdapter
}
```
- Extends BaseSQLAdapter
- Uses MySQL driver with MariaDB-specific configurations
- Handles MariaDB-specific SQL syntax variations

#### CockroachDB Adapter
```go
type CockroachDBAdapter struct {
    *BaseSQLAdapter
}
```
- Extends BaseSQLAdapter
- Uses PostgreSQL driver (CockroachDB is PostgreSQL-compatible)
- Handles CockroachDB-specific distributed database features

#### PlanetScale Adapter
```go
type PlanetScaleAdapter struct {
    *BaseSQLAdapter
}
```
- Extends BaseSQLAdapter
- Uses MySQL driver with PlanetScale-specific connection handling
- Supports serverless MySQL connections and branching

#### Neon Adapter
```go
type NeonAdapter struct {
    *BaseSQLAdapter
}
```
- Extends BaseSQLAdapter
- Uses PostgreSQL driver with Neon-specific configurations
- Handles serverless PostgreSQL connections

### 2. NoSQL Adapter Implementations

#### CouchDB Adapter
```go
type CouchDBAdapter struct {
    conn     *entities.Connection
    client   *http.Client
    baseURL  string
    mutex    sync.RWMutex
    logger   *logrus.Logger
}
```
- Implements DatabaseAdapter interface directly
- Uses HTTP client for CouchDB REST API
- Handles document-based operations and views

#### ArangoDB Adapter
```go
type ArangoDBAdapter struct {
    conn     *entities.Connection
    client   driver.Client
    db       driver.Database
    mutex    sync.RWMutex
    logger   *logrus.Logger
}
```
- Implements DatabaseAdapter interface directly
- Uses ArangoDB Go driver
- Supports multi-model (document, graph, key-value) operations

### 3. Time Series Adapter Implementations

#### QuestDB Adapter
```go
type QuestDBAdapter struct {
    *BaseSQLAdapter
}
```
- Extends BaseSQLAdapter
- Uses PostgreSQL driver (QuestDB supports PostgreSQL wire protocol)
- Handles time-series specific SQL extensions

#### TimescaleDB Adapter
```go
type TimescaleDBAdapter struct {
    *BaseSQLAdapter
}
```
- Extends BaseSQLAdapter
- Uses PostgreSQL driver with TimescaleDB extensions
- Supports hypertables and time-series functions

### 4. AWS Service Adapter Implementations

#### AWS RDS Adapter
```go
type RDSAdapter struct {
    *BaseSQLAdapter
    engine string
}
```
- Extends BaseSQLAdapter
- Delegates to appropriate SQL adapter based on RDS engine
- Handles AWS-specific authentication and SSL requirements

#### AWS Aurora Adapter
```go
type AuroraAdapter struct {
    *BaseSQLAdapter
    engine string
}
```
- Extends BaseSQLAdapter
- Supports both Aurora MySQL and PostgreSQL
- Handles cluster endpoints and read replicas

#### AWS Redshift Adapter
```go
type RedshiftAdapter struct {
    *BaseSQLAdapter
}
```
- Extends BaseSQLAdapter
- Uses PostgreSQL driver with Redshift-specific configurations
- Handles data warehouse specific SQL syntax

#### AWS DocumentDB Adapter
```go
type DocumentDBAdapter struct {
    conn     *entities.Connection
    client   *mongo.Client
    database *mongo.Database
    mutex    sync.RWMutex
    logger   *logrus.Logger
}
```
- Implements DatabaseAdapter interface directly
- Uses MongoDB driver (DocumentDB is MongoDB-compatible)
- Handles AWS-specific authentication and SSL requirements

#### AWS ElastiCache Adapter
```go
type ElastiCacheAdapter struct {
    conn     *entities.Connection
    client   redis.Cmdable
    mutex    sync.RWMutex
    logger   *logrus.Logger
}
```
- Implements DatabaseAdapter interface directly
- Uses Redis client
- Supports both Redis and Memcached ElastiCache variants

## Data Models

### Connection String Enhancements

The `Connection` entity already has connection string methods for most database types. Missing implementations need to be added:

```go
// New connection string methods to implement
func (c *Connection) getPlanetScaleConnectionString() string
func (c *Connection) getNeonConnectionString() string
```

### Database Type Constants

New constants need to be added to the `Connection` entity:

```go
const (
    TypePlanetScale = "planetscale"
    TypeNeon        = "neon"
)
```

## Error Handling

### Standardized Error Patterns

All adapters will use the existing `AdapterError` structure:

```go
type AdapterError struct {
    Code    string `json:"code"`
    Message string `json:"message"`
    Details string `json:"details,omitempty"`
}
```

### Error Categories

1. **Connection Errors**: Failed to establish connection
2. **Authentication Errors**: Invalid credentials or permissions
3. **Query Errors**: SQL syntax or execution errors
4. **Schema Errors**: Database structure access issues
5. **Network Errors**: Connectivity and timeout issues

### Database-Specific Error Handling

Each adapter will handle database-specific error codes and translate them to standardized error messages:

- **MariaDB**: Handle MariaDB-specific error codes
- **CockroachDB**: Handle distributed database errors and retries
- **PlanetScale**: Handle serverless connection errors
- **Neon**: Handle serverless PostgreSQL errors
- **CouchDB**: Handle HTTP status codes and CouchDB errors
- **ArangoDB**: Handle multi-model operation errors
- **AWS Services**: Handle AWS SDK errors and service limits

## Testing Strategy

### Unit Testing

Each adapter will have comprehensive unit tests covering:

1. **Connection Management**
   - Successful connections
   - Failed connections with various error scenarios
   - Connection pooling behavior
   - SSL/TLS configuration

2. **Query Execution**
   - Basic SELECT queries
   - INSERT/UPDATE/DELETE operations (where applicable)
   - Parameterized queries
   - Error handling for invalid queries

3. **Schema Operations**
   - Database schema retrieval
   - Table information access
   - Index information access
   - Error handling for missing objects

### Integration Testing

Integration tests will use:

1. **Docker Containers**: For databases that can run in containers
2. **Mock Services**: For cloud services and external APIs
3. **Test Databases**: For services that provide test environments

### Test Database Setup

```go
// Example test setup for each adapter
func setupTestDatabase(dbType string) (*entities.Connection, func()) {
    // Setup test database instance
    // Return connection and cleanup function
}
```

### Mocking Strategy

For cloud services and external dependencies:

```go
type MockAWSService struct {
    // Mock AWS service responses
}

type MockHTTPClient struct {
    // Mock HTTP responses for REST APIs
}
```

## Implementation Phases

### Phase 1: SQL Database Adapters
1. MariaDB Adapter
2. CockroachDB Adapter  
3. PlanetScale Adapter
4. Neon Adapter

### Phase 2: NoSQL Database Adapters
1. CouchDB Adapter
2. ArangoDB Adapter

### Phase 3: Time Series Database Adapters
1. QuestDB Adapter
2. TimescaleDB Adapter

### Phase 4: AWS Service Adapters
1. RDS Adapter
2. Aurora Adapter
3. Redshift Adapter
4. DocumentDB Adapter
5. ElastiCache Adapter

## Dependencies

### Required Go Modules

```go
// SQL Drivers
"github.com/go-sql-driver/mysql"           // MariaDB, PlanetScale
"github.com/lib/pq"                        // CockroachDB, Neon, QuestDB, TimescaleDB
"github.com/denisenkom/go-mssqldb"        // SQL Server (for completeness)

// NoSQL Drivers
"github.com/arangodb/go-driver"           // ArangoDB
"go.mongodb.org/mongo-driver/mongo"       // DocumentDB (MongoDB-compatible)

// HTTP Clients
"net/http"                                // CouchDB REST API

// Redis Clients
"github.com/go-redis/redis/v8"            // ElastiCache Redis

// AWS SDK
"github.com/aws/aws-sdk-go/aws"           // AWS services
"github.com/aws/aws-sdk-go/service/rds"   // RDS
"github.com/aws/aws-sdk-go/service/redshift" // Redshift
```

### Configuration Requirements

Each adapter will require specific configuration:

1. **Connection Parameters**: Host, port, database, credentials
2. **SSL/TLS Settings**: Certificate validation, encryption
3. **Pool Settings**: Connection limits, timeouts
4. **Service-Specific Options**: Region (AWS), cluster settings, etc.

## Security Considerations

### Authentication Methods

1. **Username/Password**: Standard authentication for most databases
2. **SSL Certificates**: Client certificate authentication
3. **AWS IAM**: For AWS services
4. **API Keys**: For cloud services that use key-based auth

### Encryption

1. **In-Transit**: SSL/TLS encryption for all connections
2. **At-Rest**: Support for encrypted storage where available
3. **Credential Storage**: Secure storage of connection credentials

### Access Control

1. **Connection Validation**: Verify user permissions before allowing connections
2. **Query Restrictions**: Implement query filtering where appropriate
3. **Audit Logging**: Log connection attempts and query executions

## Performance Considerations

### Connection Pooling

Each adapter will support connection pooling with database-specific optimizations:

```go
func (a *Adapter) configureConnectionPool(db *sql.DB, dbType string) {
    switch dbType {
    case entities.TypeMariaDB:
        // MariaDB-specific pool settings
    case entities.TypeCockroachDB:
        // CockroachDB-specific pool settings
    // ... other database types
    }
}
```

### Query Optimization

1. **Prepared Statements**: Use prepared statements where supported
2. **Result Streaming**: Stream large result sets
3. **Connection Reuse**: Optimize connection reuse patterns
4. **Timeout Handling**: Implement appropriate timeouts for different operations

### Caching Strategy

1. **Schema Caching**: Cache database schema information
2. **Connection Caching**: Reuse established connections
3. **Query Result Caching**: Cache frequently accessed data (where appropriate)