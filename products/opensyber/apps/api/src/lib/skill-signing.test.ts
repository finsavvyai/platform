import { describe, it, expect, beforeAll } from 'vitest';
import {
  signSkillTarball,
  verifySkillTarball,
  extractPublicJwk,
} from './skill-signing.js';

let privateJwk: string;
let publicJwk: string;

async function generateTestKeyPair(): Promise<{ privateJwk: string; publicJwk: string }> {
  const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const priv = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const pub = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return { privateJwk: JSON.stringify(priv), publicJwk: JSON.stringify(pub) };
}

describe('skill-signing', () => {
  beforeAll(async () => {
    const keys = await generateTestKeyPair();
    privateJwk = keys.privateJwk;
    publicJwk = keys.publicJwk;
  });

  it('signs a tarball and verifies with the matching public key', async () => {
    const data = new TextEncoder().encode('fake-skill-tarball').buffer;
    const sig = await signSkillTarball(data, privateJwk);
    expect(sig).toMatch(/^[0-9a-f]{128}$/);
    expect(await verifySkillTarball(data, sig, publicJwk)).toBe(true);
  });

  it('rejects a tampered tarball', async () => {
    const data = new TextEncoder().encode('legit').buffer;
    const tampered = new TextEncoder().encode('evil-payload').buffer;
    const sig = await signSkillTarball(data, privateJwk);
    expect(await verifySkillTarball(tampered, sig, publicJwk)).toBe(false);
  });

  it('rejects a mismatched public key', async () => {
    const data = new TextEncoder().encode('same-data').buffer;
    const sig = await signSkillTarball(data, privateJwk);
    const otherKeys = await generateTestKeyPair();
    expect(await verifySkillTarball(data, sig, otherKeys.publicJwk)).toBe(false);
  });

  it('rejects a malformed signature hex', async () => {
    const data = new TextEncoder().encode('x').buffer;
    expect(await verifySkillTarball(data, 'not-hex', publicJwk)).toBe(false);
  });

  it('extractPublicJwk strips the d coordinate from a private JWK', () => {
    const pub = extractPublicJwk(privateJwk);
    const parsed = JSON.parse(pub) as JsonWebKey & { d?: string };
    expect(parsed.d).toBeUndefined();
    expect(parsed.x).toBeDefined();
    expect(parsed.kty).toBe('OKP');
  });
});
