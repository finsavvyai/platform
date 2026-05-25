import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TokenForgeConfig } from '../shared/types.js';

function makeConfig(overrides?: Partial<TokenForgeConfig>): TokenForgeConfig {
  return { apiBase: 'https://api.example.com', getSessionId: () => 'sess-1', ...overrides };
}

function makeMaterial(pk: CryptoKey) {
  return async () => ({ privateKey: pk, sessionId: 'sess-1', deviceId: 'dev-1' });
}

function getHeaders(call: unknown[]): Headers | null {
  const init = call[1] as RequestInit | undefined;
  return init?.headers ? new Headers(init.headers) : null;
}

describe('installFetchInterceptor', () => {
  let originalFetch: typeof globalThis.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;
  let keyPair: CryptoKeyPair;

  beforeEach(async () => {
    keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'],
    );
    mockFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    originalFetch = globalThis.fetch;
    vi.stubGlobal('window', { fetch: mockFetch });
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
  });

  async function load() {
    return await import('./interceptor.js');
  }

  it('adds TF headers to intercepted requests', async () => {
    const { installFetchInterceptor } = await load();
    const cleanup = installFetchInterceptor(makeConfig(), makeMaterial(keyPair.privateKey));
    await window.fetch('https://api.example.com/data');

    expect(mockFetch).toHaveBeenCalledOnce();
    const h = getHeaders(mockFetch.mock.calls[0])!;
    expect(h.get('X-TF-Signature')).toBeTruthy();
    expect(h.get('X-TF-Nonce')).toBeTruthy();
    expect(h.get('X-TF-Timestamp')).toBeTruthy();
    expect(h.get('X-TF-Device-ID')).toBe('dev-1');
    cleanup();
  });

  it('does not intercept requests to other origins', async () => {
    const { installFetchInterceptor } = await load();
    const cleanup = installFetchInterceptor(makeConfig(), makeMaterial(keyPair.privateKey));
    await window.fetch('https://other.example.com/data');

    expect(mockFetch).toHaveBeenCalledOnce();
    const h = getHeaders(mockFetch.mock.calls[0]);
    expect(h?.get('X-TF-Signature') ?? null).toBeNull();
    cleanup();
  });

  it('skips paths matching skipPaths (exact)', async () => {
    const { installFetchInterceptor } = await load();
    const cleanup = installFetchInterceptor(
      makeConfig({ skipPaths: ['/health'] }), makeMaterial(keyPair.privateKey),
    );
    await window.fetch('https://api.example.com/health');

    const h = getHeaders(mockFetch.mock.calls[0]);
    expect(h?.get('X-TF-Signature') ?? null).toBeNull();
    cleanup();
  });

  it('skips paths matching skipPaths (wildcard)', async () => {
    const { installFetchInterceptor } = await load();
    const cleanup = installFetchInterceptor(
      makeConfig({ skipPaths: ['/public/*'] }), makeMaterial(keyPair.privateKey),
    );
    await window.fetch('https://api.example.com/public/assets/logo.png');

    const h = getHeaders(mockFetch.mock.calls[0]);
    expect(h?.get('X-TF-Signature') ?? null).toBeNull();
    cleanup();
  });

  it('cleanup function restores original fetch', async () => {
    const { installFetchInterceptor } = await load();
    const cleanup = installFetchInterceptor(makeConfig(), makeMaterial(keyPair.privateKey));
    const interceptedFetch = window.fetch;
    cleanup();

    expect(window.fetch).not.toBe(interceptedFetch);
    await window.fetch('https://api.example.com/after-cleanup');
    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(lastCall[0]).toBe('https://api.example.com/after-cleanup');
    const h = getHeaders(lastCall);
    expect(h?.get('X-TF-Signature') ?? null).toBeNull();
  });

  it('handles step-up response (403 with step_up_required)', async () => {
    const stepUpHandler = vi.fn();
    mockFetch.mockResolvedValueOnce(new Response(
      JSON.stringify({ action: 'step_up_required', reason: 'trust_score_low' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    ));

    const { installFetchInterceptor } = await load();
    const cleanup = installFetchInterceptor(
      makeConfig({ onStepUpRequired: stepUpHandler }), makeMaterial(keyPair.privateKey),
    );
    await window.fetch('https://api.example.com/protected');

    expect(stepUpHandler).toHaveBeenCalledOnce();
    expect(stepUpHandler).toHaveBeenCalledWith('trust_score_low');
    cleanup();
  });

  it('handles session revoked response (401 with session_revoked)', async () => {
    const revokedHandler = vi.fn();
    mockFetch.mockResolvedValueOnce(new Response(
      JSON.stringify({ action: 'session_revoked' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    ));

    const { installFetchInterceptor } = await load();
    const cleanup = installFetchInterceptor(
      makeConfig({ onSessionRevoked: revokedHandler }), makeMaterial(keyPair.privateKey),
    );
    await window.fetch('https://api.example.com/protected');

    expect(revokedHandler).toHaveBeenCalledOnce();
    cleanup();
  });

  it('passes through when getSigningMaterial returns null', async () => {
    const { installFetchInterceptor } = await load();
    const cleanup = installFetchInterceptor(makeConfig(), async () => null);
    await window.fetch('https://api.example.com/data');

    expect(mockFetch).toHaveBeenCalledOnce();
    const h = getHeaders(mockFetch.mock.calls[0]);
    expect(h?.get('X-TF-Signature') ?? null).toBeNull();
    cleanup();
  });

  it('uses custom header names when configured', async () => {
    const { installFetchInterceptor } = await load();
    const config = makeConfig({
      headers: {
        signature: 'X-Custom-Sig', nonce: 'X-Custom-Nonce',
        timestamp: 'X-Custom-TS', deviceId: 'X-Custom-Device',
      },
    });
    const cleanup = installFetchInterceptor(config, makeMaterial(keyPair.privateKey));
    await window.fetch('https://api.example.com/data');

    const h = getHeaders(mockFetch.mock.calls[0])!;
    expect(h.get('X-Custom-Sig')).toBeTruthy();
    expect(h.get('X-Custom-Nonce')).toBeTruthy();
    expect(h.get('X-Custom-TS')).toBeTruthy();
    expect(h.get('X-Custom-Device')).toBe('dev-1');
    cleanup();
  });

  it('403 with non-JSON body silently swallows parse error and does NOT call onStepUpRequired (line 67)', async () => {
    const stepUpHandler = vi.fn();
    mockFetch.mockResolvedValueOnce(new Response('plain text 403', { status: 403 }));
    const { installFetchInterceptor } = await load();
    const cleanup = installFetchInterceptor(
      makeConfig({ onStepUpRequired: stepUpHandler }), makeMaterial(keyPair.privateKey),
    );
    await window.fetch('https://api.example.com/protected');
    expect(stepUpHandler).not.toHaveBeenCalled();
    cleanup();
  });

  it('401 with non-JSON body silently swallows parse error and does NOT call onSessionRevoked (line 84)', async () => {
    const revokedHandler = vi.fn();
    mockFetch.mockResolvedValueOnce(new Response('plain text 401', { status: 401 }));
    const { installFetchInterceptor } = await load();
    const cleanup = installFetchInterceptor(
      makeConfig({ onSessionRevoked: revokedHandler }), makeMaterial(keyPair.privateKey),
    );
    await window.fetch('https://api.example.com/protected');
    expect(revokedHandler).not.toHaveBeenCalled();
    cleanup();
  });
});
