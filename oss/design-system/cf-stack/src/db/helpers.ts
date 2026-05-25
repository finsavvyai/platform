import type { D1Database, D1Result } from '../bindings';

export async function queryOne<T = unknown>(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  const result = await bound.first<T>();
  return result || null;
}

export async function queryAll<T = unknown>(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  const result = await bound.all<T>();
  return result.results || [];
}

export async function execute(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
): Promise<D1Result<unknown>> {
  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  return bound.run();
}
