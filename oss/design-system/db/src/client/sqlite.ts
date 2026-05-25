import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { pgTables } from '../schema/tables';
import { usersRelations, subscriptionsRelations, apiKeysRelations, auditLogRelations } from '../schema/relations';
import { DatabaseClient, SqliteConfig } from './types';

export class SqliteClient implements DatabaseClient {
  private sqlite: Database.Database;
  readonly db: ReturnType<typeof drizzle>;
  readonly config: any;

  private constructor(sqlite: Database.Database) {
    this.sqlite = sqlite;
    this.db = drizzle(sqlite, {
      schema: { ...pgTables, usersRelations, subscriptionsRelations, apiKeysRelations, auditLogRelations },
    });
    this.config = { type: 'sqlite' };
  }

  static create(config: SqliteConfig): SqliteClient {
    const sqlite = new Database(config.filePath);
    sqlite.pragma('journal_mode = WAL');
    return new SqliteClient(sqlite);
  }

  async close(): Promise<void> {
    this.sqlite.close();
  }
}

export function createSqliteClient(filePath: string): DatabaseClient {
  return SqliteClient.create({ filePath });
}
