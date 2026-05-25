/**
 * Loads enabled policies for a tenant and parses their rule JSON.
 *
 * Returns an array of `Policy` objects ordered by `priority` ascending.
 * Malformed rules are dropped silently — a single broken policy must
 * not lock a tenant out of refresh.
 */

import { and, asc, eq } from 'drizzle-orm';
import { tfPolicies } from '@opensyber/db';
import {
  parsePolicyRules,
  type Policy,
} from '@opensyber/tokenforge/server/internal';
import type { Variables } from '../../types.js';

export async function loadEnabledPolicies(
  db: Variables['db'],
  tenantId: string,
): Promise<Policy[]> {
  const rows = await db
    .select()
    .from(tfPolicies)
    .where(and(
      eq(tfPolicies.tenantId, tenantId),
      eq(tfPolicies.enabled, true),
    ))
    .orderBy(asc(tfPolicies.priority));

  const policies: Policy[] = [];
  for (const row of rows) {
    const parsed = parsePolicyRules(row.rules);
    if (parsed) policies.push(parsed);
  }
  return policies;
}
