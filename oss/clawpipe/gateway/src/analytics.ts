/** Analytics endpoints — aggregate request data from D1 for dashboards. */

import type { Env } from './types';
import { getDailyUsage, getProjectTier } from './billing/usage';

interface OverviewRow {
  total_requests: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost: number;
  cached_count: number;
  boosted_count: number;
  avg_latency: number;
}

interface ProviderRow {
  provider: string;
  model: string;
  request_count: number;
  total_cost: number;
  avg_latency: number;
  total_tokens_out: number;
}

interface CacheRow {
  day: string;
  total: number;
  cached: number;
  boosted: number;
}
interface RouteRow {
  provider: string;
  model: string;
  day: string;
  request_count: number;
  avg_latency: number;
}

/** GET /v1/analytics/overview — summary stats for a project. */
export async function handleOverview(env: Env, projectId: string): Promise<Response> {
  const row = await env.DB.prepare(`
    SELECT
      COUNT(*) as total_requests,
      COALESCE(SUM(tokens_in), 0) as total_tokens_in,
      COALESCE(SUM(tokens_out), 0) as total_tokens_out,
      COALESCE(SUM(cost), 0) as total_cost,
      COALESCE(SUM(cached), 0) as cached_count,
      COALESCE(SUM(boosted), 0) as boosted_count,
      COALESCE(AVG(latency_ms), 0) as avg_latency
    FROM requests WHERE project_id = ?
  `).bind(projectId).first<OverviewRow>();

  const [tier, usage] = await Promise.all([
    getProjectTier(env, projectId),
    getDailyUsage(env, projectId),
  ]);

  return Response.json({
    totalRequests: row?.total_requests ?? 0,
    totalTokensIn: row?.total_tokens_in ?? 0,
    totalTokensOut: row?.total_tokens_out ?? 0,
    totalCost: Math.round((row?.total_cost ?? 0) * 10000) / 10000,
    cachedCount: row?.cached_count ?? 0,
    boostedCount: row?.boosted_count ?? 0,
    avgLatencyMs: Math.round(row?.avg_latency ?? 0),
    cacheHitRate: row?.total_requests
      ? `${(((row.cached_count ?? 0) / row.total_requests) * 100).toFixed(1)}%`
      : '0.0%',
    boostRate: row?.total_requests
      ? `${(((row.boosted_count ?? 0) / row.total_requests) * 100).toFixed(1)}%`
      : '0.0%',
    tier,
    dailyUsed: usage.totalCalls,
    dailyLimit: usage.limitCalls,
    dailyRemaining: usage.remaining,
  });
}

/** GET /v1/analytics/providers — per-provider/model breakdown. */
export async function handleProviders(env: Env, projectId: string): Promise<Response> {
  const rows = await env.DB.prepare(`
    SELECT provider, model,
      COUNT(*) as request_count,
      COALESCE(SUM(cost), 0) as total_cost,
      COALESCE(AVG(latency_ms), 0) as avg_latency,
      COALESCE(SUM(tokens_out), 0) as total_tokens_out
    FROM requests
    WHERE project_id = ?
    GROUP BY provider, model
    ORDER BY request_count DESC
  `).bind(projectId).all<ProviderRow>();

  return Response.json({
    providers: (rows.results ?? []).map((r) => ({
      provider: r.provider,
      model: r.model,
      requestCount: r.request_count,
      totalCost: Math.round(r.total_cost * 10000) / 10000,
      avgLatencyMs: Math.round(r.avg_latency),
      totalTokensOut: r.total_tokens_out,
    })),
  });
}

/** GET /v1/analytics/cache — daily cache hit trends. */
export async function handleCacheAnalytics(env: Env, projectId: string): Promise<Response> {
  const rows = await env.DB.prepare(`
    SELECT DATE(created_at) as day,
      COUNT(*) as total,
      COALESCE(SUM(cached), 0) as cached,
      COALESCE(SUM(boosted), 0) as boosted
    FROM requests
    WHERE project_id = ?
    GROUP BY DATE(created_at)
    ORDER BY day DESC
    LIMIT 30
  `).bind(projectId).all<CacheRow>();

  return Response.json({
    daily: (rows.results ?? []).map((r) => ({
      day: r.day,
      total: r.total,
      cached: r.cached,
      boosted: r.boosted,
      hitRate: r.total > 0 ? `${(((r.cached + r.boosted) / r.total) * 100).toFixed(1)}%` : '0.0%',
    })),
  });
}

/** GET /v1/analytics/cost-trend — daily $ cost + savings vs baseline. */
export async function handleCostTrend(env: Env, projectId: string): Promise<Response> {
  const rows = await env.DB.prepare(`
    SELECT DATE(created_at) as day,
      COUNT(*) as total,
      COALESCE(SUM(cost), 0) as cost,
      COALESCE(SUM(cached), 0) as cached,
      COALESCE(SUM(boosted), 0) as boosted,
      COALESCE(SUM(tokens_in + tokens_out), 0) as tokens
    FROM requests WHERE project_id = ?
    GROUP BY DATE(created_at) ORDER BY day DESC LIMIT 30
  `).bind(projectId).all<{ day: string; total: number; cost: number; cached: number; boosted: number; tokens: number }>();
  return Response.json({
    days: (rows.results ?? []).map((r) => {
      const baseline = r.cost + (r.cached + r.boosted) * 0.002; // est saved
      return {
        day: r.day, total: r.total, cost: Math.round(r.cost * 10000) / 10000,
        baseline: Math.round(baseline * 10000) / 10000,
        saved: Math.round((baseline - r.cost) * 10000) / 10000,
        cached: r.cached, boosted: r.boosted,
      };
    }),
  });
}

/** GET /v1/analytics/savings-by-task — group by booster/cache/model. */
export async function handleSavingsByTask(env: Env, projectId: string): Promise<Response> {
  const rows = await env.DB.prepare(`
    SELECT
      CASE WHEN boosted=1 THEN 'boosted'
           WHEN cached=1 THEN 'cached'
           ELSE provider END as bucket,
      COUNT(*) as count,
      COALESCE(SUM(cost), 0) as cost,
      COALESCE(AVG(latency_ms), 0) as avg_latency
    FROM requests WHERE project_id = ?
    GROUP BY bucket ORDER BY count DESC LIMIT 20
  `).bind(projectId).all<{ bucket: string; count: number; cost: number; avg_latency: number }>();
  return Response.json({
    buckets: (rows.results ?? []).map((r) => ({
      bucket: r.bucket, count: r.count,
      cost: Math.round(r.cost * 10000) / 10000,
      avgLatencyMs: Math.round(r.avg_latency),
    })),
  });
}

/** GET /v1/analytics/routes — routing decisions over time. */
export async function handleRouteAnalytics(env: Env, projectId: string): Promise<Response> {
  const rows = await env.DB.prepare(`
    SELECT provider, model, DATE(created_at) as day,
      COUNT(*) as request_count,
      COALESCE(AVG(latency_ms), 0) as avg_latency
    FROM requests
    WHERE project_id = ?
    GROUP BY provider, model, DATE(created_at)
    ORDER BY day DESC, request_count DESC
    LIMIT 100
  `).bind(projectId).all<RouteRow>();

  return Response.json({
    routes: (rows.results ?? []).map((r) => ({
      provider: r.provider,
      model: r.model,
      day: r.day,
      requestCount: r.request_count,
      avgLatencyMs: Math.round(r.avg_latency),
    })),
  });
}
