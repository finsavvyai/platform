import { describe, it, expect, vi } from 'vitest';
import handler from '../pages/api/analyze';

function createMocks(method: string, body?: Record<string, unknown>) {
  const req = {
    method,
    body: body || {},
  } as any;
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status, json } as any;
  return { req, res, status, json };
}

describe('POST /api/analyze', () => {
  it('rejects non-POST methods', () => {
    const { req, res, status } = createMocks('GET');
    handler(req, res);
    expect(status).toHaveBeenCalledWith(405);
  });

  it('rejects missing URL', () => {
    const { req, res, status } = createMocks('POST', {});
    handler(req, res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('rejects invalid URL', () => {
    const { req, res, status } = createMocks('POST', { url: 'not-a-url' });
    handler(req, res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('returns analysis result for valid URL', () => {
    const { req, res, status, json } = createMocks('POST', { url: 'https://example.com/blog' });
    handler(req, res);
    expect(status).toHaveBeenCalledWith(200);
    const result = json.mock.calls[0][0];
    expect(result).toHaveProperty('url', 'https://example.com/blog');
    expect(result).toHaveProperty('overallScore');
    expect(result).toHaveProperty('signals');
    expect(result).toHaveProperty('agentScores');
    expect(result).toHaveProperty('summary');
    expect(result.agentScores).toHaveLength(4);
  });

  it('returns score between 0 and 100', () => {
    const { req, res, json } = createMocks('POST', { url: 'https://example.com' });
    handler(req, res);
    const result = json.mock.calls[0][0];
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('returns all signal groups', () => {
    const { req, res, json } = createMocks('POST', { url: 'https://example.com' });
    handler(req, res);
    const { signals } = json.mock.calls[0][0];
    expect(signals.structure).toBeDefined();
    expect(signals.authority).toBeDefined();
    expect(signals.aiReadiness).toBeDefined();
    expect(signals.technical).toBeDefined();
  });
});
