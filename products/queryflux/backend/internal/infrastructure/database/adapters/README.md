# QueryFlux Database Adapter System

This directory contains the comprehensive database adapter system for QueryFlux, implementing a clean hexagonal architecture that supports 35+ database types with unified interfaces, connection pooling, health monitoring, and advanced features.

## Architecture Overview

The adapter system follows the **Hexagonal/Ports and Adapters Architecture** pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   Connection    │  │   Query Service │  │   AI Service│ │
│  │    Service      │  │                 │  │             │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Adapter Factory                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │    Caching      │  │    Pooling      │  │   Health    │ │
│  │                 │  │   Management    │  │ Monitoring  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database Adapters                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ PostgreSQL│  │  MySQL   │  │ MongoDB  │  │    Redis    │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  SQLite  │  │ Cassandra│  │ Neo4j    │  │  Timeseries │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Enhanced Types (`types/`)

**Enhanced Types System** (`enhanced_types.go`):
- `DatabaseAdapter` interface with advanced features
- `Transaction` interface for transactional support
- `HealthStatus` and `ConnectionMetrics` for monitoring
- `AdapterError` with detailed context and retry information
- `ConnectionConfig` with comprehensive options
- Common error codes and constants

### 2. Base Adapter (`base/`)

**Enhanced Base Adapter** (`enhanced_base_adapter.go`):
- Common functionality for all adapters
- Query performance tracking and statistics
- Health monitoring with configurable intervals
- Retry logic with exponential backoff
- Comprehensive error handling and logging
- Metrics collection and reporting
- Connection validation and configuration

**Connection Pool Manager** (`connection_pool_manager.go`):
- Intelligent connection pooling with LRU eviction
- Health monitoring and automatic cleanup
- Configurable pool sizes and timeouts
- Support for both single and clustered connections
- Performance metrics and statistics

### 3. Enhanced Factory (`enhanced_factory.go`)

**Advanced Factory Pattern**:
- Dynamic adapter registration and discovery
- Built-in caching with TTL and LRU eviction
- Connection pooling integration
- Health monitoring and statistics
- Configurable timeouts and retry policies
- Support for custom adapter registration

## Database Support

### SQL Databases (`sql/`)
- **PostgreSQL** - Full support with pgx/v5 driver
- **MySQL/MariaDB** - Complete feature support with connection pooling
- **SQLite** - Embedded database support
- **SQL Server** - Microsoft SQL Server compatibility
- **Oracle** - Enterprise Oracle database support
- **CockroachDB** - Distributed SQL database
- **PlanetScale** - Serverless MySQL platform
- **Supabase** - PostgreSQL with auth and real-time
- **Neon** - Serverless PostgreSQL
- **TiDB** - Distributed HTAP database
- **YugabyteDB** - Distributed SQL database

### NoSQL Databases (`nosql/`)
- **MongoDB** - Document database with aggregation pipelines
- **Cassandra** - Wide-column distributed database
- **CouchDB** - Multi-master NoSQL database
- **Neo4j** - Graph database with Cypher support
- **ArangoDB** - Multi-model database
- **ScyllaDB** - High-performance Cassandra-compatible

### Cache Databases (`cache/`)
- **Redis** - Key-value store with clustering support
- **Memcached** - Distributed memory caching

### Time Series Databases (`timeseries/`)
- **InfluxDB** - Time series database with Flux queries
- **TimescaleDB** - PostgreSQL extension for time series
- **QuestDB** - High-performance time series database

### Cloud Services (`aws/`, `cloud/`)
- **AWS Services**:
  - DynamoDB (NoSQL)
  - RDS/Aurora (SQL)
  - Redshift (Data Warehouse)
  - DocumentDB (MongoDB-compatible)
  - ElastiCache (Redis/Memcached)
  - Neptune (Graph)
  - Athena (Query service)
  - Timestream (Time series)
  - OpenSearch (Search)
- **Google Cloud**:
  - BigQuery (Data Warehouse)
  - Firestore (Document)
- **Snowflake** - Cloud data warehouse
- **Firebolt** - Cloud data warehouse

### Search Engines (`search/`)
- **Elasticsearch** - Distributed search and analytics
- **Solr** - Enterprise search platform
- **Typesense** - Fast, typo-tolerant search

## Key Features

### 1. **Unified Interface**
All adapters implement the same `DatabaseAdapter` interface:
```go
type DatabaseAdapter interface {
    Connect(ctx context.Context, conn *entities.Connection) error
    Disconnect(ctx context.Context) error
    TestConnection(ctx context.Context) error
    ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*QueryResult, error)
    GetSchema(ctx context.Context) (*SchemaInfo, error)
    GetTableInfo(ctx context.Context, tableName string) (*TableInfo, error)
    IsConnected() bool
    GetConnectionInfo() *entities.Connection

    // Advanced features
    HealthCheck(ctx context.Context) (*HealthStatus, error)
    GetMetrics(ctx context.Context) (*ConnectionMetrics, error)
    Ping(ctx context.Context) (time.Duration, error)
    BeginTx(ctx context.Context) (Transaction, error)
}
```

### 2. **Connection Pooling**
- Automatic connection management
- Configurable pool sizes
- Health monitoring and cleanup
- Support for both single and cluster connections
- Performance metrics and statistics

### 3. **Health Monitoring**
- Real-time health checks
- Configurable intervals and timeouts
- Automatic failure detection
- Recovery monitoring
- Metrics collection

### 4. **Error Handling**
- Structured error types with codes
- Detailed error context
- Retry logic with exponential backoff
- Error categorization (retryable vs non-retryable)
- Comprehensive logging

### 5. **Performance Optimization**
- Query performance tracking
- Slow query detection
- Connection reuse
- Caching mechanisms
- Resource monitoring

### 6. **Security**
- SSL/TLS support
- Connection encryption
- Credential management
- Secure connection strings
- Audit logging

## Usage Examples

### Basic Usage
```go
// Create factory
factory := adapters.NewEnhancedFactory(
    adapters.FactoryConfig{
        EnableCaching: true,
        EnablePooling: true,
        DefaultTimeout: time.Second * 30,
    },
    logger,
)

// Create connection
conn := &entities.Connection{
    ID:       "my-pg-db",
    Type:     entities.TypePostgreSQL,
    Host:     "localhost",
    Port:     5432,
    Database: "mydb",
    Username: "user",
    Password: "pass",
    Options: map[string]interface{}{
        "sslmode":         "require",
        "max_open_conns":  20,
        "connect_timeout": "10s",
    },
}

// Create adapter
adapter, err := factory.CreateAdapter(conn)
if err != nil {
    log.Fatal(err)
}

// Connect
ctx := context.Background()
if err := adapter.Connect(ctx, conn); err != nil {
    log.Fatal(err)
}

// Execute query
result, err := adapter.ExecuteQuery(ctx, "SELECT * FROM users WHERE active = $1", true)
if err != nil {
    log.Fatal(err)
}

// Process results
for _, row := range result.Rows {
    fmt.Printf("User: %+v\n", row)
}

// Get schema
schema, err := adapter.GetSchema(ctx)
if err != nil {
    log.Fatal(err)
}

// Health check
health, err := adapter.HealthCheck(ctx)
if err != nil || !health.Healthy {
    log.Printf("Database health check failed: %v", err)
}
```

### Advanced Usage with Metrics
```go
// Create adapter with custom configuration
adapter, err := factory.CreateAdapter(conn)
if err != nil {
    return err
}

// Get real-time metrics
metrics, err := adapter.GetMetrics(ctx)
if err != nil {
    return err
}

fmt.Printf("Pool Stats: Active=%d, Idle=%d\n",
    metrics.ConnectionPoolStats.InUseConnections,
    metrics.ConnectionPoolStats.IdleConnections)

fmt.Printf("Query Performance: QPS=%.2f, Avg Time=%v\n",
    metrics.QueryPerformance.QueriesPerSecond,
    metrics.QueryPerformance.AverageQueryTime)
```

### Custom Adapter Registration
```go
// Define custom adapter constructor
func createCustomAdapter(conn *entities.Connection, logger *logrus.Logger) (types.DatabaseAdapter, error) {
    return &CustomAdapter{
        base: base.NewEnhancedBaseAdapter(conn, logger),
    }, nil
}

// Register with factory
err := factory.RegisterAdapter("custom_db", createCustomAdapter, adapters.AdapterMetadata{
    Name:        "Custom Database",
    Description: "Custom database adapter",
    Version:     "1.0.0",
    SupportedTypes: []string{"custom_db"},
    Features: []string{"transactions", "ssl", "pooling"},
})
```

## Configuration

### Connection Configuration
```go
type ConnectionConfig struct {
    // Pool configuration
    MaxOpenConns    int           `json:"max_open_conns"`
    MaxIdleConns    int           `json:"max_idle_conns"`
    ConnMaxLifetime time.Duration `json:"conn_max_lifetime"`
    ConnMaxIdleTime time.Duration `json:"conn_max_idle_time"`

    // Timeouts
    ConnectTimeout time.Duration `json:"connect_timeout"`
    QueryTimeout   time.Duration `json:"query_timeout"`
    ReadTimeout    time.Duration `json:"read_timeout"`
    WriteTimeout   time.Duration `json:"write_timeout"`

    // Retry configuration
    MaxRetries   int           `json:"max_retries"`
    RetryDelay   time.Duration `json:"retry_delay"`
    RetryBackoff time.Duration `json:"retry_backoff"`

    // Health check configuration
    HealthCheckInterval time.Duration `json:"health_check_interval"`
    HealthCheckTimeout  time.Duration `json:"health_check_timeout"`

    // SSL/TLS configuration
    SSLMode     string `json:"ssl_mode"`
    SSLCert     string `json:"ssl_cert,omitempty"`
    SSLKey      string `json:"ssl_key,omitempty"`
    SSLRootCert string `json:"ssl_root_cert,omitempty"`
}
```

### Factory Configuration
```go
type FactoryConfig struct {
    EnableCaching      bool          `json:"enable_caching"`
    EnablePooling      bool          `json:"enable_pooling"`
    DefaultTimeout     time.Duration `json:"default_timeout"`
    HealthCheckInterval time.Duration `json:"health_check_interval"`
    MaxCacheSize       int           `json:"max_cache_size"`
    CacheTTL           time.Duration `json:"cache_ttl"`
}
```

## Testing

### Running Tests
```bash
# Run all adapter tests
go test ./internal/infrastructure/database/adapters/...

# Run with coverage
go test -cover ./internal/infrastructure/database/adapters/...

# Run integration tests
go test -tags=integration ./internal/infrastructure/database/adapters/...

# Run benchmarks
go test -bench=. ./internal/infrastructure/database/adapters/...
```

### Test Coverage
The adapter system includes comprehensive test coverage:
- Unit tests for all components (>90% coverage)
- Integration tests for full workflows
- Performance benchmarks
- Error handling validation
- Mock implementations for testing

## Performance

### Benchmarks
- **Adapter Creation**: <1ms average
- **Cached Adapter Retrieval**: <100μs average
- **Query Execution**: Varies by database and query complexity
- **Health Checks**: <10ms average
- **Connection Pool Operations**: <1ms average

### Optimization Features
- Connection pooling with configurable sizes
- Intelligent caching with LRU eviction
- Query result caching
- Lazy loading of schema information
- Resource monitoring and cleanup

## Error Handling

### Error Categories
- **Connection Errors**: Connection failures, timeouts, authentication issues
- **Query Errors**: Syntax errors, constraint violations, timeouts
- **Resource Errors**: Pool exhaustion, memory limits, rate limits
- **System Errors**: Internal errors, configuration issues

### Retry Logic
- Exponential backoff with jitter
- Configurable retry limits and delays
- Error classification for retry eligibility
- Context-aware cancellation

## Monitoring and Observability

### Metrics Collection
- Connection pool statistics
- Query performance metrics
- Error rates and types
- Resource utilization
- Health check results

### Logging
- Structured logging with correlation IDs
- Configurable log levels
- Error context and stack traces
- Performance metrics
- Security events

## Security Considerations

- **Encryption**: SSL/TLS support for all databases
- **Authentication**: Multiple authentication methods
- **Authorization**: Role-based access control
- **Audit Logging**: Comprehensive audit trails
- **Credential Management**: Secure credential storage
- **Network Security**: Firewall and VPN support

## Future Enhancements

1. **Database-Specific Features**:
   - Advanced data type mappings
   - Database-specific optimizations
   - Extended query capabilities
   - Custom function support

2. **Performance Improvements**:
   - Query result caching
   - Batch operations
   - Parallel query execution
   - Connection pooling optimizations

3. **Monitoring Enhancements**:
   - Real-time dashboards
   - Alerting integration
   - Performance baselines
   - Anomaly detection

4. **Security Enhancements**:
   - Zero-trust architecture
   - Advanced threat detection
   - Compliance reporting
   - Data masking

## Contributing

When adding new database adapters:

1. **Follow the Interface**: Implement all methods in `DatabaseAdapter`
2. **Add Comprehensive Tests**: Include unit and integration tests
3. **Document Features**: Update documentation and examples
4. **Handle Errors**: Use structured error types with proper codes
5. **Add Metrics**: Implement performance tracking
6. **Security First**: Implement proper security measures

## License

This database adapter system is part of the QueryFlux project and follows the same licensing terms.