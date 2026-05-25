import { store } from '../storage';
import { getOrCreateAdapter, removeAdapter } from '../adapters/factory';
import { AppError } from '../middleware/errorHandler';
import type { ConnectionConfig, CreateConnectionInput, ConnectionStatus } from '../types';
import type { AdapterConfig } from '../adapters/base';

function toAdapterConfig(conn: ConnectionConfig): AdapterConfig {
  return {
    host: conn.host,
    port: conn.port,
    database: conn.database,
    username: conn.username,
    password: conn.password,
    ssl: conn.ssl,
  };
}

export async function createConnection(input: CreateConnectionInput): Promise<ConnectionConfig> {
  const conn = store.createConnection(input);
  return conn;
}

export function getConnection(id: string): ConnectionConfig {
  const conn = store.getConnection(id);
  if (!conn) throw new AppError(404, 'Connection not found', 'NOT_FOUND');
  return conn;
}

export function listConnections(): ConnectionConfig[] {
  return store.listConnections();
}

export function updateConnection(id: string, updates: Partial<ConnectionConfig>): ConnectionConfig {
  const conn = store.updateConnection(id, updates);
  if (!conn) throw new AppError(404, 'Connection not found', 'NOT_FOUND');
  return conn;
}

export async function deleteConnection(id: string): Promise<void> {
  await removeAdapter(id);
  const deleted = store.deleteConnection(id);
  if (!deleted) throw new AppError(404, 'Connection not found', 'NOT_FOUND');
}

export async function testConnection(id: string): Promise<ConnectionStatus> {
  const conn = getConnection(id);
  const adapter = await getOrCreateAdapter(id, conn.type, toAdapterConfig(conn));
  const result = await adapter.testConnection();

  return {
    id,
    status: result.success ? 'connected' : 'error',
    message: result.message,
    latencyMs: result.latencyMs,
    checkedAt: new Date().toISOString(),
  };
}

export async function connectToDatabase(id: string): Promise<void> {
  const conn = getConnection(id);
  await getOrCreateAdapter(id, conn.type, toAdapterConfig(conn));
}

export async function disconnectFromDatabase(id: string): Promise<void> {
  await removeAdapter(id);
}
