/**
 * Public-key reader for `/.well-known/tokenforge/jwks` (Sprint 35).
 *
 * Returns the published JWK array — keys with status `active` or
 * `retiring`. Revoked keys are excluded so verifiers don't accept
 * signatures from compromised material.
 */

import { inArray } from 'drizzle-orm';
import { tfSigningKeys } from '@opensyber/db';
import type { Variables } from '../../types.js';

type DbLike = Variables['db'];

export interface PublicJwk {
  kid: string;
  alg: string;
  [key: string]: unknown;
}

export async function loadPublicJwks(db: DbLike): Promise<PublicJwk[]> {
  const rows = await db
    .select()
    .from(tfSigningKeys)
    .where(inArray(tfSigningKeys.status, ['active', 'retiring']));

  const keys: PublicJwk[] = [];
  for (const row of rows) {
    const parsed = parseJwk(row.publicJwk);
    if (!parsed) continue;
    keys.push({ ...parsed, kid: row.kid, alg: row.alg });
  }
  return keys;
}

function parseJwk(raw: string): Record<string, unknown> | null {
  try {
    const j = JSON.parse(raw) as unknown;
    return j && typeof j === 'object' ? (j as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
