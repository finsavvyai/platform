/**
 * Hono middleware for JWT authentication
 */

import { Context, Next } from 'hono';
import { JwtAuthProvider } from './provider';
import { AuthContext, AuthMiddlewareOptions, UnauthorizedError, ForbiddenError } from './types';

export function createAuthMiddleware(authProvider: JwtAuthProvider) {
  return async (context: Context, next: Next) => {
    const authHeader = context.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    try {
      const payload = authProvider.verifyToken(token);
      (context as any).authContext = {
        user: {
          id: payload.userId,
          email: payload.email,
          role: payload.role,
          subscriptionPlan: payload.subscriptionPlan,
        },
        token,
        isAuthenticated: true,
      } as AuthContext;
    } catch (error) {
      throw new UnauthorizedError('Invalid token');
    }

    await next();
  };
}

export function requireRole(roles: string[]) {
  return async (context: Context, next: Next) => {
    const authContext = (context as any).authContext as AuthContext;

    if (!authContext || !authContext.isAuthenticated) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!roles.includes(authContext.user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }

    await next();
  };
}

export function requireSubscription(plans: string[]) {
  return async (context: Context, next: Next) => {
    const authContext = (context as any).authContext as AuthContext;

    if (!authContext || !authContext.isAuthenticated) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!plans.includes(authContext.user.subscriptionPlan)) {
      throw new ForbiddenError('Subscription plan required');
    }

    await next();
  };
}

export function getAuthContext(context: Context): AuthContext {
  const authContext = (context as any).authContext as AuthContext;
  if (!authContext) {
    throw new UnauthorizedError('Not authenticated');
  }
  return authContext;
}
