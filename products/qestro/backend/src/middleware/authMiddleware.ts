/**
 * Auth middleware — powered by @finsavvyai/auth
 * Validates JWT tokens and optionally checks user exists in DB
 */

import { Request, Response, NextFunction } from 'express';
import {
  authenticateToken as sharedAuthenticateToken,
  requireRole as sharedRequireRole,
  configureAuthMiddleware,
  configureTokens,
} from '@finsavvyai/auth';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { users } from '../schema/index.js';
import { logger } from '../utils/logger.js';

function getRequiredSecret(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`${name} environment variable is required in production`);
  }
  return value || `dev-only-${name}-not-for-production`;
}

// Configure @finsavvyai/auth for Qestro
configureTokens({
  jwtSecret: getRequiredSecret('JWT_SECRET'),
  jwtRefreshSecret: getRequiredSecret('JWT_REFRESH_SECRET'),
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  issuer: 'questro',
  audience: 'questro-api',
});

configureAuthMiddleware({
  validateUser: async (payload) => {
    const [user] = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);
    return user || null;
  },
  onAuthFailure: (error, req) => {
    logger.error(`Authentication failed: ${error}`, {
      ip: req.ip,
      path: req.path,
    });
  },
});

export const authenticateToken = sharedAuthenticateToken;
export const requireRole = sharedRequireRole;

// Re-export subscription middleware for backward compatibility
export {
  requireSubscription,
  requireFeature,
  checkUsageLimit,
  rateLimitFreeUsers,
} from './subscriptionMiddleware.js';
