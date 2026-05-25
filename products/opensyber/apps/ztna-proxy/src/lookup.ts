import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { tfZtnaApps } from '@opensyber/db';
import type { ZtnaApp } from './types.js';

/**
 * Look up the ZTNA app config for a given hostname.
 * Returns null when no row exists, regardless of status — caller decides how
 * to handle paused/deleted vs missing.
 */
export async function lookupAppByHostname(
  db: D1Database,
  hostname: string,
): Promise<ZtnaApp | null> {
  const orm = drizzle(db);
  const [row] = await orm
    .select()
    .from(tfZtnaApps)
    .where(eq(tfZtnaApps.hostname, hostname))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    hostname: row.hostname,
    upstream: row.upstream,
    requiredTrustScore: row.requiredTrustScore,
    forwardWriteMethods: !!row.forwardWriteMethods,
    status: row.status,
  };
}
