/**
 * Database Connection Manager - Multi-Database Support
 *
 * Handles connections to PostgreSQL, MySQL, MongoDB, Redis, etc.
 * with enterprise-grade security and VPN support
 */

import { z } from 'zod';
import { Pool, Pool as PgPool } from 'pg';
import { createPool } from 'mysql2/promise';
import { MongoClient, Db as MongoDb } from 'mongodb';
import { createClient } from 'redis';
import { Client } from 'ssh2';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { ConnectionPool } from '../security/connection-pool.js';
import { CredentialManager } from '../security/credential-manager.js';

// Database connection configuration schema
const ConnectionConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Connection name is required'),
  type: z.enum(['postgresql', 'mysql', 'mongodb', 'redis', 'sqlite', 'sqlserver', 'oracle', 'cassandra', 'elasticsearch', 'couchbase', 'dynamodb', 'bigquery', 'snowflake', 'redshift']),
  host: z.string().min(1, 'Host is required'),
  port: z.number().min(1).max(65535, 'Port must be between 1-65535'),
  database: z.string().min(1, 'Database name is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  ssl: z.boolean().default(true),
  connectionTimeout: z.number().default(30000),
  queryTimeout: z.number().default(60000),
  maxConnections: z.number().min(1).max(100).default(10),
  sshTunnel: z.object({
    enabled: z.boolean().default(false),
    host: z.string().optional(),
    port: z.number().default(22),
    username: z.string().optional(),
    password: z.string().optional(),
    privateKey: z.string().optional(),
    bastion: z.boolean().default(false)
  }).optional(),
  advanced: z.object({
    charset: z.string().default('utf8'),
    timezone: z.string().default('UTC'),
    applicationName: z.string().default('QueryFlux OpenAI App')
  }).optional()
});

interface DatabaseConnection {
  id: string;
  name: string;
  type: string;
  config: z.infer<typeof ConnectionConfigSchema>;
  pool: any;
  isConnected: boolean;
  lastConnected: Date;
  connectionCount: number;
  healthCheckInterval?: NodeJS.Timeout;
}

/**
 * Database Connection Manager
 * Supports multiple database types with connection pooling and security
 */
export class DatabaseConnectionManager {
  private connections: Map<string, DatabaseConnection> = new Map();
  private connectionPools: Map<string, ConnectionPool> = new Map();
  private credentialManager: CredentialManager;
  private connectionListeners: Map<string, Set<Function>> = new Map();
  private healthCheckInterval: number = 30000; // 30 seconds

  constructor() {
    this.credentialManager = new CredentialManager();
    this.setupEventHandlers();
    this.startHealthChecks();

    logger.info('📊 Database Connection Manager initialized');
    logger.info(`🔌 Supported databases: ${this.getSupportedDatabaseTypes().join(', ')}`);
  }

  /**
   * Create new database connection
   */
  async createConnection(config: z.infer<typeof ConnectionConfigSchema>): Promise<DatabaseConnection> {
    const validatedConfig = ConnectionConfigSchema.parse(config);
    const connectionId = validatedConfig.id || this.generateConnectionId();

    logger.info(`🔗 Creating connection to ${validatedConfig.type}: ${validatedConfig.host}:${validatedConfig.port}/${validatedConfig.database}`);

    try {
      // Store credentials securely
      const credentialId = await this.credentialManager.storeCredentials({
        connectionId,
        type: validatedConfig.type,
        host: validatedConfig.host,
        username: validatedConfig.username,
        password: validatedConfig.password,
        sshConfig: validatedConfig.sshTunnel
      });

      // Create connection pool
      const pool = await this.createConnectionPool(validatedConfig, credentialId);

      // Test the connection
      const isConnected = await this.testConnection(pool, validatedConfig);

      const connection: DatabaseConnection = {
        id: connectionId,
        name: validatedConfig.name,
        type: validatedConfig.type,
        config: validatedConfig,
        pool,
        isConnected,
        lastConnected: new Date(),
        connectionCount: 0
      };

      // Store connection
      this.connections.set(connectionId, connection);
      this.connectionPools.set(connectionId, pool);

      logger.info(`✅ Successfully created connection: ${validatedConfig.name} (${connectionId})`);

      // Notify listeners
      await this.notifyConnectionListeners('created', connection);

      return connection;

    } catch (error) {
      logger.error(`❌ Failed to create connection: ${error.message}`);
      throw new DatabaseConnectionError(`Failed to create connection: ${error.message}`, {
        cause: error,
        config: validatedConfig
      });
    }
  }

  /**
   * Test database connection
   */
  async testConnection(pool: any, config: any): Promise<boolean> {
    try {
      const startTime = Date.now();

      switch (config.type) {
        case 'postgresql':
          const client = await (pool as PgPool).connect();
          await client.query('SELECT 1');
          await client.end();
          break;

        case 'mysql':
          await (pool as any).execute('SELECT 1');
          break;

        case 'mongodb':
          const db = (pool as MongoClient).db();
          await db.command({ ping: 1 });
          break;

        case 'redis':
          await (pool as any).ping();
          break;

        case 'sqlserver':
          // SQL Server connection test
          break;

        case 'oracle':
          // Oracle connection test
          break;

        default:
          throw new Error(`Unsupported database type: ${config.type}`);
      }

      const responseTime = Date.now() - startTime;
      logger.info(`✅ Connection test successful (${responseTime}ms)`);
      return true;

    } catch (error) {
      logger.error(`❌ Connection test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Execute SQL query
   */
  async executeQuery(connectionId: string, query: string, params: any[] = []): Promise<QueryExecutionResult> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new DatabaseConnectionError(`Connection not found: ${connectionId}`);
    }

    if (!connection.isConnected) {
      logger.warn(`⚠️ Connection ${connectionId} is not connected, attempting to reconnect...`);
      await this.reconnectConnection(connectionId);
    }

    try {
      const startTime = Date.now();

      // Security validation for query
      const validationResult = await this.validateQuery(query, connection);
      if (!validationResult.isValid) {
        throw new DatabaseConnectionError(`Query validation failed: ${validationResult.reason}`, {
          query,
          validation: validationResult
        });
      }

      // Execute query with timeout
      let result: any;

      switch (connection.type) {
        case 'postgresql':
          result = await this.executePostgreSQLQuery(connection, query, params);
          break;

        case 'mysql':
          result = await this.executeMySQLQuery(connection, query, params);
          break;

        case 'mongodb':
          result = await this.executeMongoDBQuery(connection, query);
          break;

        case 'redis':
          result = await this.executeRedisCommand(connection, query);
          break;

        default:
          throw new DatabaseConnectionError(`Query execution not implemented for: ${connection.type}`);
      }

      const executionTime = Date.now() - startTime;
      connection.connectionCount = (connection.connectionCount || 0) + 1;

      const queryResult: QueryExecutionResult = {
        success: true,
        data: result.data || result.rows || result,
        rowCount: result.rowCount || result.affectedRows || 0,
        columns: result.columns || result.fields || [],
        executionTime: `${executionTime}ms`,
        connectionId,
        query,
        metadata: {
          queryHash: this.generateQueryHash(query),
          executionTimestamp: new Date().toISOString(),
          connectionMetadata: {
            databaseType: connection.type,
            host: connection.config.host,
            database: connection.config.database
          }
        }
      };

      // Log query execution for monitoring
      await this.logQueryExecution(queryResult);

      // Update last connected time
      connection.lastConnected = new Date();

      logger.info(`✅ Query executed in ${executionTime}ms (${queryResult.rowCount} rows)`);

      // Notify listeners
      await this.notifyConnectionListeners('queryExecuted', queryResult);

      return queryResult;

    } catch (error) {
      const errorResult: QueryExecutionResult = {
        success: false,
        error: error.message,
        query,
        connectionId,
        executionTime: '0ms',
        metadata: {
          errorType: this.getErrorType(error),
          errorTimestamp: new Date().toISOString()
        }
      };

      logger.error(`❌ Query execution failed: ${error.message}`);
      await this.notifyConnectionListeners('queryError', errorResult);

      return errorResult;
    }
  }

  /**
   * Get database schema
   */
  async getSchema(connectionId: string): Promise<DatabaseSchema> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new DatabaseConnectionError(`Connection not found: ${connectionId}`);
    }

    try {
      let schema: DatabaseSchema;

      switch (connection.type) {
        case 'postgresql':
          schema = await this.getPostgreSQLSchema(connection);
          break;

        case 'mysql':
          schema = await this.getMySQLSchema(connection);
          break;

        case 'mongodb':
          schema = await this.getMongoDBSchema(connection);
          break;

        case 'redis':
          schema = await this.getRedisSchema(connection);
          break;

        default:
          throw new DatabaseConnectionError(`Schema retrieval not implemented for: ${connection.type}`);
      }

      logger.info(`✅ Schema retrieved from ${connection.name} (${schema.tables.length} tables)`);

      return schema;

    } catch (error) {
      logger.error(`❌ Failed to get schema: ${error.message}`);
      throw new DatabaseConnectionError(`Failed to get schema: ${error.message}`);
    }
  }

  /**
   * Create SSH tunnel for VPN support
   */
  async createSSHTunnel(connectionId: string, sshConfig: any): Promise<TunnelResult> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new DatabaseConnectionError(`Connection not found: ${connectionId}`);
    }

    try {
      logger.info(`🚇 Creating SSH tunnel to ${sshConfig.host}`);

      const sshClient = new Client();

      return new Promise((resolve, reject) => {
        sshClient.on('ready', () => {
          logger.info(`✅ SSH tunnel established to ${sshConfig.host}`);

          // Forward local port to remote database
          sshClient.forwardOut(
            `127.0.0.1`,
            0,
            connection.config.host,
            connection.config.port,
            (err, stream) => {
              if (err) {
                reject(new DatabaseConnectionError(`SSH tunnel failed: ${err.message}`));
              } else {
                const tunnelId = this.generateTunnelId();

                logger.info(`✅ Tunnel created: local port ${stream.localPort} -> ${sshConfig.host}:${connection.config.port}`);

                resolve({
                  tunnelId,
                  sshClient,
                  stream,
                  localPort: stream.localPort,
                  remoteHost: sshConfig.host,
                  remotePort: connection.config.port,
                  connectionId
                });
              }
            }
          );
        });

        sshClient.on('error', (err) => {
          reject(new DatabaseConnectionError(`SSH connection failed: ${err.message}`, { cause: err }));
        });

        const sshConfigObj = {
          host: sshConfig.host,
          port: sshConfig.port || 22,
          username: sshConfig.username,
          privateKey: sshConfig.privateKey ?
            require('fs').readFileSync(sshConfig.privateKey) :
            undefined,
          password: sshConfig.password,
          readyTimeout: sshConfig.timeout || 15000
        };

        sshClient.connect(sshConfigObj);
      });

    } catch (error) {
      logger.error(`❌ SSH tunnel creation failed: ${error.message}`);
      throw new DatabaseConnectionError(`Failed to create SSH tunnel: ${error.message}`);
    }
  }

  /**
   * Close database connection
   */
  async closeConnection(connectionId: string): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      logger.warn(`Connection not found: ${connectionId}`);
      return false;
    }

    try {
      logger.info(`🔌 Closing connection: ${connection.name} (${connectionId})`);

      // Clear connection pool
      const pool = this.connectionPools.get(connectionId);
      if (pool) {
        await this.closeConnectionPool(pool, connection.type);
        this.connectionPools.delete(connectionId);
      }

      // Close SSH tunnel if exists
      if (connection.sshTunnel?.enabled) {
        await this.closeSSHTunnel(connection);
      }

      // Update connection state
      connection.isConnected = false;

      // Remove from connections
      this.connections.delete(connectionId);

      // Notify listeners
      await this.notifyConnectionListeners('connectionClosed', { connectionId, name: connection.name });

      logger.info(`✅ Connection closed successfully`);
      return true;

    } catch (error) {
      logger.error(`❌ Failed to close connection: ${error.message}`);
      return false;
    }
  }

  /**
   * Get connection status
   */
  async getConnectionStatus(connectionId: string): Promise<ConnectionStatus> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return { exists: false, status: 'not_found' };
    }

    try {
      // Test connection
      const isConnected = await this.testConnection(connection.pool, connection.config);

      // Check SSH tunnel
      const tunnelStatus = connection.sshTunnel?.enabled ?
        await this.checkSSHTunnelStatus(connection) :
        { enabled: false, status: 'not_applicable' };

      return {
        exists: true,
        status: isConnected ? 'connected' : 'disconnected',
        connection: {
          id: connectionId,
          name: connection.name,
          type: connection.type,
          host: connection.config.host,
          port: connection.config.port,
          database: connection.config.database,
          lastConnected: connection.lastConnected,
          connectionCount: connection.connectionCount
        },
        tunnel: tunnelStatus,
        pool: {
          activeConnections: await this.getPoolSize(connection.pool, connection.type),
          totalConnections: connection.config.maxConnections
        }
      };

    } catch (error) {
      return {
        exists: true,
        status: 'error',
        error: error.message,
        connection: {
          id: connectionId,
          name: connection.name,
          type: connection.type,
          host: connection.config.host,
          port: connection.config.port,
          database: connection.config.database,
          lastConnected: connection.lastConnected,
          connectionCount: connection.connectionCount
        }
      };
    }
  }

  /**
   * List all connections
   */
  listConnections(): DatabaseConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): DatabaseConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Add connection event listener
   */
  addConnectionListener(event: string, callback: Function): void {
    if (!this.connectionListeners.has(event)) {
      this.connectionListeners.set(event, new Set());
    }
    this.connectionListeners.get(event)?.add(callback);

    logger.debug(`Added listener for event: ${event}`);
  }

  /**
   * Remove connection event listener
   */
  removeConnectionListener(event: string, callback: Function): void {
    const listeners = this.connectionListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.connectionListeners.delete(event);
      }
    }

    logger.debug(`Removed listener for event: ${event}`);
  }

  // Private methods implementation
  private async createConnectionPool(config: any, credentialId: string): Promise<any> {
    switch (config.type) {
      case 'postgresql':
        return new Pool({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.username,
          password: config.password,
          ssl: config.ssl,
          max: config.maxConnections,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: config.connectionTimeout,
          application_name: config.advanced?.applicationName || 'QueryFlux OpenAI App',
          options: {
            timezone: config.advanced?.timezone || 'UTC',
            charset: config.advanced?.charset || 'utf8'
          }
        });

      case 'mysql':
        return createPool({
          host: config.host,
          port: config.port,
          user: config.username,
          password: config.password,
          database: config.database,
          ssl: {
            rejectUnauthorized: false,
            ca: config.ssl ? fs.readFileSync(config.ssl.ca) : undefined,
            cert: config.ssl ? fs.readFileSync(config.ssl.cert) : undefined,
            key: config.ssl ? fs.readFileSync(config.ssl.key) : undefined
          },
          timezone: config.advanced?.timezone || 'UTC',
          charset: config.advanced?.charset || 'utf8',
          connectionLimit: config.maxConnections,
          acquireTimeout: config.connectionTimeout,
          timeout: config.queryTimeout,
          queueLimit: 0,
          dateStrings: true
        });

      case 'mongodb':
        const mongoUrl = this.buildMongoDBConnectionString(config, credentialId);
        return new MongoClient(mongoUrl, {
          maxPoolSize: config.maxConnections,
          serverSelectionTimeoutMS: config.connectionTimeout,
          socketTimeoutMS: config.queryTimeout,
          appName: config.advanced?.applicationName || 'QueryFlux OpenAI App'
        });

      case 'redis':
        return createClient({
          socket: {
            host: config.host,
            port: config.port,
            tls: config.ssl,
            connectTimeout: config.connectionTimeout
          },
          username: config.username,
          password: config.password,
          database: config.database,
          connectionTimeout: config.connectionTimeout,
          commandTimeout: config.queryTimeout,
          retry_strategy: {
            maxRetriesPerRequest: 3
          },
          maxRetriesPerRequest: 3
        });

      default:
        throw new DatabaseConnectionError(`Connection pool not implemented for: ${config.type}`);
    }
  }

  private async closeConnectionPool(pool: any, databaseType: string): Promise<void> {
    switch (databaseType) {
      case 'postgresql':
        await (pool as PgPool).end();
        break;
      case 'mysql':
        await (pool as any).end();
        break;
      case 'mongodb':
        await (pool as MongoClient).close();
        break;
      case 'redis':
        await (pool as any).quit();
        break;
      default:
        logger.warn(`Connection pool close not implemented for: ${databaseType}`);
    }
  }

  private async getPoolSize(pool: any, databaseType: string): Promise<number> {
    switch (databaseType) {
      case 'postgresql':
        return (pool as PgPool).totalCount;
      case 'mysql':
        return (pool as any).pool._allConnections.length;
      case 'mongodb':
        return (pool as MongoClient).topology.connections.length;
      case 'redis':
        return (pool as any).connected;
      default:
        return 1;
    }
  }

  private async reconnectConnection(connectionId: string): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    try {
      logger.info(`🔄 Reconnecting to ${connection.name}`);

      // Close existing pool
      await this.closeConnectionPool(connection.pool, connection.type);

      // Create new pool
      const credentialId = await this.credentialManager.getCredentialId(connectionId);
      const newPool = await this.createConnectionPool(connection.config, credentialId);

      // Update connection
      connection.pool = newPool;

      // Test reconnection
      const isConnected = await this.testConnection(newPool, connection.config);
      connection.isConnected = isConnected;

      if (isConnected) {
        logger.info(`✅ Successfully reconnected to ${connection.name}`);
        return true;
      } else {
        logger.error(`❌ Reconnection failed for ${connection.name}`);
        return false;
      }

    } catch (error) {
      logger.error(`❌ Reconnection failed for ${connection.name}: ${error.message}`);
      return false;
    }
  }

  private async executePostgreSQLQuery(connection: DatabaseConnection, query: string, params: any[]): Promise<any> {
    const client = await (connection.pool as PgPool).connect();
    try {
      const result = await client.query(query, params);
      await client.end();
      return result;
    } catch (error) {
      await client.end();
      throw error;
    }
  }

  private async executeMySQLQuery(connection: DatabaseConnection, query: string, params: any[]): Promise<any> {
    return await (connection.pool as any).execute(query, params);
  }

  private async executeMongoDBQuery(connection: DatabaseConnection, query: string): Promise<any> {
    const db = (connection.pool as MongoClient).db(connection.config.database);
    return await db.eval(query);
  }

  private async executeRedisCommand(connection: DatabaseConnection, command: string): Promise<any> {
    return await (connection.pool as any).sendCommand(['EVAL', command]);
  }

  private async getPostgreSQLSchema(connection: DatabaseConnection): Promise<DatabaseSchema> {
    const client = await (connection.pool as PgPool).connect();
    try {
      const result = await client.query(`
        SELECT
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          numeric_precision,
          numeric_scale
        FROM information_schema.columns
        WHERE table_schema = '${connection.config.database}'
        ORDER BY table_name, ordinal_position
      `);

      // Organize into schema structure
      const schema: DatabaseSchema = {
        name: connection.config.database,
        type: 'postgresql',
        tables: this.organizePostgreSQLTables(result.rows),
        constraints: await this.getPostgreSQLConstraints(client, connection.config.database),
        indexes: await this.getPostgreSQLIndexes(client, connection.config.database)
      };

      await client.end();
      return schema;
    } catch (error) {
      await client.end();
      throw error;
    }
  }

  private async getMySQLSchema(connection: DatabaseConnection): Promise<DatabaseSchema> {
    try {
      const result = await (connection.pool as any).execute(`
        SELECT
          TABLE_NAME as table_name,
          COLUMN_NAME as column_name,
          DATA_TYPE as data_type,
          IS_NULLABLE as is_nullable,
          COLUMN_DEFAULT as column_default,
          CHARACTER_MAXIMUM_LENGTH as char_max_length,
          NUMERIC_PRECISION as numeric_precision,
          NUMERIC_SCALE as numeric_scale
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '${connection.config.database}'
        ORDER BY TABLE_NAME, ORDINAL_POSITION
      `);

      const schema: DatabaseSchema = {
        name: connection.config.database,
        type: 'mysql',
        tables: this.organizeMySQLTables(result[0]),
        constraints: await this.getMySQLConstraints(connection),
        indexes: await this.getMySQLIndexes(connection)
      };

      return schema;
    } catch (error) {
      throw error;
    }
  }

  private async getMongoDBSchema(connection: DatabaseConnection): Promise<DatabaseSchema> {
    const db = (connection.pool as MongoClient).db(connection.config.database);
    const collections = await db.listCollections().toArray();

    const tables = await Promise.all(collections.map(async (collection) => {
      const dbCollection = db.collection(collection.name);
      const indexes = await dbCollection.indexes();

      // Get a sample document to infer schema
      const sampleDoc = await dbCollection.findOne();

      return {
        name: collection.name,
        type: 'collection',
        columns: this.inferMongoDBColumns(sampleDoc),
        indexes: indexes.map(index => ({
          name: index.name,
          unique: index.unique,
          background: index.background,
          sparse: index.sparse,
          fields: index.key
        })),
        sampleDocument: sampleDoc,
        documentCount: await dbCollection.countDocuments()
      };
    }));

    return {
      name: connection.config.database,
      type: 'mongodb',
      tables,
      constraints: [],
      indexes: []
    };
  }

  private async getRedisSchema(connection: DatabaseConnection): Promise<DatabaseSchema> {
    try {
      const info = await (connection.pool as any).info();
      const keys = await (connection.pool as any).keys('*');

      return {
        name: connection.config.database || 'redis',
        type: 'redis',
        tables: [{
          name: 'keys',
          columns: [
            { name: 'key', type: 'string', nullable: false },
            { name: 'ttl', type: 'integer', nullable: true },
            { name: 'value', type: 'string', nullable: false }
          ]
        }],
        constraints: [],
        indexes: [],
        metadata: {
          version: info.redis_version,
          mode: info.mode,
          maxMemory: info.maxmemory,
          connectedClients: info.connected_clients
        }
      };
    } catch (error) {
      throw new DatabaseConnectionError(`Failed to get Redis schema: ${error.message}`);
    }
  }

  private organizePostgreSQLTables(rows: any[]): TableSchema[] {
    const tableMap = new Map<string, any>();

    rows.forEach((row) => {
      if (!tableMap.has(row.table_name)) {
        tableMap.set(row.table_name, {
          name: row.table_name,
          columns: [],
          constraints: [],
          indexes: []
        });
      }

      tableMap.get(row.table_name).columns.push({
        name: row.column_name,
        type: this.mapPostgreSQLDataType(row.data_type),
        nullable: row.is_nullable,
        default: row.column_default,
        maxLength: row.character_maximum_length,
        precision: row.numeric_precision,
        scale: row.numeric_scale
      });
    });

    return Array.from(tableMap.values());
  }

  private organizeMySQLTables(rows: any[]): TableSchema[] {
    const tableMap = new Map<string, any>();

    rows.forEach((row) => {
      if (!tableMap.has(row.table_name)) {
        tableMap.set(row.table_name, {
          name: row.table_name,
          columns: [],
          constraints: [],
          indexes: []
        });
      }

      tableMap.get(row.table_name).columns.push({
        name: row.column_name,
        type: this.mapMySQLDataType(row.data_type),
        nullable: row.is_nullable,
        default: row.column_default,
        maxLength: row.character_maximum_length,
        precision: row.numeric_precision,
        scale: row.numeric_scale
      });
    });

    return Array.from(tableMap.values());
  }

  private inferMongoDBColumns(document: any): ColumnSchema[] {
    if (!document) return [];

    return Object.keys(document).map((key) => {
      const value = document[key];
      const type = this.inferMongoDBDataType(value);

      return {
        name: key,
        type,
        nullable: false, // MongoDB doesn't have nullable concept
        default: null,
        maxLength: typeof value === 'string' ? value.length : undefined,
        precision: undefined,
        scale: undefined
      };
    });
  }

  private mapPostgreSQLDataType(pgType: string): string {
    const mapping: { [key: string]: string } = {
      'integer': 'integer',
      'bigint': 'bigint',
      'smallint': 'smallint',
      'serial': 'serial',
      'bigserial': 'bigserial',
      'decimal': 'decimal',
      'numeric': 'numeric',
      'real': 'real',
      'double precision': 'double',
      'money': 'money',
      'character': 'string',
      'character varying': 'string',
      'text': 'text',
      'varchar': 'string',
      'char': 'string',
      'boolean': 'boolean',
      'date': 'date',
      'timestamp': 'datetime',
      'timestamptz': 'datetime',
      'time': 'time',
      'timetz': 'time',
      'interval': 'interval',
      'json': 'json',
      'jsonb': 'json',
      'uuid': 'string',
      'xml': 'string',
      'bytea': 'binary',
      'cidr': 'string',
      'macaddr': 'string',
      'macaddr8': 'string',
      'point': 'object',
      'line': 'object',
      'lseg': 'object',
      'box': 'object',
      'polygon': 'object',
      'path': 'object',
      'circle': 'object',
      'geography': 'object',
      'geometry': 'object',
      'geometrycollection': 'object'
    };

    return mapping[pgType.toLowerCase()] || 'string';
  }

  private mapMySQLDataType(mysqlType: string): string {
    const mapping: { [key: string]: string } = {
      'tinyint': 'integer',
      'smallint': 'integer',
      'mediumint': 'integer',
      'int': 'integer',
      'bigint': 'bigint',
      'decimal': 'decimal',
      'float': 'float',
      'double': 'double',
      'bit': 'boolean',
      'char': 'string',
      'varchar': 'string',
      'binary': 'binary',
      'varbinary': 'binary',
      'tinyblob': 'binary',
      'blob': 'binary',
      'mediumblob': 'binary',
      'longblob': 'binary',
      'tinytext': 'string',
      'text': 'string',
      'mediumtext': 'string',
      'longtext': 'string',
      'date': 'date',
      'datetime': 'datetime',
      'timestamp': 'datetime',
      'time': 'time',
      'year': 'integer',
      'json': 'string',
      'enum': 'string',
      'set': 'string',
      'geometry': 'object',
      'point': 'object',
      'linestring': 'object',
      'polygon': 'object',
      'multipoint': 'object',
      'multilinestring': 'object',
      'multipolygon': 'object',
      'geometrycollection': 'object'
    };

    return mapping[mysqlType.toLowerCase()] || 'string';
  }

  private inferMongoDBDataType(value: any): string {
    if (value === null || value === undefined) return 'null';

    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'object') {
      if (Array.isArray(value)) return 'array';
      if (value instanceof Date) return 'datetime';
      if (value instanceof ObjectId) return 'string';
      return 'object';
    }

    if (value instanceof ObjectId) return 'string';
    if (value instanceof Date) return 'datetime';

    return 'binary';
  }

  private async getPostgreSQLConstraints(client: any, database: string): Promise<any[]> {
    try {
      const result = await client.query(`
        SELECT
          tc.constraint_name,
          tc.constraint_type,
          tc.table_name,
          kcu.column_name,
          ccu.table_name as foreign_table_name,
          ccu.column_name as foreign_column_name
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        LEFT JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_schema = '${database}'
        ORDER BY tc.table_name, tc.constraint_name
      `);

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  private async getPostgreSQLIndexes(client: any, database: string): Promise<any[]> {
    try {
      const result = await client.query(`
        SELECT
          indexname,
          tablename,
          indexdef
        FROM pg_indexes
        WHERE schemaname = '${database}'
        ORDER BY tablename, indexname
      `);

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  private async getMySQLConstraints(connection: DatabaseConnection): Promise<any[]> {
    try {
      const result = await (connection.pool as any).execute(`
        SELECT
          CONSTRAINT_NAME as constraint_name,
          CONSTRAINT_TYPE as constraint_type,
          TABLE_NAME as table_name,
          COLUMN_NAME as column_name,
          REFERENCED_TABLE_NAME as referenced_table_name,
          REFERENCED_COLUMN_NAME as referenced_column_name
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = '${connection.config.database}'
        ORDER BY TABLE_NAME, CONSTRAINT_NAME
      `);

      return result[0] || [];
    } catch (error) {
      throw error;
    }
  }

  private async getMySQLIndexes(connection: DatabaseConnection): Promise<any[]> {
    try {
      const result = await (connection.pool as any).execute(`
        SELECT
          INDEX_NAME as index_name,
          TABLE_NAME as table_name,
          COLUMN_NAME as column_name,
          SEQ_IN_INDEX as sequence_in_index,
          COLLATION as collation,
          SUB_PART as sub_part,
          NULLABLE as nullable,
          INDEX_TYPE as index_type,
          COMMENT as comment
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = '${connection.config.database}'
        ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
      `);

      return result[0] || [];
    } catch (error) {
      throw error;
    }
  }

  private buildMongoDBConnectionString(config: any, credentialId: string): string {
    const auth = [];

    if (config.username && config.password) {
      auth.push(`${config.username}:${config.password}@`);
    }

    if (config.username && config.sshTunnel) {
      // Handle SSH tunneling credentials if needed
      auth.push('ssh_tunnel_user');
    }

    return `mongodb://${auth.join('')}${config.host}:${config.port}/${config.database}${this.buildMongoDBOptions(config)}`;
  }

  private buildMongoDBOptions(config: any): string {
    const options = [];

    if (config.ssl) {
      options.push('ssl=true');
      if (config.ssl.ca) options.push(`ca=${config.ssl.ca}`);
      if (config.ssl.cert) options.push(`cert=${config.ssl.cert}`);
      if (config.ssl.key) options.push(`key=${config.ssl.key}`);
    }

    if (config.connectionTimeout) {
      options.push(`serverSelectionTimeoutMS=${config.connectionTimeout}`);
    }

    if (config.advanced?.appname) {
      options.push(`appName=${config.advanced.appname}`);
    }

    return options.length > 0 ? `?${options.join('&')}` : '';
  }

  private async validateQuery(query: string, connection: DatabaseConnection): Promise<QueryValidation> {
    const validation: QueryValidation = {
      isValid: true,
      reason: '',
      issues: [],
      severity: 'low',
      suggestions: []
    };

    // Basic SQL injection detection
    const injectionPatterns = [
      /union\s+select/i,
      /drop\s+table/i,
      /delete\s+from/i,
      /insert\s+into/i,
      /update\s+.*\s+set/i,
      /create\s+table/i,
      /alter\s+table/i,
      /grant\s+/i,
      /revoke\s+/i,
      /truncate\s+table/i,
      /exec\s*\(/i,
      /--.*script/i,
      /;.*\/\*|--/i
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(query)) {
        validation.isValid = false;
        validation.reason = 'Potential SQL injection detected';
        validation.issues.push('SQL injection pattern detected');
        validation.severity = 'high';
        validation.suggestions.push('Review query for potential security risks');
        return validation;
      }
    }

    // Database-specific validations
    switch (connection.type) {
      case 'postgresql':
        return this.validatePostgreSQLQuery(query, validation);
      case 'mysql':
        return this.validateMySQLQuery(query, validation);
      case 'mongodb':
        return this.validateMongoDBQuery(query, validation);
      case 'redis':
        return this.validateRedisCommand(query, validation);
    }

    return validation;
  }

  private validatePostgreSQLQuery(query: string, validation: QueryValidation): QueryValidation {
    // Check for dangerous PostgreSQL functions
    if (query.includes('pg_sleep') || query.includes('pg_read_file')) {
      validation.isValid = false;
      validation.reason = 'Potentially dangerous PostgreSQL functions detected';
      validation.issues.push('Potentially dangerous function detected');
      validation.severity = 'high';
    }

    return validation;
  }

  private validateMySQLQuery(query: string, validation: QueryValidation): QueryValidation {
    // Check for dangerous MySQL functions
    if (query.includes('sleep(') || query.includes('load_file') || query.includes('into outfile')) {
      validation.isValid = false;
      validation.reason = 'Potentially dangerous MySQL functions detected';
      validation.issues.push('Potentially dangerous function detected');
      validation.severity = 'high';
    }

    return validation;
  }

  private validateMongoDBQuery(query: string, validation: QueryValidation): QueryValidation {
    // Check for dangerous MongoDB operators
    if (query.includes('$where') && query.includes('$eval')) {
      validation.isValid = false;
      validation.reason = 'Potentially dangerous MongoDB operators detected';
      validation.issues.push('Combination of $where and $eval detected');
      validation.severity = 'high';
    }

    return validation;
  }

  private validateRedisCommand(command: string, validation: QueryValidation): QueryValidation {
    // Check for dangerous Redis commands
    const dangerousCommands = ['FLUSHALL', 'FLUSHDB', 'EVAL', 'CONFIG'];
    for (const dangerousCmd of dangerousCommands) {
      if (command.toUpperCase().includes(dangerousCmd)) {
        validation.isValid = false;
        validation.reason = `Potentially dangerous Redis command detected: ${dangerousCmd}`;
        validation.issues.push(`Dangerous command detected: ${dangerousCmd}`);
        validation.severity = 'high';
        break;
      }
    }

    return validation;
  }

  private async logQueryExecution(result: QueryExecutionResult): Promise<void> {
    if (!config.monitoring.enabled) return;

    // In production, this would send to monitoring service
    logger.info(`Query executed: ${result.connectionId} - ${result.query.substring(0, 100)}...`, {
      query: result.query,
      connectionId: result.connectionId,
      success: result.success,
      executionTime: result.executionTime,
      rowCount: result.rowCount
    });
  }

  private async notifyConnectionListeners(event: string, data: any): Promise<void> {
    const listeners = this.connectionListeners.get(event);
    if (!listeners) return;

    const promises = Array.from(listeners).map(callback => {
      try {
        return callback(data);
      } catch (error) {
        logger.error(`Error in connection listener for ${event}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  private setupEventHandlers(): void {
    // Handle process signals
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down database connections...');
      await this.shutdown();
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down database connections...');
      await this.shutdown();
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      logger.error('Uncaught exception:', error);
      await this.shutdown();
    });
  }

  private startHealthChecks(): void {
    setInterval(async () => {
      const connectionCount = this.connections.size;
      logger.debug(`Health check: ${connectionCount} active connections`);

      for (const [connectionId, connection] of this.connections) {
        try {
          const wasConnected = connection.isConnected;
          const isConnected = await this.testConnection(connection.pool, connection.config);

          if (wasConnected !== isConnected) {
            connection.isConnected = isConnected;

            if (isConnected) {
              logger.info(`Connection restored: ${connection.name}`);
              await this.notifyConnectionListeners('connectionRestored', connection);
            } else {
              logger.warn(`Connection lost: ${connection.name}`);
              await this.notifyConnectionListeners('connectionLost', connection);
            }
          }
        } catch (error) {
          logger.error(`Health check failed for ${connection.name}:`, error);
          connection.isConnected = false;
          await this.notifyConnectionListeners('connectionError', {
            connectionId,
            name: connection.name,
            error: error.message
          });
        }
      } catch (error) {
        logger.error(`Health check error for ${connection.name}:`, error);
      }
    }
    }, this.healthCheckInterval);
  }

  private async shutdown(): Promise<void> {
    logger.info('Shutting down database connections...');

    // Close all connections
    const closePromises = Array.from(this.connections.keys()).map(async (connectionId) => {
      try {
        await this.closeConnection(connectionId);
      } catch (error) {
        logger.error(`Error closing connection ${connectionId}:`, error);
      }
    });

    await Promise.allSettled(closePromises);

    // Close SSH tunnels
    for (const connection of this.connections.values()) {
      if (connection.sshTunnel?.enabled) {
        await this.closeSSHTunnel(connection);
      }
    }

    logger.info('All database connections closed');
  }

  private async closeSSHTunnel(connection: DatabaseConnection): Promise<void> {
    if (!connection.sshTunnel || !connection.pool?.sshClient) return;

    try {
      connection.pool.sshClient.end();
      logger.info(`SSH tunnel closed for ${connection.name}`);
    } catch (error) {
      logger.error(`Error closing SSH tunnel for ${connection.name}:`, error);
    }
  }

  private async checkSSHTunnelStatus(connection: DatabaseConnection): Promise<{ enabled: boolean; status: string }> {
    if (!connection.sshTunnel || !connection.pool?.sshClient) {
      return { enabled: false, status: 'not_applicable' };
    }

    try {
      // Simple ping to check if tunnel is still active
      await connection.pool.sshClient.exec('echo "tunnel_alive"', { timeout: 5000 });
      return { enabled: true, status: 'connected' };
    } catch (error) {
      return { enabled: true, status: 'disconnected' };
    }
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTunnelId(): string {
    return `tunnel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateQueryHash(query: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(query).digest('hex');
  }

  private getSupportedDatabaseTypes(): string[] {
    return [
      'postgresql', 'mysql', 'mongodb', 'redis', 'sqlite',
      'sqlserver', 'oracle', 'cassandra', 'elasticsearch',
      'couchbase', 'dynamodb', 'bigquery', 'snowflake', 'redshift'
    ];
  }

  private getErrorType(error: any): string {
    if (error.code === 'ETIMEDOUT') return 'connection_timeout';
    if (error.code === 'ECONNREFUSED') return 'connection_refused';
    if (error.code === 'ECONNRESET') return 'connection_reset';
    if (error.code === 'ENOTFOUND') return 'host_not_found';
    if (error.code === 'EACCES') return 'permission_denied';
    return 'unknown_error';
  }
}

// Custom error class
export class DatabaseConnectionError extends Error {
  public readonly connectionId?: string;
  public readonly validation?: QueryValidation;
  public readonly config?: any;

  constructor(message: string, options: {
    connectionId?: string;
    validation?: QueryValidation;
    config?: any;
    cause?: Error;
  } = {}) {
    super(message);
    this.connectionId = options.connectionId;
    this.validation = options.validation;
    this.config = options.config;
    if (options.cause) {
      this.stack = options.cause.stack;
    }
  }
}

// TypeScript interfaces
export interface DatabaseSchema {
  name: string;
  type: string;
  tables: TableSchema[];
  constraints: any[];
  indexes: any[];
}

export interface TableSchema {
  name: string;
  type: string;
  columns: ColumnSchema[];
  constraints: any[];
  indexes: any[];
  sampleDocument?: any;
  documentCount?: number;
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  default: any;
  maxLength?: number;
  precision?: number;
  scale?: number;
}

export interface QueryExecutionResult {
  success: boolean;
  data?: any;
  rowCount: number;
  columns: ColumnSchema[];
  executionTime: string;
  connectionId: string;
  query: string;
  metadata: {
    queryHash: string;
    executionTimestamp: string;
    connectionMetadata: {
      databaseType: string;
      host: string;
      database: string;
    };
  };
  error?: string;
  metadata?: {
    errorType: string;
    errorTimestamp: string;
  };
}

export interface ConnectionStatus {
  exists: boolean;
  status: 'connected' | 'disconnected' | 'not_found' | 'error';
  connection?: DatabaseConnection;
  tunnel?: {
    enabled: boolean;
    status: string;
  };
  pool?: {
    activeConnections: number;
    totalConnections: number;
  };
  error?: string;
}

export interface TunnelResult {
  tunnelId: string;
  sshClient: any;
  stream: any;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  connectionId: string;
}

export interface QueryValidation {
  isValid: boolean;
  reason: string;
  issues: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestions: string[];
}

export default DatabaseConnectionManager;
