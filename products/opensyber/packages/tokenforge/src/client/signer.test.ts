import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signChallenge, generateNonce, arrayBufferToBase64Url, isNativeDbscAvailable, sha256Hex, buildSignatureInput, TF_PROTOCOL_VERSION } from './signer.js';

describe('arrayBufferToBase64Url', () => {
  it('encodes empty buffer as empty string', () => {
    const buffer = new ArrayBuffer(0);
    expect(arrayBufferToBase64Url(buffer)).toBe('');
  });

  it('encodes known bytes correctly', () => {
    // [0x00] -> base64 "AA==" -> base64url "AA"
    const buf = new Uint8Array([0x00]).buffer;
    expect(arrayBufferToBase64Url(buf)).toBe('AA');
  });

  it('encodes [0xfb, 0xff, 0xfe] without +, /, or = characters', () => {
    // 0xfb=251, 0xff=255, 0xfe=254 -> base64 "+//+" -> base64url "-__-"
    const buf = new Uint8Array([0xfb, 0xff, 0xfe]).buffer;
    const result = arrayBufferToBase64Url(buf);
    expect(result).toBe('-__-');
    expect(result).not.toContain('+');
    expect(result).not.toContain('/');
    expect(result).not.toContain('=');
  });

  it('encodes [72, 101, 108, 108, 111] ("Hello") as base64url', () => {
    const buf = new Uint8Array([72, 101, 108, 108, 111]).buffer;
    expect(arrayBufferToBase64Url(buf)).toBe('SGVsbG8');
  });
});

describe('generateNonce', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('produces a string of ~22 characters (16 bytes base64url)', () => {
    const nonce = generateNonce();
    // 16 bytes -> ceil(16 * 4/3) = 22 chars without padding
    expect(nonce.length).toBe(22);
  });

  it('produces a base64url-safe string', () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces unique values on successive calls', () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
  });
});

describe('sha256Hex', () => {
  it('computes correct hash of empty string', async () => {
    const hash = await sha256Hex('');
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('computes correct hash of "hello"', async () => {
    const hash = await sha256Hex('hello');
    expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });
});

describe('buildSignatureInput', () => {
  it('builds v2 format with method, path, bodyHash, sessionId, nonce, timestamp', async () => {
    const input = await buildSignatureInput('sess-1', 'nonce-1', '1700000000', 'POST', '/api/data', '{"key":"value"}');
    const bodyHash = await sha256Hex('{"key":"value"}');
    expect(input).toBe(`POST:/api/data:${bodyHash}:sess-1:nonce-1:1700000000`);
  });

  it('uses empty string hash when body is null', async () => {
    const input = await buildSignatureInput('sess-1', 'nonce-1', '1700000000', 'GET', '/api/data', null);
    const emptyHash = await sha256Hex('');
    expect(input).toBe(`GET:/api/data:${emptyHash}:sess-1:nonce-1:1700000000`);
  });
});

describe('TF_PROTOCOL_VERSION', () => {
  it('is "2"', () => {
    expect(TF_PROTOCOL_VERSION).toBe('2');
  });
});

describe('signChallenge', () => {
  let keyPair: CryptoKeyPair;

  beforeEach(async () => {
    keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign', 'verify'],
    );
  });

  it('returns an object with signature and bodyHash', async () => {
    const result = await signChallenge(keyPair.privateKey, 'sess-123', 'nonce-abc', 1700000000, 'GET', '/api', null);
    expect(typeof result.signature).toBe('string');
    expect(result.signature.length).toBeGreaterThan(0);
    expect(result.signature).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(typeof result.bodyHash).toBe('string');
    expect(result.bodyHash.length).toBe(64);
  });

  it('v2 signature verifies with matching public key', async () => {
    const sessionId = 'sess-456';
    const nonce = 'nonce-xyz';
    const timestamp = 1700000001;
    const body = '{"action":"delete"}';
    const result = await signChallenge(keyPair.privateKey, sessionId, nonce, timestamp, 'POST', '/api/data', body);

    const base64 = result.signature.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const sigBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) sigBytes[i] = binary.charCodeAt(i);

    const bodyHash = await sha256Hex(body);
    const payload = `POST:/api/data:${bodyHash}:${sessionId}:${nonce}:${timestamp}`;
    const encoded = new TextEncoder().encode(payload);

    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      keyPair.publicKey, sigBytes.buffer, encoded,
    );
    expect(valid).toBe(true);
  });

  it('falls back to v1 format when method/path not provided', async () => {
    const signSpy = vi.spyOn(crypto.subtle, 'sign');
    await signChallenge(keyPair.privateKey, 'ses', 'non', 999);

    expect(signSpy).toHaveBeenCalledOnce();
    const encodedArg = signSpy.mock.calls[0][2] as Uint8Array;
    const decoded = new TextDecoder().decode(encodedArg);
    expect(decoded).toBe('ses:non:999');
    signSpy.mockRestore();
  });

  it('v2 constructs payload as method:path:bodyHash:sessionId:nonce:timestamp', async () => {
    const signSpy = vi.spyOn(crypto.subtle, 'sign');
    await signChallenge(keyPair.privateKey, 'ses', 'non', 999, 'PUT', '/path', 'body');

    expect(signSpy).toHaveBeenCalledOnce();
    const encodedArg = signSpy.mock.calls[0][2] as Uint8Array;
    const decoded = new TextDecoder().decode(encodedArg);
    const bodyHash = await sha256Hex('body');
    expect(decoded).toBe(`PUT:/path:${bodyHash}:ses:non:999`);
    signSpy.mockRestore();
  });

  it('produces different signatures for different bodies', async () => {
    const r1 = await signChallenge(keyPair.privateKey, 'a', 'n', 1, 'POST', '/x', 'body1');
    const r2 = await signChallenge(keyPair.privateKey, 'a', 'n', 1, 'POST', '/x', 'body2');
    expect(r1.signature).not.toBe(r2.signature);
    expect(r1.bodyHash).not.toBe(r2.bodyHash);
  });
});

describe('isNativeDbscAvailable', () => {
  type Mut = Navigator & { deviceBoundSession?: unknown };
  const reset = (): void => {
    delete (navigator as Mut).deviceBoundSession;
  };

  beforeEach(() => reset());

  it('returns false when navigator.deviceBoundSession is undefined (no native DBSC)', () => {
    expect(isNativeDbscAvailable()).toBe(false);
  });

  it('returns false when navigator.deviceBoundSession is null', () => {
    (navigator as Mut).deviceBoundSession = null;
    expect(isNativeDbscAvailable()).toBe(false);
  });

  it('returns false when navigator.deviceBoundSession is a primitive (downgrade-shim guard)', () => {
    (navigator as Mut).deviceBoundSession = 'truthy-but-not-an-object';
    expect(isNativeDbscAvailable()).toBe(false);
  });

  it('returns false when navigator.deviceBoundSession is a function (functions are not objects per typeof)', () => {
    (navigator as Mut).deviceBoundSession = (): void => {};
    expect(isNativeDbscAvailable()).toBe(false);
  });

  it('returns true when navigator.deviceBoundSession is a real object', () => {
    (navigator as Mut).deviceBoundSession = { register: (): void => {} };
    expect(isNativeDbscAvailable()).toBe(true);
  });
});
