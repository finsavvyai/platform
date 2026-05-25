/**
 * IP Reputation Tracker - Abuse Prevention
 *
 * Tracks IP behavior to detect and prevent abuse patterns:
 * - Auth failures and brute force attempts
 * - Repeated rate limit violations
 * - Suspicious request patterns
 * - Automatic blocking of malicious IPs
 */

import { logger } from '../../utils/logger.js';
import type { IPReputation } from './types.js';

export class IPReputationTracker {
  private reputations: Map<string, IPReputation> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly maxAge = 24 * 60 * 60 * 1000; // 24 hours
  private readonly cleanupInterval = 60 * 60 * 1000; // 1 hour

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Record a request from an IP
   * Updates failure count based on HTTP status code
   */
  recordRequest(ip: string, status: number): void {
    const reputation = this.getOrCreateReputation(ip);

    reputation.requestCount++;
    reputation.lastRequestAt = Date.now();

    // Track failures
    if (status >= 400 && status < 600) {
      reputation.failureCount++;

      // Track auth-specific failures
      if (status === 401 || status === 403) {
        reputation.authFailureCount++;
      }
    }

    // Update reputation score
    this.updateScore(reputation);

    // Check for suspicious patterns
    this.checkSuspiciousPatterns(reputation);
  }

  /**
   * Record a rate limit exceeded event
   */
  recordRateLimitExceeded(ip: string): void {
    const reputation = this.getOrCreateReputation(ip);
    reputation.rateLimitExceededCount++;

    // Auto-block after 5+ rate limit violations
    if (reputation.rateLimitExceededCount > 5) {
      this.blockIP(ip, 15 * 60 * 1000, 'Repeated rate limit violations');
    }

    this.updateScore(reputation);
  }

  /**
   * Get current reputation for an IP
   */
  getReputation(ip: string): IPReputation {
    return this.getOrCreateReputation(ip);
  }

  /**
   * Check if IP is currently blocked
   */
  isBlocked(ip: string): boolean {
    const reputation = this.getOrCreateReputation(ip);

    if (!reputation.isBlocked) {
      return false;
    }

    // Check if block has expired
    if (reputation.blockExpiresAt && reputation.blockExpiresAt < Date.now()) {
      reputation.isBlocked = false;
      reputation.blockReason = undefined;
      reputation.blockExpiresAt = undefined;
      return false;
    }

    return reputation.isBlocked;
  }

  /**
   * Manually block an IP
   */
  blockIP(ip: string, durationMs: number, reason: string): void {
    const reputation = this.getOrCreateReputation(ip);
    reputation.isBlocked = true;
    reputation.blockReason = reason;
    reputation.blockExpiresAt = Date.now() + durationMs;

    logger.warn(`IP blocked: ${ip} (${reason}) until ${new Date(reputation.blockExpiresAt).toISOString()}`);
  }

  /**
   * Unblock an IP
   */
  unblockIP(ip: string): void {
    const reputation = this.getOrCreateReputation(ip);
    reputation.isBlocked = false;
    reputation.blockReason = undefined;
    reputation.blockExpiresAt = undefined;

    logger.info(`IP unblocked: ${ip}`);
  }

  /**
   * Get all blocked IPs
   */
  getBlockedIPs(): Array<{ ip: string; reason: string; expiresAt: number }> {
    const result: Array<{ ip: string; reason: string; expiresAt: number }> = [];
    const repValues = Array.from(this.reputations.values());
    for (const r of repValues) {
      if (this.isBlocked(r.ip)) {
        result.push({
          ip: r.ip,
          reason: r.blockReason || 'Unknown',
          expiresAt: r.blockExpiresAt || 0,
        });
      }
    }
    return result;
  }

  /**
   * Get reputation stats for monitoring
   */
  getStats(): {
    totalIPs: number;
    blockedIPs: number;
    averageScore: number;
    suspiciousCount: number;
  } {
    const repValues = Array.from(this.reputations.values());
    const reps = repValues;
    const blocked = reps.filter((r) => this.isBlocked(r.ip));
    const suspicious = reps.filter((r) => r.suspiciousPatterns.length > 0);

    return {
      totalIPs: reps.length,
      blockedIPs: blocked.length,
      averageScore: reps.length > 0 ? reps.reduce((sum, r) => sum + r.score, 0) / reps.length : 100,
      suspiciousCount: suspicious.length,
    };
  }

  /**
   * Cleanup and shutdown
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.reputations.clear();
  }

  // Private helpers

  private getOrCreateReputation(ip: string): IPReputation {
    if (!this.reputations.has(ip)) {
      this.reputations.set(ip, {
        ip,
        requestCount: 0,
        failureCount: 0,
        rateLimitExceededCount: 0,
        authFailureCount: 0,
        suspiciousPatterns: [],
        score: 100,
        isBlocked: false,
        lastRequestAt: Date.now(),
        createdAt: Date.now(),
      });
    }
    return this.reputations.get(ip)!;
  }

  private updateScore(reputation: IPReputation): void {
    // Start at 100, deduct based on behavior
    let score = 100;

    // Auth failures (brute force indicator)
    score -= Math.min(50, reputation.authFailureCount * 5);

    // Rate limit violations
    score -= Math.min(30, reputation.rateLimitExceededCount * 3);

    // General failure rate
    const failureRate = reputation.requestCount > 0 ? reputation.failureCount / reputation.requestCount : 0;
    score -= Math.min(20, failureRate * 100);

    reputation.score = Math.max(0, score);
  }

  private checkSuspiciousPatterns(reputation: IPReputation): void {
    reputation.suspiciousPatterns = [];

    // Too many auth failures
    if (reputation.authFailureCount > 10) {
      reputation.suspiciousPatterns.push('brute_force_attempt');
    }

    // Rapid requests
    if (reputation.requestCount > 1000 && reputation.lastRequestAt) {
      const ageHours = (Date.now() - reputation.createdAt) / (60 * 60 * 1000);
      if (reputation.requestCount / ageHours > 500) {
        reputation.suspiciousPatterns.push('unusually_high_volume');
      }
    }

    // High failure rate
    if (reputation.failureCount > reputation.requestCount * 0.8) {
      reputation.suspiciousPatterns.push('high_error_rate');
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      const repEntries = Array.from(this.reputations.entries());
      for (const [ip, reputation] of repEntries) {
        // Remove old entries and expired blocks
        if (now - reputation.lastRequestAt > this.maxAge) {
          this.reputations.delete(ip);
          cleaned++;
        } else if (reputation.blockExpiresAt && reputation.blockExpiresAt < now) {
          reputation.isBlocked = false;
          reputation.blockReason = undefined;
          reputation.blockExpiresAt = undefined;
        }
      }

      if (cleaned > 0) {
        logger.debug(`IP reputation cleanup: ${cleaned} old entries removed`);
      }
    }, this.cleanupInterval);

    this.cleanupTimer.unref();
  }
}

export default IPReputationTracker;
