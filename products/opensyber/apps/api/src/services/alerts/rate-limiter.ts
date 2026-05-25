/**
 * Alert rate limiter
 *
 * Prevents alert flooding by limiting alerts per channel per minute.
 * Uses Cloudflare KV for distributed rate limiting.
 */

import type { Kv, RateLimitResult } from './dispatcher-types.js';

/**
 * Check rate limit for a channel
 * Max 10 alerts per channel per minute
 */
export async function checkRateLimit(
  kv: Kv | undefined,
  channelId: string,
): Promise<RateLimitResult> {
  if (!kv) {
    // No KV available, allow all (dev environment)
    return { allowed: true, remaining: 999, resetAt: Date.now() + 60000 };
  }

  const key = `alert_rate_limit:${channelId}`;
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window

  try {
    const existing = await kv.get(key);
    let timestamps: number[] = [];

    if (existing) {
      // Parse JSON if it's a string
      const parsed = typeof existing === 'string' ? JSON.parse(existing) : existing;
      timestamps = Array.isArray(parsed) ? parsed : [];
    }

    // Filter out timestamps outside the current window
    const recentTimestamps = timestamps.filter((t) => t > windowStart);

    if (recentTimestamps.length >= 10) {
      // Rate limit exceeded
      const oldestTimestamp = recentTimestamps[0]!;
      return {
        allowed: false,
        remaining: 0,
        resetAt: oldestTimestamp + 60000,
      };
    }

    // Add current timestamp and save back
    recentTimestamps.push(now);
    await kv.put(key, JSON.stringify(recentTimestamps), { expirationTtl: 120 });

    return {
      allowed: true,
      remaining: 10 - recentTimestamps.length,
      resetAt: now + 60000,
    };
  } catch (error) {
    // KV error, log but allow the alert
    console.error(`Rate limit check failed for channel ${channelId}:`, error);
    return { allowed: true, remaining: 999, resetAt: now + 60000 };
  }
}
