import { Client } from 'pg';
import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import Redis from 'ioredis';
import Database from 'better-sqlite3';
import { Connection } from 'tedious';
import * as oracledb from 'oracledb';
import { Client as CassandraClient } from 'cassandra-driver';

export interface DatabaseConfig {
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'sqlite' | 'sqlserver' | 'oracle' | 'cassandra';
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  connectionString?: string;
  options?: Record<string, any>;
}

export interface DatabaseConnection {
  id: string;
  config: DatabaseConfig;
  client: any;
  type: string;
  connected: boolean;
  connectedAt: Date;
}

export interface QueryResult {
  success: boolean;
  data?: {
    columns: string[];
    rows: any[][];
    rowCount: number;
  };
  error?: string;
  executionTime: number;
  affectedRows?: number;
}

export interface TableInfo {
  name: string;
  schema: string;
  type: string;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  rowCount?: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  primaryKey: boolean;
  foreignKey?: {
    table: string;
    column: string;
  };
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
  type: string;
}

class DatabaseConnectionManager {
  private connections: Map<string, DatabaseConnection> = new Map();
  private connectionIdCounter = 0;

  async connect(config: DatabaseConfig): Promise<{ success: boolean; connectionId?: string; error?: string }> {
    try {
      const connectionId = `conn_${++this.connectionIdCounter}_${Date.now()}`;

      let client: any;
      const startTime = Date.now();

      switch (config.type) {
        case 'postgresql':
          client = await this.connectPostgreSQL(config);
          break;
        case 'mysql':
          client = await this.connectMySQL(config);
          break;
        case 'mongodb':
          client = await this.connectMongoDB(config);
          break;
        case 'redis':
          client = await this.connectRedis(config);
          break;
        case 'sqlite':
          client = await this.connectSQLite(config);
          break;
        case 'sqlserver':
          client = await this.connectSQLServer(config);
          break;
        case 'oracle':
          client = await this.connectOracle(config);
          break;
        case 'cassandra':
          client = await this.connectCassandra(config);
          break;
        default:
          throw new Error(`Unsupported database type: ${config.type}`);
      }

      const connection: DatabaseConnection = {
        id: connectionId,
        config: this.sanitizeConfig(config),
        client,
        type: config.type,
        connected: true,
        connectedAt: new Date()
      };

      this.connections.set(connectionId, connection);

      return {
        success: true,
        connectionId
      };

    } catch (error) {
      console.error('Database connection failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown connection error'
      };
    }
  }

  async disconnect(connectionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        return {
          success: false,
          error: 'Connection not found'
        };
      }

      if (connection.client) {
        switch (connection.type) {
          case 'postgresql':
            await connection.client.end();
            break;
          case 'mysql':
            await connection.client.end();
            break;
          case 'mongodb':
            await connection.client.close();
            break;
          case 'redis':
            connection.client.disconnect();
            break;
          case 'sqlite':
            connection.client.close();
            break;
          case 'sqlserver':
            connection.client.close();
            break;
          case 'oracle':
            await connection.client.close();
            break;
          case 'cassandra':
            await connection.client.shutdown();
            break;
        }
      }

      this.connections.delete(connectionId);
      return { success: true };

    } catch (error) {
      console.error('Database disconnection failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown disconnection error'
      };
    }
  }

  async executeQuery(connectionId: string, query: string, params?: any[]): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      let result: QueryResult;

      switch (connection.type) {
        case 'postgresql':
          result = await this.executeQueryPostgreSQL(connection.client, query, params);
          break;
        case 'mysql':
          result = await this.executeQueryMySQL(connection.client, query, params);
          break;
        case 'mongodb':
          result = await this.executeQueryMongoDB(connection.client, query);
          break;
        case 'redis':
          result = await this.executeQueryRedis(connection.client, query);
          break;
        case 'sqlite':
          result = await this.executeQuerySQLite(connection.client, query, params);
          break;
        case 'sqlserver':
          result = await this.executeQuerySQLServer(connection.client, query);
          break;
        case 'oracle':
          result = await this.executeQueryOracle(connection.client, query, params);
          break;
        case 'cassandra':
          result = await this.executeQueryCassandra(connection.client, query, params);
          break;
        default:
          throw new Error(`Query execution not supported for ${connection.type}`);
      }

      result.executionTime = Date.now() - startTime;
      return result;

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query execution failed',
        executionTime: Date.now() - startTime
      };
    }
  }

  async getSchema(connectionId: string): Promise<{ tables: TableInfo[] }> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    switch (connection.type) {
      case 'postgresql':
        return this.getPostgreSQLSchema(connection.client);
      case 'mysql':
        return this.getMySQLSchema(connection.client);
      case 'mongodb':
        return this.getMongoDBSchema(connection.client);
      case 'sqlite':
        return this.getSQLiteSchema(connection.client);
      default:
        throw new Error(`Schema introspection not supported for ${connection.type}`);
    }
  }

  getConnection(connectionId: string): DatabaseConnection | undefined {
    return this.connections.get(connectionId);
  }

  getAllConnections(): DatabaseConnection[] {
    return Array.from(this.connections.values());
  }

  async healthCheck(connectionId: string): Promise<boolean> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) return false;

      switch (connection.type) {
        case 'postgresql':
          await connection.client.query('SELECT 1');
          return true;
        case 'mysql':
          await connection.client.execute('SELECT 1');
          return true;
        case 'redis':
          await connection.client.ping();
          return true;
        case 'sqlite':
          connection.client.prepare('SELECT 1').get();
          return true;
        default:
          return true; // Assume healthy if no error thrown
      }
    } catch {
      return false;
    }
  }

  // Private connection methods
  private async connectPostgreSQL(config: DatabaseConfig): Promise<Client> {
    const client = new Client({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl,
      ...config.options
    });
    await client.connect();
    return client;
  }

  private async connectMySQL(config: DatabaseConfig): Promise<mysql.Connection> {
    return await mysql.createConnection({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl,
      ...config.options
    });
  }

  private async connectMongoDB(config: DatabaseConfig): Promise<MongoClient> {
    const uri = config.connectionString ||
      `mongodb://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;
    return await MongoClient.connect(uri);
  }

  private async connectRedis(config: DatabaseConfig): Promise<Redis> {
    const client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: parseInt(config.database) || 0,
      ssl: config.ssl,
      ...config.options
    });
    await client.ping();
    return client;
  }

  private connectSQLite(config: DatabaseConfig): Database.Database {
    return new Database(config.database);
  }

  private async connectSQLServer(config: DatabaseConfig): Promise<Connection> {
    // Note: Tedious uses callbacks, so we'll wrap it in a Promise
    return new Promise((resolve, reject) => {
      const connection = new Connection({
        server: config.host,
        authentication: {
          type: 'default',
          options: {
            userName: config.username,
            password: config.password
          }
        },
        options: {
          database: config.database,
          encrypt: config.ssl,
          trustServerCertificate: true,
          ...config.options
        }
      });

      connection.connect((err) => {
        if (err) {
          reject(err);
        } else {
          resolve(connection);
        }
      });
    });
  }

  private async connectOracle(config: DatabaseConfig): Promise<any> {
    return await oracledb.getConnection({
      user: config.username,
      password: config.password,
      connectionString: `${config.host}:${config.port}/${config.database}`,
      ...config.options
    });
  }

  private async connectCassandra(config: DatabaseConfig): Promise<CassandraClient> {
    const client = new CassandraClient({
      contactPoints: [`${config.host}:${config.port}`],
      localDataCenter: config.options?.localDataCenter || 'datacenter1',
      keyspace: config.database,
      credentials: {
        username: config.username,
        password: config.password
      }
    });
    await client.connect();
    return client;
  }

  // Private query execution methods
  private async executeQueryPostgreSQL(client: Client, query: string, params?: any[]): Promise<QueryResult> {
    const result = await client.query(query, params);

    return {
      success: true,
      data: {
        columns: result.fields?.map((field: any) => field.name) || [],
        rows: result.rows || [],
        rowCount: result.rowCount || 0
      },
      affectedRows: result.rowCount
    };
  }

  private async executeQueryMySQL(client: mysql.Connection, query: string, params?: any[]): Promise<QueryResult> {
    const [rows, fields] = await client.execute(query, params);

    return {
      success: true,
      data: {
        columns: fields?.map((field: any) => field.name) || [],
        rows: Array.isArray(rows) ? rows.map(row => Object.values(row)) : [],
        rowCount: Array.isArray(rows) ? rows.length : 0
      },
      affectedRows: Array.isArray(rows) ? rows.length : 0
    };
  }

  private async executeQueryMongoDB(client: MongoClient, query: string): Promise<QueryResult> {
    const db = client.db();
    const result = db.command({ eval: query });

    return {
      success: true,
      data: {
        columns: ['result'],
        rows: [[result]],
        rowCount: 1
      }
    };
  }

  private async executeQueryRedis(client: Redis, command: string): Promise<QueryResult> {
    const args = command.split(' ');
    const cmd = args.shift();
    const result = await client.call(cmd as any, ...args);

    return {
      success: true,
      data: {
        columns: ['result'],
        rows: [[result]],
        rowCount: 1
      }
    };
  }

  private async executeQuerySQLite(db: Database.Database, query: string, params?: any[]): Promise<QueryResult> {
    const stmt = db.prepare(query);
    let result: any;

    if (query.trim().toLowerCase().startsWith('select')) {
      result = stmt.all(params);
      const columns = result.length > 0 ? Object.keys(result[0]) : [];
      const rows = result.map((row: any) => columns.map(col => row[col]));

      return {
        success: true,
        data: {
          columns,
          rows,
          rowCount: rows.length
        }
      };
    } else {
      const info = stmt.run(params);
      return {
        success: true,
        affectedRows: info.changes,
        data: {
          columns: ['affected_rows'],
          rows: [[info.changes]],
          rowCount: 1
        }
      };
    }
  }

  private async executeQuerySQLServer(client: Connection, query: string): Promise<QueryResult> {
    return new Promise((resolve, reject) => {
      const request = new (require('tedious').Request)(query, (err: any, rowCount: number, rows: any[][]) => {
        if (err) {
          reject(err);
        } else {
          const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
          const rowData = rows.map(row => columns.map(col => row[col].value));

          resolve({
            success: true,
            data: {
              columns,
              rows: rowData,
              rowCount
            }
          });
        }
      });

      client.execSql(request);
    });
  }

  private async executeQueryOracle(client: any, query: string, params?: any[]): Promise<QueryResult> {
    const result = await client.execute(query, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    return {
      success: true,
      data: {
        columns: result.metaData?.map((meta: any) => meta.name) || [],
        rows: result.rows?.map((row: any) => Object.values(row)) || [],
        rowCount: result.rows?.length || 0
      },
      affectedRows: result.rowsAffected
    };
  }

  private async executeQueryCassandra(client: CassandraClient, query: string, params?: any[]): Promise<QueryResult> {
    const result = await client.execute(query, params, { prepare: true });

    return {
      success: true,
      data: {
        columns: result.rowLength > 0 ? Object.keys(result.first()) : [],
        rows: Array.from(result).map(row => Object.values(row)),
        rowCount: result.rowLength
      }
    };
  }

  // Schema introspection methods
  private async getPostgreSQLSchema(client: Client): Promise<{ tables: TableInfo[] }> {
    const query = `
      SELECT
        t.table_name,
        t.table_schema,
        'table' as table_type,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.ordinal_position,
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as primary_key
      FROM information_schema.tables t
      LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
      LEFT JOIN (
        SELECT ku.table_name, ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
      ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
      WHERE t.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      ORDER BY t.table_name, c.ordinal_position
    `;

    const result = await client.query(query);
    const tablesMap = new Map<string, TableInfo>();

    for (const row of result.rows) {
      const tableName = row.table_name;
      if (!tablesMap.has(tableName)) {
        tablesMap.set(tableName, {
          name: tableName,
          schema: row.table_schema,
          type: row.table_type,
          columns: [],
          indexes: []
        });
      }

      const table = tablesMap.get(tableName)!;
      table.columns.push({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES',
        defaultValue: row.column_default,
        primaryKey: row.primary_key
      });
    }

    return { tables: Array.from(tablesMap.values()) };
  }

  private async getMySQLSchema(client: mysql.Connection): Promise<{ tables: TableInfo[] }> {
    const [rows] = await client.execute(`
      SELECT
        TABLE_NAME,
        TABLE_SCHEMA,
        TABLE_TYPE,
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        ORDINAL_POSITION,
        COLUMN_KEY
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);

    const tablesMap = new Map<string, TableInfo>();

    for (const row of rows as any[]) {
      const tableName = row.TABLE_NAME;
      if (!tablesMap.has(tableName)) {
        tablesMap.set(tableName, {
          name: tableName,
          schema: row.TABLE_SCHEMA,
          type: row.TABLE_TYPE.toLowerCase(),
          columns: [],
          indexes: []
        });
      }

      const table = tablesMap.get(tableName)!;
      table.columns.push({
        name: row.COLUMN_NAME,
        type: row.DATA_TYPE,
        nullable: row.IS_NULLABLE === 'YES',
        defaultValue: row.COLUMN_DEFAULT,
        primaryKey: row.COLUMN_KEY === 'PRI'
      });
    }

    return { tables: Array.from(tablesMap.values()) };
  }

  private async getMongoDBSchema(client: MongoClient): Promise<{ tables: TableInfo[] }> {
    const db = client.db();
    const collections = await db.listCollections().toArray();

    const tables: TableInfo[] = collections.map(collection => ({
      name: collection.name,
      schema: db.databaseName,
      type: 'collection',
      columns: [],
      indexes: []
    }));

    return { tables };
  }

  private async getSQLiteSchema(db: Database.Database): Promise<{ tables: TableInfo[] }> {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];

    const result: TableInfo[] = [];

    for (const table of tables) {
      const columns = db.prepare(`PRAGMA table_info(${table.name})`).all() as any[];

      result.push({
        name: table.name,
        schema: 'main',
        type: 'table',
        columns: columns.map(col => ({
          name: col.name,
          type: col.type,
          nullable: col.notnull === 0,
          defaultValue: col.dflt_value,
          primaryKey: col.pk === 1
        })),
        indexes: []
      });
    }

    return { tables: result };
  }

  private sanitizeConfig(config: DatabaseConfig): DatabaseConfig {
    const sanitized = { ...config };
    // Remove sensitive data for storage
    if (sanitized.password) {
      sanitized.password = '***encrypted***';
    }
    return sanitized;
  }
}

export const connectionManager = new DatabaseConnectionManager();