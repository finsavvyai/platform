import { randomUUID } from 'crypto';
import type { ConnectionConfig, SavedQuery } from '../types';

export class InMemoryStore {
  private connections = new Map<string, ConnectionConfig>();
  private queries = new Map<string, SavedQuery>();

  // ── Connections ──────────────────────────────────────────────

  createConnection(input: Omit<ConnectionConfig, 'id' | 'createdAt' | 'updatedAt'>): ConnectionConfig {
    const now = new Date().toISOString();
    const conn: ConnectionConfig = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.connections.set(conn.id!, conn);
    return conn;
  }

  getConnection(id: string): ConnectionConfig | undefined {
    return this.connections.get(id);
  }

  listConnections(): ConnectionConfig[] {
    return Array.from(this.connections.values());
  }

  updateConnection(id: string, updates: Partial<ConnectionConfig>): ConnectionConfig | undefined {
    const existing = this.connections.get(id);
    if (!existing) return undefined;
    const updated: ConnectionConfig = {
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };
    this.connections.set(id, updated);
    return updated;
  }

  deleteConnection(id: string): boolean {
    return this.connections.delete(id);
  }

  // ── Queries ──────────────────────────────────────────────────

  createQuery(input: Omit<SavedQuery, 'id' | 'createdAt' | 'updatedAt'>): SavedQuery {
    const now = new Date().toISOString();
    const query: SavedQuery = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.queries.set(query.id!, query);
    return query;
  }

  getQuery(id: string): SavedQuery | undefined {
    return this.queries.get(id);
  }

  listQueries(connectionId?: string): SavedQuery[] {
    const all = Array.from(this.queries.values());
    if (connectionId) return all.filter((q) => q.connectionId === connectionId);
    return all;
  }

  updateQuery(id: string, updates: Partial<SavedQuery>): SavedQuery | undefined {
    const existing = this.queries.get(id);
    if (!existing) return undefined;
    const updated: SavedQuery = {
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };
    this.queries.set(id, updated);
    return updated;
  }

  deleteQuery(id: string): boolean {
    return this.queries.delete(id);
  }

  // ── Utility ──────────────────────────────────────────────────

  clear(): void {
    this.connections.clear();
    this.queries.clear();
  }
}

export const store = new InMemoryStore();
