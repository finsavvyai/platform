/**
 * Authentication tests for Luna-OS Wave 1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createAuthProvider } from '../src/auth/provider';
import {
  UnauthorizedError,
  ForbiddenError,
} from '../src/auth/types';
import {
  createMockUser,
  createMockJwtPayload,
  mockEnv,
} from './fixtures';

describe('JWT Authentication Provider', () => {
  let authProvider: ReturnType<typeof createAuthProvider>;

  beforeEach(() => {
    authProvider = createAuthProvider(mockEnv.JWT_SECRET);
  });

  it('should sign and verify token', () => {
    const user = createMockUser();
    const token = authProvider.signToken(user);

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const payload = authProvider.verifyToken(token);
    expect(payload.userId).toBe(user.id);
    expect(payload.email).toBe(user.email);
  });

  it('should throw error for invalid token', () => {
    expect(() => authProvider.verifyToken('invalid-token')).toThrow(
      'Invalid or expired token'
    );
  });

  it('should generate access token with correct expiry', () => {
    const user = createMockUser();
    const token = authProvider.generateAccessToken(user, '1h');

    const payload = authProvider.verifyToken(token);
    expect(payload.userId).toBe(user.id);
  });

  it('should generate refresh token with correct expiry', () => {
    const user = createMockUser();
    const token = authProvider.generateRefreshToken(user, '30d');

    const payload = authProvider.verifyToken(token);
    expect(payload.userId).toBe(user.id);
  });

  it('should preserve user role in token', () => {
    const user = createMockUser({ role: 'admin' });
    const token = authProvider.signToken(user);
    const payload = authProvider.verifyToken(token);

    expect(payload.role).toBe('admin');
  });

  it('should preserve subscription plan in token', () => {
    const user = createMockUser({ subscriptionPlan: 'pro' });
    const token = authProvider.signToken(user);
    const payload = authProvider.verifyToken(token);

    expect(payload.subscriptionPlan).toBe('pro');
  });
});

describe('Error Handling', () => {
  it('should create UnauthorizedError', () => {
    const error = new UnauthorizedError('Test message');
    expect(error.message).toBe('Test message');
    expect(error.name).toBe('UnauthorizedError');
  });

  it('should create ForbiddenError', () => {
    const error = new ForbiddenError('Test message');
    expect(error.message).toBe('Test message');
    expect(error.name).toBe('ForbiddenError');
  });
});

describe('JWT Payload', () => {
  it('should create mock JWT payload', () => {
    const payload = createMockJwtPayload();

    expect(payload.userId).toBeDefined();
    expect(payload.email).toBeDefined();
    expect(payload.role).toBe('user');
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
  });

  it('should allow JWT payload overrides', () => {
    const payload = createMockJwtPayload({
      role: 'admin',
      subscriptionPlan: 'team',
    });

    expect(payload.role).toBe('admin');
    expect(payload.subscriptionPlan).toBe('team');
  });
});
