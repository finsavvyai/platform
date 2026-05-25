import mysql from "mysql2/promise";
import {
  DatabaseAdapter,
  DatabaseConfig,
  QueryResult,
  TableInfo,
  ConnectionTestResult,
  ColumnInfo,
  IndexInfo,
} from "../types";

export class MySQLAdapter implements DatabaseAdapter {
  private client: mysql.Connection | null = null;
  private config: DatabaseConfig;
  private connectionId: string;
  private connected: boolean = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.connectionId = `mysql_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async connect(): Promise<void> {
    try {
      this.client = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        ssl: this.config.ssl,
        ...this.config.options,
      });

      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new Error(
        `MySQL connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
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
      throw new Error("MySQL not connected");
    }

    try {
      const [rows, fields] = await this.client.execute(query, params);

      return {
        success: true,
        data: {
          columns: fields?.map((field: any) => field.name) || [],
          rows: Array.isArray(rows)
            ? rows.map((row) => Object.values(row))
            : [],
          rowCount: Array.isArray(rows) ? rows.length : 0,
        },
        affectedRows: Array.isArray(rows) ? rows.length : 0,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Query execution failed",
        executionTime: Date.now() - startTime,
      };
    }
  }

  async getSchema(): Promise<{ tables: TableInfo[] }> {
    if (!this.client || !this.connected) {
      throw new Error("MySQL not connected");
    }

    const [rows] = await this.client.execute(`
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
          indexes: [],
        });
      }

      const table = tablesMap.get(tableName)!;
      table.columns.push({
        name: row.COLUMN_NAME,
        type: row.DATA_TYPE,
        nullable: row.IS_NULLABLE === "YES",
        defaultValue: row.COLUMN_DEFAULT,
        primaryKey: row.COLUMN_KEY === "PRI",
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

      const [rows] = await this.client!.execute("SELECT VERSION() as version");
      const version = (rows as any[])[0]?.version;
      const latency = Date.now() - startTime;

      return {
        success: true,
        version,
        latency,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Connection test failed",
      };
    }
  }

  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  getConnectionId(): string {
    return this.connectionId;
  }

  getClient(): mysql.Connection | null {
    return this.client;
  }
}
