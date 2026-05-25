import { Client } from 'pg';
import {
  DatabaseAdapter,
  DatabaseConfig,
  QueryResult,
  TableInfo,
  ConnectionTestResult,
  ColumnInfo,
  IndexInfo
} from '../types';

export class PostgreSQLAdapter implements DatabaseAdapter {
  private client: Client | null = null;
  private config: DatabaseConfig;
  private connectionId: string;
  private connected: boolean = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.connectionId = `pg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async connect(): Promise<void> {
    try {
      this.client = new Client({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        ssl: this.config.ssl,
        ...this.config.options
      });

      await this.client.connect();
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new Error(`PostgreSQL connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
    this.connected = false;
  }

  async executeQuery(query: string, params?: any[]): Promise<QueryResult> {
    const startTime = Date.now();

    if (!this.client || !this.connected) {
      throw new Error('PostgreSQL not connected');
    }

    try {
      const result = await this.client.query(query, params);

      return {
        success: true,
        data: {
          columns: result.fields?.map((field: any) => field.name) || [],
          rows: result.rows || [],
          rowCount: result.rowCount || 0
        },
        affectedRows: result.rowCount,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query execution failed',
        executionTime: Date.now() - startTime
      };
    }
  }

  async getSchema(): Promise<{ tables: TableInfo[] }> {
    if (!this.client || !this.connected) {
      throw new Error('PostgreSQL not connected');
    }

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

    const result = await this.client.query(query);
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

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    try {
      if (!this.client || !this.connected) {
        await this.connect();
      }

      const result = await this.client!.query('SELECT version()');
      const version = result.rows[0]?.version;
      const latency = Date.now() - startTime;

      return {
        success: true,
        version,
        latency
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  getConnectionId(): string {
    return this.connectionId;
  }

  getClient(): Client | null {
    return this.client;
  }
}
