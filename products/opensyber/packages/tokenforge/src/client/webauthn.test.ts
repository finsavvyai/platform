import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  bindDeviceWebAuthn,
  signChallengeWebAuthn,
  bufferToBase64Url,
  base64UrlToBuffer,
} from './webauthn.js';

// ── base64url helpers ──
describe('bufferToBase64Url', () => {
  it('encodes empty buffer to empty string', () => {
    expect(bufferToBase64Url(new Uint8Array([]))).toBe('');
  });

  it('uses url-safe alphabet (no + / =)', () => {
    // 0xff 0xff 0xff → standard base64 = "////"; url-safe = "____"
    const out = bufferToBase64Url(new Uint8Array([0xff, 0xff, 0xff]));
    expect(out).toBe('____');
    expect(out).not.toMatch(/[+/=]/);
  });

  it('round-trips through base64UrlToBuffer', () => {
    const original = new Uint8Array([1, 2, 3, 4, 250, 251, 252, 253, 254, 255]);
    const encoded = bufferToBase64Url(original);
    const decoded = new Uint8Array(base64UrlToBuffer(encoded));
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it('accepts ArrayBuffer input', () => {
    const buf = new Uint8Array([0x10, 0x20, 0x30]).buffer;
    expect(bufferToBase64Url(buf)).toBe('ECAw');
  });
});

describe('base64UrlToBuffer', () => {
  it('handles missing padding', () => {
    // "AQI" decodes to [1, 2] (would be "AQI=" with padding)
    const decoded = new Uint8Array(base64UrlToBuffer('AQI'));
    expect(Array.from(decoded)).toEqual([1, 2]);
  });

  it('decodes url-safe characters', () => {
    const decoded = new Uint8Array(base64UrlToBuffer('____'));
    expect(Array.from(decoded)).toEqual([0xff, 0xff, 0xff]);
  });
});

// ── bindDeviceWebAuthn ──
describe('bindDeviceWebAuthn', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('throws when navigator.credentials is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    await expect(
      bindDeviceWebAuthn('https://api.example.com', 'sess-1', 'user-1', 'Alice'),
    ).rejects.toThrow(/WebAuthn not available/);
  });

  it('posts attestation payload to /api/tf/bind/webauthn and returns deviceId', async () => {
    const fakeRawId = new Uint8Array([1, 2, 3, 4]).buffer;
    const fakeAttestation = new Uint8Array([10, 20, 30]).buffer;
    const fakeClientData = new Uint8Array([40, 50, 60]).buffer;
    const create = vi.fn().mockResolvedValue({
      rawId: fakeRawId,
      response: { attestationObject: fakeAttestation, clientDataJSON: fakeClientData },
    });
    vi.stubGlobal('navigator', { credentials: { create } });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ deviceId: 'dev-webauthn-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await bindDeviceWebAuthn('https://api.example.com', 'sess-1', 'user-1', 'Alice');

    expect(result.deviceId).toBe('dev-webauthn-1');
    expect(result.credentialId).toBe(bufferToBase64Url(fakeRawId));
    expect(create).toHaveBeenCalledTimes(1);
    const opts = (create.mock.calls[0][0] as { publicKey: PublicKeyCredentialCreationOptions }).publicKey;
    expect(opts.pubKeyCredParams).toEqual([
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -8 },
    ]);
    expect(opts.rp.name).toBe('TokenForge');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/tf/bind/webauthn');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as Record<string, string>;
    expect(body.sessionId).toBe('sess-1');
    expect(body.userId).toBe('user-1');
    expect(body.credentialId).toBe(bufferToBase64Url(fakeRawId));
    expect(body.attestationObject).toBe(bufferToBase64Url(fakeAttestation));
    expect(body.clientDataJSON).toBe(bufferToBase64Url(fakeClientData));
  });

  it('rejects when navigator.credentials.create returns null', async () => {
    const create = vi.fn().mockResolvedValue(null);
    vi.stubGlobal('navigator', { credentials: { create } });
    await expect(
      bindDeviceWebAuthn('https://api.example.com', 'sess-1', 'user-1', 'Alice'),
    ).rejects.toThrow(/cancelled/);
  });

  it('throws when server returns non-OK', async () => {
    vi.stubGlobal('navigator', {
      credentials: {
        create: vi.fn().mockResolvedValue({
          rawId: new Uint8Array([1]).buffer,
          response: {
            attestationObject: new Uint8Array([2]).buffer,
            clientDataJSON: new Uint8Array([3]).buffer,
          },
        }),
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(
      bindDeviceWebAuthn('https://api.example.com', 'sess-1', 'user-1', 'Alice'),
    ).rejects.toThrow(/binding failed: 500/);
  });
});

// ── signChallengeWebAuthn ──
describe('signChallengeWebAuthn', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns base64url-encoded signature, authData, clientDataJSON, credentialId', async () => {
    const sigBytes = new Uint8Array([0xa1, 0xa2, 0xa3]).buffer;
    const authData = new Uint8Array([0xb1, 0xb2]).buffer;
    const clientData = new Uint8Array([0xc1, 0xc2, 0xc3, 0xc4]).buffer;
    const rawId = new Uint8Array([0xd1, 0xd2]).buffer;
    const get = vi.fn().mockResolvedValue({
      rawId,
      response: { signature: sigBytes, authenticatorData: authData, clientDataJSON: clientData },
    });
    vi.stubGlobal('navigator', { credentials: { get } });

    const out = await signChallengeWebAuthn('credential-id-b64u', 'sess-1', 'nonce-1', 1700000000);

    expect(out.signature).toBe(bufferToBase64Url(sigBytes));
    expect(out.authenticatorData).toBe(bufferToBase64Url(authData));
    expect(out.clientDataJSON).toBe(bufferToBase64Url(clientData));
    expect(out.credentialId).toBe(bufferToBase64Url(rawId));
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('passes the credentialId through allowCredentials', async () => {
    const get = vi.fn().mockResolvedValue({
      rawId: new Uint8Array([1]).buffer,
      response: {
        signature: new Uint8Array([2]).buffer,
        authenticatorData: new Uint8Array([3]).buffer,
        clientDataJSON: new Uint8Array([4]).buffer,
      },
    });
    vi.stubGlobal('navigator', { credentials: { get } });
    // credId encodes "AQI" → bytes [1, 2]
    await signChallengeWebAuthn('AQI', 's', 'n', 0);
    const opts = (get.mock.calls[0][0] as { publicKey: PublicKeyCredentialRequestOptions }).publicKey;
    expect(opts.allowCredentials).toHaveLength(1);
    const entry = opts.allowCredentials![0];
    const idBytes = new Uint8Array(entry.id as ArrayBuffer);
    expect(Array.from(idBytes)).toEqual([1, 2]);
    expect(entry.type).toBe('public-key');
  });

  it('rejects when assertion is cancelled (returns null)', async () => {
    const get = vi.fn().mockResolvedValue(null);
    vi.stubGlobal('navigator', { credentials: { get } });
    await expect(signChallengeWebAuthn('id', 's', 'n', 0)).rejects.toThrow(/cancelled/);
  });

  it('signChallengeWebAuthn throws when navigator.credentials is unavailable (line 127)', async () => {
    vi.stubGlobal('navigator', {});
    await expect(signChallengeWebAuthn('id', 's', 'n', 0)).rejects.toThrow(/WebAuthn not available/);
  });
});
