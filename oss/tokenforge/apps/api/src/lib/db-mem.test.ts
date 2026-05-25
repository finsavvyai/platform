import { describe, it, expect } from 'vitest';
import { InMemoryDb } from './db-mem.js';

describe('InMemoryDb', () => {
  it('returns null for unknown ids', async () => {
    const db = new InMemoryDb();
    expect(await db.findApp('nope')).toBeNull();
    expect(await db.findSubject('a', 'b')).toBeNull();
    expect(await db.findSession('s')).toBeNull();
  });

  it('touchSubject is a no-op on missing id', async () => {
    const db = new InMemoryDb();
    await expect(db.touchSubject('nope', new Date())).resolves.toBeUndefined();
  });

  it('updateSessionRefresh + revokeSession are no-ops on missing id', async () => {
    const db = new InMemoryDb();
    await expect(
      db.updateSessionRefresh({
        sessionId: 'x',
        lastRefreshAt: new Date(),
        boundCookieHash: 'h',
        boundCookieIssuedAt: new Date(),
        boundCookieExpiresAt: new Date(),
      }),
    ).resolves.toBeUndefined();
    await expect(db.revokeSession('x', 'r', new Date())).resolves.toBeUndefined();
  });

  it('listActiveSessions filters revoked + expired', async () => {
    const db = new InMemoryDb();
    const past = new Date(Date.now() - 1000);
    const future = new Date(Date.now() + 60_000);
    await db.insertSession({
      id: 'live', appId: 'a', subjectId: 'u',
      publicKeyJwk: { kty: 'EC' } as JsonWebKey, bindingClass: 'webcrypto',
      origin: 'https://x', boundCookieHash: 'h',
      boundCookieIssuedAt: new Date(), boundCookieExpiresAt: future,
      createdAt: new Date(), expiresAt: future,
    });
    await db.insertSession({
      id: 'expired', appId: 'a', subjectId: 'u',
      publicKeyJwk: { kty: 'EC' } as JsonWebKey, bindingClass: 'webcrypto',
      origin: 'https://x', boundCookieHash: 'h',
      boundCookieIssuedAt: new Date(), boundCookieExpiresAt: past,
      createdAt: new Date(), expiresAt: past,
    });
    await db.insertSession({
      id: 'revoked', appId: 'a', subjectId: 'u',
      publicKeyJwk: { kty: 'EC' } as JsonWebKey, bindingClass: 'webcrypto',
      origin: 'https://x', boundCookieHash: 'h',
      boundCookieIssuedAt: new Date(), boundCookieExpiresAt: future,
      createdAt: new Date(), expiresAt: future,
    });
    await db.revokeSession('revoked', 'logout', new Date());
    const list = await db.listActiveSessions('a', 'u');
    expect(list.map((s) => s.id)).toEqual(['live']);
  });
});
