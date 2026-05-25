import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockGenerateKeyPair, mockExportPublicKey, mockStoreKey, mockGetKey, mockBindWebAuthn } = vi.hoisted(() => ({
  mockGenerateKeyPair: vi.fn(),
  mockExportPublicKey: vi.fn(),
  mockStoreKey: vi.fn(),
  mockGetKey: vi.fn(),
  mockBindWebAuthn: vi.fn(),
}));

vi.mock('./crypto.js', () => ({
  generateDeviceKeyPair: mockGenerateKeyPair,
  exportPublicKey: mockExportPublicKey,
}));
vi.mock('./storage.js', () => ({
  storeDeviceKey: mockStoreKey,
  getDeviceKey: mockGetKey,
}));
vi.mock('./webauthn.js', () => ({ bindDeviceWebAuthn: mockBindWebAuthn }));

import { bindDevice } from './binding.js';

const fakeKeyPair = { privateKey: {} as CryptoKey, publicKey: {} as CryptoKey } as CryptoKeyPair;
const fakeJwk = { kty: 'EC', crv: 'P-256', x: 'X', y: 'Y' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 TestAgent', language: 'en-US', platform: 'TestOS',
  });
  vi.stubGlobal('screen', { width: 1920, height: 1080, colorDepth: 24 });
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ deviceId: 'dev_1' }), { status: 200 })) as unknown as typeof fetch;
  mockGenerateKeyPair.mockResolvedValue(fakeKeyPair);
  mockExportPublicKey.mockResolvedValue(fakeJwk);
  mockGetKey.mockResolvedValue(null);
  mockStoreKey.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('bindDevice — WebAuthn path', () => {
  it('throws when userId is missing', async () => {
    await expect(bindDevice('https://api', 's1', { prefer: 'webauthn', displayName: 'Alice' }))
      .rejects.toThrow('bindDevice(webauthn): userId and displayName are required');
  });

  it('throws when displayName is missing', async () => {
    await expect(bindDevice('https://api', 's1', { prefer: 'webauthn', userId: 'u1' }))
      .rejects.toThrow('bindDevice(webauthn): userId and displayName are required');
  });

  it('delegates to bindDeviceWebAuthn and returns its result wrapped as type=webauthn', async () => {
    mockBindWebAuthn.mockResolvedValueOnce({ deviceId: 'dev_w', credentialId: 'cred_x' });
    const r = await bindDevice('https://api', 's1', { prefer: 'webauthn', userId: 'u1', displayName: 'Alice' });
    expect(r).toEqual({ type: 'webauthn', deviceId: 'dev_w', credentialId: 'cred_x' });
    expect(mockBindWebAuthn).toHaveBeenCalledWith('https://api', 's1', 'u1', 'Alice');
  });
});

describe('bindDevice — ECDSA path', () => {
  it('returns the existing key when sessionId matches stored binding (no fetch, no regen)', async () => {
    mockGetKey.mockResolvedValueOnce({ deviceId: 'dev_existing', keyPair: fakeKeyPair, sessionId: 's1', createdAt: 0 });
    const r = await bindDevice('https://api', 's1');
    expect(r).toEqual({ type: 'ecdsa', deviceId: 'dev_existing', keyPair: fakeKeyPair });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(mockGenerateKeyPair).not.toHaveBeenCalled();
  });

  it('generates a new key + binds when stored sessionId does not match (rebind)', async () => {
    mockGetKey.mockResolvedValueOnce({ deviceId: 'dev_old', keyPair: fakeKeyPair, sessionId: 'OLD-SESSION', createdAt: 0 });
    const r = await bindDevice('https://api', 's-new');
    expect(r.type).toBe('ecdsa');
    if (r.type === 'ecdsa') expect(r.deviceId).toBe('dev_1');
    expect(mockGenerateKeyPair).toHaveBeenCalledOnce();
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });

  it('POSTs to {apiBase}/api/tf/bind with publicKey, sessionId, metadata fields', async () => {
    await bindDevice('https://api.example', 's-new');
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.example/api/tf/bind');
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse(((init as RequestInit).body as string)) as {
      publicKey: unknown; sessionId: string; metadata: Record<string, unknown>;
    };
    expect(body.publicKey).toEqual(fakeJwk);
    expect(body.sessionId).toBe('s-new');
    expect(body.metadata).toMatchObject({
      userAgent: expect.any(String),
      language: expect.any(String),
      platform: expect.any(String),
      timezone: expect.any(String),
    });
    expect(typeof body.metadata.screenResolution).toBe('string');
    expect(typeof body.metadata.colorDepth).toBe('number');
  });

  it('sends credentials: include so the session cookie is forwarded', async () => {
    await bindDevice('https://api', 's-new');
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    expect((fetchMock.mock.calls[0]![1] as RequestInit).credentials).toBe('include');
  });

  it('throws with status code when API returns non-OK', async () => {
    globalThis.fetch = vi.fn(async () => new Response('boom', { status: 500 })) as unknown as typeof fetch;
    await expect(bindDevice('https://api', 's-new')).rejects.toThrow('TokenForge binding failed: 500');
    expect(mockStoreKey).not.toHaveBeenCalled();
  });

  it('stores the keyPair + deviceId + sessionId after successful bind', async () => {
    await bindDevice('https://api', 's-new');
    expect(mockStoreKey).toHaveBeenCalledOnce();
    const stored = mockStoreKey.mock.calls[0]![0] as Record<string, unknown>;
    expect(stored.deviceId).toBe('dev_1');
    expect(stored.keyPair).toBe(fakeKeyPair);
    expect(stored.sessionId).toBe('s-new');
    expect(typeof stored.createdAt).toBe('number');
  });

  it('returns {type:"ecdsa", deviceId, keyPair} on the happy path', async () => {
    const r = await bindDevice('https://api', 's-new');
    expect(r).toEqual({ type: 'ecdsa', deviceId: 'dev_1', keyPair: fakeKeyPair });
  });
});
