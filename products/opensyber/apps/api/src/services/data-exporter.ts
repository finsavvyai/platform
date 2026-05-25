/**
 * Data Export Service
 *
 * Converts DB rows to JSON or CSV format with proper escaping,
 * date range filtering, and cursor-based pagination helpers.
 */

/** Supported export formats */
export type ExportFormat = 'json' | 'csv';

/** Validate export format parameter */
export function parseExportFormat(format: string | undefined): ExportFormat {
  if (format === 'csv') return 'csv';
  return 'json';
}

/** Escape a CSV field value (handles commas, quotes, newlines) */
function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert an array of objects to CSV string.
 * Uses keys from the first row as column headers.
 */
export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]!);
  const headerLine = headers.map(escapeCsvField).join(',');

  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCsvField(row[h])).join(','),
  );

  return [headerLine, ...dataLines].join('\n');
}

/**
 * Convert rows to the requested export format.
 * Returns { content, contentType } for response building.
 */
export function exportToFormat(
  rows: Record<string, unknown>[],
  format: ExportFormat,
): { content: string; contentType: string } {
  if (format === 'csv') {
    return { content: rowsToCsv(rows), contentType: 'text/csv' };
  }
  return {
    content: JSON.stringify({ data: rows, exportedAt: new Date().toISOString(), count: rows.length }),
    contentType: 'application/json',
  };
}

/**
 * Build a date range SQL filter clause.
 * Returns { from, to } as ISO strings (or null if invalid).
 */
export function buildDateFilter(
  from: string | undefined,
  to: string | undefined,
): { from: string | null; to: string | null } {
  const isValid = (d: string) => !isNaN(Date.parse(d));
  return {
    from: from && isValid(from) ? new Date(from).toISOString() : null,
    to: to && isValid(to) ? new Date(to).toISOString() : null,
  };
}

/**
 * Parse and validate a numeric limit with defaults.
 * Max export size capped at 10,000 rows to prevent memory issues.
 */
export function parseExportLimit(limit: string | undefined): number {
  const MAX_EXPORT_LIMIT = 10_000;
  const DEFAULT_EXPORT_LIMIT = 1_000;
  if (!limit) return DEFAULT_EXPORT_LIMIT;
  const n = parseInt(limit, 10);
  if (isNaN(n) || n < 1) return DEFAULT_EXPORT_LIMIT;
  return Math.min(n, MAX_EXPORT_LIMIT);
}
