import { Request, Response, NextFunction } from 'express';
import { subscriptionService } from '../services/SubscriptionService.js';
import { logger } from '../utils/logger.js';

export const trackUsageMiddleware = (usageType: 'recording' | 'execution' | 'storage' | 'api', amount: number = 1) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Track usage after successful request
    const originalSend = res.send;

    res.send = function (data: any) {
      // Only track if request was successful
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        subscriptionService.trackUsage(req.user.userId, usageType, amount)
          .catch(error => logger.error(`Failed to track usage: ${error}`));
      }

      return originalSend.call(this, data);
    };

    next();
  };
};

export const validatePaymentRequired = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const subscription = await subscriptionService.getActiveSubscription(req.user.userId);

    // Check if user has valid payment method for non-free plans
    if (subscription && subscription.planId !== 'free') {
      const customer = await subscriptionService.getCustomerByUserId(req.user.userId);

      if (!customer) {
        res.status(403).json({
          error: 'Payment setup required',
          message: 'Please complete payment setup to continue',
          setupUrl: '/billing/setup'
        });
        return;
      }

      // TODO: Check if customer has valid payment method in Stripe
      // const paymentMethods = await stripeService.listPaymentMethods(customer.stripeCustomerId);
      // if (paymentMethods.length === 0) {
      //   res.status(403).json({
      //     error: 'Payment method required',
      //     message: 'Please add a payment method to continue',
      //     setupUrl: '/billing/payment-methods'
      //   });
      //   return;
      // }
    }

    next();
  } catch (error) {
    logger.error(`Payment validation failed: ${error}`);
    res.status(500).json({ error: 'Payment validation failed' });
  }
};

export const preventTrialAbuse = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // TODO: Check for trial abuse patterns
    // - Multiple accounts from same email domain
    // - Multiple accounts from same IP address
    // - Multiple accounts with same payment method
    // - Rapid account creation patterns

    const userEmail = req.user.email;
    const clientIP = req.ip || req.socket?.remoteAddress;

    // Check for suspicious patterns
    if (userEmail && userEmail.includes('+') && userEmail.split('+').length > 2) {
      logger.warn(`Potential trial abuse detected: ${userEmail} from IP ${clientIP}`);
      // Don't block, but log for review
    }

    // TODO: Implement proper abuse detection
    // - Check database for similar accounts
    // - Track IP addresses and patterns
    // - Implement CAPTCHA for suspicious requests

    next();
  } catch (error) {
    logger.error(`Trial abuse check failed: ${error}`);
    next(); // Don't block on errors
  }
};

export const enforceBusinessRules = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const subscription = await subscriptionService.getActiveSubscription(req.user.userId);
    const planId = subscription?.planId || 'free';

    // Enforce plan-specific restrictions
    switch (planId) {
      case 'free':
        // Additional restrictions for free users
        if (req.path.includes('/export') && req.body?.format === 'enterprise') {
          res.status(403).json({
            error: 'Enterprise export formats require paid plan',
            upgradeUrl: '/pricing'
          });
          return;
        }
        break;

      case 'starter':
        // Starter plan restrictions
        if (req.path.includes('/integrations') && req.body?.type === 'sso') {
          res.status(403).json({
            error: 'SSO integrations require Professional plan or higher',
            upgradeUrl: '/pricing'
          });
          return;
        }
        break;

      case 'professional':
        // Professional plan restrictions
        if (req.path.includes('/deployment') && req.body?.type === 'on-premise') {
          res.status(403).json({
            error: 'On-premise deployment requires Enterprise plan',
            upgradeUrl: '/pricing'
          });
          return;
        }
        break;

      case 'enterprise':
        // No additional restrictions for enterprise
        break;

      default:
        res.status(403).json({
          error: 'Invalid subscription plan',
          upgradeUrl: '/pricing'
        });
        return;
    }

    next();
  } catch (error) {
    logger.error(`Business rules enforcement failed: ${error}`);
    res.status(500).json({ error: 'Plan validation failed' });
  }
};