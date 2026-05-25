/**
 * Usage tracking and tier limit enforcement for ClawPipe.
 *
 * Tracks tokens per project per day, enforces tier call limits,
 * and provides a stub for reporting metered usage to Stripe.
 */

import type { Env } from '../types';
import type {
  Tier,
  DailyUsageSummary,
  TIER_LIMITS as TierLimitsType,
} from './types';
import { TIER_LIMITS } from './types';

/** Get today's date as YYYY-MM-DD. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Fetch the project's current tier from D1. */
export async function getProjectTier(
  env: Env,
  projectId: string,
): Promise<Tier> {
  const row = await env.DB.prepare(
    'SELECT tier FROM projects WHERE id = ?',
  )
    .bind(projectId)
    .first<{ tier: string }>();

  return (row?.tier as Tier) ?? 'free';
}

/** Get today's usage for a project. */
export async function getDailyUsage(
  env: Env,
  projectId: string,
): Promise<DailyUsageSummary> {
  const date = today();
  const row = await env.DB.prepare(
    `SELECT
       COALESCE(SUM(tokens_in), 0)  AS tokens_in,
       COALESCE(SUM(tokens_out), 0) AS tokens_out,
       COUNT(*)                      AS total_calls
     FROM requests
     WHERE project_id = ? AND DATE(created_at) = ?`,
  )
    .bind(projectId, date)
    .first<{ tokens_in: number; tokens_out: number; total_calls: number }>();

  const tier = await getProjectTier(env, projectId);
  const limits = TIER_LIMITS[tier];
  const totalCalls = row?.total_calls ?? 0;
  const limitCalls = limits.callsPerDay;

  return {
    tokensIn: row?.tokens_in ?? 0,
    tokensOut: row?.tokens_out ?? 0,
    totalCalls,
    limitCalls,
    remaining: limitCalls === -1 ? -1 : Math.max(0, limitCalls - totalCalls),
  };
}

/** Check whether a project has remaining calls for today. */
export async function isWithinLimits(
  env: Env,
  projectId: string,
): Promise<boolean> {
  const usage = await getDailyUsage(env, projectId);
  if (usage.limitCalls === -1) return true;
  return usage.remaining > 0;
}

/** Record a completed call's token usage. */
export async function trackUsage(
  env: Env,
  projectId: string,
  tokensIn: number,
  tokensOut: number,
): Promise<void> {
  // Usage is already tracked via the requests table in index.ts logRequest.
  // This function provides an additional KV-based fast counter for
  // rate-limit checks without hitting D1 on every request.
  const date = today();
  const key = `usage:${projectId}:${date}`;

  const current = await env.CACHE.get(key);
  const count = current ? parseInt(current, 10) + 1 : 1;

  // TTL of 48 hours — auto-cleanup after the day ends
  await env.CACHE.put(key, String(count), { expirationTtl: 172_800 });
}

/** Fast rate-limit check using KV counter. */
export async function checkRateLimit(
  env: Env,
  projectId: string,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const tier = await getProjectTier(env, projectId);
  const limits = TIER_LIMITS[tier];
  if (limits.callsPerDay === -1) {
    return { allowed: true, used: 0, limit: -1 };
  }

  const date = today();
  const key = `usage:${projectId}:${date}`;
  const current = await env.CACHE.get(key);
  const used = current ? parseInt(current, 10) : 0;

  return {
    allowed: used < limits.callsPerDay,
    used,
    limit: limits.callsPerDay,
  };
}
