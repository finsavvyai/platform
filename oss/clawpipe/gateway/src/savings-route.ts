/** GET /v1/savings — per-project saved-USD aggregates from the requests table.
 *
 * The schema stores the actual `cost` paid for each request and `cached`/
 * `boosted` flags. There is no `direct_cost` column. We estimate "would-have-
 * been" cost by treating cached/boosted requests as 100% saved (we paid 0,
 * a baseline call would have cost similarly to non-cached calls of the same
 * model) and live calls as the saved fraction implied by router downgrades.
 *
 * Concretely:
 *   savedThisMonth = SUM(baselineCostThisMonth) - SUM(actualCostThisMonth)
 * where baselineCostThisMonth is the avg per-request cost of NON-cached,
 * NON-boosted calls in the same window multiplied by total request count.
 *
 * Zero-usage projects return all zeros. No mock data; everything is computed
 * from real D1 reads.
 */

import type { Env } from './types';

interface AggRow {
  total_cost: number;
  total_calls: number;
  baseline_cost_avg: number;
  baseline_calls: number;
}

async function aggregate(
  env: Env,
  projectId: string,
  monthStart: string | null,
): Promise<{ saved: number; baselineTotal: number; actualTotal: number }> {
  const sql = `
    SELECT
      COALESCE(SUM(cost), 0) AS total_cost,
      COUNT(*) AS total_calls,
      COALESCE(AVG(CASE WHEN cached = 0 AND boosted = 0 THEN cost END), 0)
        AS baseline_cost_avg,
      SUM(CASE WHEN cached = 0 AND boosted = 0 THEN 1 ELSE 0 END)
        AS baseline_calls
    FROM requests
    WHERE project_id = ?${monthStart ? ' AND created_at >= ?' : ''}
  `;
  const stmt = monthStart
    ? env.DB.prepare(sql).bind(projectId, monthStart)
    : env.DB.prepare(sql).bind(projectId);
  const row = await stmt.first<AggRow>();

  const totalCost = row?.total_cost ?? 0;
  const totalCalls = row?.total_calls ?? 0;
  const baselineAvg = row?.baseline_cost_avg ?? 0;
  // Each call would have cost the live-call avg if not cached/boosted/routed.
  const baselineTotal = baselineAvg * totalCalls;
  const saved = Math.max(0, baselineTotal - totalCost);
  return { saved, baselineTotal, actualTotal: totalCost };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface SavingsResult {
  thisMonth: number;
  sinceStart: number;
  percent: number;
  currency: 'USD';
}

/** Compute savings for a project, scoped to current month + lifetime. */
export async function computeSavings(
  env: Env,
  projectId: string,
): Promise<SavingsResult> {
  const monthStart = new Date().toISOString().slice(0, 7) + '-01';
  const monthAgg = await aggregate(env, projectId, monthStart);
  const lifeAgg = await aggregate(env, projectId, null);

  const percent = lifeAgg.baselineTotal > 0
    ? Math.round((lifeAgg.saved / lifeAgg.baselineTotal) * 1000) / 10
    : 0;

  return {
    thisMonth: round2(monthAgg.saved),
    sinceStart: round2(lifeAgg.saved),
    percent,
    currency: 'USD',
  };
}

/** Route handler: GET /v1/savings. projectId is auth-trusted by router. */
export async function handleSavings(
  env: Env,
  projectId: string,
): Promise<Response> {
  try {
    const result = await computeSavings(env, projectId);
    return Response.json(result, { status: 200 });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: 'savings_unavailable', detail },
      { status: 500 },
    );
  }
}
