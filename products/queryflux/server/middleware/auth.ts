import type { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import * as crypto from 'crypto';

export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authMiddleware(jwtSecret: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError(401, 'Missing or invalid authorization header', 'AUTH_REQUIRED');
    }

    const token = header.slice(7);

    try {
      const decoded = verifyToken(token, jwtSecret);
      req.user = decoded;
      next();
    } catch {
      throw new AppError(401, 'Invalid or expired token', 'AUTH_INVALID');
    }
  };
}

export function optionalAuth(jwtSecret: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      try {
        req.user = verifyToken(header.slice(7), jwtSecret);
      } catch {
        // Silently ignore invalid tokens for optional auth
      }
    }
    next();
  };
}

function verifyToken(token: string, secret: string): AuthUser {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  const [headerB64, payloadB64, signatureB64] = parts;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  if (expected !== signatureB64) throw new Error('Invalid signature');

  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
  if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error('Token expired');

  return { id: payload.sub, email: payload.email, role: payload.role || 'user' };
}

export function generateToken(user: AuthUser, secret: string, expiresInSec = 3600): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: user.id, email: user.email, role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSec,
  })).toString('base64url');

  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}
