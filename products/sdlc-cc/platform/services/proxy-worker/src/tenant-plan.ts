/**
 * Tenant plan override — orthogonal to the per-API-key `plan` field.
 *
 * When a user upgrades via Lemon Squeezy, the webhook writes
 *   plan:{userId} -> {plan: "team", updatedAt, source}
 * to the API_KEYS KV namespace. The rate-limit + quota path checks this
 * override first and falls back to the key's stored plan if absent, so
 * existing API keys start picking up the new tier on the next request
 * without a re-issue.
 *
 * Using one KV key per user (not one per API key) means a user with ten
 * API keys gets their upgrade applied atomically; no iteration required.
 */

export interface TenantPlanRecord {
  plan: string;
  updatedAt: number;
  source: 'webhook' | 'admin' | 'signup';
  reference?: string; // external subscription/event id for traceability
}

const TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days — refreshed on every write

function keyFor(userId: string): string {
  return `plan:${userId}`;
}

/**
 * getTenantPlan returns the override for a user, or null if none is set.
 */
export async function getTenantPlan(
  kv: KVNamespace,
  userId: string
): Promise<TenantPlanRecord | null> {
  const raw = await kv.get(keyFor(userId), 'json');
  return (raw as TenantPlanRecord | null) ?? null;
}

/**
 * setTenantPlan writes an override. Safe to call repeatedly; latest write
 * wins. Emits a 90-day TTL so stale records age out if a user is deleted
 * upstream without the webhook firing a cancel event.
 */
export async function setTenantPlan(
  kv: KVNamespace,
  userId: string,
  record: TenantPlanRecord
): Promise<void> {
  await kv.put(keyFor(userId), JSON.stringify(record), {
    expirationTtl: TTL_SECONDS,
  });
}

/**
 * resolvePlan returns the effective plan string for a user, preferring the
 * override and falling back to the key's stored plan.
 */
export async function resolvePlan(
  kv: KVNamespace,
  userId: string,
  keyStoredPlan: string | undefined
): Promise<string> {
  const override = await getTenantPlan(kv, userId);
  return override?.plan ?? keyStoredPlan ?? 'free';
}
