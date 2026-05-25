import { describe, it, expect, vi } from 'vitest';
import handler from '../pages/api/waitlist';

function createMocks(method: string, body?: Record<string, unknown>) {
  const req = { method, body: body || {} } as any;
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status, json } as any;
  return { req, res, status, json };
}

describe('POST /api/waitlist', () => {
  it('rejects non-POST methods', () => {
    const { req, res, status } = createMocks('GET');
    handler(req, res);
    expect(status).toHaveBeenCalledWith(405);
  });

  it('rejects missing email', () => {
    const { req, res, status } = createMocks('POST', {});
    handler(req, res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('rejects invalid email', () => {
    const { req, res, status } = createMocks('POST', { email: 'bad' });
    handler(req, res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('accepts valid email', () => {
    const { req, res, status, json } = createMocks('POST', { email: 'a@b.com' });
    handler(req, res);
    expect(status).toHaveBeenCalledWith(200);
    expect(json.mock.calls[0][0].success).toBe(true);
  });
});
