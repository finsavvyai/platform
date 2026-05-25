import { verifyTokenSafe } from '../jwt/verify';
import { hasPermission } from '../rbac/permissions';
import {
  AuthMiddlewareOptions,
  AuthenticatedRequest,
  extractTokenFromHeader,
  shouldSkipPath,
  UnauthorizedError,
  ForbiddenError,
} from './types';

export function requireAuth(secret: string, options: Partial<AuthMiddlewareOptions> = {}) {
  return (
    req: AuthenticatedRequest & { path?: string; headers: Record<string, string | string[] | undefined> },
    res: { status(code: number): { json(body: unknown): void }; },
    next: () => void
  ) => {
    if (options.skipPaths && shouldSkipPath(req.path || '', options.skipPaths)) {
      return next();
    }

    const authHeader = Array.isArray(req.headers.authorization)
      ? req.headers.authorization[0]
      : req.headers.authorization;

    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const payload = verifyTokenSafe(token, secret, {
      issuer: options.issuer,
      audience: options.audience,
    });

    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role as 'admin' | 'user' | 'guest',
      permissions: [],
    };
    req.token = token;

    next();
  };
}

export function requireRole(...roles: string[]) {
  return (
    req: AuthenticatedRequest,
    res: { status(code: number): { json(body: unknown): void }; },
    next: () => void
  ) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role,
      });
    }

    next();
  };
}

export function requirePermission(resource: string, action: string) {
  return (
    req: AuthenticatedRequest,
    res: { status(code: number): { json(body: unknown): void }; },
    next: () => void
  ) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!hasPermission(req.user, resource, action)) {
      return res.status(403).json({
        error: 'Permission denied',
        resource,
        action,
      });
    }

    next();
  };
}

export function errorHandler(
  err: Error,
  req: AuthenticatedRequest,
  res: { status(code: number): { json(body: unknown): void }; },
  next?: () => void
) {
  if (err instanceof UnauthorizedError) {
    return res.status(401).json({ error: err.message });
  }

  if (err instanceof ForbiddenError) {
    return res.status(403).json({ error: err.message });
  }

  res.status(500).json({ error: 'Internal server error' });
}
