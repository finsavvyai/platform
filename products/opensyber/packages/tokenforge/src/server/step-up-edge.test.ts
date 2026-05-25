/**
 * Edge-case coverage for createStepUpRoutes.
 * Lives in a sibling file because step-up.test.ts is already at the
 * 200L portfolio cap. Pins paths in /initiate (sendEmail wiring) and
 * /complete (OTP reuse, missing OTP, passkey-without-handler).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createStepUpRoutes } from './step-up.js';
import type { TokenForgeServerOptions } from '../shared/types.js';
import type { StepUpChallengeRecord } from './storage/interface.js';

const { mockVerifyTotp } = vi.hoisted(() => ({ mockVerifyTotp: vi.fn() }));
vi.mock('./totp.js', () => ({ verifyTotp: mockVerifyTotp }));

interface State {
  recentCount: number;
  challenges: Map<string, StepUpChallengeRecord>;
  otps: Map<string, string>;
  deletedOtps: string[];
  statusUpdates: Array<{ id: string; status: string }>;
  restoreTrustCalls: Array<{ deviceId: string; userId: string }>;
}

const baseState = (): State => ({
  recentCount: 0, challenges: new Map(), otps: new Map(),
  deletedOtps: [], statusUpdates: [], restoreTrustCalls: [],
});

function makeStorage(s: State): TokenForgeServerOptions['storage'] {
  return {
    countRecentChallenges: vi.fn(async () => s.recentCount),
    createChallenge: vi.fn(async (c: StepUpChallengeRecord) => { s.challenges.set(c.id, c); }),
    getChallenge: vi.fn(async (id: string) => s.challenges.get(id) ?? null),
    storeOtp: vi.fn(async (id: string, otp: string) => { s.otps.set(id, otp); }),
    getOtp: vi.fn(async (id: string) => s.otps.get(id) ?? null),
    deleteOtp: vi.fn(async (id: string) => { s.deletedOtps.push(id); s.otps.delete(id); }),
    updateChallengeStatus: vi.fn(async (id: string, status: string) => { s.statusUpdates.push({ id, status }); }),
    restoreTrust: vi.fn(async (deviceId: string, userId: string) => { s.restoreTrustCalls.push({ deviceId, userId }); }),
  } as unknown as TokenForgeServerOptions['storage'];
}

function buildApp(opts: Partial<TokenForgeServerOptions>, userId = 'u1', sessionId = 's1') {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (userId) c.set('userId', userId);
    if (sessionId) c.set('sessionId', sessionId);
    await next();
  });
  app.route('/step-up', createStepUpRoutes({ ...opts, storage: opts.storage } as TokenForgeServerOptions));
  return app;
}

const pending = (over: Partial<StepUpChallengeRecord>): StepUpChallengeRecord => ({
  id: 'ch_x', sessionId: 's1', userId: 'u1', reason: 'trust_score_drop',
  method: 'totp', status: 'pending',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  createdAt: new Date().toISOString(), completedAt: null, ...over,
});

describe('createStepUpRoutes — /initiate sendEmail wiring', () => {
  beforeEach(() => { mockVerifyTotp.mockReset(); });

  it('calls sendEmail with userId + 6-digit OTP for method=email_otp', async () => {
    const state = baseState();
    const sendEmail = vi.fn(async () => undefined);
    const app = buildApp({ storage: makeStorage(state), sendEmail });
    const res = await app.request('/step-up/initiate', {
      method: 'POST', body: JSON.stringify({ method: 'email_otp' }),
    });
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [calledUserId, calledOtp] = sendEmail.mock.calls[0]!;
    expect(calledUserId).toBe('u1');
    expect(calledOtp).toMatch(/^\d{6}$/);
    // OTP also persisted under the new challenge id
    expect(state.otps.size).toBe(1);
    const persistedOtp = Array.from(state.otps.values())[0];
    expect(persistedOtp).toBe(calledOtp);
  });
});

describe('createStepUpRoutes — /complete edge cases', () => {
  beforeEach(() => { mockVerifyTotp.mockReset(); });

  it('email_otp success deletes the stored OTP (anti-reuse)', async () => {
    const state = baseState();
    state.challenges.set('ch_1', pending({ id: 'ch_1', method: 'email_otp' }));
    state.otps.set('ch_1', '123456');
    const app = buildApp({ storage: makeStorage(state) });
    const res = await app.request('/step-up/complete', {
      method: 'POST', body: JSON.stringify({ challengeId: 'ch_1', code: '123456' }),
    });
    expect(res.status).toBe(200);
    expect(state.deletedOtps).toEqual(['ch_1']);
    expect(state.otps.has('ch_1')).toBe(false);
  });

  it('email_otp with WRONG code → 401 verification_failed + status=failed (does NOT delete OTP)', async () => {
    const state = baseState();
    state.challenges.set('ch_2', pending({ id: 'ch_2', method: 'email_otp' }));
    state.otps.set('ch_2', '123456');
    const app = buildApp({ storage: makeStorage(state) });
    const res = await app.request('/step-up/complete', {
      method: 'POST', body: JSON.stringify({ challengeId: 'ch_2', code: '000000' }),
    });
    expect(res.status).toBe(401);
    expect(state.statusUpdates.find((u) => u.status === 'failed')).toBeDefined();
    // Wrong-code attempts must NOT consume the OTP — that would let an
    // attacker burn legitimate codes with one wrong guess.
    expect(state.deletedOtps).toEqual([]);
    expect(state.otps.has('ch_2')).toBe(true);
  });

  it('email_otp with no stored OTP (storeOtp gap) → 401 verification_failed', async () => {
    const state = baseState();
    state.challenges.set('ch_3', pending({ id: 'ch_3', method: 'email_otp' }));
    // OTP was NOT seeded — simulates a storeOtp persistence gap
    const app = buildApp({ storage: makeStorage(state) });
    const res = await app.request('/step-up/complete', {
      method: 'POST', body: JSON.stringify({ challengeId: 'ch_3', code: '123456' }),
    });
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe('verification_failed');
  });

  it('passkey without getPasskeyPublicKey handler → 401 verification_failed', async () => {
    const state = baseState();
    state.challenges.set('ch_4', pending({ id: 'ch_4', method: 'passkey' }));
    const credential = {
      id: 'cred_1', rawId: 'rawid',
      response: { authenticatorData: 'AA==', clientDataJSON: 'AA==', signature: 'AA==' },
    };
    // No getPasskeyPublicKey provided → storedKey stays null → verified=false
    const app = buildApp({ storage: makeStorage(state) });
    const res = await app.request('/step-up/complete', {
      method: 'POST', body: JSON.stringify({ challengeId: 'ch_4', credential }),
    });
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe('verification_failed');
  });

  it('passkey method without credential field → 401 verification_failed (no key lookup attempted)', async () => {
    const state = baseState();
    state.challenges.set('ch_5', pending({ id: 'ch_5', method: 'passkey' }));
    const getPasskeyPublicKey = vi.fn();
    const app = buildApp({ storage: makeStorage(state), getPasskeyPublicKey });
    const res = await app.request('/step-up/complete', {
      method: 'POST', body: JSON.stringify({ challengeId: 'ch_5' }),
    });
    expect(res.status).toBe(401);
    expect(getPasskeyPublicKey).not.toHaveBeenCalled();
  });

  it('passkey with stored key + credential clientDataJSON of WRONG type (webauthn.create) → false', async () => {
    // Sprint 39 line 96 coverage: hits verifyPasskeyCredential body up to
    // line 159 (clientData.type check). storedKey is non-null so the
    // body actually executes.
    const state = baseState();
    state.challenges.set('ch_pk1', pending({ id: 'ch_pk1', method: 'passkey' }));
    const cd = btoa(JSON.stringify({ type: 'webauthn.create', challenge: 'x' }));
    const credential = { id: 'c', rawId: 'r', response: { authenticatorData: 'AA==', clientDataJSON: cd, signature: 'AA==' } };
    const app = buildApp({ storage: makeStorage(state), getPasskeyPublicKey: async () => new ArrayBuffer(91) });
    const res = await app.request('/step-up/complete', {
      method: 'POST', body: JSON.stringify({ challengeId: 'ch_pk1', credential }),
    });
    expect(res.status).toBe(401);
  });

  it('passkey with stored key + malformed clientDataJSON triggers catch block (177-178) → false', async () => {
    // base64 decodes to a non-JSON string so JSON.parse throws → caught at
    // line 177, returns false. Covers the catch fallback explicitly.
    const state = baseState();
    state.challenges.set('ch_pk2', pending({ id: 'ch_pk2', method: 'passkey' }));
    const credential = { id: 'c', rawId: 'r', response: { authenticatorData: 'AA==', clientDataJSON: btoa('not-json{'), signature: 'AA==' } };
    const app = buildApp({ storage: makeStorage(state), getPasskeyPublicKey: async () => new ArrayBuffer(91) });
    const res = await app.request('/step-up/complete', {
      method: 'POST', body: JSON.stringify({ challengeId: 'ch_pk2', credential }),
    });
    expect(res.status).toBe(401);
  });

  it('passkey with stored key + valid type but WRONG challenge → false (line 161-162 check)', async () => {
    const state = baseState();
    state.challenges.set('ch_pk3', pending({ id: 'ch_pk3', method: 'passkey' }));
    // Valid type, but the challenge inside clientData decodes to a different
    // string than expectedChallenge (which is challengeId 'ch_pk3').
    const cd = btoa(JSON.stringify({ type: 'webauthn.get', challenge: btoa('different-challenge') }));
    const credential = { id: 'c', rawId: 'r', response: { authenticatorData: 'AA==', clientDataJSON: cd, signature: 'AA==' } };
    const app = buildApp({ storage: makeStorage(state), getPasskeyPublicKey: async () => new ArrayBuffer(91) });
    const res = await app.request('/step-up/complete', {
      method: 'POST', body: JSON.stringify({ challengeId: 'ch_pk3', credential }),
    });
    expect(res.status).toBe(401);
  });
});
