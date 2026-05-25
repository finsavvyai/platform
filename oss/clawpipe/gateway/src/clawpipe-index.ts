/** GET /v1/index — public, anonymized aggregate stats across ALL projects.
 *
 * No auth, no per-project data, 1-hour KV cache.
 */

import type { Env } from './types';

export interface ClawpipeIndex {
  period: string;
  totalPrompts: number;
  totalSavedUsd: number;
  totalLLMCallsSkipped: number;
  avgCacheHitRate: number;
  providerMix: Array<{ provider: string; share: number }>;
  lastUpdated: string;
}

const KV_KEY = 'clawpipe:index:v1';
const TTL_SEC = 3600;

interface AggRow {
  total_prompts: number;
  cached_count: number;
  boosted_count: number;
  baseline_avg: number;
  total_cost: number;
}
interface ProviderRow { provider: string; calls: number }

/** ISO week label, e.g. "2026-04-week-17". Used as the rolling period tag. */
export function periodTag(now: Date = new Date()): string {
  const yyyymm = now.toISOString().slice(0, 7);
  // ISO week number: Thursday-anchored.
  const tmp = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7;
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(
    ((tmp.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
  );
  return `${yyyymm}-week-${week}`;
}

async function computeIndex(env: Env): Promise<ClawpipeIndex> {
  const agg = await env.DB.prepare(`
    SELECT
      COUNT(*) AS total_prompts,
      COALESCE(SUM(cached), 0) AS cached_count,
      COALESCE(SUM(boosted), 0) AS boosted_count,
      COALESCE(AVG(CASE WHEN cached = 0 AND boosted = 0 THEN cost END), 0)
        AS baseline_avg,
      COALESCE(SUM(cost), 0) AS total_cost
    FROM requests
  `).first<AggRow>();

  const totalPrompts = agg?.total_prompts ?? 0;
  const cached = agg?.cached_count ?? 0;
  const boosted = agg?.boosted_count ?? 0;
  const baseline = (agg?.baseline_avg ?? 0) * totalPrompts;
  const totalSavedUsd = Math.max(0, baseline - (agg?.total_cost ?? 0));
  const skipped = cached + boosted;
  const cacheHit = totalPrompts > 0 ? cached / totalPrompts : 0;

  const providers = await env.DB.prepare(`
    SELECT provider, COUNT(*) AS calls FROM requests
    GROUP BY provider ORDER BY calls DESC LIMIT 10
  `).all<ProviderRow>();
  const totalProviderCalls = (providers.results ?? [])
    .reduce((s, r) => s + (r.calls ?? 0), 0);
  const providerMix = (providers.results ?? []).map((r) => ({
    provider: r.provider,
    share: totalProviderCalls > 0 ? Math.round((r.calls / totalProviderCalls) * 1000) / 1000 : 0,
  }));

  return {
    period: periodTag(),
    totalPrompts,
    totalSavedUsd: Math.round(totalSavedUsd * 100) / 100,
    totalLLMCallsSkipped: skipped,
    avgCacheHitRate: Math.round(cacheHit * 1000) / 1000,
    providerMix,
    lastUpdated: new Date().toISOString(),
  };
}

/** Public route handler. Reads from KV; falls back to D1 + writes cache. */
export async function handleClawpipeIndex(env: Env): Promise<Response> {
  try {
    const cached = await env.CACHE.get(KV_KEY);
    if (cached) {
      return new Response(cached, {
        status: 200,
        headers: { 'content-type': 'application/json', 'x-clawpipe-index-cache': 'HIT' },
      });
    }
    const fresh = await computeIndex(env);
    const body = JSON.stringify(fresh);
    await env.CACHE.put(KV_KEY, body, { expirationTtl: TTL_SEC });
    return new Response(body, {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-clawpipe-index-cache': 'MISS' },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return Response.json({ error: 'index_unavailable', detail }, { status: 500 });
  }
}
