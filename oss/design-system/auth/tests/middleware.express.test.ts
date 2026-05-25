import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireAuth, requireRole, requirePermission } from '../src/middleware/express';
import { extractTokenFromHeader, shouldSkipPath } from '../src/middleware/types';
import { signToken } from '../src/jwt/sign';

const SECRET = 'test-secret';

describe('Express Middleware', () => {
  let mockReq: any;
  let mockRes: any;
  let nextFn: any;

  beforeEach(() => {
    mockReq = {
      headers: {},
      path: '/api/test',
      user: undefined,
      token: undefined,
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    nextFn = vi.fn();
  });

  describe('requireAuth middleware', () => {
    it('should allow requests with valid token', () => {
      const payload = { sub: 'user-1', email: 'test@example.com', role: 'user' };
      const token = signToken(payload, SECRET);
      mockReq.headers.authorization = `Bearer ${token}`;

      const middleware = requireAuth(SECRET);
      middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.id).toBe('user-1');
    });

    it('should reject requests without token', () => {
      const middleware = requireAuth(SECRET);
      middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalled();
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid token', () => {
      mockReq.headers.authorization = 'Bearer invalid-token';
      const middleware = requireAuth(SECRET);
      middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should skip protected paths when configured', () => {
      const middleware = requireAuth(SECRET, { skipPaths: ['/health', '/auth/*'] });
      mockReq.path = '/health';
      middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('requireRole middleware', () => {
    beforeEach(() => {
      mockReq.user = {
        id: 'user-1',
        email: 'test@example.com',
        role: 'user',
        permissions: [],
      };
    });

    it('should allow requests from authorized roles', () => {
      const middleware = requireRole('user', 'admin');
      middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should reject requests from unauthorized roles', () => {
      mockReq.user.role = 'guest';
      const middleware = requireRole('admin', 'user');
      middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated requests', () => {
      mockReq.user = undefined;
      const middleware = requireRole('user');
      middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requirePermission middleware', () => {
    beforeEach(() => {
      mockReq.user = {
        id: 'user-1',
        email: 'test@example.com',
        role: 'user',
        permissions: ['documents:write'],
      };
    });

    it('should allow requests with required permission', () => {
      const middleware = requirePermission('documents', 'write');
      middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should reject requests without required permission', () => {
      const middleware = requirePermission('users', 'delete');
      middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated requests', () => {
      mockReq.user = undefined;
      const middleware = requirePermission('documents', 'read');
      middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });
});

describe('Middleware utilities', () => {
  it('should extract token from Bearer header', () => {
    const token = extractTokenFromHeader('Bearer my-token-123');
    expect(token).toBe('my-token-123');
  });

  it('should return null for invalid auth header', () => {
    expect(extractTokenFromHeader('Basic dXNlcjpwYXNz')).toBeNull();
    expect(extractTokenFromHeader('Bearer')).toBeNull();
    expect(extractTokenFromHeader(undefined)).toBeNull();
  });

  it('should check skip paths with patterns', () => {
    expect(shouldSkipPath('/health', ['/health'])).toBe(true);
    expect(shouldSkipPath('/auth/login', ['/auth/*'])).toBe(true);
    expect(shouldSkipPath('/api/test', ['/health'])).toBe(false);
  });
});
