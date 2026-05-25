import { AuthUser } from '../types';

export interface AuthenticatedRequest {
  user?: AuthUser;
  token?: string;
}

export interface AuthMiddlewareOptions {
  secret: string;
  issuer?: string;
  audience?: string;
  skipPaths?: string[];
}

export interface RoleMiddlewareOptions {
  roles: string[];
  onUnauthorized?: () => void;
}

export interface PermissionMiddlewareOptions {
  resource: string;
  action: string;
  onForbidden?: () => void;
}

export type NextFunction = () => Promise<void> | void;

export interface ExpressRequest extends AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
}

export interface ExpressResponse {
  status(code: number): ExpressResponse;
  json(body: unknown): void;
}

export interface HonoContext {
  req: {
    header(name: string): string | undefined;
  };
  text(text: string, status?: number): Response;
  json(body: unknown, status?: number): Response;
  env?: Record<string, unknown>;
}

export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export function extractTokenFromHeader(
  authHeader: string | undefined
): string | null {
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

export function shouldSkipPath(path: string, skipPaths?: string[]): boolean {
  if (!skipPaths || skipPaths.length === 0) {
    return false;
  }

  return skipPaths.some((pattern) => {
    if (pattern.includes('*')) {
      const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
      return regex.test(path);
    }
    return path === pattern;
  });
}
