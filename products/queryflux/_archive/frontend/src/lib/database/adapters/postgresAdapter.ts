/**
 * PostgreSQL Database Adapter
 *
 * This adapter provides real PostgreSQL database connectivity using the 'pg' library.
 * It includes connection pooling, secure query execution, and schema introspection.
 */

import { Pool, Client, PoolClient, QueryResult as PgQueryResult } from 'pg';
import { DatabaseAdapter, QueryResult, DatabaseSchema, TableSchema, ColumnSchema } from '../baseAdapter';

export interface PostgresConnectionConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
  connectionString?: string;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  max?: number;
}

export class PostgresAdapter implements DatabaseAdapter {
  private pool: Pool | null = null;
  private config: PostgresConnectionConfig;
  private isConnected: boolean = false;

  constructor(config: PostgresConnectionConfig) {
    this.config = {
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 10,
      ssl: false,
      ...config,
    };
  }

  /**
   * Establish connection to PostgreSQL database
   */
  async connect(): Promise<void> {
    try {
      if (this.config.connectionString) {
        this.pool = new Pool({
          connectionString: this.config.connectionString,
          ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
          connectionTimeoutMillis: this.config.connectionTimeoutMillis,
          idleTimeoutMillis: this.config.idleTimeoutMillis,
          max: this.config.max,
        });
      } else {
        this.pool = new Pool({
          host: this.config.host,
          port: this.config.port,
          database: this.config.database,
          user: this.config.user,
          password: this.config.password,
          ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
          connectionTimeoutMillis: this.config.connectionTimeoutMillis,
          idleTimeoutMillis: this.config.idleTimeoutMillis,
          max: this.config.max,
        });
      }

      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      this.isConnected = true;
    } catch (error) {
      this.isConnected = false;
      throw new Error(`PostgreSQL connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Close database connection pool
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
    }
  }

  /**
   * Check if adapter is connected
   */
  isConnectionActive(): boolean {
    return this.isConnected && this.pool !== null;
  }

  /**
   * Execute a query with parameters for SQL injection prevention
   */
  async executeQuery(query: string, params?: any[]): Promise<QueryResult> {
    if (!this.pool || !this.isConnected) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const client = await this.pool.connect();

    try {
      const start = Date.now();
      const result: PgQueryResult = await client.query(query, params);
      const duration = Date.now() - start;

      // Transform PostgreSQL result to standard format
      const columns = result.fields.map(field => ({
        name: field.name,
        type: field.dataTypeID,
        nullable: true, // PostgreSQL doesn't provide this in result
      }));

      return {
        success: true,
        data: result.rows,
        columns,
        rowCount: result.rowCount,
        executionTime: duration,
        affectedRows: result.rowCount,
        message: `Query executed successfully. Returned ${result.rowCount} rows in ${duration}ms.`,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        columns: [],
        rowCount: 0,
        executionTime: 0,
        affectedRows: 0,
        message: `Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      client.release();
    }
  }

  /**
   * Test connection without throwing errors
   */
  async testConnection(): Promise<{ success: boolean; message: string; latency?: number }> {
    try {
      const start = Date.now();
      await this.connect();
      const latency = Date.now() - start;

      await this.disconnect();

      return {
        success: true,
        message: 'PostgreSQL connection successful',
        latency,
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get database schema information
   */
  async getSchema(): Promise<DatabaseSchema> {
    if (!this.pool || !this.isConnected) {
      throw new Error('Database not connected. Call connect() first.');
    }

    try {
      // Get all tables
      const tablesQuery = `
        SELECT
          table_schema,
          table_name,
          table_type
        FROM information_schema.tables
        WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY table_schema, table_name
      `;

      const tablesResult = await this.executeQuery(tablesQuery);

      const tables: TableSchema[] = [];

      for (const tableRow of tablesResult.data || []) {
        const tableName = tableRow.table_name;
        const schemaName = tableRow.table_schema;

        // Get columns for this table
        const columnsQuery = `
          SELECT
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length,
            numeric_precision,
            numeric_scale
          FROM information_schema.columns
          WHERE table_schema = $1
            AND table_name = $2
          ORDER BY ordinal_position
        `;

        const columnsResult = await this.executeQuery(columnsQuery, [schemaName, tableName]);

        const columns: ColumnSchema[] = (columnsResult.data || []).map(col => ({
          name: col.column_name,
          type: this.mapPostgresType(col.data_type),
          nullable: col.is_nullable === 'YES',
          defaultValue: col.column_default,
          maxLength: col.character_maximum_length,
          precision: col.numeric_precision,
          scale: col.numeric_scale,
        }));

        // Get primary keys
        const pkQuery = `
          SELECT a.attname
          FROM pg_constraint c
          JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
          WHERE c.conrelid = $1::regclass
            AND c.contype = 'p'
        `;

        const pkResult = await this.executeQuery(pkQuery, [`${schemaName}.${tableName}`]);
        const primaryKeys = (pkResult.data || []).map(pk => pk.attname);

        // Get foreign keys
        const fkQuery = `
          SELECT
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = $1
            AND tc.table_name = $2
        `;

        const fkResult = await this.executeQuery(fkQuery, [schemaName, tableName]);

        const foreignKeys: Record<string, { table: string; column: string }> = {};
        (fkResult.data || []).forEach(fk => {
          foreignKeys[fk.column_name] = {
            table: fk.foreign_table_name,
            column: fk.foreign_column_name,
          };
        });

        tables.push({
          name: tableName,
          schema: schemaName,
          type: tableRow.table_type === 'VIEW' ? 'view' : 'table',
          columns,
          primaryKeys,
          foreignKeys,
          rowCount: await this.getRowCount(schemaName, tableName),
        });
      }

      return {
        databaseName: this.config.database || 'unknown',
        version: await this.getVersion(),
        tables,
        views: tables.filter(t => t.type === 'view'),
      };
    } catch (error) {
      throw new Error(`Schema retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get estimated row count for a table
   */
  private async getRowCount(schema: string, table: string): Promise<number> {
    try {
      const result = await this.executeQuery(
        `SELECT reltuples::bigint FROM pg_class WHERE relname = $1`,
        [table]
      );
      return result.data?.[0]?.reltuples || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get PostgreSQL version
   */
  private async getVersion(): Promise<string> {
    try {
      const result = await this.executeQuery('SELECT version()');
      return result.data?.[0]?.version || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Map PostgreSQL data types to standard types
   */
  private mapPostgresType(pgType: string): string {
    const typeMap: Record<string, string> = {
      'character varying': 'string',
      'varchar': 'string',
      'character': 'string',
      'char': 'string',
      'text': 'string',
      'integer': 'integer',
      'int': 'integer',
      'int4': 'integer',
      'bigint': 'bigint',
      'int8': 'bigint',
      'smallint': 'smallint',
      'int2': 'smallint',
      'decimal': 'decimal',
      'numeric': 'decimal',
      'real': 'real',
      'float4': 'real',
      'double precision': 'double',
      'float8': 'double',
      'smallserial': 'integer',
      'serial': 'integer',
      'bigserial': 'bigint',
      'boolean': 'boolean',
      'bool': 'boolean',
      'date': 'date',
      'timestamp': 'timestamp',
      'timestamptz': 'timestamp',
      'timestamp with time zone': 'timestamp',
      'timestamp without time zone': 'timestamp',
      'time': 'time',
      'timetz': 'time',
      'time with time zone': 'time',
      'time without time zone': 'time',
      'json': 'json',
      'jsonb': 'json',
      'uuid': 'uuid',
      'xml': 'xml',
      'bytea': 'binary',
      'point': 'geometric',
      'line': 'geometric',
      'lseg': 'geometric',
      'box': 'geometric',
      'path': 'geometric',
      'polygon': 'geometric',
      'circle': 'geometric',
      'cidr': 'network',
      'inet': 'network',
      'macaddr': 'network',
      'macaddr8': 'network',
      'money': 'money',
      'interval': 'interval',
    };

    return typeMap[pgType.toLowerCase()] || 'unknown';
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats() {
    if (!this.pool) {
      return {
        totalCount: 0,
        idleCount: 0,
        waitingCount: 0,
      };
    }

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  /**
   * Execute a transaction
   */
  async executeTransaction(queries: Array<{ query: string; params?: any[] }>): Promise<QueryResult[]> {
    if (!this.pool || !this.isConnected) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const results: QueryResult[] = [];

      for (const { query, params } of queries) {
        const start = Date.now();
        const result: PgQueryResult = await client.query(query, params);
        const duration = Date.now() - start;

        const columns = result.fields.map(field => ({
          name: field.name,
          type: field.dataTypeID,
          nullable: true,
        }));

        results.push({
          success: true,
          data: result.rows,
          columns,
          rowCount: result.rowCount,
          executionTime: duration,
          affectedRows: result.rowCount,
          message: `Query executed successfully. Returned ${result.rowCount} rows in ${duration}ms.`,
        });
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
