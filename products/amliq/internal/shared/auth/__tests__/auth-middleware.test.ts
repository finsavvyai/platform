import { UnifiedAuthService, createAuthMiddleware } from '../unified-auth';
import type { UnifiedJWTClaims } from '../unified-auth';

describe('createAuthMiddleware', () => {
  let authService: UnifiedAuthService;

  beforeEach(() => {
    authService = new UnifiedAuthService({ secretKey: 'test-secret' });
  });

  it('returns 401 when no Authorization header', async () => {
    const middleware = createAuthMiddleware(authService);
    const mockReq = { header: jest.fn().mockReturnValue(undefined) };
    const mockJson = jest.fn();
    const c = { req: mockReq, json: mockJson, set: jest.fn() };
    const next = jest.fn();

    await middleware(c, next);

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'Missing authorization header' },
      401
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('validates Bearer token and sets user', async () => {
    const token = authService.generateToken({
      user_id: 'u1', email: 'test@test.com', role: 'admin', sub: 'u1',
    });

    const middleware = createAuthMiddleware(authService);
    const mockReq = { header: jest.fn().mockReturnValue(`Bearer ${token}`) };
    const sets: Record<string, unknown> = {};
    const c = {
      req: mockReq,
      json: jest.fn(),
      set: jest.fn((key: string, val: unknown) => { sets[key] = val; }),
    };
    const next = jest.fn();

    await middleware(c, next);

    expect(sets['authType']).toBe('jwt');
    expect((sets['user'] as UnifiedJWTClaims).user_id).toBe('u1');
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 for invalid Bearer token', async () => {
    const middleware = createAuthMiddleware(authService);
    const mockReq = { header: jest.fn().mockReturnValue('Bearer invalid-token') };
    const mockJson = jest.fn();
    const c = { req: mockReq, json: mockJson, set: jest.fn() };
    const next = jest.fn();

    await middleware(c, next);

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'Invalid or expired token' },
      401
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('handles ApiKey prefix', async () => {
    const middleware = createAuthMiddleware(authService);
    const mockReq = { header: jest.fn().mockReturnValue('ApiKey fs_test_abc') };
    const sets: Record<string, unknown> = {};
    const c = {
      req: mockReq,
      json: jest.fn(),
      set: jest.fn((key: string, val: unknown) => { sets[key] = val; }),
    };
    const next = jest.fn();

    await middleware(c, next);

    expect(sets['authType']).toBe('apikey');
    expect(typeof sets['apiKeyHash']).toBe('string');
    expect(next).toHaveBeenCalled();
  });

  it('handles raw fs_ API key', async () => {
    const middleware = createAuthMiddleware(authService);
    const mockReq = { header: jest.fn().mockReturnValue('fs_live_mykey') };
    const sets: Record<string, unknown> = {};
    const c = {
      req: mockReq,
      json: jest.fn(),
      set: jest.fn((key: string, val: unknown) => { sets[key] = val; }),
    };
    const next = jest.fn();

    await middleware(c, next);

    expect(sets['authType']).toBe('apikey');
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 for invalid auth format', async () => {
    const middleware = createAuthMiddleware(authService);
    const mockReq = { header: jest.fn().mockReturnValue('Basic dXNlcjpwYXNz') };
    const mockJson = jest.fn();
    const c = { req: mockReq, json: mockJson, set: jest.fn() };
    const next = jest.fn();

    await middleware(c, next);

    expect(mockJson).toHaveBeenCalledWith(
      { error: 'Invalid authorization format' },
      401
    );
  });
});
