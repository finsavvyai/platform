import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  verifySkillSignature,
  signatureKvKey,
  signatureKvPrefix,
  type SignatureEntry,
} from './skill-signature-verify.js';

function makeEntry(overrides: Partial<SignatureEntry> = {}): SignatureEntry {
  return {
    id: 'sig_test123',
    skillSlug: 'ai-triage',
    version: '1.2.0',
    sha256: 'a'.repeat(64),
    signatureB64: 'dGVzdC1zaWduYXR1cmU=',
    sbomUrl: 'https://r2.opensyber.cloud/sbom/ai-triage-1.2.0.json',
    reviewedAt: '2026-04-15T10:00:00.000Z',
    reviewerId: 'user_reviewer1',
    publishedAt: '2026-04-15T12:00:00.000Z',
    ...overrides,
  };
}

function createMockKV(data: Record<string, string> = {}) {
  const store = new Map(Object.entries(data));
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    list: vi.fn(async ({ prefix }: { prefix: string }) => ({
      keys: [...store.keys()]
        .filter((k) => k.startsWith(prefix))
        .map((name) => ({ name })),
    })),
    delete: vi.fn(),
  } as unknown as KVNamespace;
}

describe('signatureKvKey', () => {
  it('builds the correct KV key', () => {
    expect(signatureKvKey('ai-triage', '1.2.0')).toBe(
      'skill-sig:ai-triage:1.2.0',
    );
  });
});

describe('signatureKvPrefix', () => {
  it('builds the correct KV prefix', () => {
    expect(signatureKvPrefix('ai-triage')).toBe('skill-sig:ai-triage:');
  });
});

describe('verifySkillSignature', () => {
  let kv: KVNamespace;

  beforeEach(() => {
    kv = createMockKV();
  });

  it('returns unverified with null entry when no signature exists', async () => {
    const result = await verifySkillSignature(
      kv,
      'nonexistent',
      '1.0.0',
      'a'.repeat(64),
    );
    expect(result.verified).toBe(false);
    expect(result.entry).toBeNull();
  });

  it('returns unverified when hash does not match entry', async () => {
    const entry = makeEntry({ sha256: 'b'.repeat(64) });
    kv = createMockKV({
      [signatureKvKey('ai-triage', '1.2.0')]: JSON.stringify(entry),
    });

    const result = await verifySkillSignature(
      kv,
      'ai-triage',
      '1.2.0',
      'a'.repeat(64),
    );
    expect(result.verified).toBe(false);
    expect(result.entry).not.toBeNull();
    expect(result.entry?.sha256).toBe('b'.repeat(64));
  });

  it('returns unverified when hash matches but no public key provided', async () => {
    const entry = makeEntry();
    kv = createMockKV({
      [signatureKvKey('ai-triage', '1.2.0')]: JSON.stringify(entry),
    });

    const result = await verifySkillSignature(
      kv,
      'ai-triage',
      '1.2.0',
      'a'.repeat(64),
    );
    expect(result.verified).toBe(false);
    expect(result.entry).toEqual(entry);
  });

  it('returns verified true with valid ECDSA P-256 key pair', async () => {
    // Generate a real P-256 key pair
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );

    const hash = 'c'.repeat(64);
    const hashBytes = new TextEncoder().encode(hash);
    const sigBuffer = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      hashBytes,
    );

    const sigB64 = btoa(
      String.fromCharCode(...new Uint8Array(sigBuffer)),
    );
    const spkiBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const pubKeyB64 = btoa(
      String.fromCharCode(...new Uint8Array(spkiBuffer)),
    );

    const entry = makeEntry({ sha256: hash, signatureB64: sigB64 });
    kv = createMockKV({
      [signatureKvKey('ai-triage', '1.2.0')]: JSON.stringify(entry),
    });

    const result = await verifySkillSignature(
      kv,
      'ai-triage',
      '1.2.0',
      hash,
      pubKeyB64,
    );
    expect(result.verified).toBe(true);
    expect(result.entry).toEqual(entry);
  });

  it('returns verified false with mismatched key', async () => {
    // Generate two different key pairs
    const signingKey = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );
    const wrongKey = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );

    const hash = 'd'.repeat(64);
    const hashBytes = new TextEncoder().encode(hash);
    const sigBuffer = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      signingKey.privateKey,
      hashBytes,
    );

    const sigB64 = btoa(
      String.fromCharCode(...new Uint8Array(sigBuffer)),
    );
    const wrongPubBuffer = await crypto.subtle.exportKey(
      'spki',
      wrongKey.publicKey,
    );
    const wrongPubB64 = btoa(
      String.fromCharCode(...new Uint8Array(wrongPubBuffer)),
    );

    const entry = makeEntry({ sha256: hash, signatureB64: sigB64 });
    kv = createMockKV({
      [signatureKvKey('ai-triage', '1.2.0')]: JSON.stringify(entry),
    });

    const result = await verifySkillSignature(
      kv,
      'ai-triage',
      '1.2.0',
      hash,
      wrongPubB64,
    );
    expect(result.verified).toBe(false);
    expect(result.entry).toEqual(entry);
  });
});
