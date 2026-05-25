/** GET /v1/status — public, no auth, aggregated from `requests` table.
 *
 * Returns p50/p95 latency, error rate, 30-day uptime proxy, and 24h volume.
 * 30-second KV cache (key `status:public:v1`) to avoid D1 load tax.
 * Never exposes project_id, user data, or per-tenant rows.
 */

import type { Env } from './types';

export interface PublicStatus {
  p50_ms: number;
  p95_ms: number;
  error_rate: number;
  uptime_30d: number;
  requests_24h: number;
  generated_at: string;
}

const KV_KEY = 'status:public:v1';
const CACHE_TTL = 30; // seconds

interface LatencyRow { latency_ms: number }
interface CountRow { n: number }
interface ErrorRow { errors: number; total: number }

async function computeStatus(env: Env): Promise<PublicStatus> {
  const now = new Date();
  const since24h = new Date(now.getTime() - 86_400_000).toISOString();
  const since30d = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  // p50 / p95 from last 24h (sample up to 10 000 rows to bound cost)
  const latencies = await env.DB.prepare(
    `SELECT latency_ms FROM requests
     WHERE created_at >= ? AND latency_ms IS NOT NULL
     ORDER BY latency_ms
     LIMIT 10000`,
  ).bind(since24h).all<LatencyRow>();

  const rows = (latencies.results ?? []).map((r) => r.latency_ms).filter((v) => v > 0);
  const p50 = percentile(rows, 50);
  const p95 = percentile(rows, 95);

  // Error rate: rows where provider returned an error (cost = 0, not cached, not boosted)
  const errRow = await env.DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN cost = 0 AND cached = 0 AND boosted = 0 THEN 1 ELSE 0 END), 0) AS errors,
       COUNT(*) AS total
     FROM requests WHERE created_at >= ?`,
  ).bind(since24h).first<ErrorRow>();

  const total24h = errRow?.total ?? 0;
  const errors24h = errRow?.errors ?? 0;
  const error_rate = total24h > 0 ? Math.round((errors24h / total24h) * 10000) / 10000 : 0;

  // 30-day uptime proxy: fraction of 30-day hours with at least one successful request.
  // "Successful" = cached OR boosted OR cost > 0.
  // Approximated as: (1 - error_rate_30d) clamped to [0, 1].
  const errRow30 = await env.DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN cost = 0 AND cached = 0 AND boosted = 0 THEN 1 ELSE 0 END), 0) AS errors,
       COUNT(*) AS total
     FROM requests WHERE created_at >= ?`,
  ).bind(since30d).first<ErrorRow>();

  const total30d = errRow30?.total ?? 0;
  const errors30d = errRow30?.errors ?? 0;
  const raw30d = total30d > 0 ? 1 - errors30d / total30d : 1;
  const uptime_30d = Math.round(Math.max(0, Math.min(1, raw30d)) * 10000) / 10000;

  // Volume over last 24h
  const volRow = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM requests WHERE created_at >= ?`,
  ).bind(since24h).first<CountRow>();
  const requests_24h = volRow?.n ?? 0;

  return { p50_ms: p50, p95_ms: p95, error_rate, uptime_30d, requests_24h,
    generated_at: now.toISOString() };
}

/** Compute percentile from a pre-sorted numeric array. Returns 0 on empty. */
export function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/** Public handler — 30s KV cache, CORS allow-all. */
export async function handlePublicStatus(env: Env): Promise<Response> {
  try {
    const hit = await env.CACHE.get(KV_KEY);
    if (hit) {
      return new Response(hit, {
        status: 200,
        headers: { 'content-type': 'application/json', 'x-status-cache': 'HIT', ...CORS_HEADERS },
      });
    }
    const fresh = await computeStatus(env);
    const body = JSON.stringify(fresh);
    await env.CACHE.put(KV_KEY, body, { expirationTtl: CACHE_TTL });
    return new Response(body, {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-status-cache': 'MISS', ...CORS_HEADERS },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: 'status_unavailable', detail }), {
      status: 500,
      headers: { 'content-type': 'application/json', ...CORS_HEADERS },
    });
  }
}
