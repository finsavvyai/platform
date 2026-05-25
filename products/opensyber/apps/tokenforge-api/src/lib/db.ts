import { drizzle } from 'drizzle-orm/d1';
import * as schema from '@opensyber/db';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

export function createDb(d1: D1Database): DrizzleD1Database<typeof schema> {
  return drizzle(d1, { schema });
}
