import { store } from '../storage';
import { getOrCreateAdapter } from '../adapters/factory';
import { sanitizeSQL } from '../adapters/base';
import { AppError } from '../middleware/errorHandler';
import { getConnection } from './connectionService';
import type { QueryResult, SavedQuery, QueryExecutionInput } from '../types';
import type { AdapterConfig } from '../adapters/base';

const MAX_RESULT_ROWS = 10_000;

function toAdapterConfig(conn: { host: string; port: number; database: string; username: string; password: string; ssl: boolean }): AdapterConfig {
  return { host: conn.host, port: conn.port, database: conn.database, username: conn.username, password: conn.password, ssl: conn.ssl };
}

export async function executeQuery(input: QueryExecutionInput): Promise<QueryResult> {
  const check = sanitizeSQL(input.sql);
  if (!check.safe) {
    throw new AppError(400, check.reason || 'Unsafe query', 'UNSAFE_QUERY');
  }

  const conn = getConnection(input.connectionId);
  const adapter = await getOrCreateAdapter(input.connectionId, conn.type, toAdapterConfig(conn));
  const result = await adapter.executeQuery(input.sql);

  if (result.rowCount > MAX_RESULT_ROWS) {
    result.rows = result.rows.slice(0, MAX_RESULT_ROWS);
    result.truncated = true;
  }

  return result;
}

export function createSavedQuery(input: Omit<SavedQuery, 'id' | 'createdAt' | 'updatedAt'>): SavedQuery {
  getConnection(input.connectionId); // validate connection exists
  return store.createQuery(input);
}

export function getSavedQuery(id: string): SavedQuery {
  const query = store.getQuery(id);
  if (!query) throw new AppError(404, 'Query not found', 'NOT_FOUND');
  return query;
}

export function listSavedQueries(connectionId?: string): SavedQuery[] {
  return store.listQueries(connectionId);
}

export function updateSavedQuery(id: string, updates: Partial<SavedQuery>): SavedQuery {
  const query = store.updateQuery(id, updates);
  if (!query) throw new AppError(404, 'Query not found', 'NOT_FOUND');
  return query;
}

export function deleteSavedQuery(id: string): void {
  const deleted = store.deleteQuery(id);
  if (!deleted) throw new AppError(404, 'Query not found', 'NOT_FOUND');
}
