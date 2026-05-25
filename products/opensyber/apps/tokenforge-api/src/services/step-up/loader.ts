/**
 * Per-tenant step-up policy loader (Sprint 39).
 *
 * Reads `tf_tenants.step_up_actions` JSON, parses it through the shared
 * validator, and resolves the verdict for a given request path. Null
 * column / parse failure / no match all collapse to the default verdict
 * so a tenant who hasn't configured anything just sees the unrestricted
 * baseline.
 *
 * Cached lookup is intentionally NOT here — this is a sub-second-level
 * D1 read that runs on the request path; if a future fire shows DB-RTT
 * pressure, drop it behind the existing CACHE KV with short TTL.
 */

import { eq } from 'drizzle-orm';
import { tfTenants } from '@opensyber/db';
import {
  parseStepUpActions,
  evaluateStepUpPolicy,
  type StepUpVerdict,
} from '@opensyber/tokenforge/server/internal';
import type { Variables } from '../../types.js';

type DbLike = Variables['db'];

const DEFAULT_VERDICT: StepUpVerdict = {
  matched: false,
  requireFreshSig: false,
  freshSigMaxAgeSec: 60,
  requireWebAuthn: false,
};

export async function resolveStepUpVerdict(
  db: DbLike,
  tenantId: string,
  requestPath: string,
): Promise<StepUpVerdict> {
  const [tenant] = await db
    .select({ stepUpActions: tfTenants.stepUpActions })
    .from(tfTenants)
    .where(eq(tfTenants.id, tenantId))
    .limit(1);

  if (!tenant || !tenant.stepUpActions) return DEFAULT_VERDICT;

  const parsed = parseStepUpActions(tenant.stepUpActions);
  if (!parsed) return DEFAULT_VERDICT;

  return evaluateStepUpPolicy(parsed, requestPath);
}
