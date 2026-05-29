import pg from 'pg';
import type { DatabaseAdapter, AdapterConfig } from './base';
import type { QueryResult, SchemaInfo, ColumnInfo, TableInfo } from '../types';

export class PostgreSQLAdapter implements DatabaseAdapter {
  private pool: pg.Pool | null = null;
  private config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    this.pool = new pg.Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  isConnected(): boolean {
    return this.pool !== null;
  }

  async executeQuery(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.pool) throw new Error('Not connected');
    const start = Date.now();
    const result = await this.pool.query(sql, params);
    const executionTimeMs = Date.now() - start;

    const columns = result.fields?.map((f) => f.name) ?? [];
    return {
      columns,
      rows: result.rows ?? [],
      rowCount: result.rowCount ?? 0,
      executionTimeMs,
    };
  }

  async getSchema(): Promise<SchemaInfo> {
    if (!this.pool) throw new Error('Not connected');

    const tablesResult = await this.pool.query(
      `SELECT table_name, table_type FROM information_schema.tables
       WHERE table_schema = 'public' ORDER BY table_name`,
    );

    const tables: TableInfo[] = [];
    for (const row of tablesResult.rows) {
      const cols = await this.getColumnInfo(row.table_name);
      tables.push({
        name: row.table_name,
        schema: 'public',
        type: row.table_type === 'VIEW' ? 'view' : 'table',
        columns: cols,
      });
    }

    return { databaseName: this.config.database, tables };
  }

  async testConnection(): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const start = Date.now();
    try {
      if (!this.pool) await this.connect();
      await this.pool!.query('SELECT 1');
      return { success: true, message: 'Connected', latencyMs: Date.now() - start };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, message: msg, latencyMs: Date.now() - start };
    }
  }

  private async getColumnInfo(tableName: string): Promise<ColumnInfo[]> {
    const result = await this.pool!.query(
      `SELECT c.column_name, c.data_type, c.is_nullable, c.column_default,
              CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_pk
       FROM information_schema.columns c
       LEFT JOIN (
         SELECT ku.column_name FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
         WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
       ) pk ON c.column_name = pk.column_name
       WHERE c.table_name = $1 AND c.table_schema = 'public'
       ORDER BY c.ordinal_position`,
      [tableName],
    );

    return result.rows.map((r) => ({
      name: r.column_name,
      type: r.data_type,
      nullable: r.is_nullable === 'YES',
      defaultValue: r.column_default ?? undefined,
      isPrimaryKey: r.is_pk,
    }));
  }
}
