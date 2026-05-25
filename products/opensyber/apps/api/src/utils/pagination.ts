import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '@opensyber/shared';

interface CursorData {
  createdAt: string;
  id: string;
}

/**
 * Decode a base64 cursor string to { createdAt, id }.
 * Returns null if cursor is invalid.
 */
export function parseCursor(cursor: string | undefined): CursorData | null {
  if (!cursor) return null;
  try {
    const decoded = atob(cursor);
    const parsed = JSON.parse(decoded) as CursorData;
    if (typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Build a base64 cursor from the last item in a result set.
 */
export function buildNextCursor(createdAt: string, id: string): string {
  return btoa(JSON.stringify({ createdAt, id }));
}

/**
 * Parse and validate limit query parameter.
 */
export function parseLimit(limit: string | undefined): number {
  if (!limit) return DEFAULT_PAGE_LIMIT;
  const n = parseInt(limit, 10);
  if (isNaN(n) || n < 1) return DEFAULT_PAGE_LIMIT;
  return Math.min(n, MAX_PAGE_LIMIT);
}

/**
 * Parse and validate ISO date range parameters.
 * Returns null values for missing/invalid dates.
 */
export function parseDateRange(
  from: string | undefined,
  to: string | undefined,
): { from: string | null; to: string | null } {
  const isValidDate = (d: string): boolean => !isNaN(Date.parse(d));
  return {
    from: from && isValidDate(from) ? from : null,
    to: to && isValidDate(to) ? to : null,
  };
}
