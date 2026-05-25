import { describe, expect, it } from 'vitest';
import {
  ApiError,
  AuthExpiredError,
  AUTH_EXPIRED_EVENT,
  ForbiddenError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  ServerError,
  TimeoutError,
} from './api-errors';

describe('api-errors', () => {
  it('ApiError carries status and message', () => {
    const err = new ApiError(418, 'teapot', 'body');
    expect(err.status).toBe(418);
    expect(err.message).toBe('teapot');
    expect(err.body).toBe('body');
    expect(err.name).toBe('ApiError');
    expect(err).toBeInstanceOf(Error);
  });

  it('NetworkError has status 0 and the right name', () => {
    const err = new NetworkError();
    expect(err.status).toBe(0);
    expect(err.name).toBe('NetworkError');
    expect(err).toBeInstanceOf(ApiError);
  });

  it('TimeoutError has status 0 and the right name', () => {
    const err = new TimeoutError();
    expect(err.status).toBe(0);
    expect(err.name).toBe('TimeoutError');
  });

  it('AuthExpiredError is 401 with a stable name', () => {
    const err = new AuthExpiredError();
    expect(err.status).toBe(401);
    expect(err.name).toBe('AuthExpiredError');
  });

  it('ForbiddenError is 403 and carries a custom message', () => {
    const err = new ForbiddenError('nope');
    expect(err.status).toBe(403);
    expect(err.message).toBe('nope');
    expect(err.name).toBe('ForbiddenError');
  });

  it('NotFoundError is 404', () => {
    const err = new NotFoundError();
    expect(err.status).toBe(404);
    expect(err.name).toBe('NotFoundError');
  });

  it('RateLimitError captures Retry-After', () => {
    const err = new RateLimitError(30, 'slow down');
    expect(err.status).toBe(429);
    expect(err.retryAfterSeconds).toBe(30);
    expect(err.message).toBe('slow down');
  });

  it('RateLimitError defaults retryAfter to null when none given', () => {
    const err = new RateLimitError();
    expect(err.retryAfterSeconds).toBeNull();
  });

  it('ServerError keeps the upstream status code', () => {
    const err = new ServerError(503, 'unavailable');
    expect(err.status).toBe(503);
    expect(err.name).toBe('ServerError');
  });

  it('exports a stable auth-expired event name', () => {
    expect(AUTH_EXPIRED_EVENT).toBe('pushci:auth-expired');
  });
});
