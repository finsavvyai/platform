import { describe, it, expect, vi } from 'vitest';
import { bindViaWebCrypto, RegisterError } from './webcrypto.js';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('bindViaWebCrypto', () => {
  it('POSTs the public JWK + binding_class and returns a BoundSessionRecord', async () => {
    const captured: { url: string; body: unknown }[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      captured.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return jsonResponse({
        session_id: 'tf_sess_yyy',
        refresh_url: 'https://api.test/refresh',
        challenge: 'init-nonce',
      });
    }) as unknown as typeof globalThis.fetch;

    const rec = await bindViaWebCrypto({
      registerUrl: '/__tokenforge/register',
      subject: 'user_42',
      fetchImpl,
    });
    expect(rec.sessionId).toBe('tf_sess_yyy');
    expect(rec.bindingClass).toBe('webcrypto');
    expect(rec.publicKeyJwk.kty).toBe('EC');
    expect(rec.publicKeyJwk.crv).toBe('P-256');
    expect(captured[0]?.url).toBe('/__tokenforge/register');
    expect(rec.privateKey.usages).toEqual(['sign']);
    expect(rec.privateKey.extractable).toBe(false);
  });

  it('throws RegisterError on non-2xx', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 503 })) as unknown as typeof globalThis.fetch;
    await expect(
      bindViaWebCrypto({ registerUrl: '/r', subject: 'u', fetchImpl }),
    ).rejects.toBeInstanceOf(RegisterError);
  });
});
