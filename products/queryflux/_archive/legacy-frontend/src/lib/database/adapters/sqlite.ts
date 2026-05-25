import Database from 'better-sqlite3';
import {
  DatabaseAdapter,
  DatabaseConfig,
  QueryResult,
  TableInfo,
  ConnectionTestResult,
  ColumnInfo,
  IndexInfo
} from '../types';

export class SQLiteAdapter implements DatabaseAdapter {
  private db: Database.Database | null = null;
  private config: DatabaseConfig;
  private connectionId: string;
  private connected: boolean = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.connectionId = `sqlite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async connect(): Promise<void> {
    try {
      // For SQLite, the database parameter should be the file path
      const dbPath = this.config.database || ':memory:';
      this.db = new Database(dbPath);
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new Error(`SQLite connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.connected = false;
  }

  async executeQuery(query: string, params?: any[]): Promise<QueryResult> {
    const startTime = Date.now();

    if (!this.db || !this.connected) {
      throw new Error('SQLite not connected');
    }

    try {
      const stmt = this.db.prepare(query);
      let result: any;

      if (query.trim().toLowerCase().startsWith('select')) {
        result = stmt.all(params || []);
        const columns = result.length > 0 ? Object.keys(result[0]) : [];
        const rows = result.map((row: any) => columns.map(col => row[col]));

        return {
          success: true,
          data: {
            columns,
            rows,
            rowCount: rows.length
          },
          executionTime: Date.now() - startTime
        };
      } else {
        const info = stmt.run(params || []);
        return {
          success: true,
          affectedRows: info.changes,
          data: {
            columns: ['affected_rows'],
            rows: [[info.changes]],
            rowCount: 1
          },
          executionTime: Date.now() - startTime
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query execution failed',
        executionTime: Date.now() - startTime
      };
    }
  }

  async getSchema(): Promise<{ tables: TableInfo[] }> {
    if (!this.db || !this.connected) {
      throw new Error('SQLite not connected');
    }

    const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];

    const result: TableInfo[] = [];

    for (const table of tables) {
      const columns = this.db.prepare(`PRAGMA table_info(${table.name})`).all() as any[];

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

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    try {
      if (!this.db || !this.connected) {
        await this.connect();
      }

      // Test with a simple query
      const result = this.db!.prepare("SELECT sqlite_version()").get() as any;
      const version = result?.['sqlite_version()'];
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
    return this.connected && this.db !== null;
  }

  getConnectionId(): string {
    return this.connectionId;
  }

  getDatabase(): Database.Database | null {
    return this.db;
  }
}
