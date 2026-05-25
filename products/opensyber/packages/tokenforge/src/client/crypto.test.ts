import { describe, it, expect } from 'vitest';
import { generateDeviceKeyPair, exportPublicKey } from './crypto.js';

describe('generateDeviceKeyPair', () => {
  it('creates a CryptoKeyPair', async () => {
    const kp = await generateDeviceKeyPair();
    expect(kp).toBeDefined();
    expect(kp.privateKey).toBeDefined();
    expect(kp.publicKey).toBeDefined();
    expect(kp.privateKey).toBeInstanceOf(CryptoKey);
    expect(kp.publicKey).toBeInstanceOf(CryptoKey);
  });

  it('private key is NOT extractable', async () => {
    const kp = await generateDeviceKeyPair();
    expect(kp.privateKey.extractable).toBe(false);
  });

  it('public key IS extractable', async () => {
    const kp = await generateDeviceKeyPair();
    expect(kp.publicKey.extractable).toBe(true);
  });

  it('private key has ECDSA algorithm with P-256 curve', async () => {
    const kp = await generateDeviceKeyPair();
    const algo = kp.privateKey.algorithm as EcKeyAlgorithm;
    expect(algo.name).toBe('ECDSA');
    expect(algo.namedCurve).toBe('P-256');
  });

  it('private key usages include "sign"', async () => {
    const kp = await generateDeviceKeyPair();
    expect(kp.privateKey.usages).toContain('sign');
  });

  it('public key usages include "verify"', async () => {
    const kp = await generateDeviceKeyPair();
    expect(kp.publicKey.usages).toContain('verify');
  });

  it('generates unique key pairs on each call', async () => {
    const kp1 = await generateDeviceKeyPair();
    const kp2 = await generateDeviceKeyPair();
    const jwk1 = await crypto.subtle.exportKey('jwk', kp1.publicKey);
    const jwk2 = await crypto.subtle.exportKey('jwk', kp2.publicKey);
    expect(jwk1.x).not.toBe(jwk2.x);
  });
});

describe('exportPublicKey', () => {
  it('returns a JWK with kty "EC" and crv "P-256"', async () => {
    const kp = await generateDeviceKeyPair();
    const jwk = await exportPublicKey(kp);
    expect(jwk.kty).toBe('EC');
    expect(jwk.crv).toBe('P-256');
  });

  it('JWK has x and y coordinates', async () => {
    const kp = await generateDeviceKeyPair();
    const jwk = await exportPublicKey(kp);
    expect(typeof jwk.x).toBe('string');
    expect(typeof jwk.y).toBe('string');
    expect(jwk.x!.length).toBeGreaterThan(0);
    expect(jwk.y!.length).toBeGreaterThan(0);
  });

  it('JWK does not contain the private key component "d"', async () => {
    const kp = await generateDeviceKeyPair();
    const jwk = await exportPublicKey(kp);
    expect(jwk.d).toBeUndefined();
  });

  it('exporting private key directly throws', async () => {
    const kp = await generateDeviceKeyPair();
    await expect(
      crypto.subtle.exportKey('jwk', kp.privateKey),
    ).rejects.toThrow();
  });

  it('JWK key_ops includes "verify"', async () => {
    const kp = await generateDeviceKeyPair();
    const jwk = await exportPublicKey(kp);
    expect(jwk.key_ops).toContain('verify');
  });
});
