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

/**
 * Production authentication middleware
 * Extracts and validates JWT from Authorization header
 * Attaches user object to request if valid
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET environment variable is not set');
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    // Verify token signature and expiration
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    if (decoded.type !== 'access') {
      res.status(401).json({ error: 'Invalid token type' });
      return;
    }

    // Fetch user from database
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
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Check email verification (optional - adjust based on requirements)
    // if (!user.isEmailVerified) {
    //   res.status(403).json({ error: 'Email not verified' });
    //   return;
    // }

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
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }

    logger.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Optional authentication middleware
 * Attempts to authenticate but continues if token is missing or invalid
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
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

    // Fetch user from database
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

/**
 * Role-based access control middleware
 */
export const requireRole = (requiredRole: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.role !== requiredRole && req.user.role !== 'admin') {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

/**
 * Subscription-based access control middleware
 */
export const requireSubscription = (requiredSubscription: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const subscriptionLevels = ['free', 'pro', 'enterprise'];
    const userLevel = subscriptionLevels.indexOf(req.user.subscription || 'free');
    const requiredLevel = subscriptionLevels.indexOf(requiredSubscription);

    if (userLevel < requiredLevel) {
      res.status(403).json({
        error: 'Subscription upgrade required',
        required: requiredSubscription,
        current: req.user.subscription || 'free'
      });
      return;
    }

    next();
  };
};

export default {
  authenticate,
  optionalAuth,
  requireRole,
  requireSubscription
};
