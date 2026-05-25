import mysql from 'mysql2/promise';
import type { DatabaseAdapter, AdapterConfig } from './base';
import type { QueryResult, SchemaInfo, ColumnInfo, TableInfo } from '../types';

export class MySQLAdapter implements DatabaseAdapter {
  private pool: mysql.Pool | null = null;
  private config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    this.pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl: this.config.ssl ? {} : undefined,
      connectionLimit: 10,
      waitForConnections: true,
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
    const [rows, fields] = await this.pool.execute(sql, params);
    const executionTimeMs = Date.now() - start;

    const resultRows = Array.isArray(rows) ? rows : [];
    const columns = (fields as mysql.FieldPacket[])?.map((f) => f.name) ?? [];

    return {
      columns,
      rows: resultRows as Record<string, unknown>[],
      rowCount: resultRows.length,
      executionTimeMs,
    };
  }

  async getSchema(): Promise<SchemaInfo> {
    if (!this.pool) throw new Error('Not connected');

    const [rows] = await this.pool.query(
      `SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
      [this.config.database],
    );

    const tables: TableInfo[] = [];
    for (const row of rows as any[]) {
      const cols = await this.getColumnInfo(row.TABLE_NAME);
      tables.push({
        name: row.TABLE_NAME,
        schema: this.config.database,
        type: row.TABLE_TYPE === 'VIEW' ? 'view' : 'table',
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
    const [rows] = await this.pool!.query(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [this.config.database, tableName],
    );

    return (rows as any[]).map((r) => ({
      name: r.COLUMN_NAME,
      type: r.DATA_TYPE,
      nullable: r.IS_NULLABLE === 'YES',
      defaultValue: r.COLUMN_DEFAULT ?? undefined,
      isPrimaryKey: r.COLUMN_KEY === 'PRI',
    }));
  }
}
