/**
 * Database client setup for Drizzle + Cloudflare D1.
 * Creates and exports configured Drizzle instance.
 */

import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema.js';

export type DB = DrizzleD1Database<typeof schema>;

export interface DatabaseConfig {
  d1Binding: D1Database;
}

export function createDB(config: DatabaseConfig): DB {
  return drizzle(config.d1Binding, { schema });
}

export { schema };
