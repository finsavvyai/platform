# Database Support in QueryFlux

QueryFlux now supports **20+ different database types** with comprehensive adapter implementations across SQL, NoSQL, Cache, Time Series, and Cloud databases.

## Supported Databases

### SQL Databases ✅

#### 1. PostgreSQL
- **Driver**: `pgx/v5` (native Go driver)
- **Features**: Full SQL support, connection pooling, schema introspection
- **Connection**: Standard PostgreSQL connection string
- **Use Cases**: OLTP applications, complex queries, JSON support

#### 2. MySQL
- **Driver**: `go-sql-driver/mysql`
- **Features**: Full SQL support, charset handling, timezone support
- **Connection**: MySQL DSN format
- **Use Cases**: Web applications, e-commerce, content management

#### 3. MariaDB
- **Driver**: `go-sql-driver/mysql` (MySQL-compatible)
- **Features**: MySQL compatibility with MariaDB-specific optimizations
- **Connection**: MySQL DSN format
- **Use Cases**: Drop-in MySQL replacement, enhanced performance

#### 4. SQLite
- **Driver**: `modernc.org/sqlite`
- **Features**: Embedded database, ACID transactions, full-text search
- **Connection**: File path or `:memory:`
- **Use Cases**: Embedded applications, testing, local development

#### 5. SQL Server
- **Driver**: `denisenkom/go-mssqldb`
- **Features**: T-SQL support, Windows authentication, encryption
- **Connection**: SQL Server connection string
- **Use Cases**: Enterprise applications, .NET integration

#### 6. Oracle Database
- **Driver**: `godror` (Oracle driver for Go)
- **Features**: Full SQL support, PL/SQL, advanced Oracle features
- **Connection**: Oracle connection string format (`user/password@host:port/service`)
- **Use Cases**: Enterprise applications, data warehousing, complex transactions

#### 7. CockroachDB
- **Driver**: `pgx/v5` (PostgreSQL wire protocol)
- **Features**: Distributed SQL, ACID transactions, horizontal scaling
- **Connection**: PostgreSQL connection string
- **Use Cases**: Distributed applications, global consistency

#### 8. TimescaleDB
- **Driver**: `pgx/v5` (PostgreSQL extension)
- **Features**: Time-series optimizations, continuous aggregates
- **Connection**: PostgreSQL connection string
- **Use Cases**: IoT data, monitoring, analytics

### NoSQL Databases ✅

#### 9. MongoDB
- **Driver**: `mongo-driver` (official MongoDB driver)
- **Features**: Document operations, aggregation pipelines, replica sets
- **Connection**: MongoDB URI format
- **Use Cases**: Document storage, content management, real-time analytics

#### 10. Cassandra
- **Driver**: `gocql`
- **Features**: Wide-column store, eventual consistency, high availability
- **Connection**: Cassandra cluster configuration
- **Use Cases**: Big data, IoT, time-series data

#### 11. Neo4j ✨ **NEW**
- **Driver**: `neo4j-go-driver/v5`
- **Features**: Graph database, Cypher queries, ACID transactions
- **Connection**: Bolt protocol connection
- **Use Cases**: Social networks, recommendation engines, fraud detection

### Key-Value & Cache Databases ✅

#### 12. Redis
- **Driver**: `go-redis/v9`
- **Features**: Key-value operations, pub/sub, cluster support
- **Connection**: Redis URI format
- **Use Cases**: Caching, session storage, real-time messaging

#### 13. Memcached ✨ **NEW**
- **Driver**: `bradfitz/gomemcache`
- **Features**: Distributed memory caching, simple key-value operations
- **Connection**: Server address format
- **Use Cases**: Web application caching, session storage

### Time Series & Analytics ✅

#### 14. InfluxDB ✨ **NEW**
- **Driver**: `influxdata/influxdb-client-go/v2`
- **Features**: Time-series database, Flux queries, retention policies
- **Connection**: InfluxDB URL with token authentication
- **Use Cases**: IoT monitoring, DevOps metrics, sensor data

#### 15. QuestDB
- **Driver**: `pgx/v5` (PostgreSQL wire protocol)
- **Features**: High-performance time-series, SQL compatibility
- **Connection**: PostgreSQL connection string
- **Use Cases**: Financial data, real-time analytics

### Cloud & Managed Services ✅

#### 16. Supabase
- **Driver**: `pgx/v5` (PostgreSQL-compatible)
- **Features**: PostgreSQL + Supabase-specific features (RLS, functions)
- **Connection**: PostgreSQL connection string with SSL required
- **Use Cases**: Modern web applications, real-time apps, JAMstack

### AWS Services ✅

#### 17. DynamoDB
- **Driver**: `aws-sdk-go-v2/service/dynamodb`
- **Features**: NoSQL document/key-value, serverless, auto-scaling
- **Connection**: AWS credentials and region
- **Use Cases**: Serverless applications, mobile backends

#### 18. RDS (Multi-Engine)
- **Engines**: PostgreSQL, MySQL, MariaDB, Oracle, SQL Server
- **Features**: Managed SQL databases, automated backups, scaling
- **Connection**: Engine-specific connection strings
- **Use Cases**: Managed database hosting, enterprise applications

#### 19. Redshift
- **Driver**: `pgx/v5` (PostgreSQL wire protocol)
- **Features**: Data warehouse, columnar storage, MPP architecture
- **Connection**: PostgreSQL connection string with SSL
- **Use Cases**: Data warehousing, business intelligence

#### 20. Aurora (Multi-Engine)
- **Engines**: Aurora MySQL, Aurora PostgreSQL
- **Features**: Cloud-native, auto-scaling, global databases
- **Connection**: Engine-specific connection strings
- **Use Cases**: High-performance applications, global distribution

## Connection Examples

### Neo4j
```go
conn := &entities.Connection{
    Type:     entities.TypeNeo4j,
    Host:     "localhost",
    Port:     7687,
    Database: "neo4j",
    Username: "neo4j",
    Password: "password",
    SSL:      false,
}
```

### Cassandra
```go
conn := &entities.Connection{
    Type:     entities.TypeCassandra,
    Host:     "localhost",
    Port:     9042,
    Database: "test_keyspace",
    Username: "cassandra",
    Password: "cassandra",
    Options: map[string]string{
        "consistency": "QUORUM",
        "timeout":     "10s",
    },
}
```

### InfluxDB
```go
conn := &entities.Connection{
    Type:     entities.TypeInfluxDB,
    Host:     "localhost",
    Port:     8086,
    Database: "my_bucket",
    Password: "my-token",
    Options: map[string]string{
        "organization": "my-org",
    },
}
```

### Memcached
```go
conn := &entities.Connection{
    Type:     entities.TypeMemcached,
    Host:     "localhost",
    Port:     11211,
    Options: map[string]string{
        "timeout": "100ms",
    },
}
```

### DynamoDB
```go
conn := &entities.Connection{
    Type:     entities.TypeAWSDynamoDB,
    Host:     "us-east-1",        // Region
    Username: "access-key-id",
    Password: "secret-access-key",
    Options: map[string]string{
        "endpoint": "http://localhost:8000", // For local DynamoDB
    },
}
```

## Query Language Support

### SQL Databases
- **Standard SQL**: SELECT, INSERT, UPDATE, DELETE
- **DDL Operations**: CREATE, ALTER, DROP
- **Advanced Features**: CTEs, window functions, stored procedures

### NoSQL Databases
- **MongoDB**: MongoDB Query Language, aggregation pipelines
- **Cassandra**: CQL (Cassandra Query Language)
- **Neo4j**: Cypher query language
- **DynamoDB**: JSON-based operations (scan, query, get/put/update/delete)

### Cache Databases
- **Redis**: Redis commands (GET, SET, HGET, etc.)
- **Memcached**: Simple operations (GET, SET, DELETE, STATS)

### Time Series
- **InfluxDB**: Flux query language
- **QuestDB**: SQL with time-series extensions

## Advanced Features

### Connection Management
- **Connection Pooling**: Configurable pool sizes and timeouts
- **Health Monitoring**: Automatic connection health checks
- **SSL/TLS Support**: Secure connections for all database types
- **Retry Logic**: Automatic retry for transient failures

### Schema Discovery
- **Table/Collection Listing**: Discover all tables/collections
- **Column/Field Information**: Data types, constraints, defaults
- **Index Information**: Primary keys, secondary indexes, unique constraints
- **Relationship Mapping**: Foreign keys and relationships

### Query Execution
- **Parameterized Queries**: Protection against injection attacks
- **Streaming Results**: Efficient handling of large result sets
- **Query Timeout**: Configurable execution timeouts
- **Concurrent Operations**: Thread-safe operations

### Error Handling
- **Typed Errors**: Specific error codes for different scenarios
- **Connection Validation**: Pre-connection validation and testing
- **Detailed Logging**: Comprehensive error and performance logging

## Performance Optimizations

### Connection Pooling
- **Per-Database Optimization**: Tailored pool settings for each database type
- **Dynamic Scaling**: Automatic pool size adjustment based on load
- **Connection Reuse**: Efficient connection lifecycle management

### Query Optimization
- **Prepared Statements**: Cached query plans for repeated queries
- **Batch Operations**: Efficient bulk operations where supported
- **Result Streaming**: Memory-efficient large result processing

### Caching
- **Schema Caching**: Cache database schema information
- **Connection Caching**: Reuse established connections
- **Query Result Caching**: Optional result caching for expensive queries

## Security Features

### Authentication & Authorization
- **Multiple Auth Methods**: Username/password, tokens, IAM roles
- **SSL/TLS Encryption**: Secure data transmission
- **Certificate Validation**: Proper certificate chain validation

### Data Protection
- **Credential Encryption**: AES-GCM encryption for stored passwords
- **Parameter Binding**: Protection against SQL injection
- **Audit Logging**: Comprehensive security event logging

### Access Control
- **Connection Validation**: Thorough pre-connection validation
- **Permission Checking**: Database-level permission validation
- **Rate Limiting**: Optional query rate limiting

## Testing & Quality Assurance

### Test Coverage
- **Unit Tests**: Comprehensive adapter logic testing
- **Integration Tests**: Real database connection testing
- **Performance Tests**: Benchmark testing for all adapters
- **Concurrent Tests**: Multi-threaded safety testing

### Quality Metrics
- **Code Coverage**: >90% test coverage for all adapters
- **Performance Benchmarks**: Standardized performance testing
- **Memory Profiling**: Memory usage optimization
- **Error Scenario Testing**: Comprehensive failure mode testing

## Usage Examples

### Basic Connection and Query
```go
// Create adapter factory
factory := adapters.NewFactory()

// Create adapter for any supported database
adapter, err := factory.CreateAdapter(connection)
if err != nil {
    return err
}

// Connect to database
err = adapter.Connect(ctx, connection)
if err != nil {
    return err
}
defer adapter.Disconnect(ctx)

// Execute queries
result, err := adapter.ExecuteQuery(ctx, "SELECT * FROM users")
if err != nil {
    return err
}

// Process results
for _, row := range result.Rows {
    fmt.Printf("User: %v\n", row)
}
```

### Schema Discovery
```go
// Get complete schema information
schema, err := adapter.GetSchema(ctx)
if err != nil {
    return err
}

// List all tables/collections
for _, table := range schema.Tables {
    fmt.Printf("Table: %s\n", table.Name)
    
    // Get detailed table information
    tableInfo, err := adapter.GetTableInfo(ctx, table.Name)
    if err != nil {
        continue
    }
    
    // List columns
    for _, column := range tableInfo.Columns {
        fmt.Printf("  Column: %s (%s)\n", column.Name, column.Type)
    }
}
```

### Database-Specific Operations
```go
// MongoDB aggregation
mongoResult, err := adapter.ExecuteQuery(ctx, `{
    "collection": "users",
    "operation": "aggregate",
    "pipeline": [
        {"$match": {"status": "active"}},
        {"$group": {"_id": "$department", "count": {"$sum": 1}}}
    ]
}`)

// Redis operations
redisResult, err := adapter.ExecuteQuery(ctx, "HGETALL user:123")

// Neo4j Cypher query
neo4jResult, err := adapter.ExecuteQuery(ctx, "MATCH (n:Person)-[:KNOWS]->(m:Person) RETURN n.name, m.name")

// InfluxDB Flux query
influxResult, err := adapter.ExecuteQuery(ctx, `
    from(bucket: "sensors")
    |> range(start: -1h)
    |> filter(fn: (r) => r._measurement == "temperature")
    |> mean()
`)
```

## Roadmap

### Planned Additions
- **CouchDB**: Document database with HTTP API
- **ArangoDB**: Multi-model database (document, graph, key-value)
- **AWS DocumentDB**: MongoDB-compatible managed service
- **AWS ElastiCache**: Redis/Memcached managed service
- **AWS Neptune**: Managed graph database
- **AWS Keyspaces**: Cassandra-compatible managed service
- **AWS Timestream**: Managed time-series database
- **AWS Athena**: Serverless query service
- **AWS OpenSearch**: Elasticsearch-compatible search service

### Future Enhancements
- **Connection Multiplexing**: Share connections across queries
- **Query Plan Caching**: Cache and reuse query execution plans
- **Distributed Transactions**: Cross-database transaction support
- **Real-time Streaming**: Live query result streaming
- **Advanced Monitoring**: Detailed performance metrics and alerting