import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDBBindingStorage, MemoryBindingStorage, defaultStorage } from './storage.js';
import type { BoundSessionRecord } from '../types.js';

async function fixture(): Promise<BoundSessionRecord> {
  const pair = (await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey;
  return {
    sessionId: 'tf_sess_test',
    refreshUrl: 'https://api.test/v1/sessions/refresh',
    lastChallenge: 'aGVsbG8',
    publicKeyJwk: jwk,
    privateKey: pair.privateKey,
    bindingClass: 'webcrypto',
    createdAt: new Date().toISOString(),
  };
}

describe('MemoryBindingStorage', () => {
  it('round-trips a record and clears it', async () => {
    const s = new MemoryBindingStorage();
    expect(await s.getSession()).toBeNull();
    const rec = await fixture();
    await s.putSession(rec);
    const got = await s.getSession();
    expect(got?.sessionId).toBe('tf_sess_test');
    await s.clear();
    expect(await s.getSession()).toBeNull();
  });

  it('updates only the challenge field in place', async () => {
    const s = new MemoryBindingStorage();
    await s.putSession(await fixture());
    await s.updateChallenge('next-nonce');
    const got = await s.getSession();
    expect(got?.lastChallenge).toBe('next-nonce');
  });

  it('updateChallenge is a no-op when no record stored', async () => {
    const s = new MemoryBindingStorage();
    await s.updateChallenge('whatever');
    expect(await s.getSession()).toBeNull();
  });
});

describe('defaultStorage', () => {
  it('picks IndexedDB when globalThis.indexedDB is present', () => {
    const s = defaultStorage();
    expect(s).toBeInstanceOf(IndexedDBBindingStorage);
  });

  it('falls back to memory when indexedDB is absent', () => {
    const original = globalThis.indexedDB;
    delete (globalThis as { indexedDB?: unknown }).indexedDB;
    try {
      const s = defaultStorage();
      expect(s).toBeInstanceOf(MemoryBindingStorage);
    } finally {
      (globalThis as { indexedDB: IDBFactory }).indexedDB = original;
    }
  });
});

describe('IndexedDBBindingStorage (fake-indexeddb)', () => {
  beforeEach(async () => {
    const s = new IndexedDBBindingStorage();
    await s.clear();
  });

  it('persists and retrieves the record across instances', async () => {
    const s1 = new IndexedDBBindingStorage();
    await s1.putSession(await fixture());
    const s2 = new IndexedDBBindingStorage();
    const got = await s2.getSession();
    expect(got?.sessionId).toBe('tf_sess_test');
  });

  it('updateChallenge persists', async () => {
    const s = new IndexedDBBindingStorage();
    await s.putSession(await fixture());
    await s.updateChallenge('rotated');
    const got = await s.getSession();
    expect(got?.lastChallenge).toBe('rotated');
  });

  it('clear deletes the record', async () => {
    const s = new IndexedDBBindingStorage();
    await s.putSession(await fixture());
    await s.clear();
    expect(await s.getSession()).toBeNull();
  });
});
