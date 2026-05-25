/**
 * @finsavvyai/db — Shared database schemas and helpers
 *
 * Features:
 * - Base schema templates (users, subscriptions, API keys, audit log)
 * - ID generation, pagination, soft delete helpers
 * - Full-text search for SQLite/D1
 */

export {
  baseUsers,
  baseSubscriptions,
  baseApiKeys,
  baseAuditLog,
} from './schemas.js';

export {
  generateId,
  now,
  paginate,
  buildPaginatedResult,
  softDeleteClause,
  searchClause,
  type PaginationParams,
  type PaginatedResult,
} from './helpers.js';
