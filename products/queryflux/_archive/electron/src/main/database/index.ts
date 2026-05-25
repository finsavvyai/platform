/**
 * Database Module Index
 * Exports all database adapters and utilities
 */

// Types and interfaces
export * from './types';

// Base adapter
export { default as BaseDatabaseAdapter } from './base-adapter';

// Database adapters
export { default as PostgreSQLAdapter } from './adapters/postgresql-adapter';
export { default as MySQLAdapter } from './adapters/mysql-adapter';
export { default as MongoDBAdapter } from './adapters/mongodb-adapter';
export { default as SQLiteAdapter } from './adapters/sqlite-adapter';
export { default as OracleAdapter } from './adapters/oracle-adapter';
export { default as SQLServerAdapter } from './adapters/sql-server-adapter';
export { default as CassandraAdapter } from './adapters/cassandra-adapter';
export { default as RedisAdapter } from './adapters/redis-adapter';
export { default as Neo4jAdapter } from './adapters/neo4j-adapter';
export { TimescaleDBAdapter } from './adapters/timescaledb-adapter';
export { InfluxDBAdapter } from './adapters/influxdb-adapter';
export { SnowflakeAdapter } from './adapters/snowflake-adapter';
export { BigQueryAdapter } from './adapters/bigquery-adapter';
export { ElasticsearchAdapter } from './adapters/elasticsearch-adapter';
export { DynamoDBAdapter } from './adapters/dynamodb-adapter';
export { NeptuneAdapter } from './adapters/neptune-adapter';
export { CouchDBAdapter } from './adapters/couchdb-adapter';

// Factory
export {
  DatabaseAdapterFactory,
  createPostgreSQLAdapter,
  createMySQLAdapter,
  createMongoDBAdapter,
  createSQLiteAdapter,
  createOracleAdapter,
  createSQLServerAdapter,
  createCassandraAdapter,
  createRedisAdapter,
  createNeo4jAdapter,
  createTimescaleDBAdapter,
  createInfluxDBAdapter,
  createSnowflakeAdapter,
  createBigQueryAdapter,
  createElasticsearchAdapter,
  createDynamoDBAdapter,
  createNeptuneAdapter,
  createCouchDBAdapter,
  createAdapterFromConfig,
  getSupportedDatabases
} from './adapter-factory';

// Re-export commonly used types for convenience
export type {
  IDatabaseAdapter,
  ConnectionParams,
  DatabaseInfo,
  CollectionInfo,
  QueryResult,
  DatabaseError,
  ConnectionError,
  QueryError
} from './types';
