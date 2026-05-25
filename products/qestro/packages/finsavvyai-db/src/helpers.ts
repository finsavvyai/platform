/**
 * @finsavvyai/db — Drizzle ORM helpers
 */

import { sql } from 'drizzle-orm';

/** Generate a ULID-style ID (sortable, unique) */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}${random}`;
}

/** ISO timestamp for SQLite */
export function now(): string {
  return new Date().toISOString();
}

/** Pagination helper */
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function paginate(params: PaginationParams): {
  offset: number;
  limit: number;
} {
  const page = Math.max(1, params.page);
  const limit = Math.min(100, Math.max(1, params.limit));
  return { offset: (page - 1) * limit, limit };
}

export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  params: PaginationParams,
): PaginatedResult<T> {
  return {
    data,
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}

/** Soft delete helper — marks records instead of removing */
export function softDeleteClause() {
  return sql`deleted_at IS NULL`;
}

/** Full-text search helper for SQLite */
export function searchClause(column: string, query: string) {
  return sql`${sql.raw(column)} LIKE ${`%${query}%`}`;
}
