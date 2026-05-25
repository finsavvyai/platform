/**
 * Real WebAuthn ECDSA P-256 round-trip coverage for verifyPasskeyCredential.
 * Sibling file because step-up-edge.test.ts is 197L (no headroom). Closes
 * Sprint 39 line 96 residual gap: step-up.ts lines 154, 164-176 (the
 * importKey + signature verify body — only reachable with a real
 * keypair + signed (authData || SHA-256(clientDataJSON)) tuple).
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createStepUpRoutes } from './step-up.js';
import type { TokenForgeServerOptions } from '../shared/types.js';
import type { StepUpChallengeRecord } from './storage/interface.js';

interface State {
  challenges: Map<string, StepUpChallengeRecord>;
  statusUpdates: Array<{ id: string; status: string }>;
  restoreTrustCalls: Array<{ deviceId: string; userId: string }>;
}

function makeStorage(s: State): TokenForgeServerOptions['storage'] {
  return {
    countRecentChallenges: async () => 0,
    createChallenge: async () => undefined,
    getChallenge: async (id: string) => s.challenges.get(id) ?? null,
    storeOtp: async () => undefined,
    getOtp: async () => null,
    deleteOtp: async () => undefined,
    updateChallengeStatus: async (id: string, status: string) => {
      s.statusUpdates.push({ id, status });
    },
    restoreTrust: async (deviceId: string, userId: string) => {
      s.restoreTrustCalls.push({ deviceId, userId });
    },
  } as unknown as TokenForgeServerOptions['storage'];
}

function buildApp(opts: Partial<TokenForgeServerOptions>) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('userId', 'u1');
    c.set('sessionId', 's1');
    await next();
  });
  app.route('/step-up', createStepUpRoutes({ ...opts, storage: opts.storage } as TokenForgeServerOptions));
  return app;
}

const pending = (id: string): StepUpChallengeRecord => ({
  id, sessionId: 's1', userId: 'u1', reason: 'trust_score_drop',
  method: 'passkey', status: 'pending',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  createdAt: new Date().toISOString(), completedAt: null,
});

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes));
}

function b64url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function buildSignedCredential(
  challengeId: string,
  signingKey: CryptoKey,
): Promise<{ id: string; rawId: string; response: { authenticatorData: string; clientDataJSON: string; signature: string } }> {
  const clientDataObj = { type: 'webauthn.get', challenge: b64url(challengeId) };
  const clientDataJSONStr = JSON.stringify(clientDataObj);
  const clientDataB64 = btoa(clientDataJSONStr);
  const authData = new Uint8Array(37); // rpIdHash(32) + flags(1) + counter(4)
  const clientDataHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clientDataJSONStr));
  const signedData = new Uint8Array(authData.length + clientDataHash.byteLength);
  signedData.set(authData, 0);
  signedData.set(new Uint8Array(clientDataHash), authData.length);
  const sigBuf = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, signedData);
  return {
    id: 'cred_real', rawId: 'rawid',
    response: { authenticatorData: b64(authData), clientDataJSON: clientDataB64, signature: b64(sigBuf) },
  };
}

describe('createStepUpRoutes — passkey ECDSA P-256 round-trip (Sprint 39 line 96)', () => {
  it('happy path: real key + valid signature → 200 verified=true (covers step-up.ts lines 164-176)', async () => {
    const challengeId = 'ch_pk_happy';
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const spki = await crypto.subtle.exportKey('spki', kp.publicKey);
    const credential = await buildSignedCredential(challengeId, kp.privateKey);
    const state: State = { challenges: new Map(), statusUpdates: [], restoreTrustCalls: [] };
    state.challenges.set(challengeId, pending(challengeId));
    const app = buildApp({ storage: makeStorage(state), getPasskeyPublicKey: async () => spki });
    const res = await app.request('/step-up/complete', {
      method: 'POST', body: JSON.stringify({ challengeId, credential }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { verified: boolean; trustScore: number };
    expect(body.verified).toBe(true);
    expect(body.trustScore).toBe(100);
    // Side-effect: status moved to completed (covers line 109)
    expect(state.statusUpdates.some((u) => u.id === challengeId && u.status === 'completed')).toBe(true);
  });

  it('signature from a DIFFERENT key fails verify → 401 verification_failed (covers verify-returns-false branch at line 176)', async () => {
    const challengeId = 'ch_pk_wrongkey';
    const advertisedKp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const attackerKp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const spki = await crypto.subtle.exportKey('spki', advertisedKp.publicKey);
    // Sign with attacker's key, server expects advertised key's signature.
    const credential = await buildSignedCredential(challengeId, attackerKp.privateKey);
    const state: State = { challenges: new Map(), statusUpdates: [], restoreTrustCalls: [] };
    state.challenges.set(challengeId, pending(challengeId));
    const app = buildApp({ storage: makeStorage(state), getPasskeyPublicKey: async () => spki });
    const res = await app.request('/step-up/complete', {
      method: 'POST', body: JSON.stringify({ challengeId, credential }),
    });
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe('verification_failed');
  });

  it('credential missing signature field → 401 (covers step-up.ts line 153-154 missing-fields guard)', async () => {
    // The earliest exit branch inside verifyPasskeyCredential. Storage
    // returns a non-null public key so we enter the body, but the !sig
    // guard short-circuits before any crypto operations.
    const challengeId = 'ch_pk_nosig';
    const credential = { id: 'c', rawId: 'r', response: { authenticatorData: 'AA==', clientDataJSON: 'AA==' } };
    const state: State = { challenges: new Map(), statusUpdates: [], restoreTrustCalls: [] };
    state.challenges.set(challengeId, pending(challengeId));
    const app = buildApp({ storage: makeStorage(state), getPasskeyPublicKey: async () => new ArrayBuffer(91) });
    const res = await app.request('/step-up/complete', {
      method: 'POST', body: JSON.stringify({ challengeId, credential }),
    });
    expect(res.status).toBe(401);
  });
});
