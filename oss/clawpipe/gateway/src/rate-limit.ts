/** Per-project daily rate limiting via KV + provider timeout helper. */

import type { Env } from './types';

const FREE_DAILY_LIMIT = 1_000;
export const PROVIDER_TIMEOUT_MS = 30_000;

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export async function checkRateLimit(env: Env, projectId: string): Promise<RateLimitResult> {
  const day = new Date().toISOString().slice(0, 10);
  const key = `rl:project:${projectId}:${day}`;
  const countStr = await env.CACHE.get(key);
  const count = countStr ? parseInt(countStr, 10) : 0;
  if (count >= FREE_DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  await env.CACHE.put(key, String(count + 1), { expirationTtl: 90_000 });
  return { allowed: true, remaining: FREE_DAILY_LIMIT - count - 1 };
}

export function withProviderTimeout<T>(promise: Promise<T>, ms = PROVIDER_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Provider timed out after ${ms}ms`)), ms),
    ),
  ]);
}
