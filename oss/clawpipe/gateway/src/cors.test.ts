/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { corsResponse } from './cors';
import { GATEWAY_VERSION } from './version';

describe('corsResponse', () => {
  it('echoes whitelisted origin + credentials + Vary', () => {
    const r = corsResponse(new Response('x'), 'https://clawpipe.ai');
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://clawpipe.ai');
    expect(r.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(r.headers.get('Vary')).toBe('Origin');
  });

  it('falls back to * for non-whitelisted origin', () => {
    const r = corsResponse(new Response('x'), 'https://evil.test');
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('falls back to * when origin is null', () => {
    const r = corsResponse(new Response('x'), null);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('sets HSTS, nosniff, and Referrer-Policy', () => {
    const r = corsResponse(new Response('x'));
    expect(r.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
    expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(r.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('attaches X-Powered-By and X-ClawPipe-Version', () => {
    const r = corsResponse(new Response('x'));
    expect(r.headers.get('X-Powered-By')).toContain('ClawPipe');
    expect(r.headers.get('X-ClawPipe-Version')).toBe(GATEWAY_VERSION);
  });

  it('preserves status + body', async () => {
    const r = corsResponse(new Response('hello', { status: 201 }));
    expect(r.status).toBe(201);
    expect(await r.text()).toBe('hello');
  });

  it('whitelists localhost dev origins', () => {
    const r = corsResponse(new Response('x'), 'http://localhost:5173');
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
  });
});
