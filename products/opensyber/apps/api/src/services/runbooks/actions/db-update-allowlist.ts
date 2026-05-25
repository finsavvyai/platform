/**
 * Allowlist for db_update action.
 *
 * Hard rule: a runbook cannot update an arbitrary table. Each entry below is
 * an explicit (table, columns, scope) tuple. Adding a new entry must come
 * with a security review — runbooks run with elevated context and any
 * column not in this list MUST NOT be writable from a runbook step.
 *
 * Scope semantics:
 *   - 'org': WHERE org_id = ctx.orgId is auto-injected. Owner cannot escape.
 *   - 'self': WHERE owner_user_id = ctx.ownerUserId is auto-injected.
 *
 * To keep the blast radius small, the initial registry is empty. The first
 * real entry will be added when a specific runbook proves it needs DB writes.
 * In the meantime db_update returns 403 instead of pretending success — that
 * is the explicit fail-closed contract.
 */

export interface AllowlistEntry {
  table: string;
  columns: string[];
  scope: 'org' | 'self';
  // Optional: additional zod-like type tag per column for input validation.
  columnTypes?: Record<string, 'string' | 'number' | 'boolean'>;
}

export const DB_UPDATE_ALLOWLIST: AllowlistEntry[] = [
  // Empty by design. Add entries deliberately, with security review.
];

export function findAllowlistEntry(table: string): AllowlistEntry | null {
  return DB_UPDATE_ALLOWLIST.find((e) => e.table === table) ?? null;
}

export function disallowedColumns(
  entry: AllowlistEntry,
  cols: readonly string[],
): string[] {
  return cols.filter((c) => !entry.columns.includes(c));
}
