/**
 * Authentication module type definitions
 */

export type UserRole = 'admin' | 'user' | 'guest';

export interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  subscriptionPlan: 'free' | 'pro' | 'team';
  createdAt: Date;
  updatedAt: Date;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  subscriptionPlan: string;
  iat?: number;
  exp?: number;
}

export interface AuthContext {
  user: User;
  token: string;
  isAuthenticated: boolean;
}

export interface AuthMiddlewareOptions {
  requireRole?: UserRole[];
  requireSubscription?: string[];
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}
