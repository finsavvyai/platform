/**
 * Rate Limiter API Routes
 *
 * Endpoints for monitoring and managing rate limits:
 * - View current usage and limits
 * - Admin IP blocking/unblocking
 * - Rate limit statistics
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger.js';
import RateLimiter from './RateLimiter.js';
import IPReputationTracker from './IPReputationTracker.js';

export function createRateLimiterRoutes(): Router {
  const router = Router();
  const limiter = new RateLimiter();
  const tracker = new IPReputationTracker();

  /**
   * GET /api/rate-limit/status
   * Get current rate limit status for authenticated user
   */
  router.get('/status', (req: Request, res: Response): void => {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const tier = user.tier || 'free';
      const key = `user:${user.id}`;
      const tierConfig = limiter.getTierConfig(tier);
      const result = limiter.checkLimit(key, tier);
      const remaining = limiter.getRemainingRequests(key, tier);

      res.json({
        tier,
        current: {
          requests: tierConfig.requestsPerMinute - remaining,
          limit: tierConfig.requestsPerMinute,
          remaining,
          percentageUsed: Math.round(((tierConfig.requestsPerMinute - remaining) / tierConfig.requestsPerMinute) * 100),
        },
        hourly: {
          limit: tierConfig.requestsPerHour,
        },
        burst: {
          limit: tierConfig.burstLimit,
        },
        resetAt: new Date(result.resetAt).toISOString(),
      });
    } catch (error) {
      logger.error('Error getting rate limit status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/rate-limit/usage
   * Get usage statistics across all tiers and keys
   */
  router.get('/usage', (req: Request, res: Response): void => {
    try {
      // Admin check
      const user = (req as any).user;
      if (!user || user.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const keys = limiter.getActiveKeys();
      const stats = {
        totalActiveKeys: keys.length,
        byTier: {
          free: { count: 0, requests: 0 },
          starter: { count: 0, requests: 0 },
          pro: { count: 0, requests: 0 },
          enterprise: { count: 0, requests: 0 },
        },
      };

      // Aggregate stats (simplified - full implementation would track per-key tier)
      res.json(stats);
    } catch (error) {
      logger.error('Error getting rate limit usage:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/rate-limit/blocked-ips
   * List all currently blocked IPs
   */
  router.get('/blocked-ips', (req: Request, res: Response): void => {
    try {
      const user = (req as any).user;
      if (!user || user.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const blockedIPs = tracker.getBlockedIPs();
      res.json({
        count: blockedIPs.length,
        ips: blockedIPs.map((b) => ({
          ...b,
          expiresAt: new Date(b.expiresAt).toISOString(),
        })),
      });
    } catch (error) {
      logger.error('Error getting blocked IPs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/rate-limit/block/:ip
   * Block an IP address (admin only)
   */
  router.post('/block/:ip', (req: Request, res: Response): void => {
    try {
      const user = (req as any).user;
      if (!user || user.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const { ip } = req.params;
      const { durationMinutes = 60, reason = 'Admin blocked' } = req.body as {
        durationMinutes?: number;
        reason?: string;
      };

      tracker.blockIP(ip, durationMinutes * 60 * 1000, reason);

      res.json({
        success: true,
        message: `IP ${ip} blocked for ${durationMinutes} minutes`,
        ip,
        reason,
        expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000).toISOString(),
      });
    } catch (error) {
      logger.error('Error blocking IP:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * DELETE /api/rate-limit/block/:ip
   * Unblock an IP address (admin only)
   */
  router.delete('/block/:ip', (req: Request, res: Response): void => {
    try {
      const user = (req as any).user;
      if (!user || user.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const { ip } = req.params;
      tracker.unblockIP(ip);

      res.json({
        success: true,
        message: `IP ${ip} unblocked`,
      });
    } catch (error) {
      logger.error('Error unblocking IP:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/rate-limit/reputation/:ip
   * Get reputation details for an IP (admin only)
   */
  router.get('/reputation/:ip', (req: Request, res: Response): void => {
    try {
      const user = (req as any).user;
      if (!user || user.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const { ip } = req.params;
      const reputation = tracker.getReputation(ip);

      res.json({
        ip,
        stats: {
          requestCount: reputation.requestCount,
          failureCount: reputation.failureCount,
          authFailureCount: reputation.authFailureCount,
          rateLimitExceededCount: reputation.rateLimitExceededCount,
        },
        reputation: {
          score: reputation.score,
          isBlocked: reputation.isBlocked,
          blockReason: reputation.blockReason,
          blockExpiresAt: reputation.blockExpiresAt
            ? new Date(reputation.blockExpiresAt).toISOString()
            : null,
        },
        suspiciousPatterns: reputation.suspiciousPatterns,
        activity: {
          createdAt: new Date(reputation.createdAt).toISOString(),
          lastRequestAt: new Date(reputation.lastRequestAt).toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error getting IP reputation:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/rate-limit/stats
   * Get aggregate reputation and blocking statistics (admin only)
   */
  router.get('/stats', (req: Request, res: Response): void => {
    try {
      const user = (req as any).user;
      if (!user || user.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const stats = tracker.getStats();
      res.json(stats);
    } catch (error) {
      logger.error('Error getting rate limit stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

export default createRateLimiterRoutes;
