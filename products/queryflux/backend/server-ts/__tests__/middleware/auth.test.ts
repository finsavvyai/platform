import { generateToken, authMiddleware, optionalAuth } from '../../middleware/auth';
import type { AuthUser } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';

const SECRET = 'test-secret-for-jwt-signing';

const testUser: AuthUser = { id: 'u1', email: 'test@example.com', role: 'user' };

describe('generateToken', () => {
  it('produces a valid JWT string with 3 parts', () => {
    const token = generateToken(testUser, SECRET);
    expect(token.split('.')).toHaveLength(3);
  });
});

describe('authMiddleware', () => {
  const middleware = authMiddleware(SECRET);

  const mockReqRes = (authHeader?: string) => {
    const req = { headers: { authorization: authHeader }, user: undefined } as any;
    const res = {} as any;
    const next = jest.fn();
    return { req, res, next };
  };

  it('sets req.user and calls next for valid token', () => {
    const token = generateToken(testUser, SECRET);
    const { req, res, next } = mockReqRes(`Bearer ${token}`);
    middleware(req, res, next);
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe('u1');
    expect(next).toHaveBeenCalled();
  });

  it('throws AppError when no Authorization header', () => {
    const { req, res, next } = mockReqRes();
    expect(() => middleware(req, res, next)).toThrow(AppError);
  });

  it('throws AppError for invalid token', () => {
    const { req, res, next } = mockReqRes('Bearer invalid.token.here');
    expect(() => middleware(req, res, next)).toThrow(AppError);
  });

  it('throws AppError for expired token', () => {
    const token = generateToken(testUser, SECRET, -10); // expired
    const { req, res, next } = mockReqRes(`Bearer ${token}`);
    expect(() => middleware(req, res, next)).toThrow(AppError);
  });
});

describe('optionalAuth', () => {
  const middleware = optionalAuth(SECRET);

  it('sets user when valid token provided', () => {
    const token = generateToken(testUser, SECRET);
    const req = { headers: { authorization: `Bearer ${token}` }, user: undefined } as any;
    const next = jest.fn();
    middleware(req, {} as any, next);
    expect(req.user).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  it('calls next without user when no token', () => {
    const req = { headers: {}, user: undefined } as any;
    const next = jest.fn();
    middleware(req, {} as any, next);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('calls next without user when token is invalid', () => {
    const req = { headers: { authorization: 'Bearer bad' }, user: undefined } as any;
    const next = jest.fn();
    middleware(req, {} as any, next);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
