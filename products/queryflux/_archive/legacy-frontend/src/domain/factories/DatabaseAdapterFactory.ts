import { DatabaseType } from '../../types/database';
import { IDatabaseAdapter } from '../interfaces/IDatabaseAdapter';
import {
  PostgreSQLAdapter,
  MySQLAdapter,
  MongoDBAdapter,
  RedisAdapter,
  SQLiteAdapter,
  SQLServerAdapter,
  OracleAdapter,
  CassandraAdapter
} from '../adapters';
import { UnsupportedDatabaseTypeError } from '../errors/DatabaseErrors';

/**
 * Factory Pattern: Database Adapter Factory
 * Creates appropriate database adapter instances based on database type
 */
export class DatabaseAdapterFactory {
  private static adapters = new Map<DatabaseType, new () => IDatabaseAdapter>();
  private static customAdapters = new Map<string, new () => IDatabaseAdapter>();

  // Register built-in adapters
  static {
    this.registerAdapter('postgresql', PostgreSQLAdapter);
    this.registerAdapter('mysql', MySQLAdapter);
    this.registerAdapter('mariadb', MySQLAdapter); // MariaDB uses MySQL protocol
    this.registerAdapter('mongodb', MongoDBAdapter);
    this.registerAdapter('redis', RedisAdapter);
    this.registerAdapter('sqlite', SQLiteAdapter);
    this.registerAdapter('sqlserver', SQLServerAdapter);
    this.registerAdapter('oracle', OracleAdapter);
    this.registerAdapter('cassandra', CassandraAdapter);

    // Cloud databases use standard protocols
    this.registerAdapter('supabase', PostgreSQLAdapter);
    this.registerAdapter('planetscale', MySQLAdapter);
    this.registerAdapter('neon', PostgreSQLAdapter);
    this.registerAdapter('rds-postgresql', PostgreSQLAdapter);
    this.registerAdapter('rds-mysql', MySQLAdapter);
    this.registerAdapter('aurora', MySQLAdapter);
    this.registerAdapter('redshift', PostgreSQLAdapter);
    this.registerAdapter('documentdb', MongoDBAdapter);
    this.registerAdapter('elasticache', RedisAdapter);
    this.registerAdapter('cockroachdb', PostgreSQLAdapter);
    this.registerAdapter('timescaledb', PostgreSQLAdapter);
    this.registerAdapter('influxdb', PostgreSQLAdapter); // Simplified - needs dedicated adapter
    this.registerAdapter('questdb', PostgreSQLAdapter);   // Simplified - needs dedicated adapter
    this.registerAdapter('neo4j', PostgreSQLAdapter);     // Simplified - needs dedicated adapter
    this.registerAdapter('arangodb', PostgreSQLAdapter);   // Simplified - needs dedicated adapter
    this.registerAdapter('dynamodb', MongoDBAdapter);     // Simplified - needs dedicated adapter
    this.registerAdapter('couchdb', MongoDBAdapter);      // Simplified - needs dedicated adapter
    this.registerAdapter('memcached', RedisAdapter);      // Simplified - needs dedicated adapter
  }

  /**
   * Create a database adapter for the specified type
   * @param type Database type
   * @returns Database adapter instance
   */
  static createAdapter(type: DatabaseType): IDatabaseAdapter {
    const AdapterClass = this.adapters.get(type);

    if (!AdapterClass) {
      throw new UnsupportedDatabaseTypeError(`Unsupported database type: ${type}`);
    }

    const adapter = new AdapterClass();

    // Initialize adapter with configuration
    adapter.initialize({
      type,
      features: this.getSupportedFeatures(type),
      limitations: this.getLimitations(type)
    });

    return adapter;
  }

  /**
   * Register a new adapter type
   * @param type Database type
   * @param adapterClass Adapter class constructor
   */
  static registerAdapter(type: DatabaseType, adapterClass: new () => IDatabaseAdapter): void {
    this.adapters.set(type, adapterClass);
  }

  /**
   * Register a custom adapter with a custom type name
   * @param typeName Custom type name
   * @param adapterClass Adapter class constructor
   */
  static registerCustomAdapter(typeName: string, adapterClass: new () => IDatabaseAdapter): void {
    this.customAdapters.set(typeName, adapterClass);
  }

  /**
   * Create a custom adapter
   * @param typeName Custom type name
   * @returns Database adapter instance
   */
  static createCustomAdapter(typeName: string): IDatabaseAdapter {
    const AdapterClass = this.customAdapters.get(typeName);

    if (!AdapterClass) {
      throw new UnsupportedDatabaseTypeError(`Unsupported custom adapter type: ${typeName}`);
    }

    return new AdapterClass();
  }

  /**
   * Get all supported database types
   * @returns Array of supported database types
   */
  static getSupportedTypes(): DatabaseType[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get all registered custom adapter types
   * @returns Array of custom type names
   */
  static getCustomAdapterTypes(): string[] {
    return Array.from(this.customAdapters.keys());
  }

  /**
   * Check if a database type is supported
   * @param type Database type
   * @returns True if supported
   */
  static isSupported(type: DatabaseType): boolean {
    return this.adapters.has(type);
  }

  /**
   * Get adapter information
   * @param type Database type
   * @returns Adapter information
   */
  static getAdapterInfo(type: DatabaseType): AdapterInfo {
    if (!this.isSupported(type)) {
      throw new UnsupportedDatabaseTypeError(`Unsupported database type: ${type}`);
    }

    return {
      type,
      category: this.getDatabaseCategory(type),
      features: this.getSupportedFeatures(type),
      limitations: this.getLimitations(type),
      defaultPort: this.getDefaultPort(type),
      supportsSSL: this.supportsSSL(type),
      supportsConnectionPooling: this.supportsConnectionPooling(type),
      supportsTransactions: this.supportsTransactions(type)
    };
  }

  /**
   * Get supported features for a database type
   */
  private static getSupportedFeatures(type: DatabaseType): string[] {
    const featureMap: Record<DatabaseType, string[]> = {
      postgresql: ['transactions', 'connection-pooling', 'ssl', 'window-functions', 'cte', 'jsonb'],
      mysql: ['transactions', 'connection-pooling', 'ssl', 'json', 'cte'],
      mariadb: ['transactions', 'connection-pooling', 'ssl', 'json', 'cte'],
      mongodb: ['connection-pooling', 'ssl', 'aggregation', 'transactions'],
      redis: ['connection-pooling', 'ssl', 'clustering', 'pub-sub'],
      sqlite: ['transactions', 'json'],
      sqlserver: ['transactions', 'connection-pooling', 'ssl', 'cte', 'window-functions'],
      oracle: ['transactions', 'connection-pooling', 'ssl', 'cte', 'window-functions'],
      cassandra: ['connection-pooling', 'ssl', 'clustering'],
      // Cloud databases inherit from their base types
      supabase: ['transactions', 'connection-pooling', 'ssl', 'window-functions', 'cte', 'jsonb', 'realtime'],
      planetscale: ['transactions', 'connection-pooling', 'ssl', 'sharding'],
      neon: ['transactions', 'connection-pooling', 'ssl', 'window-functions', 'cte', 'jsonb', 'serverless'],
      // Add more as needed...
    };

    return featureMap[type] || [];
  }

  /**
   * Get limitations for a database type
   */
  private static getLimitations(type: DatabaseType): string[] {
    const limitationMap: Record<DatabaseType, string[]> = {
      sqlite: ['single-writer', 'no-concurrent-writes'],
      redis: ['no-complex-queries', 'no-joins'],
      mongodb: ['no-joins', 'limited-transactions'],
      // Add more limitations as needed...
    };

    return limitationMap[type] || [];
  }

  /**
   * Get database category
   */
  private static getDatabaseCategory(type: DatabaseType): string {
    // This should match the category from DATABASE_CONFIGS
    const categories: Record<string, string> = {
      postgresql: 'rdbms',
      mysql: 'rdbms',
      mariadb: 'rdbms',
      sqlite: 'rdbms',
      oracle: 'rdbms',
      sqlserver: 'rdbms',
      mongodb: 'nosql',
      redis: 'cache',
      cassandra: 'nosql',
      couchdb: 'nosql',
      dynamodb: 'aws',
      influxdb: 'timeseries',
      timescaledb: 'timeseries',
      questdb: 'timeseries',
      cockroachdb: 'rdbms',
      supabase: 'cloud',
      planetscale: 'cloud',
      neon: 'cloud',
      'rds-postgresql': 'aws',
      'rds-mysql': 'aws',
      aurora: 'aws',
      redshift: 'aws',
      documentdb: 'aws',
      elasticache: 'aws',
      neo4j: 'graph',
      arangodb: 'graph',
      memcached: 'cache'
    };

    return categories[type] || 'unknown';
  }

  /**
   * Get default port for database type
   */
  private static getDefaultPort(type: DatabaseType): number {
    const portMap: Record<string, number> = {
      postgresql: 5432,
      mysql: 3306,
      mariadb: 3306,
      sqlite: 0,
      oracle: 1521,
      sqlserver: 1433,
      mongodb: 27017,
      redis: 6379,
      cassandra: 9042,
      couchdb: 5984,
      dynamodb: 8000,
      influxdb: 8086,
      timescaledb: 5432,
      questdb: 9000,
      cockroachdb: 26257,
      neo4j: 7687,
      arangodb: 8529,
      memcached: 11211
    };

    return portMap[type] || 0;
  }

  /**
   * Check if database type supports SSL
   */
  private static supportsSSL(type: DatabaseType): boolean {
    const noSSL = ['sqlite', 'memcached'];
    return !noSSL.includes(type);
  }

  /**
   * Check if database type supports connection pooling
   */
  private static supportsConnectionPooling(type: DatabaseType): boolean {
    const noPooling = ['sqlite'];
    return !noPooling.includes(type);
  }

  /**
   * Check if database type supports transactions
   */
  private static supportsTransactions(type: DatabaseType): boolean {
    const noTransactions = ['redis', 'memcached', 'influxdb'];
    return !noTransactions.includes(type);
  }
}

/**
 * DTO: Adapter Information
 */
export interface AdapterInfo {
  type: DatabaseType;
  category: string;
  features: string[];
  limitations: string[];
  defaultPort: number;
  supportsSSL: boolean;
  supportsConnectionPooling: boolean;
  supportsTransactions: boolean;
}

/**
 * Abstract Factory: Database Component Factory
 * Creates related database components (adapter, connection pool, etc.)
 */
export abstract class DatabaseComponentFactory {
  abstract createAdapter(): IDatabaseAdapter;
  abstract createConnectionPool(): IConnectionPool;
  abstract createQueryOptimizer(): IQueryOptimizer;
  abstract createSchemaIntrospector(): ISchemaIntrospector;
}

/**
 * Concrete Factory: PostgreSQL Component Factory
 */
export class PostgreSQLComponentFactory extends DatabaseComponentFactory {
  createAdapter(): IDatabaseAdapter {
    return DatabaseAdapterFactory.createAdapter('postgresql');
  }

  createConnectionPool(): IConnectionPool {
    return new PostgreSQLConnectionPool();
  }

  createQueryOptimizer(): IQueryOptimizer {
    return new PostgreSQLQueryOptimizer();
  }

  createSchemaIntrospector(): ISchemaIntrospector {
    return new PostgreSQLSchemaIntrospector();
  }
}

// Add other concrete factories as needed...

/**
 * Registry for component factories
 */
export class ComponentFactoryRegistry {
  private static factories = new Map<DatabaseType, () => DatabaseComponentFactory>();

  static {
    this.factories.set('postgresql', () => new PostgreSQLComponentFactory());
    // Register other factories...
  }

  static getFactory(type: DatabaseType): DatabaseComponentFactory {
    const factoryCreator = this.factories.get(type);
    if (!factoryCreator) {
      throw new UnsupportedDatabaseTypeError(`No component factory for: ${type}`);
    }
    return factoryCreator();
  }

  static registerFactory(type: DatabaseType, factoryCreator: () => DatabaseComponentFactory): void {
    this.factories.set(type, factoryCreator);
  }
}

// Forward declarations for interfaces (to be implemented)
export interface IConnectionPool {
  connect(config: any): Promise<any>;
  disconnect(): Promise<void>;
  getConnection(): Promise<any>;
  releaseConnection(connection: any): Promise<void>;
}

export interface IQueryOptimizer {
  optimize(sql: string): string;
  explain(sql: string): Promise<any>;
}

export interface ISchemaIntrospector {
  getTables(): Promise<any[]>;
  getColumns(table: string): Promise<any[]>;
  getIndexes(table: string): Promise<any[]>;
}

// Placeholder implementations
class PostgreSQLConnectionPool implements IConnectionPool {
  async connect(config: any): Promise<any> { return {}; }
  async disconnect(): Promise<void> {}
  async getConnection(): Promise<any> { return {}; }
  async releaseConnection(connection: any): Promise<void> {}
}

class PostgreSQLQueryOptimizer implements IQueryOptimizer {
  optimize(sql: string): string { return sql; }
  async explain(sql: string): Promise<any> { return {}; }
}

class PostgreSQLSchemaIntrospector implements ISchemaIntrospector {
  async getTables(): Promise<any[]> { return []; }
  async getColumns(table: string): Promise<any[]> { return []; }
  async getIndexes(table: string): Promise<any[]> { return []; }
}
