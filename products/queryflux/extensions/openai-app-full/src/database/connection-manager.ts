/**
 * Database Connection Manager
 *
 * Enterprise-grade database connection management with support for
 * multiple database types, connection pooling, and secure tunneling
 */

import { z } from 'zod';
import { Pool, PoolClient } from 'pg';
import mysql from 'mysql2/promise';
import { MongoClient, Db } from 'mongodb';
import { createClient } from 'redis';
import { Connection, Request } from 'tedious';
import { Client as SSHClient } from 'ssh2';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { CredentialManager } from '../security/credential-manager.js';
import { TunnelManager } from '../network/tunnel-manager.js';

// Database connection configuration schema
const DatabaseConnectionConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Connection name is required'),
  type: z.enum(['postgresql', 'mysql', 'mongodb', 'redis', 'sqlite', 'sqlserver', 'oracle']),
  host: z.string().min(1, 'Host is required'),
  port: z.number().positive().optional(),
  database: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  ssl: z.boolean().default(true),
  connectionTimeout: z.number().default(30000),
  queryTimeout: z.number().default(60000),
  maxConnections: z.number().default(10),
  // SSH Tunnel configuration
  sshTunnel: z.object({
    enabled: z.boolean().default(false),
    host: z.string().optional(),
    port: z.number().default(22),
    username: z.string().optional(),
    privateKey: z.string().optional(),
    password: z.string().optional(),
    bastion: z.boolean().default(false)
  }).optional(),
  // Advanced options
  options: z.record(z.any()).optional()
});

/**
 * Database connection interface
 */
export interface DatabaseConnection {
  id: string;
  name: string;
  type: string;
  config: DatabaseConnectionConfig;
  pool: any;
  status: 'connected' | 'disconnected' | 'error';
  connectedAt?: Date;
  lastUsed?: Date;
  metrics: ConnectionMetrics;
}

export interface ConnectionMetrics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageQueryTime: number;
  activeConnections: number;
  totalConnections: number;
  lastError?: string;
  lastErrorAt?: Date;
}

export interface QueryResult {
  rows: any[];
  columns: ColumnInfo[];
  rowCount: number;
  executionTime: number;
  affectedRows?: number;
  insertId?: any;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: any;
}

/**
 * Database Connection Manager
 */
export class DatabaseConnectionManager {
  private connections: Map<string, DatabaseConnection> = new Map();
  private credentialManager: CredentialManager;
  private tunnelManager: TunnelManager;
  private queryHistory: Map<string, QueryHistoryEntry[]> = new Map();

  constructor() {
    this.credentialManager = new CredentialManager();
    this.tunnelManager = new TunnelManager();

    logger.info('📊 Database Connection Manager initialized');
  }

  /**
   * Create a new database connection
   */
  async createConnection(config: DatabaseConnectionConfig): Promise<DatabaseConnection> {
    try {
      // Validate configuration
      const validatedConfig = DatabaseConnectionConfigSchema.parse(config);

      // Generate connection ID if not provided
      const connectionId = validatedConfig.id || this.generateConnectionId();

      logger.info(`🔗 Creating connection to ${validatedConfig.type} database: ${validatedConfig.name}`);

      // Setup SSH tunnel if required
      let tunnelInfo = null;
      if (validatedConfig.sshTunnel?.enabled) {
        tunnelInfo = await this.tunnelManager.createTunnel({
          connectionId,
          sshConfig: validatedConfig.sshTunnel,
          targetHost: validatedConfig.host,
          targetPort: validatedConfig.port || this.getDefaultPort(validatedConfig.type)
        });
      }

      // Get database credentials
      const credentials = await this.credentialManager.getCredentials(validatedConfig);

      // Create connection pool based on database type
      const pool = await this.createConnectionPool(validatedConfig, credentials, tunnelInfo);

      // Test the connection
      await this.testConnection(pool, validatedConfig.type);

      const connection: DatabaseConnection = {
        id: connectionId,
        name: validatedConfig.name,
        type: validatedConfig.type,
        config: validatedConfig,
        pool,
        status: 'connected',
        connectedAt: new Date(),
        lastUsed: new Date(),
        metrics: {
          totalQueries: 0,
          successfulQueries: 0,
          failedQueries: 0,
          averageQueryTime: 0,
          activeConnections: 0,
          totalConnections: validatedConfig.maxConnections || 10
        }
      };

      this.connections.set(connectionId, connection);

      logger.info(`✅ Successfully connected to ${validatedConfig.name} (${connectionId})`);

      return connection;

    } catch (error) {
      logger.error(`❌ Failed to create connection: ${error.message}`);
      throw new Error(`Connection creation failed: ${error.message}`);
    }
  }

  /**
   * Execute a query on a specific connection
   */
  async executeQuery(
    connectionId: string,
    query: string,
    parameters: any[] = [],
    options: QueryOptions = {}
  ): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      const connection = this.getConnection(connectionId);

      logger.debug(`🔍 Executing query on ${connection.name}: ${query.substring(0, 100)}...`);

      // Validate query security
      await this.validateQuerySecurity(query, connection);

      // Update connection metrics
      connection.lastUsed = new Date();
      connection.metrics.totalQueries++;
      connection.metrics.activeConnections++;

      // Execute query based on database type
      let result: QueryResult;

      switch (connection.type) {
        case 'postgresql':
          result = await this.executePostgreSQLQuery(connection.pool, query, parameters);
          break;
        case 'mysql':
          result = await this.executeMySQLQuery(connection.pool, query, parameters);
          break;
        case 'mongodb':
          result = await this.executeMongoDBQuery(connection.pool, query, parameters);
          break;
        case 'redis':
          result = await this.executeRedisQuery(connection.pool, query, parameters);
          break;
        case 'sqlserver':
          result = await this.executeSQLServerQuery(connection.pool, query, parameters);
          break;
        default:
          throw new Error(`Unsupported database type: ${connection.type}`);
      }

      // Update metrics
      const executionTime = Date.now() - startTime;
      connection.metrics.successfulQueries++;
      connection.metrics.averageQueryTime = this.updateAverageQueryTime(
        connection.metrics.averageQueryTime,
        executionTime,
        connection.metrics.successfulQueries
      );
      connection.metrics.activeConnections--;

      // Add to query history
      this.addToQueryHistory(connectionId, {
        query,
        parameters,
        executionTime,
        success: true,
        rowCount: result.rowCount,
        timestamp: new Date()
      });

      result.executionTime = executionTime;

      logger.debug(`✅ Query executed successfully in ${executionTime}ms (${result.rowCount} rows)`);

      return result;

    } catch (error) {
      // Update error metrics
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.metrics.failedQueries++;
        connection.metrics.lastError = error.message;
        connection.metrics.lastErrorAt = new Date();
        connection.metrics.activeConnections--;

        // Add to query history
        this.addToQueryHistory(connectionId, {
          query,
          parameters,
          executionTime: Date.now() - startTime,
          success: false,
          error: error.message,
          timestamp: new Date()
        });
      }

      logger.error(`❌ Query execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get database schema information
   */
  async getSchema(connectionId: string): Promise<DatabaseSchema> {
    const connection = this.getConnection(connectionId);

    try {
      logger.debug(`📋 Getting schema for ${connection.name}`);

      let schema: DatabaseSchema;

      switch (connection.type) {
        case 'postgresql':
          schema = await this.getPostgreSQLSchema(connection.pool);
          break;
        case 'mysql':
          schema = await this.getMySQLSchema(connection.pool);
          break;
        case 'mongodb':
          schema = await this.getMongoDBSchema(connection.pool);
          break;
        default:
          throw new Error(`Schema retrieval not supported for ${connection.type}`);
      }

      return schema;

    } catch (error) {
      logger.error(`❌ Failed to get schema: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close a database connection
   */
  async closeConnection(connectionId: string): Promise<void> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      logger.info(`🔌 Closing connection: ${connection.name}`);

      // Close connection pool based on database type
      if (connection.pool && typeof connection.pool.end === 'function') {
        await connection.pool.end();
      } else if (connection.pool && typeof connection.pool.close === 'function') {
        await connection.pool.close();
      }

      // Close SSH tunnel if it exists
      if (connection.config.sshTunnel?.enabled) {
        await this.tunnelManager.closeTunnel(connectionId);
      }

      connection.status = 'disconnected';
      this.connections.delete(connectionId);

      logger.info(`✅ Connection closed: ${connection.name}`);

    } catch (error) {
      logger.error(`❌ Failed to close connection: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): DatabaseConnection {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    if (connection.status !== 'connected') {
      throw new Error(`Connection not active: ${connectionId} (status: ${connection.status})`);
    }

    return connection;
  }

  /**
   * List all active connections
   */
  listConnections(): DatabaseConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get query history for a connection
   */
  getQueryHistory(connectionId: string, limit: number = 50): QueryHistoryEntry[] {
    const history = this.queryHistory.get(connectionId) || [];
    return history.slice(-limit);
  }

  /**
   * Create connection pool based on database type
   */
  private async createConnectionPool(
    config: DatabaseConnectionConfig,
    credentials: any,
    tunnelInfo: any
  ): Promise<any> {

    const targetHost = tunnelInfo ? tunnelInfo.localHost : config.host;
    const targetPort = tunnelInfo ? tunnelInfo.localPort : (config.port || this.getDefaultPort(config.type));

    switch (config.type) {
      case 'postgresql':
        return new Pool({
          host: targetHost,
          port: targetPort,
          database: config.database,
          user: credentials.username,
          password: credentials.password,
          ssl: config.ssl,
          max: config.maxConnections || 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: config.connectionTimeout,
          ...config.options
        });

      case 'mysql':
        return mysql.createPool({
          host: targetHost,
          port: targetPort,
          database: config.database,
          user: credentials.username,
          password: credentials.password,
          ssl: config.ssl,
          connectionLimit: config.maxConnections || 10,
          acquireTimeout: config.connectionTimeout,
          timeout: config.queryTimeout,
          ...config.options
        });

      case 'mongodb':
        const mongoClient = new MongoClient(
          `mongodb://${credentials.username}:${credentials.password}@${targetHost}:${targetPort}`,
          {
            maxPoolSize: config.maxConnections || 10,
            serverSelectionTimeoutMS: config.connectionTimeout,
            socketTimeoutMS: config.queryTimeout,
            ...config.options
          }
        );
        await mongoClient.connect();
        return mongoClient.db(config.database);

      case 'redis':
        return createClient({
          socket: {
            host: targetHost,
            port: targetPort
          },
          username: credentials.username,
          password: credentials.password,
          socket: {
            connectTimeout: config.connectionTimeout,
            lazyConnect: true
          },
          ...config.options
        });

      case 'sqlserver':
        return new Connection({
          server: targetHost,
          port: targetPort,
          database: config.database,
          authentication: {
            type: 'default',
            options: {
              userName: credentials.username,
              password: credentials.password
            }
          },
          options: {
            encrypt: config.ssl,
            connectTimeout: config.connectionTimeout,
            requestTimeout: config.queryTimeout,
            maxPool: config.maxConnections || 10,
            ...config.options
          }
        });

      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  }

  /**
   * Test database connection
   */
  private async testConnection(pool: any, dbType: string): Promise<void> {
    try {
      switch (dbType) {
        case 'postgresql':
          const pgClient = await pool.connect();
          await pgClient.query('SELECT 1');
          pgClient.release();
          break;

        case 'mysql':
          const mysqlConnection = await pool.getConnection();
          await mysqlConnection.execute('SELECT 1');
          mysqlConnection.release();
          break;

        case 'mongodb':
          await pool.admin().ping();
          break;

        case 'redis':
          await pool.connect();
          await pool.ping();
          break;

        default:
          logger.warn(`Connection test not implemented for ${dbType}`);
      }
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  /**
   * Execute PostgreSQL query
   */
  private async executePostgreSQLQuery(pool: Pool, query: string, parameters: any[]): Promise<QueryResult> {
    const client = await pool.connect();
    try {
      const result = await client.query(query, parameters);

      return {
        rows: result.rows,
        columns: result.fields.map(field => ({
          name: field.name,
          type: this.mapPostgreSQLDataType(field.dataTypeID),
          nullable: !field.notNull,
          primaryKey: false // Would need to query schema for this
        })),
        rowCount: result.rowCount || 0,
        executionTime: 0 // Will be set by caller
      };
    } finally {
      client.release();
    }
  }

  /**
   * Execute MySQL query
   */
  private async executeMySQLQuery(pool: any, query: string, parameters: any[]): Promise<QueryResult> {
    const [rows, fields] = await pool.execute(query, parameters);

    return {
      rows,
      columns: fields.map((field: any) => ({
        name: field.name,
        type: this.mapMySQLDataType(field.type),
        nullable: field.nullable,
        primaryKey: false
      })),
      rowCount: Array.isArray(rows) ? rows.length : 0,
      executionTime: 0
    };
  }

  /**
   * Execute MongoDB query
   */
  private async executeMongoDBQuery(db: Db, query: string, parameters: any[]): Promise<QueryResult> {
    // This is a simplified implementation
    // In practice, you'd need to parse MongoDB query language
    throw new Error('MongoDB query execution not fully implemented');
  }

  /**
   * Execute Redis query
   */
  private async executeRedisQuery(client: any, query: string, parameters: any[]): Promise<QueryResult> {
    // This is a simplified implementation
    // In practice, you'd need to parse Redis commands
    throw new Error('Redis query execution not fully implemented');
  }

  /**
   * Execute SQL Server query
   */
  private async executeSQLServerQuery(connection: Connection, query: string, parameters: any[]): Promise<QueryResult> {
    return new Promise((resolve, reject) => {
      const request = new Request(query, (err, rowCount) => {
        if (err) {
          reject(err);
          return;
        }

        const rows: any[] = [];
        const columns: ColumnInfo[] = [];

        request.on('columnMetadata', (columnsInfo) => {
          columnsInfo.forEach((col, index) => {
            columns.push({
              name: col.colName,
              type: col.dataType.name,
              nullable: col.nullable,
              primaryKey: false
            });
          });
        });

        request.on('row', (columns) => {
          const row: any = {};
          columns.forEach((column, index) => {
            row[columns[index].name] = column.value;
          });
          rows.push(row);
        });

        request.on('requestCompleted', () => {
          resolve({
            rows,
            columns,
            rowCount: rowCount || 0,
            executionTime: 0
          });
        });
      });

      if (parameters.length > 0) {
        parameters.forEach((param, index) => {
          request.addParameter(param, (typeof param === 'number') ? TYPES.Int : TYPES.NVarChar);
        });
      }

      connection.execSql(request);
    });
  }

  /**
   * Get PostgreSQL schema
   */
  private async getPostgreSQLSchema(pool: Pool): Promise<DatabaseSchema> {
    const client = await pool.connect();
    try {
      const tablesQuery = `
        SELECT table_name, table_type
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `;

      const tablesResult = await client.query(tablesQuery);
      const tables: TableSchema[] = [];

      for (const tableRow of tablesResult.rows) {
        const columnsQuery = `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `;

        const columnsResult = await client.query(columnsQuery, [tableRow.table_name]);

        const columns: ColumnSchema[] = columnsResult.rows.map(col => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          primaryKey: false // Would need separate query
        }));

        tables.push({
          name: tableRow.table_name,
          type: tableRow.table_type,
          columns,
          primaryKey: [],
          foreignKeys: []
        });
      }

      return { tables, relationships: [] };
    } finally {
      client.release();
    }
  }

  /**
   * Get MySQL schema
   */
  private async getMySQLSchema(pool: any): Promise<DatabaseSchema> {
    const connection = await pool.getConnection();
    try {
      const [tables] = await connection.execute('SHOW TABLES');
      const tableNames = tables.map((row: any) => Object.values(row)[0]);

      const schemaTables: TableSchema[] = [];

      for (const tableName of tableNames) {
        const [columns] = await connection.execute(`DESCRIBE ${tableName}`);

        schemaTables.push({
          name: tableName,
          type: 'BASE TABLE',
          columns: columns.map((col: any) => ({
            name: col.Field,
            type: col.Type,
            nullable: col.Null === 'YES',
            primaryKey: col.Key === 'PRI'
          })),
          primaryKey: [],
          foreignKeys: []
        });
      }

      return { tables: schemaTables, relationships: [] };
    } finally {
      connection.release();
    }
  }

  /**
   * Get MongoDB schema
   */
  private async getMongoDBSchema(db: Db): Promise<DatabaseSchema> {
    const collections = await db.listCollections().toArray();

    const tables: TableSchema[] = collections.map((collection: any) => ({
      name: collection.name,
      type: 'COLLECTION',
      columns: [], // MongoDB doesn't have fixed schemas
      primaryKey: [],
      foreignKeys: []
    }));

    return { tables, relationships: [] };
  }

  /**
   * Validate query security
   */
  private async validateQuerySecurity(query: string, connection: DatabaseConnection): Promise<void> {
    const dangerousPatterns = [
      /DROP\s+TABLE/i,
      /DELETE\s+FROM/i,
      /TRUNCATE/i,
      /UPDATE\s+.*\s+SET/i,
      /INSERT\s+INTO/i,
      /CREATE\s+TABLE/i,
      /ALTER\s+TABLE/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        throw new Error(`Dangerous SQL operation detected: ${pattern.source}`);
      }
    }
  }

  /**
   * Update average query time
   */
  private updateAverageQueryTime(current: number, newTime: number, queryCount: number): number {
    return ((current * (queryCount - 1)) + newTime) / queryCount;
  }

  /**
   * Add entry to query history
   */
  private addToQueryHistory(connectionId: string, entry: QueryHistoryEntry): void {
    if (!this.queryHistory.has(connectionId)) {
      this.queryHistory.set(connectionId, []);
    }

    const history = this.queryHistory.get(connectionId)!;
    history.push(entry);

    // Keep only last 1000 entries per connection
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }

  /**
   * Get default port for database type
   */
  private getDefaultPort(dbType: string): number {
    const defaultPorts = {
      postgresql: 5432,
      mysql: 3306,
      mongodb: 27017,
      redis: 6379,
      sqlserver: 1433,
      oracle: 1521
    };

    return defaultPorts[dbType as keyof typeof defaultPorts] || 5432;
  }

  /**
   * Map PostgreSQL data types
   */
  private mapPostgreSQLDataType(dataTypeId: number): string {
    const typeMap: Record<number, string> = {
      23: 'integer',
      1043: 'varchar',
      1082: 'date',
      1114: 'timestamp',
      1186: 'timestamp',
      1700: 'numeric'
    };

    return typeMap[dataTypeId] || 'unknown';
  }

  /**
   * Map MySQL data types
   */
  private mapMySQLDataType(mysqlType: string): string {
    // Simplified MySQL type mapping
    if (mysqlType.includes('int')) return 'integer';
    if (mysqlType.includes('varchar')) return 'varchar';
    if (mysqlType.includes('text')) return 'text';
    if (mysqlType.includes('date') || mysqlType.includes('time')) return 'datetime';
    if (mysqlType.includes('decimal') || mysqlType.includes('numeric')) return 'numeric';

    return mysqlType;
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// TypeScript interfaces
export interface DatabaseConnectionConfig {
  id?: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'sqlite' | 'sqlserver' | 'oracle';
  host: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  connectionTimeout?: number;
  queryTimeout?: number;
  maxConnections?: number;
  sshTunnel?: {
    enabled: boolean;
    host?: string;
    port?: number;
    username?: string;
    privateKey?: string;
    password?: string;
    bastion?: boolean;
  };
  options?: Record<string, any>;
}

export interface QueryOptions {
  timeout?: number;
  limit?: number;
  includeMetadata?: boolean;
}

export interface QueryHistoryEntry {
  query: string;
  parameters: any[];
  executionTime: number;
  success: boolean;
  rowCount?: number;
  error?: string;
  timestamp: Date;
}

export interface DatabaseSchema {
  tables: TableSchema[];
  relationships: Relationship[];
}

export interface TableSchema {
  name: string;
  type: string;
  columns: ColumnSchema[];
  primaryKey: string[];
  foreignKeys: ForeignKey[];
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
}

export interface Relationship {
  fromTable: string;
  toTable: string;
  fromColumn: string;
  toColumn: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

export interface ForeignKey {
  column: string;
  referencesTable: string;
  referencesColumn: string;
}

// SQL Server types
const { TYPES } = require('tedious');

export default DatabaseConnectionManager;
