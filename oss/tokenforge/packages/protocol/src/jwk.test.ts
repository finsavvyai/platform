import { describe, it, expect } from 'vitest';
import {
  generateKeyPair,
  importJwkPublic,
  importJwkPrivate,
  exportJwkPublic,
  exportJwkPrivate,
  publicKeyThumbprint,
} from './jwk.js';

describe('JWK ↔ CryptoKey converters', () => {
  it('round-trips public key via JWK', async () => {
    const kp = await generateKeyPair();
    const pubJwk = await exportJwkPublic(kp.publicKey);
    expect(pubJwk.kty).toBe('EC');
    expect(pubJwk.crv).toBe('P-256');
    const reimported = await importJwkPublic(pubJwk);
    expect(reimported.algorithm).toMatchObject({ name: 'ECDSA' });
    expect(reimported.usages).toEqual(['verify']);
  });

  it('round-trips private key via JWK when extractable', async () => {
    const kp = await generateKeyPair({ extractable: true });
    const privJwk = await exportJwkPrivate(kp.privateKey);
    expect(privJwk.d).toBeTruthy();
    const reimported = await importJwkPrivate(privJwk, { extractable: true });
    expect(reimported.usages).toEqual(['sign']);
  });

  it('imports public-only JWK without `d`', async () => {
    const kp = await generateKeyPair();
    const pubJwk = await exportJwkPublic(kp.publicKey);
    expect(pubJwk.d).toBeUndefined();
    const reimported = await importJwkPublic(pubJwk);
    expect(reimported.usages).toEqual(['verify']);
  });

  it('publicKeyThumbprint is stable for identical key, differs across keys', async () => {
    const a = await generateKeyPair();
    const b = await generateKeyPair();
    const aPub = await exportJwkPublic(a.publicKey);
    const bPub = await exportJwkPublic(b.publicKey);
    const thumbA1 = await publicKeyThumbprint(aPub);
    const thumbA2 = await publicKeyThumbprint(aPub);
    const thumbB = await publicKeyThumbprint(bPub);
    expect(thumbA1).toBe(thumbA2);
    expect(thumbA1).not.toBe(thumbB);
    expect(thumbA1).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
