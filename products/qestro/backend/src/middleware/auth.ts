import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../lib/db.js';
import { users } from '../schema/index.js';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

interface JWTPayload {
  userId: string;
  type: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
        firstName?: string;
        lastName?: string;
        avatar?: string;
        subscription?: string;
        teamId?: string;
      };
    }
  }
}

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET environment variable is not set');
      return res.status(500).json({ error: 'Internal server error' });
    }

    // Verify token
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    if (decoded.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Get user from database
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        firstName: users.firstName,
        lastName: users.lastName,
        avatar: users.avatar,
        subscription: users.subscription,
        isEmailVerified: users.isEmailVerified,
      })
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({ error: 'Email not verified' });
    }

    // Attach user to request
    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      avatar: user.avatar || undefined,
      subscription: user.subscription || undefined,
    };
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }

    logger.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

// Legacy alias
export const authenticateToken = authenticateUser;

export const requireRole = (requiredRole: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== requiredRole && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

export const requireSubscription = (requiredSubscription: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const subscriptionLevels = ['free', 'pro', 'enterprise'];
    const userLevel = subscriptionLevels.indexOf(req.user.subscription || 'free');
    const requiredLevel = subscriptionLevels.indexOf(requiredSubscription);

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error: 'Subscription upgrade required',
        required: requiredSubscription,
        current: req.user.subscription || 'free'
      });
    }

    next();
  };
};

export const requireFeature = (featureName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // For now, just pass through - implement feature checking logic later
    next();
  };
};

export const checkUsageLimit = (limitType: string, maxUsage: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // For now, just pass through - implement usage limit checking logic later
    next();
  };
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next(); // Continue without authentication
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return next(); // Continue without authentication
    }

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        firstName: users.firstName,
        lastName: users.lastName,
        subscription: users.subscription,
      })
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (user) {
      req.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        subscription: user.subscription || undefined,
      };
    }

    next();
  } catch (error) {
    // Silently continue without authentication on error
    next();
  }
};

export default {
  authenticateToken,
  requireRole,
  requireSubscription,
  optionalAuth,
};
// Aliased exports for compatibility
export const requireAuth = authenticateUser;
export const requireApiKey = authenticateUser;
