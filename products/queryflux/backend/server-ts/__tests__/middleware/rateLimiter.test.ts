import { rateLimiter } from '../../middleware/rateLimiter';
import { AppError } from '../../middleware/errorHandler';

describe('rateLimiter', () => {
  const mockReqRes = (ip = '127.0.0.1') => {
    const req = { ip, socket: { remoteAddress: ip } } as any;
    const res = {
      setHeader: jest.fn(),
    } as any;
    const next = jest.fn();
    return { req, res, next };
  };

  it('allows requests under the limit', () => {
    const limiter = rateLimiter(60000, 5);
    const { req, res, next } = mockReqRes();
    limiter(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '5');
  });

  it('throws AppError when limit exceeded', () => {
    const limiter = rateLimiter(60000, 2);
    const ip = '10.0.0.99';

    // First two should pass
    for (let i = 0; i < 2; i++) {
      const { req, res, next } = mockReqRes(ip);
      limiter(req, res, next);
      expect(next).toHaveBeenCalled();
    }

    // Third should throw
    const { req, res, next } = mockReqRes(ip);
    expect(() => limiter(req, res, next)).toThrow(AppError);
  });

  it('sets rate limit headers', () => {
    const limiter = rateLimiter(60000, 10);
    const { req, res, next } = mockReqRes('10.0.0.50');
    limiter(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '9');
  });
});
