import { verifyTokenSafe } from '../jwt/verify';
import { hasPermission } from '../rbac/permissions';
import {
  HonoContext,
  AuthMiddlewareOptions,
  extractTokenFromHeader,
  shouldSkipPath,
  UnauthorizedError,
  ForbiddenError,
} from './types';
import { AuthUser } from '../types';

declare global {
  namespace Hono {
    interface ContextData {
      user?: AuthUser;
      token?: string;
    }
  }
}

export function createAuthMiddleware(
  secret: string,
  options: Partial<AuthMiddlewareOptions> = {}
) {
  return async (ctx: HonoContext, next: () => Promise<void>) => {
    const path = ctx.req.path || '';
    if (options.skipPaths && shouldSkipPath(path, options.skipPaths)) {
      return next();
    }

    const authHeader = ctx.req.header('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return ctx.json({ error: 'Missing authorization token' }, 401);
    }

    const payload = verifyTokenSafe(token, secret, {
      issuer: options.issuer,
      audience: options.audience,
    });

    if (!payload) {
      return ctx.json({ error: 'Invalid or expired token' }, 401);
    }

    const user: AuthUser = {
      id: payload.sub,
      email: payload.email,
      role: payload.role as 'admin' | 'user' | 'guest',
      permissions: [],
    };

    ctx.set('user', user);
    ctx.set('token', token);

    return next();
  };
}

export function createRoleMiddleware(...roles: string[]) {
  return async (ctx: HonoContext, next: () => Promise<void>) => {
    const user = ctx.get('user') as AuthUser | undefined;

    if (!user) {
      return ctx.json({ error: 'Authentication required' }, 401);
    }

    if (!roles.includes(user.role)) {
      return ctx.json(
        {
          error: 'Insufficient permissions',
          required: roles,
          current: user.role,
        },
        403
      );
    }

    return next();
  };
}

export function createPermissionMiddleware(resource: string, action: string) {
  return async (ctx: HonoContext, next: () => Promise<void>) => {
    const user = ctx.get('user') as AuthUser | undefined;

    if (!user) {
      return ctx.json({ error: 'Authentication required' }, 401);
    }

    if (!hasPermission(user, resource, action)) {
      return ctx.json(
        {
          error: 'Permission denied',
          resource,
          action,
        },
        403
      );
    }

    return next();
  };
}

export function createErrorHandler() {
  return async (err: Error, ctx: HonoContext) => {
    if (err instanceof UnauthorizedError) {
      return ctx.json({ error: err.message }, 401);
    }

    if (err instanceof ForbiddenError) {
      return ctx.json({ error: err.message }, 403);
    }

    return ctx.json({ error: 'Internal server error' }, 500);
  };
}

export type HonoAuthContext = HonoContext & {
  get(key: 'user'): AuthUser | undefined;
  get(key: 'token'): string | undefined;
};
