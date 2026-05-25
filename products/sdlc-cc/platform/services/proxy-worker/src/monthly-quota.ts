/**
 * Monthly request quota — orthogonal to per-minute throttling.
 *
 * The per-minute token bucket in rate-limiter.ts protects against bursts;
 * this enforces *plan-level monthly caps* so a free user can't quietly chew
 * through 5M requests over a month even at 10 RPM.
 *
 * Storage layout in API_KEYS KV:
 *   quota:{tenantId}:{YYYYMM} -> { count: number, lastUpdated: number }
 *
 * TTL is 35 days so the previous month's counter ages out naturally.
 */

export const MONTHLY_QUOTAS = {
  free: 5_000,
  startup: 100_000,
  enterprise: 1_000_000,
} as const;

export type QuotaTier = keyof typeof MONTHLY_QUOTAS;

export interface QuotaState {
  count: number;
  lastUpdated: number;
}

export interface QuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetAt: number;
  tier: QuotaTier;
}

export interface QuotaStorage {
  get(key: string): Promise<QuotaState | null>;
  set(key: string, state: QuotaState, ttlSeconds: number): Promise<void>;
}

/**
 * KVQuotaStorage backs onto a Workers KV namespace. The same namespace can
 * also hold rate-limit state — the key prefix (`quota:`) keeps them disjoint.
 */
export class KVQuotaStorage implements QuotaStorage {
  constructor(private kv: KVNamespace) {}

  async get(key: string): Promise<QuotaState | null> {
    const value = await this.kv.get(key, 'json');
    return value as QuotaState | null;
  }

  async set(key: string, state: QuotaState, ttlSeconds: number): Promise<void> {
    await this.kv.put(key, JSON.stringify(state), { expirationTtl: ttlSeconds });
  }
}

/**
 * monthKey builds the YYYYMM segment used in KV keys. Uses UTC so quota
 * windows reset at the same instant globally.
 */
export function monthKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear().toString().padStart(4, '0');
  const m = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  return `${y}${m}`;
}

/**
 * resetAtForMonth returns the millisecond epoch of the next UTC month
 * boundary — used as the reset time in 429 responses.
 */
export function resetAtForMonth(now: Date = new Date()): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0);
}

/**
 * checkAndConsumeQuota does an atomic-ish check + increment. KV is not
 * strongly consistent, so under heavy concurrent load the counter may
 * over-shoot the cap by a small margin — that's an acceptable trade-off
 * for the latency win versus a strongly-consistent store.
 */
export async function checkAndConsumeQuota(
  storage: QuotaStorage,
  tenantId: string,
  tier: QuotaTier,
  now: Date = new Date()
): Promise<QuotaResult> {
  const limit = MONTHLY_QUOTAS[tier];
  const key = `quota:${tenantId}:${monthKey(now)}`;
  const state = (await storage.get(key)) || { count: 0, lastUpdated: now.getTime() };
  const used = state.count;
  const resetAt = resetAtForMonth(now);

  if (used >= limit) {
    return { allowed: false, used, limit, remaining: 0, resetAt, tier };
  }

  const next: QuotaState = { count: used + 1, lastUpdated: now.getTime() };
  // 35-day TTL so the previous month's counter ages out naturally.
  await storage.set(key, next, 35 * 24 * 60 * 60);

  return {
    allowed: true,
    used: next.count,
    limit,
    remaining: limit - next.count,
    resetAt,
    tier,
  };
}

/**
 * quotaExceededResponse formats a 429 the same shape as rate-limiter so
 * downstream clients see one consistent error envelope.
 */
export function quotaExceededResponse(result: QuotaResult): Response {
  const retryAfterSec = Math.max(1, Math.floor((result.resetAt - Date.now()) / 1000));
  return new Response(
    JSON.stringify({
      error: {
        code: 'monthly_quota_exceeded',
        message: `Monthly request quota exceeded for ${result.tier} plan. Upgrade at https://sdlc.cc/pricing.`,
        details: {
          limit: result.limit,
          used: result.used,
          remaining: 0,
          resetAt: new Date(result.resetAt).toISOString(),
          retryAfter: retryAfterSec,
          upgradeUrl: 'https://sdlc.cc/pricing',
        },
      },
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-Quota-Limit': result.limit.toString(),
        'X-Quota-Used': result.used.toString(),
        'X-Quota-Remaining': '0',
        'X-Quota-Reset': Math.floor(result.resetAt / 1000).toString(),
        'Retry-After': retryAfterSec.toString(),
      },
    }
  );
}

/**
 * tierFromPlan maps an API key record's `plan` string onto the QuotaTier
 * enum, defaulting to 'free' for unknown values.
 */
export function tierFromPlan(plan?: string): QuotaTier {
  const normalized = plan?.toLowerCase();
  if (normalized === 'enterprise') return 'enterprise';
  if (normalized === 'startup' || normalized === 'team' || normalized === 'pro') {
    return 'startup';
  }
  return 'free';
}
