import type { DatabaseAdapter, AdapterConfig } from './base';
import type { DatabaseType } from '../types';
import { PostgreSQLAdapter } from './postgresql';
import { MySQLAdapter } from './mysql';
import { AppError } from '../middleware/errorHandler';

const activeAdapters = new Map<string, DatabaseAdapter>();

export function createAdapter(type: DatabaseType, config: AdapterConfig): DatabaseAdapter {
  switch (type) {
    case 'postgresql':
      return new PostgreSQLAdapter(config);
    case 'mysql':
      return new MySQLAdapter(config);
    case 'mongodb':
    case 'redis':
    case 'sqlite':
      throw new AppError(501, `${type} adapter not yet implemented`, 'NOT_IMPLEMENTED');
    default:
      throw new AppError(400, `Unknown database type: ${type}`, 'INVALID_DB_TYPE');
  }
}

export async function getOrCreateAdapter(
  connectionId: string,
  type: DatabaseType,
  config: AdapterConfig,
): Promise<DatabaseAdapter> {
  let adapter = activeAdapters.get(connectionId);
  if (adapter?.isConnected()) return adapter;

  adapter = createAdapter(type, config);
  await adapter.connect();
  activeAdapters.set(connectionId, adapter);
  return adapter;
}

export async function removeAdapter(connectionId: string): Promise<void> {
  const adapter = activeAdapters.get(connectionId);
  if (adapter) {
    await adapter.disconnect();
    activeAdapters.delete(connectionId);
  }
}

export async function removeAllAdapters(): Promise<void> {
  for (const [id, adapter] of activeAdapters) {
    await adapter.disconnect();
    activeAdapters.delete(id);
  }
}

export function getActiveAdapterCount(): number {
  return activeAdapters.size;
}
