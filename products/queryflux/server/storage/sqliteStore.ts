import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import path from 'path';
import type { ConnectionConfig, SavedQuery } from '../types';

const DB_PATH = process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'queryflux.db');

function openDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      host TEXT,
      port INTEGER,
      database_name TEXT,
      username TEXT,
      password TEXT,
      ssl INTEGER DEFAULT 0,
      connection_string TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS saved_queries (
      id TEXT PRIMARY KEY,
      name TEXT,
      sql TEXT NOT NULL,
      connection_id TEXT NOT NULL,
      description TEXT,
      tags TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
    );
  `);
  return db;
}

function rowToConnection(row: Record<string, unknown>): ConnectionConfig {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as ConnectionConfig['type'],
    host: (row.host ?? '') as string,
    port: (row.port ?? 5432) as number,
    database: (row.database_name ?? '') as string,
    username: (row.username ?? '') as string,
    password: (row.password ?? '') as string,
    ssl: Boolean(row.ssl),
    connectionString: row.connection_string as string | undefined,
    metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToQuery(row: Record<string, unknown>): SavedQuery {
  return {
    id: row.id as string,
    name: (row.name ?? '') as string,
    sql: row.sql as string,
    connectionId: row.connection_id as string,
    description: row.description as string | undefined,
    tags: row.tags ? JSON.parse(row.tags as string) : undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export class SqliteStore {
  private db: Database.Database;

  constructor() {
    this.db = openDb();
  }

  createConnection(input: Omit<ConnectionConfig, 'id' | 'createdAt' | 'updatedAt'>): ConnectionConfig {
    const now = new Date().toISOString();
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO connections (id, name, type, host, port, database_name, username, password, ssl, connection_string, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.name, input.type, input.host ?? null, input.port ?? null,
      input.database ?? null, input.username ?? null, input.password ?? null,
      input.ssl ? 1 : 0, input.connectionString ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null, now, now);
    return rowToConnection(this.db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as Record<string, unknown>);
  }

  getConnection(id: string): ConnectionConfig | undefined {
    const row = this.db.prepare('SELECT * FROM connections WHERE id = ?').get(id);
    return row ? rowToConnection(row as Record<string, unknown>) : undefined;
  }

  listConnections(): ConnectionConfig[] {
    return (this.db.prepare('SELECT * FROM connections ORDER BY created_at DESC').all() as Record<string, unknown>[])
      .map(rowToConnection);
  }

  updateConnection(id: string, updates: Partial<ConnectionConfig>): ConnectionConfig | undefined {
    const existing = this.getConnection(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...updates, id, updatedAt: new Date().toISOString() };
    this.db.prepare(`
      UPDATE connections SET name=?, type=?, host=?, port=?, database_name=?, username=?, password=?, ssl=?, connection_string=?, metadata=?, updated_at=? WHERE id=?
    `).run(merged.name, merged.type, merged.host ?? null, merged.port ?? null,
      merged.database ?? null, merged.username ?? null, merged.password ?? null,
      merged.ssl ? 1 : 0, merged.connectionString ?? null,
      merged.metadata ? JSON.stringify(merged.metadata) : null, merged.updatedAt, id);
    return this.getConnection(id);
  }

  deleteConnection(id: string): boolean {
    const result = this.db.prepare('DELETE FROM connections WHERE id = ?').run(id);
    return result.changes > 0;
  }

  createQuery(input: Omit<SavedQuery, 'id' | 'createdAt' | 'updatedAt'>): SavedQuery {
    const now = new Date().toISOString();
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO saved_queries (id, name, sql, connection_id, description, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.name ?? null, input.sql, input.connectionId,
      input.description ?? null, input.tags ? JSON.stringify(input.tags) : null, now, now);
    return rowToQuery(this.db.prepare('SELECT * FROM saved_queries WHERE id = ?').get(id) as Record<string, unknown>);
  }

  getQuery(id: string): SavedQuery | undefined {
    const row = this.db.prepare('SELECT * FROM saved_queries WHERE id = ?').get(id);
    return row ? rowToQuery(row as Record<string, unknown>) : undefined;
  }

  listQueries(connectionId?: string): SavedQuery[] {
    const rows = connectionId
      ? this.db.prepare('SELECT * FROM saved_queries WHERE connection_id = ? ORDER BY created_at DESC').all(connectionId)
      : this.db.prepare('SELECT * FROM saved_queries ORDER BY created_at DESC').all();
    return (rows as Record<string, unknown>[]).map(rowToQuery);
  }

  updateQuery(id: string, updates: Partial<SavedQuery>): SavedQuery | undefined {
    const existing = this.getQuery(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...updates, id, updatedAt: new Date().toISOString() };
    this.db.prepare(`
      UPDATE saved_queries SET name=?, sql=?, description=?, tags=?, updated_at=? WHERE id=?
    `).run(merged.name ?? null, merged.sql, merged.description ?? null,
      merged.tags ? JSON.stringify(merged.tags) : null, merged.updatedAt, id);
    return this.getQuery(id);
  }

  deleteQuery(id: string): boolean {
    const result = this.db.prepare('DELETE FROM saved_queries WHERE id = ?').run(id);
    return result.changes > 0;
  }

  clear(): void {
    this.db.exec('DELETE FROM saved_queries; DELETE FROM connections;');
  }

  close(): void {
    this.db.close();
  }
}
