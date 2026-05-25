import { z } from 'zod';
import type { ActionFn } from '../types.js';
import { findAllowlistEntry, disallowedColumns } from './db-update-allowlist.js';

/**
 * db_update action — gated DB write driven by the allowlist registry in
 * db-update-allowlist.ts. The action will refuse to run unless every part
 * of the request is explicitly allowed:
 *
 *  1. The target table is in DB_UPDATE_ALLOWLIST
 *  2. Every column in `set` is in the entry's allowed column list
 *  3. The scope condition is satisfiable (org or self) given the run ctx
 *
 * Any failure returns ok:false. The default allowlist is intentionally
 * empty — fail-closed until a specific runbook proves it needs writes.
 *
 * Example step (will fail today because allowlist is empty):
 *   { action: "db_update",
 *     params: { table: "alerts", set: { status: "ack" }, where: { id: "..." } } }
 */

const paramsSchema = z.object({
  table: z.string().min(1),
  set: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  where: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
});

export const dbUpdateAction: ActionFn = async (step, ctx) => {
  const parsed = paramsSchema.safeParse(step.params);
  if (!parsed.success) {
    return { ok: false, error: `db_update: invalid params: ${parsed.error.message}` };
  }
  const { table, set } = parsed.data;

  const entry = findAllowlistEntry(table);
  if (!entry) {
    return {
      ok: false,
      error: `db_update: table '${table}' is not in DB_UPDATE_ALLOWLIST. Add an entry with security review.`,
    };
  }

  const setCols = Object.keys(set);
  const denied = disallowedColumns(entry, setCols);
  if (denied.length > 0) {
    return {
      ok: false,
      error: `db_update: column(s) [${denied.join(', ')}] not allowed for table '${table}'`,
    };
  }

  if (entry.scope === 'org' && !ctx.orgId) {
    return { ok: false, error: 'db_update: scope=org requires ctx.orgId' };
  }
  if (entry.scope === 'self' && !ctx.ownerUserId) {
    return { ok: false, error: 'db_update: scope=self requires ctx.ownerUserId' };
  }

  // Allowlist is empty by design today, so reaching here means a future
  // entry was added. Real DB write goes here once we have approved entries.
  // Fail-closed until that real branch lands rather than silently no-op.
  return {
    ok: false,
    error:
      'db_update: allowlist entry present but executor not yet implemented for this entry. ' +
      "Add a typed Drizzle update branch in db-update.ts when wiring the first real entry.",
  };
};
