/**
 * Rate Limiting Types and Interfaces
 *
 * Defines configuration, results, and tracking structures for
 * sliding-window rate limiting with IP reputation tracking.
 */

/**
 * Rate limit tier with request limits per minute
 */
export type RateLimitTier = 'free' | 'starter' | 'pro' | 'enterprise';

/**
 * Configuration for a rate limit tier
 */
export interface RateLimitTierConfig {
  tier: RateLimitTier;
  requestsPerMinute: number;
  requestsPerHour: number;
  burstLimit: number; // temporary spike allowance
}

/**
 * Complete rate limit configuration
 */
export interface RateLimitConfig {
  tiers: Record<RateLimitTier, RateLimitTierConfig>;
  windowSizeMs: number; // sliding window duration
  cleanupIntervalMs: number; // cleanup old entries
  blockDurationMs: number; // IP block duration
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number; // Unix timestamp when quota resets
  retryAfter?: number; // seconds to wait if blocked
  reason?: string; // explanation if blocked
}

/**
 * Entry in sliding window counter
 */
export interface SlidingWindowEntry {
  timestamp: number;
  count: number;
}

/**
 * IP reputation tracking
 */
export interface IPReputation {
  ip: string;
  requestCount: number;
  failureCount: number;
  rateLimitExceededCount: number;
  authFailureCount: number;
  suspiciousPatterns: string[];
  score: number; // 0-100, lower is worse
  isBlocked: boolean;
  blockReason?: string;
  blockExpiresAt?: number;
  lastRequestAt: number;
  createdAt: number;
}

/**
 * Usage statistics across all tiers
 */
export interface UsageStats {
  tier: RateLimitTier;
  currentRequests: number;
  limit: number;
  percentageUsed: number;
  resetAt: number;
  topEndpoints: Array<{ endpoint: string; requests: number }>;
}

/**
 * Pool health metrics
 */
export interface PoolHealth {
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalSize: number;
  utilizationPercent: number;
  avgWaitTimeMs: number;
  timeoutRate: number; // percentage of timed-out requests
  isHealthy: boolean;
  alerts: string[];
}
