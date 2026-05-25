/**
 * @finsavvyai/auth — Express middleware for authentication
 * Drop-in replacement for custom auth middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type TokenPayload } from './tokens.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
        permissions?: string[];
        teams?: string[];
      };
    }
  }
}

export interface AuthMiddlewareConfig {
  /** Async function to validate user still exists in DB */
  validateUser?: (payload: TokenPayload) => Promise<{
    id: string;
    email: string;
    role: string;
  } | null>;
  /** Called on auth failure for audit logging */
  onAuthFailure?: (
    error: string,
    req: Request,
  ) => void;
}

let middlewareConfig: AuthMiddlewareConfig = {};

export function configureAuthMiddleware(
  config: AuthMiddlewareConfig,
): void {
  middlewareConfig = config;
}

export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    if (middlewareConfig.validateUser) {
      middlewareConfig
        .validateUser(payload)
        .then((user) => {
          if (!user) {
            middlewareConfig.onAuthFailure?.('User not found', req);
            res.status(401).json({ error: 'User not found or deactivated' });
            return;
          }
          req.user = {
            userId: user.id,
            email: user.email,
            role: user.role || 'user',
            permissions: payload.permissions,
            teams: payload.teams,
          };
          next();
        })
        .catch(() => {
          res.status(500).json({ error: 'Authentication validation failed' });
        });
      return;
    }

    // No DB validation — trust the JWT
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions,
      teams: payload.teams,
    };
    next();
  } catch (error) {
    middlewareConfig.onAuthFailure?.(String(error), req);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(roles: string | string[]) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!req.user.role || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
      return;
    }
    next();
  };
}
