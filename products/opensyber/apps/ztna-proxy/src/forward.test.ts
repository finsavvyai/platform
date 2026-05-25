import { describe, it, expect, vi, beforeEach } from 'vitest';
import { forwardToUpstream } from './forward.js';
import type { ZtnaApp } from './types.js';

describe('forwardToUpstream', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      return new Response(JSON.stringify({ url: url.toString(), method: init?.method }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
  });

  const baseApp: ZtnaApp = {
    id: 'app-1',
    ownerUserId: 'u-1',
    hostname: 'grafana.acme.com',
    upstream: 'https://internal-grafana.acme.local',
    requiredTrustScore: 70,
    forwardWriteMethods: true,
    status: 'active',
  };

  const identity = { userId: 'u-1', deviceId: 'd-1', trustScore: 95 };

  it('rewrites host to upstream and preserves path/query', async () => {
    const req = new Request('https://grafana.acme.com/dashboard?id=42', { method: 'GET' });
    const res = await forwardToUpstream(req, baseApp, identity);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string };
    expect(body.url).toBe('https://internal-grafana.acme.local/dashboard?id=42');
  });

  it('strips X-TF-* verification headers before forwarding', async () => {
    const req = new Request('https://grafana.acme.com/api/health', {
      method: 'GET',
      headers: {
        'X-TF-Signature': 'sig',
        'X-TF-Nonce': 'n',
        'X-TF-Timestamp': '1234',
        'X-TF-Device-Id': 'd-1',
      },
    });
    await forwardToUpstream(req, baseApp, identity);

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const init = call[1] as RequestInit;
    const fwd = init.headers as Headers;
    expect(fwd.get('x-tf-signature')).toBeNull();
    expect(fwd.get('x-tf-nonce')).toBeNull();
    expect(fwd.get('x-tf-timestamp')).toBeNull();
    expect(fwd.get('x-tf-device-id')).toBeNull();
  });

  it('attaches X-Forwarded-User/Device/Trust-Score for upstream attribution', async () => {
    const req = new Request('https://grafana.acme.com/api/health', { method: 'GET' });
    await forwardToUpstream(req, baseApp, identity);

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const init = call[1] as RequestInit;
    const fwd = init.headers as Headers;
    expect(fwd.get('x-forwarded-user')).toBe('u-1');
    expect(fwd.get('x-forwarded-device')).toBe('d-1');
    expect(fwd.get('x-forwarded-trust-score')).toBe('95');
  });

  it('blocks write methods when forwardWriteMethods is false', async () => {
    const readOnlyApp = { ...baseApp, forwardWriteMethods: false };
    const req = new Request('https://grafana.acme.com/api/x', { method: 'POST' });
    const res = await forwardToUpstream(req, readOnlyApp, identity);
    expect(res.status).toBe(405);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('method_not_allowed');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('forwards POST/PUT/PATCH/DELETE when forwardWriteMethods is true', async () => {
    const methods = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;
    for (const method of methods) {
      const req = new Request('https://grafana.acme.com/api/x', {
        method,
        body: method === 'DELETE' ? undefined : JSON.stringify({ a: 1 }),
      });
      const res = await forwardToUpstream(req, baseApp, identity);
      expect(res.status).toBe(200);
    }
  });
});
