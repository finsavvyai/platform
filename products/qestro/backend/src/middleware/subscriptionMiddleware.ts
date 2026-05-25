import { Request, Response, NextFunction } from 'express';
import { subscriptionService } from '../services/SubscriptionService.js';
import { logger } from '../utils/logger.js';

export const requireSubscription = (requiredPlan?: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const subscription = await subscriptionService.getActiveSubscription(req.user.userId);

      if (!subscription && requiredPlan !== 'free') {
        res.status(403).json({
          error: 'Active subscription required',
          requiredPlan,
          upgradeUrl: '/pricing'
        });
        return;
      }

      if (requiredPlan && subscription?.planId !== requiredPlan) {
        res.status(403).json({
          error: `${requiredPlan} plan required`,
          currentPlan: subscription?.planId || 'free',
          requiredPlan,
          upgradeUrl: '/pricing'
        });
        return;
      }

      next();
    } catch (error) {
      logger.error(`Subscription check failed: ${error}`);
      res.status(500).json({ error: 'Subscription verification failed' });
    }
  };
};

export const requireFeature = (feature: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const hasAccess = await subscriptionService.canUseFeature(req.user.userId, feature);

      if (!hasAccess) {
        res.status(403).json({
          error: `Feature '${feature}' not available in current plan`,
          feature,
          upgradeUrl: '/pricing'
        });
        return;
      }

      next();
    } catch (error) {
      logger.error(`Feature access check failed: ${error}`);
      res.status(500).json({ error: 'Feature access verification failed' });
    }
  };
};

export const checkUsageLimit = (usageType: 'recording' | 'execution' | 'storage' | 'api') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const hasUsageRemaining = await subscriptionService.hasUsageRemaining(req.user.userId, usageType);

      if (!hasUsageRemaining) {
        res.status(429).json({
          error: `${usageType} limit exceeded for current plan`,
          usageType,
          upgradeUrl: '/pricing',
          message: 'Upgrade your plan to increase limits'
        });
        return;
      }

      next();
    } catch (error) {
      logger.error(`Usage limit check failed: ${error}`);
      res.status(500).json({ error: 'Usage limit verification failed' });
    }
  };
};

export const rateLimitFreeUsers = (maxRequestsPerHour: number = 100) => {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const subscription = await subscriptionService.getActiveSubscription(req.user.userId);
      const isFreeTier = !subscription || subscription.planId === 'free';

      if (!isFreeTier) {
        next();
        return;
      }

      const userId = req.user.userId;
      const now = Date.now();
      const hourInMs = 60 * 60 * 1000;

      const userRequests = requestCounts.get(userId);

      if (!userRequests || now > userRequests.resetTime) {
        requestCounts.set(userId, { count: 1, resetTime: now + hourInMs });
        next();
        return;
      }

      if (userRequests.count >= maxRequestsPerHour) {
        res.status(429).json({
          error: 'Rate limit exceeded for free tier',
          limit: maxRequestsPerHour,
          resetTime: new Date(userRequests.resetTime).toISOString(),
          upgradeUrl: '/pricing'
        });
        return;
      }

      userRequests.count++;
      next();
    } catch (error) {
      logger.error(`Rate limit check failed: ${error}`);
      next();
    }
  };
};
