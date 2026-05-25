import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAuthMiddleware,
  createRoleMiddleware,
  createPermissionMiddleware,
} from '../src/middleware/hono';
import { signToken } from '../src/jwt/sign';

const SECRET = 'test-secret';

describe('Hono Middleware', () => {
  let mockCtx: any;
  let nextFn: any;

  beforeEach(() => {
    mockCtx = {
      req: {
        header: vi.fn(),
        path: '/api/test',
      },
      get: vi.fn(),
      set: vi.fn(),
      json: vi.fn().mockReturnValue('response'),
    };

    nextFn = vi.fn().mockResolvedValue(undefined);
  });

  describe('createAuthMiddleware', () => {
    it('should authenticate valid tokens', async () => {
      const payload = { sub: 'user-1', email: 'test@example.com', role: 'user' };
      const token = signToken(payload, SECRET);
      mockCtx.req.header.mockReturnValue(`Bearer ${token}`);

      const middleware = createAuthMiddleware(SECRET);
      await middleware(mockCtx, nextFn);

      expect(mockCtx.set).toHaveBeenCalled();
      expect(nextFn).toHaveBeenCalled();
    });

    it('should reject missing tokens', async () => {
      mockCtx.req.header.mockReturnValue(undefined);

      const middleware = createAuthMiddleware(SECRET);
      await middleware(mockCtx, nextFn);

      expect(mockCtx.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Missing authorization token' }),
        401
      );
    });

    it('should reject invalid tokens', async () => {
      mockCtx.req.header.mockReturnValue('Bearer invalid-token');

      const middleware = createAuthMiddleware(SECRET);
      await middleware(mockCtx, nextFn);

      expect(mockCtx.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid or expired token' }),
        401
      );
    });

    it('should skip auth for configured paths', async () => {
      mockCtx.req.path = '/health';
      const middleware = createAuthMiddleware(SECRET, { skipPaths: ['/health'] });
      await middleware(mockCtx, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('createRoleMiddleware', () => {
    it('should allow authorized roles', async () => {
      mockCtx.get.mockReturnValue({
        id: 'user-1',
        email: 'test@example.com',
        role: 'user',
        permissions: [],
      });

      const middleware = createRoleMiddleware('user');
      await middleware(mockCtx, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should reject unauthorized roles', async () => {
      mockCtx.get.mockReturnValue({
        id: 'user-1',
        email: 'test@example.com',
        role: 'guest',
        permissions: [],
      });

      const middleware = createRoleMiddleware('admin');
      await middleware(mockCtx, nextFn);

      expect(mockCtx.json).toHaveBeenCalledWith(
        expect.any(Object),
        403
      );
    });

    it('should reject unauthenticated requests', async () => {
      mockCtx.get.mockReturnValue(undefined);

      const middleware = createRoleMiddleware('user');
      await middleware(mockCtx, nextFn);

      expect(mockCtx.json).toHaveBeenCalledWith(
        expect.any(Object),
        401
      );
    });

    it('should allow multiple authorized roles', async () => {
      mockCtx.get.mockReturnValue({
        id: 'user-1',
        email: 'test@example.com',
        role: 'admin',
        permissions: [],
      });

      const middleware = createRoleMiddleware('admin', 'user');
      await middleware(mockCtx, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('createPermissionMiddleware', () => {
    it('should allow authorized permissions', async () => {
      mockCtx.get.mockReturnValue({
        id: 'user-1',
        email: 'test@example.com',
        role: 'user',
        permissions: ['documents:write'],
      });

      const middleware = createPermissionMiddleware('documents', 'write');
      await middleware(mockCtx, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should reject unauthorized permissions', async () => {
      mockCtx.get.mockReturnValue({
        id: 'user-1',
        email: 'test@example.com',
        role: 'guest',
        permissions: [],
      });

      const middleware = createPermissionMiddleware('users', 'delete');
      await middleware(mockCtx, nextFn);

      expect(mockCtx.json).toHaveBeenCalledWith(
        expect.any(Object),
        403
      );
    });

    it('should reject unauthenticated requests', async () => {
      mockCtx.get.mockReturnValue(undefined);

      const middleware = createPermissionMiddleware('documents', 'read');
      await middleware(mockCtx, nextFn);

      expect(mockCtx.json).toHaveBeenCalledWith(
        expect.any(Object),
        401
      );
    });

    it('should use role defaults for permissions', async () => {
      mockCtx.get.mockReturnValue({
        id: 'user-1',
        email: 'test@example.com',
        role: 'user',
        permissions: [],
      });

      const middleware = createPermissionMiddleware('documents', 'read');
      await middleware(mockCtx, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });
  });
});
