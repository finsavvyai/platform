/**
 * SQL helpers for /v1/finops/by-user.
 * Separated to keep finops-by-user.ts under the 200-line cap.
 */

import type { Env } from './types';

interface RawUserRow {
  user_id: string | null;
  email: string | null;
  name: string | null;
  total_cost: number;
  total_requests: number;
}

interface RawModelRow {
  user_id: string | null;
  model: string;
  cost: number;
}

/**
 * Aggregate cost + request count per user for the project.
 * NULL user_id = requests from ad-hoc project keys (Unattributed).
 */
export async function buildUserRows(
  env: Env, projectId: string, from: string, to: string,
): Promise<RawUserRow[]> {
  const result = await env.DB.prepare(`
    SELECT
      r.user_id,
      u.email,
      u.name,
      COALESCE(SUM(r.cost), 0)    AS total_cost,
      COUNT(*)                     AS total_requests
    FROM requests r
    LEFT JOIN users u ON u.id = r.user_id
    WHERE r.project_id = ?
      AND r.created_at >= ?
      AND r.created_at <= (? || ' 23:59:59')
    GROUP BY r.user_id
    ORDER BY total_cost DESC
    LIMIT 200
  `).bind(projectId, from, to).all<RawUserRow>();
  return result.results ?? [];
}

/**
 * Top models by cost per user — up to 3 models per user_id bucket.
 */
export async function buildTopModels(
  env: Env, projectId: string, from: string, to: string,
): Promise<RawModelRow[]> {
  const result = await env.DB.prepare(`
    SELECT
      r.user_id,
      r.model,
      COALESCE(SUM(r.cost), 0) AS cost
    FROM requests r
    WHERE r.project_id = ?
      AND r.created_at >= ?
      AND r.created_at <= (? || ' 23:59:59')
    GROUP BY r.user_id, r.model
    ORDER BY r.user_id, cost DESC
  `).bind(projectId, from, to).all<RawModelRow>();
  return result.results ?? [];
}
