import { getOrCreateAdapter } from '../adapters/factory';
import { getConnection } from './connectionService';
import type { SchemaInfo } from '../types';
import type { AdapterConfig } from '../adapters/base';

function toAdapterConfig(conn: { host: string; port: number; database: string; username: string; password: string; ssl: boolean }): AdapterConfig {
  return { host: conn.host, port: conn.port, database: conn.database, username: conn.username, password: conn.password, ssl: conn.ssl };
}

export async function getSchema(connectionId: string): Promise<SchemaInfo> {
  const conn = getConnection(connectionId);
  const adapter = await getOrCreateAdapter(connectionId, conn.type, toAdapterConfig(conn));
  return adapter.getSchema();
}

export function formatSchemaForPrompt(schema: SchemaInfo): string {
  const lines: string[] = [];
  lines.push(`Database: ${schema.databaseName}`);
  lines.push('');

  for (const table of schema.tables) {
    lines.push(`Table: ${table.name}`);
    for (const col of table.columns) {
      const pk = col.isPrimaryKey ? ' [PK]' : '';
      const nullable = col.nullable ? ' NULL' : ' NOT NULL';
      lines.push(`  - ${col.name}: ${col.type}${nullable}${pk}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
