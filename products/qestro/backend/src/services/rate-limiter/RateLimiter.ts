/**
 * Rate Limiter - Sliding Window Implementation
 *
 * Implements precise per-minute and per-hour rate limiting using
 * sliding window counter algorithm. Tracks per-IP and per-API-key limits.
 */

import { logger } from '../../utils/logger.js';
import type {
  RateLimitConfig,
  RateLimitResult,
  RateLimitTier,
  RateLimitTierConfig,
  SlidingWindowEntry,
} from './types.js';

export class RateLimiter {
  private config: RateLimitConfig;
  private minuteWindows: Map<string, SlidingWindowEntry[]> = new Map();
  private hourWindows: Map<string, SlidingWindowEntry[]> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize rate limiter with configuration
   */
  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      tiers: {
        free: { tier: 'free', requestsPerMinute: 100, requestsPerHour: 1000, burstLimit: 150 },
        starter: { tier: 'starter', requestsPerMinute: 500, requestsPerHour: 5000, burstLimit: 750 },
        pro: { tier: 'pro', requestsPerMinute: 2000, requestsPerHour: 20000, burstLimit: 3000 },
        enterprise: {
          tier: 'enterprise',
          requestsPerMinute: 10000,
          requestsPerHour: 100000,
          burstLimit: 15000,
        },
      },
      windowSizeMs: 60 * 1000, // 1 minute sliding window
      cleanupIntervalMs: 5 * 60 * 1000, // cleanup every 5 minutes
      blockDurationMs: 15 * 60 * 1000, // 15 minute IP blocks
      ...config,
    };

    this.startCleanupTimer();
  }

  /**
   * Check if request is allowed under rate limit
   * Returns detailed result with remaining quota and reset time
   */
  checkLimit(key: string, tier: RateLimitTier): RateLimitResult {
    const tierConfig = this.config.tiers[tier];
    const now = Date.now();

    // Clean old entries before check
    this.cleanOldEntries(this.minuteWindows, key, now);
    this.cleanOldEntries(this.hourWindows, key, now);

    const minuteCount = this.getWindowCount(this.minuteWindows, key);
    const hourCount = this.getWindowCount(this.hourWindows, key);

    // Check minute limit
    if (minuteCount >= tierConfig.requestsPerMinute) {
      const resetAt = now + this.config.windowSizeMs;
      return {
        allowed: false,
        remaining: 0,
        limit: tierConfig.requestsPerMinute,
        resetAt,
        retryAfter: Math.ceil(this.config.windowSizeMs / 1000),
        reason: `Minute rate limit exceeded (${minuteCount}/${tierConfig.requestsPerMinute})`,
      };
    }

    // Check hour limit
    if (hourCount >= tierConfig.requestsPerHour) {
      const resetAt = now + 60 * 60 * 1000;
      return {
        allowed: false,
        remaining: 0,
        limit: tierConfig.requestsPerHour,
        resetAt,
        retryAfter: 3600,
        reason: `Hour rate limit exceeded (${hourCount}/${tierConfig.requestsPerHour})`,
      };
    }

    return {
      allowed: true,
      remaining: Math.min(
        tierConfig.requestsPerMinute - minuteCount,
        tierConfig.requestsPerHour - hourCount
      ),
      limit: tierConfig.requestsPerMinute,
      resetAt: now + this.config.windowSizeMs,
    };
  }

  /**
   * Record a successful request
   */
  recordRequest(key: string): void {
    const now = Date.now();
    this.addToWindow(this.minuteWindows, key, now);
    this.addToWindow(this.hourWindows, key, now);
  }

  /**
   * Get remaining requests for key under tier
   */
  getRemainingRequests(key: string, tier: RateLimitTier): number {
    const tierConfig = this.config.tiers[tier];
    const now = Date.now();

    this.cleanOldEntries(this.minuteWindows, key, now);
    const minuteCount = this.getWindowCount(this.minuteWindows, key);

    return Math.max(0, tierConfig.requestsPerMinute - minuteCount);
  }

  /**
   * Reset rate limit for a key (admin action)
   */
  resetLimit(key: string): void {
    this.minuteWindows.delete(key);
    this.hourWindows.delete(key);
    logger.info(`Rate limit reset for key: ${key}`);
  }

  /**
   * Get tier configuration
   */
  getTierConfig(tier: RateLimitTier): RateLimitTierConfig {
    return this.config.tiers[tier];
  }

  /**
   * Get all active keys for monitoring
   */
  getActiveKeys(): string[] {
    const keys = new Set<string>();
    const minuteKeys = Array.from(this.minuteWindows.keys());
    const hourKeys = Array.from(this.hourWindows.keys());
    for (const k of minuteKeys) {
      keys.add(k);
    }
    for (const k of hourKeys) {
      keys.add(k);
    }
    return Array.from(keys);
  }

  /**
   * Cleanup and shutdown
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.minuteWindows.clear();
    this.hourWindows.clear();
  }

  // Private helpers

  private addToWindow(windows: Map<string, SlidingWindowEntry[]>, key: string, now: number): void {
    if (!windows.has(key)) {
      windows.set(key, []);
    }
    const entries = windows.get(key)!;
    entries.push({ timestamp: now, count: 1 });
  }

  private getWindowCount(windows: Map<string, SlidingWindowEntry[]>, key: string): number {
    const entries = windows.get(key) || [];
    return entries.reduce((sum, entry) => sum + entry.count, 0);
  }

  private cleanOldEntries(
    windows: Map<string, SlidingWindowEntry[]>,
    key: string,
    now: number
  ): void {
    const entries = windows.get(key);
    if (!entries) return;

    const cutoff = now - this.config.windowSizeMs;
    const filtered = entries.filter((e) => e.timestamp > cutoff);

    if (filtered.length === 0) {
      windows.delete(key);
    } else if (filtered.length !== entries.length) {
      windows.set(key, filtered);
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      const keys = this.getActiveKeys();

      for (const key of keys) {
        this.cleanOldEntries(this.minuteWindows, key, now);
        this.cleanOldEntries(this.hourWindows, key, now);
      }

      logger.debug(`Rate limiter cleanup: ${keys.length} keys scanned`);
    }, this.config.cleanupIntervalMs);

    this.cleanupTimer.unref(); // Don't block process exit
  }
}

export default RateLimiter;
