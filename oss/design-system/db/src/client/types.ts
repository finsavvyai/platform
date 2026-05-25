import { DrizzleConfig } from 'drizzle-orm';

export interface DatabaseClient {
  readonly db: any;
  readonly config: DrizzleConfig<any>;
  close(): Promise<void>;
}

export type ClientType = 'postgres' | 'sqlite';

export interface PostgresConfig {
  connectionString: string;
  maxConnections?: number;
  idleTimeout?: number;
}

export interface SqliteConfig {
  filePath: string;
}
