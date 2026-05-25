/**
 * Cursor-based pagination types used across API endpoints.
 */

export interface PaginationParams {
  cursor?: string;
  limit?: number;
  from?: string;
  to?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;
