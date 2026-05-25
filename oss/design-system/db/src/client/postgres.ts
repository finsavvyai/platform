import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { pgTables } from '../schema/tables';
import { usersRelations, subscriptionsRelations, apiKeysRelations, auditLogRelations } from '../schema/relations';
import { DatabaseClient, PostgresConfig } from './types';

export class PostgresClient implements DatabaseClient {
  private pool: Pool;
  readonly db: ReturnType<typeof drizzle>;
  readonly config: any;

  private constructor(pool: Pool) {
    this.pool = pool;
    this.db = drizzle(pool, {
      schema: { ...pgTables, usersRelations, subscriptionsRelations, apiKeysRelations, auditLogRelations },
    });
    this.config = { type: 'postgres' };
  }

  static async create(config: PostgresConfig): Promise<PostgresClient> {
    const pool = new Pool({
      connectionString: config.connectionString,
      max: config.maxConnections ?? 10,
      idleTimeoutMillis: config.idleTimeout ?? 30000,
    });

    await pool.query('SELECT 1');
    return new PostgresClient(pool);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export async function createPostgresClient(
  connectionString: string
): Promise<DatabaseClient> {
  return PostgresClient.create({ connectionString });
}
