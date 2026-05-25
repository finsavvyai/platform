/**
 * Database Adapter Factory
 * Creates appropriate adapter instances based on database type
 * Based on postgres-docker adapter factory patterns
 */

import PostgreSQLAdapter from './adapters/postgresql-adapter';
import MongoDBAdapter from './adapters/mongodb-adapter';
import MySQLAdapter from './adapters/mysql-adapter';
import SQLiteAdapter from './adapters/sqlite-adapter';
import OracleAdapter from './adapters/oracle-adapter';
import SQLServerAdapter from './adapters/sql-server-adapter';
import CassandraAdapter from './adapters/cassandra-adapter';
import RedisAdapter from './adapters/redis-adapter';
import Neo4jAdapter from './adapters/neo4j-adapter';
import { TimescaleDBAdapter } from './adapters/timescaledb-adapter';
import { InfluxDBAdapter } from './adapters/influxdb-adapter';
import { SnowflakeAdapter } from './adapters/snowflake-adapter';
import { BigQueryAdapter } from './adapters/bigquery-adapter';
import { ElasticsearchAdapter } from './adapters/elasticsearch-adapter';
import { DynamoDBAdapter } from './adapters/dynamodb-adapter';
import { NeptuneAdapter } from './adapters/neptune-adapter';
import { CouchDBAdapter } from './adapters/couchdb-adapter';
import { ScyllaDBAdapter } from './adapters/scylladb-adapter';
import { ArangoDBAdapter } from './adapters/arangodb-adapter';
import {
  DatabaseType,
  ConnectionParams,
  IDatabaseAdapter,
  DatabaseError
} from './types';

export class DatabaseAdapterFactory {
  // Registry of available adapters
  private static readonly adapters = new Map<DatabaseType, new (params: ConnectionParams) => IDatabaseAdapter>([
    [DatabaseType.POSTGRESQL, PostgreSQLAdapter],
    [DatabaseType.MYSQL, MySQLAdapter],
    [DatabaseType.SQLITE, SQLiteAdapter],
    [DatabaseType.MONGODB, MongoDBAdapter],
    [DatabaseType.ORACLE, OracleAdapter],
    [DatabaseType.SQLSERVER, SQLServerAdapter],
    [DatabaseType.CASSANDRA, CassandraAdapter],
    [DatabaseType.REDIS, RedisAdapter],
    [DatabaseType.NEO4J, Neo4jAdapter],
    [DatabaseType.TIMESCALEDB, TimescaleDBAdapter],
    [DatabaseType.INFLUXDB, InfluxDBAdapter],
    [DatabaseType.SNOWFLAKE, SnowflakeAdapter],
    [DatabaseType.BIGQUERY, BigQueryAdapter],
    [DatabaseType.ELASTICSEARCH, ElasticsearchAdapter],
    [DatabaseType.DYNAMODB, DynamoDBAdapter],
    [DatabaseType.NEPTUNE, NeptuneAdapter],
    [DatabaseType.COUCHDB, CouchDBAdapter],
  ]);

  /**
   * Create a database adapter instance for the specified database type
   */
  static createAdapter(dbType: DatabaseType, connectionParams: ConnectionParams): IDatabaseAdapter {
    const AdapterClass = this.adapters.get(dbType);

    if (!AdapterClass) {
      const availableTypes = Array.from(this.adapters.keys()).map(type => type.toString());
      throw new DatabaseError(
        `Unsupported database type: ${dbType}. Available types: ${availableTypes.join(', ')}`,
        dbType
      );
    }

    try {
      return new AdapterClass(connectionParams);
    } catch (error) {
      throw new DatabaseError(
        `Failed to create adapter for ${dbType}: ${(error as Error).message}`,
        dbType,
        error as Error
      );
    }
  }

  /**
   * Create adapter from connection string
   */
  static createFromConnectionString(connectionString: string): IDatabaseAdapter {
    const parsed = this.parseConnectionString(connectionString);
    return this.createAdapter(parsed.dbType, parsed.connectionParams);
  }

  /**
   * Create adapter from configuration object
   */
  static createFromConfig(config: Record<string, any>): IDatabaseAdapter {
    const dbTypeStr = config.type?.toLowerCase();

    if (!dbTypeStr) {
      throw new DatabaseError('Database type is required in configuration', DatabaseType.POSTGRESQL);
    }

    let dbType: DatabaseType;

    // Map string to enum
    switch (dbTypeStr) {
      case 'postgresql':
      case 'postgres':
        dbType = DatabaseType.POSTGRESQL;
        break;
      case 'mysql':
        dbType = DatabaseType.MYSQL;
        break;
      case 'mariadb':
        dbType = DatabaseType.MARIADB;
        break;
      case 'mongodb':
      case 'mongo':
        dbType = DatabaseType.MONGODB;
        break;
      case 'sqlite':
        dbType = DatabaseType.SQLITE;
        break;
      case 'sqlserver':
      case 'mssql':
        dbType = DatabaseType.SQLSERVER;
        break;
      case 'oracle':
        dbType = DatabaseType.ORACLE;
        break;
      case 'cassandra':
        dbType = DatabaseType.CASSANDRA;
        break;
      case 'couchdb':
        dbType = DatabaseType.COUCHDB;
        break;
      case 'influxdb':
        dbType = DatabaseType.INFLUXDB;
        break;
      case 'elasticsearch':
      case 'es':
        dbType = DatabaseType.ELASTICSEARCH;
        break;
      case 'dynamodb':
        dbType = DatabaseType.DYNAMODB;
        break;
      case 'neptune':
        dbType = DatabaseType.NEPTUNE;
        break;
      case 'couchdb':
        dbType = DatabaseType.COUCHDB;
        break;
      case 'timescaledb':
        dbType = DatabaseType.TIMESCALEDB;
        break;
      case 'snowflake':
        dbType = DatabaseType.SNOWFLAKE;
        break;
      case 'bigquery':
      case 'bq':
        dbType = DatabaseType.BIGQUERY;
        break;
      case 'dynamodb':
        dbType = DatabaseType.DYNAMODB;
        break;
      case 'redshift':
        dbType = DatabaseType.REDSHIFT;
        break;
      default:
        throw new DatabaseError(`Unknown database type: ${dbTypeStr}`, DatabaseType.POSTGRESQL);
    }

    const connectionParams: ConnectionParams = {
      host: config.host || 'localhost',
      port: config.port || this.getDefaultPort(dbType),
      username: config.username,
      password: config.password,
      database: config.database,
      authDatabase: config.authDatabase,
      ssl: config.ssl || false,
      connectionString: config.connectionString,
      additionalParams: config.additionalParams || {}
    };

    return this.createAdapter(dbType, connectionParams);
  }

  /**
   * Get list of available database types
   */
  static getAvailableTypes(): DatabaseType[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if a database type is supported
   */
  static isTypeSupported(dbType: DatabaseType): boolean {
    return this.adapters.has(dbType);
  }

  /**
   * Get requirements information for a specific adapter
   */
  static getAdapterRequirements(dbType: DatabaseType): Record<string, any> {
    const requirements = {
      [DatabaseType.POSTGRESQL]: {
        package: 'pg',
        installCommand: 'npm install pg',
        defaultPort: 5432,
        description: 'PostgreSQL relational database',
        dependency: 'pg'
      },
      [DatabaseType.MYSQL]: {
        package: 'mysql2',
        installCommand: 'npm install mysql2',
        defaultPort: 3306,
        description: 'MySQL relational database',
        dependency: 'mysql2'
      },
      [DatabaseType.MONGODB]: {
        package: 'mongodb',
        installCommand: 'npm install mongodb',
        defaultPort: 27017,
        description: 'MongoDB document database',
        dependency: 'mongodb'
      },
      [DatabaseType.SQLITE]: {
        package: 'better-sqlite3',
        installCommand: 'npm install better-sqlite3 sqlite',
        defaultPort: 0,
        description: 'SQLite embedded database',
        dependency: 'better-sqlite3'
      },
      [DatabaseType.ORACLE]: {
        package: 'oracledb',
        installCommand: 'npm install oracledb',
        defaultPort: 1521,
        description: 'Oracle Database',
        dependency: 'oracledb'
      },
      [DatabaseType.SQLSERVER]: {
        package: 'tedious',
        installCommand: 'npm install tedious',
        defaultPort: 1433,
        description: 'Microsoft SQL Server',
        dependency: 'tedious'
      },
      [DatabaseType.CASSANDRA]: {
        package: 'cassandra-driver',
        installCommand: 'npm install cassandra-driver',
        defaultPort: 9042,
        description: 'Apache Cassandra',
        dependency: 'cassandra-driver'
      },
      [DatabaseType.COUCHDB]: {
        package: 'nano',
        installCommand: 'npm install nano',
        defaultPort: 5984,
        description: 'Apache CouchDB',
        dependency: 'nano'
      },
      [DatabaseType.INFLUXDB]: {
        package: '@influxdata/influxdb-client',
        installCommand: 'npm install @influxdata/influxdb-client',
        defaultPort: 8086,
        description: 'InfluxDB time series database',
        dependency: '@influxdata/influxdb-client'
      },
      [DatabaseType.ELASTICSEARCH]: {
        package: '@elastic/elasticsearch',
        installCommand: 'npm install @elastic/elasticsearch',
        defaultPort: 9200,
        description: 'Elasticsearch search engine',
        dependency: '@elastic/elasticsearch'
      },
      [DatabaseType.MARIADB]: {
        package: 'mysql2',
        installCommand: 'npm install mysql2',
        defaultPort: 3306,
        description: 'MariaDB MySQL-compatible database',
        dependency: 'mysql2'
      },
      [DatabaseType.SNOWFLAKE]: {
        package: 'snowflake-sdk',
        installCommand: 'npm install snowflake-sdk',
        defaultPort: 443,
        description: 'Snowflake cloud data warehouse',
        dependency: 'snowflake-sdk'
      },
      [DatabaseType.BIGQUERY]: {
        package: '@google-cloud/bigquery',
        installCommand: 'npm install @google-cloud/bigquery',
        defaultPort: 443,
        description: 'Google BigQuery data warehouse',
        dependency: '@google-cloud/bigquery'
      },
      [DatabaseType.DYNAMODB]: {
        package: '@aws-sdk/client-dynamodb',
        installCommand: 'npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb',
        defaultPort: 8000,
        description: 'AWS DynamoDB NoSQL database',
        dependency: '@aws-sdk/client-dynamodb'
      },
      [DatabaseType.ELASTICSEARCH]: {
        package: '@elastic/elasticsearch',
        installCommand: 'npm install @elastic/elasticsearch',
        defaultPort: 9200,
        description: 'Elasticsearch search and analytics engine',
        dependency: '@elastic/elasticsearch'
      },
      [DatabaseType.NEPTUNE]: {
        package: 'gremlin',
        installCommand: 'npm install gremlin aws-sdk',
        defaultPort: 8182,
        description: 'AWS Neptune graph database with Gremlin and SPARQL',
        dependency: 'gremlin'
      },
      [DatabaseType.COUCHDB]: {
        package: 'nano',
        installCommand: 'npm install nano',
        defaultPort: 5984,
        description: 'Apache CouchDB document database',
        dependency: 'nano'
      },
      [DatabaseType.REDSHIFT]: {
        package: '@aws-sdk/client-redshift-data-api',
        installCommand: 'npm install @aws-sdk/client-redshift-data-api',
        defaultPort: 5439,
        description: 'AWS Redshift data warehouse',
        dependency: '@aws-sdk/client-redshift-data-api'
      },
      [DatabaseType.NEO4J]: {
        package: 'neo4j-driver',
        installCommand: 'npm install neo4j-driver',
        defaultPort: 7687,
        description: 'Neo4j graph database',
        dependency: 'neo4j-driver'
      },
      [DatabaseType.TIMESCALEDB]: {
        package: 'pg',
        installCommand: 'npm install pg',
        defaultPort: 5432,
        description: 'TimescaleDB time series database (extends PostgreSQL)',
        dependency: 'pg'
      },
      [DatabaseType.INFLUXDB]: {
        package: '@influxdata/influxdb-client',
        installCommand: 'npm install @influxdata/influxdb-client',
        defaultPort: 8086,
        description: 'InfluxDB time series database',
        dependency: '@influxdata/influxdb-client'
      },
      [DatabaseType.SNOWFLAKE]: {
        package: 'snowflake-sdk',
        installCommand: 'npm install snowflake-sdk',
        defaultPort: 443,
        description: 'Snowflake cloud data warehouse',
        dependency: 'snowflake-sdk'
      },
      [DatabaseType.BIGQUERY]: {
        package: '@google-cloud/bigquery',
        installCommand: 'npm install @google-cloud/bigquery',
        defaultPort: 443,
        description: 'Google BigQuery data warehouse',
        dependency: '@google-cloud/bigquery'
      },
      [DatabaseType.DYNAMODB]: {
        package: '@aws-sdk/client-dynamodb',
        installCommand: 'npm install @aws-sdk/client-dynamodb',
        defaultPort: 8000,
        description: 'AWS DynamoDB NoSQL database',
        dependency: '@aws-sdk/client-dynamodb'
      }
    };

    return requirements[dbType] || {};
  }

  /**
   * Test which dependencies are available
   */
  static testDependencies(): Record<string, any> {
    const results: Record<string, any> = {};

    for (const [dbType] of this.adapters) {
      const requirements = this.getAdapterRequirements(dbType);
      const packageName = requirements.dependency;

      if (packageName) {
        try {
          require.resolve(packageName);
          results[dbType] = {
            available: true,
            package: packageName
          };
        } catch (e) {
          results[dbType] = {
            available: false,
            package: packageName,
            installCommand: requirements.installCommand
          };
        }
      }
    }

    return results;
  }

  /**
   * Register a custom adapter class
   */
  static registerAdapter(dbType: DatabaseType, adapterClass: new (params: ConnectionParams) => IDatabaseAdapter): void {
    // Basic validation - in a real implementation, we'd check interface compliance
    this.adapters.set(dbType, adapterClass);
  }

  /**
   * Unregister an adapter
   */
  static unregisterAdapter(dbType: DatabaseType): void {
    this.adapters.delete(dbType);
  }

  /**
   * Parse connection string and extract database type and parameters
   */
  private static parseConnectionString(connectionString: string): { dbType: DatabaseType; connectionParams: ConnectionParams } {
    const url = new URL(connectionString);

    let dbType: DatabaseType;

    switch (url.protocol) {
      case 'postgresql:':
      case 'postgres:':
        dbType = DatabaseType.POSTGRESQL;
        break;
      case 'mysql:':
        dbType = DatabaseType.MYSQL;
        break;
      case 'mongodb:':
        dbType = DatabaseType.MONGODB;
        break;
      case 'redis:':
        dbType = DatabaseType.REDIS;
        break;
      default:
        throw new DatabaseError(`Unsupported connection string protocol: ${url.protocol}`, DatabaseType.POSTGRESQL);
    }

    const connectionParams: ConnectionParams = {
      host: url.hostname || 'localhost',
      port: parseInt(url.port) || this.getDefaultPort(dbType),
      username: url.username,
      password: url.password,
      database: url.pathname?.slice(1), // Remove leading slash
      ssl: url.searchParams.has('ssl'),
      connectionString,
      additionalParams: {}
    };

    // Parse additional query parameters
    for (const [key, value] of url.searchParams) {
      if (key !== 'ssl') {
        connectionParams.additionalParams![key] = value;
      }
    }

    return { dbType, connectionParams };
  }

  /**
   * Get default port for database type
   */
  private static getDefaultPort(dbType: DatabaseType): number {
    const defaultPorts = {
      [DatabaseType.POSTGRESQL]: 5432,
      [DatabaseType.MYSQL]: 3306,
      [DatabaseType.MONGODB]: 27017,
      [DatabaseType.SQLITE]: 0,
      [DatabaseType.REDIS]: 6379,
      [DatabaseType.INFLUXDB]: 8086,
      [DatabaseType.NEO4J]: 7687,
      [DatabaseType.TIMESCALEDB]: 5432,
      [DatabaseType.SNOWFLAKE]: 443,
      [DatabaseType.BIGQUERY]: 443,
      [DatabaseType.DYNAMODB]: 8000,
      [DatabaseType.ELASTICSEARCH]: 9200,
      [DatabaseType.NEPTUNE]: 8182,
      [DatabaseType.COUCHDB]: 5984,
      [DatabaseType.REDSHIFT]: 5439
    };

    return defaultPorts[dbType] || 0;
  }
}

// Convenience functions
export function createPostgreSQLAdapter(params: Partial<ConnectionParams> = {}): PostgreSQLAdapter {
  const connectionParams: ConnectionParams = {
    host: params.host || 'localhost',
    port: params.port || 5432,
    username: params.username,
    password: params.password,
    database: params.database,
    ssl: params.ssl || false,
    additionalParams: params.additionalParams || {}
  };

  return new PostgreSQLAdapter(connectionParams);
}

export function createMySQLAdapter(params: Partial<ConnectionParams> = {}): MySQLAdapter {
  const connectionParams: ConnectionParams = {
    host: params.host || 'localhost',
    port: params.port || 3306,
    username: params.username,
    password: params.password,
    database: params.database,
    ssl: params.ssl || false,
    additionalParams: params.additionalParams || {}
  };

  return new MySQLAdapter(connectionParams);
}

export function createMongoDBAdapter(params: Partial<ConnectionParams> = {}): MongoDBAdapter {
  const connectionParams: ConnectionParams = {
    host: params.host || 'localhost',
    port: params.port || 27017,
    username: params.username,
    password: params.password,
    database: params.database,
    authDatabase: params.authDatabase,
    ssl: params.ssl || false,
    additionalParams: params.additionalParams || {}
  };

  return new MongoDBAdapter(connectionParams);
}

export function createSQLiteAdapter(params: Partial<ConnectionParams> = {}): SQLiteAdapter {
  const connectionParams: ConnectionParams = {
    host: params.host || '', // Not used for SQLite
    port: 0, // Not used for SQLite
    username: undefined, // Not used for SQLite
    password: undefined, // Not used for SQLite
    database: params.database, // File path
    ssl: false,
    additionalParams: params.additionalParams || {}
  };

  return new SQLiteAdapter(connectionParams);
}

export function createOracleAdapter(params: Partial<ConnectionParams> = {}): OracleAdapter {
  const connectionParams: ConnectionParams = {
    host: params.host || 'localhost',
    port: params.port || 1521,
    username: params.username,
    password: params.password,
    database: params.database, // Service name or SID
    ssl: params.ssl || false,
    additionalParams: params.additionalParams || {}
  };

  return new OracleAdapter(connectionParams);
}

export function createSQLServerAdapter(params: Partial<ConnectionParams> = {}): SQLServerAdapter {
  const connectionParams: ConnectionParams = {
    host: params.host || 'localhost',
    port: params.port || 1433,
    username: params.username,
    password: params.password,
    database: params.database,
    ssl: params.ssl || false,
    additionalParams: params.additionalParams || {}
  };

  return new SQLServerAdapter(connectionParams);
}

export function createCassandraAdapter(params: Partial<ConnectionParams> = {}): CassandraAdapter {
  const connectionParams: ConnectionParams = {
    host: params.host || 'localhost',
    port: params.port || 9042,
    username: params.username,
    password: params.password,
    database: params.database || 'datacenter1',
    ssl: params.ssl || false,
    additionalParams: params.additionalParams || {}
  };

  return new CassandraAdapter(connectionParams);
}

export function createRedisAdapter(params: Partial<ConnectionParams> = {}): RedisAdapter {
  const connectionParams: ConnectionParams = {
    host: params.host || 'localhost',
    port: params.port || 6379,
    username: undefined, // Redis doesn't use username
    password: params.password,
    database: params.database || '0', // Database number
    ssl: params.ssl || false,
    additionalParams: params.additionalParams || {}
  };

  return new RedisAdapter(connectionParams);
}

export function createNeo4jAdapter(params: Partial<ConnectionParams> = {}): Neo4jAdapter {
  const connectionParams: ConnectionParams = {
    host: params.host || 'localhost',
    port: params.port || 7687,
    username: params.username || 'neo4j',
    password: params.password,
    database: undefined, // Neo4j doesn't use database
    ssl: params.ssl || false,
    additionalParams: params.additionalParams || {}
  };

  return new Neo4jAdapter(connectionParams);
}

export function createTimescaleDBAdapter(params: Partial<ConnectionParams> = {}): TimescaleDBAdapter {
  const connectionParams: ConnectionParams = {
    host: params.host || 'localhost',
    port: params.port || 5432,
    username: params.username,
    password: params.password,
    database: params.database,
    ssl: params.ssl || false,
    additionalParams: params.additionalParams || {}
  };

  return new TimescaleDBAdapter(connectionParams);
}

export function createInfluxDBAdapter(params: Partial<ConnectionParams> = {}): InfluxDBAdapter {
  const connectionParams: ConnectionParams = {
    host: params.host || 'localhost',
    port: params.port || 8086,
    username: params.username,
    password: params.password,
    database: params.database, // bucket name
    ssl: params.ssl || false,
    additionalParams: params.additionalParams || {}
  };

  return new InfluxDBAdapter(connectionParams);
}

export function createSnowflakeAdapter(params: Partial<ConnectionParams> = {}): SnowflakeAdapter {
  const connectionParams: ConnectionParams = {
    host: params.host || 'account.snowflakecomputing.com',
    port: params.port || 443,
    username: params.username,
    password: params.password,
    database: params.database,
    ssl: params.ssl || true,
    additionalParams: {
      warehouse: params.additionalParams?.warehouse,
      role: params.additionalParams?.role,
      schema: params.additionalParams?.schema,
      account: params.additionalParams?.account,
      ...params.additionalParams
    }
  };

  return new SnowflakeAdapter(connectionParams);
}

export function createBigQueryAdapter(params: Partial<ConnectionParams> = {}): BigQueryAdapter {
  const connectionParams: ConnectionParams = {
    host: params.host || 'bigquery.googleapis.com',
    port: params.port || 443,
    username: params.username,
    password: params.password,
    database: params.database, // project ID
    ssl: params.ssl || true,
    additionalParams: {
      dataset: params.additionalParams?.dataset,
      location: params.additionalParams?.location,
      keyFilename: params.additionalParams?.keyFilename,
      clientEmail: params.additionalParams?.clientEmail,
      privateKey: params.additionalParams?.privateKey,
      ...params.additionalParams
    }
  };

  return new BigQueryAdapter(connectionParams);
}

export function createElasticsearchAdapter(params: Partial<ConnectionParams> = {}): ElasticsearchAdapter {
  const connectionParams: ConnectionParams = {
    host: params.host || 'localhost',
    port: params.port || 9200,
    username: params.username,
    password: params.password,
    database: params.database, // index name
    ssl: params.ssl || true,
    additionalParams: {
      index: params.additionalParams?.index,
      apiKey: params.additionalParams?.apiKey,
      cloudId: params.additionalParams?.cloudId,
      timeout: params.additionalParams?.timeout,
      maxRetries: params.additionalParams?.maxRetries,
      ...params.additionalParams
    }
  };

  return new ElasticsearchAdapter(connectionParams);
}

export function createDynamoDBAdapter(params: Partial<ConnectionParams> = {}): DynamoDBAdapter {
  const connectionParams: ConnectionParams = {
    host: params.host || 'localhost',
    port: params.port || 8000,
    username: params.username,
    password: params.password,
    database: params.database, // region
    ssl: params.ssl || false,
    additionalParams: {
      region: params.additionalParams?.region || 'us-east-1',
      accessKeyId: params.additionalParams?.accessKeyId,
      secretAccessKey: params.additionalParams?.secretAccessKey,
      sessionToken: params.additionalParams?.sessionToken,
      endpoint: params.additionalParams?.endpoint,
      maxRetries: params.additionalParams?.maxRetries,
      ...params.additionalParams
    }
  };

  return new DynamoDBAdapter(connectionParams);
}

export function createNeptuneAdapter(params: Partial<ConnectionParams> = {}): NeptuneAdapter {
  const connectionParams: ConnectionParams = {
    host: params.host || 'localhost',
    port: params.port || 8182,
    username: params.username,
    password: params.password,
    database: params.database, // cluster name
    ssl: params.ssl || true,
    additionalParams: {
      region: params.additionalParams?.region || 'us-east-1',
      accessKeyId: params.additionalParams?.accessKeyId,
      secretAccessKey: params.additionalParams?.secretAccessKey,
      sessionToken: params.additionalParams?.sessionToken,
      endpoint: params.additionalParams?.endpoint,
      queryLanguage: params.additionalParams?.queryLanguage || 'gremlin',
      maxRetries: params.additionalParams?.maxRetries,
      timeout: params.additionalParams?.timeout,
      ...params.additionalParams
    }
  };

  return new NeptuneAdapter(connectionParams);
}

export function createCouchDBAdapter(params: Partial<ConnectionParams> = {}): CouchDBAdapter {
  const connectionParams: ConnectionParams = {
    host: params.host || 'localhost',
    port: params.port || 5984,
    username: params.username,
    password: params.password,
    database: params.database,
    ssl: params.ssl || false,
    additionalParams: {
      timeout: params.additionalParams?.timeout,
      maxRetries: params.additionalParams?.maxRetries,
      keepAlive: params.additionalParams?.keepAlive,
      ...params.additionalParams
    }
  };

  return new CouchDBAdapter(connectionParams);
}

export function createAdapterFromConfig(config: Record<string, any>): IDatabaseAdapter {
  return DatabaseAdapterFactory.createFromConfig(config);
}

export function getSupportedDatabases(): Record<string, string> {
  const supported: Record<string, string> = {};

  for (const dbType of DatabaseAdapterFactory.getAvailableTypes()) {
    const requirements = DatabaseAdapterFactory.getAdapterRequirements(dbType);
    supported[dbType] = requirements.description || `${dbType} database`;
  }

  return supported;
}

export default DatabaseAdapterFactory;
