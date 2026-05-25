/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { extractRequestMeta } from './request-meta';

function req(headers: Record<string, string>): Request {
  return new Request('https://api.clawpipe.ai/v1/prompt', { method: 'POST', headers });
}

describe('extractRequestMeta', () => {
  it('returns all nulls when no clawpipe headers present', () => {
    const m = extractRequestMeta(req({}));
    expect(m).toEqual({
      properties: null,
      sessionId: null,
      parentSessionId: null,
      tags: null,
      cacheForceRefresh: false,
    });
  });

  it('parses property headers case-insensitively', () => {
    const m = extractRequestMeta(req({
      'x-clawpipe-property-user': 'u_123',
      'X-ClawPipe-Property-tenant': 'acme',
    }));
    expect(m.properties).toEqual({ user: 'u_123', tenant: 'acme' });
  });

  it('parses session + parent session', () => {
    const m = extractRequestMeta(req({
      'x-clawpipe-session-id': 's1',
      'x-clawpipe-parent-session-id': 's0',
    }));
    expect(m.sessionId).toBe('s1');
    expect(m.parentSessionId).toBe('s0');
  });

  it('parses comma-separated tags', () => {
    const m = extractRequestMeta(req({ 'x-clawpipe-tag': 'eu, premium ,beta' }));
    expect(m.tags).toEqual(['eu', 'premium', 'beta']);
  });

  it('flags cache force refresh', () => {
    const m = extractRequestMeta(req({ 'x-clawpipe-cache-force-refresh': 'true' }));
    expect(m.cacheForceRefresh).toBe(true);
  });

  it('truncates oversize property values', () => {
    const m = extractRequestMeta(req({ 'x-clawpipe-property-big': 'x'.repeat(1000) }));
    expect(m.properties?.big.length).toBe(500);
  });

  it('caps total property count at 20', () => {
    const h: Record<string, string> = {};
    for (let i = 0; i < 30; i++) h[`x-clawpipe-property-p${i}`] = String(i);
    const m = extractRequestMeta(req(h));
    expect(Object.keys(m.properties ?? {}).length).toBe(20);
  });
});
