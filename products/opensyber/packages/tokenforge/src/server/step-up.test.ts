import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createStepUpRoutes } from './step-up.js';
import type { TokenForgeServerOptions } from '../shared/types.js';
import type { StepUpChallengeRecord } from './storage/interface.js';

const { mockVerifyTotp } = vi.hoisted(() => ({ mockVerifyTotp: vi.fn() }));
vi.mock('./totp.js', () => ({ verifyTotp: mockVerifyTotp }));

interface StorageState {
  recentCount: number;
  challenges: Map<string, StepUpChallengeRecord>;
  otps: Map<string, string>;
  restoreTrustCalls: Array<{ deviceId: string; userId: string }>;
  statusUpdates: Array<{ id: string; status: string }>;
}

function makeStorage(s: StorageState): TokenForgeServerOptions['storage'] {
  return {
    countRecentChallenges: vi.fn(async () => s.recentCount),
    createChallenge: vi.fn(async (c: StepUpChallengeRecord) => { s.challenges.set(c.id, c); }),
    getChallenge: vi.fn(async (id: string) => s.challenges.get(id) ?? null),
    storeOtp: vi.fn(async (id: string, otp: string) => { s.otps.set(id, otp); }),
    getOtp: vi.fn(async (id: string) => s.otps.get(id) ?? null),
    deleteOtp: vi.fn(async (id: string) => { s.otps.delete(id); }),
    updateChallengeStatus: vi.fn(async (id: string, status: string) => { s.statusUpdates.push({ id, status }); }),
    restoreTrust: vi.fn(async (deviceId: string, userId: string) => { s.restoreTrustCalls.push({ deviceId, userId }); }),
  } as unknown as TokenForgeServerOptions['storage'];
}

function buildApp(opts: Partial<TokenForgeServerOptions>, userId: string | null, sessionId: string | null) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (userId) c.set('userId', userId);
    if (sessionId) c.set('sessionId', sessionId);
    await next();
  });
  app.route('/step-up', createStepUpRoutes({ ...opts, storage: opts.storage } as TokenForgeServerOptions));
  return app;
}

const baseState = (): StorageState => ({
  recentCount: 0, challenges: new Map(), otps: new Map(),
  restoreTrustCalls: [], statusUpdates: [],
});

describe('createStepUpRoutes /initiate', () => {
  beforeEach(() => { mockVerifyTotp.mockReset(); });

  it('returns 401 unauthorized when userId/sessionId missing', async () => {
    const state = baseState();
    const app = buildApp({ storage: makeStorage(state) }, null, null);
    const res = await app.request('/step-up/initiate', {
      method: 'POST', body: JSON.stringify({ method: 'totp' }),
    });
    expect(res.status).toBe(401);
    expect((await res.json() as { error: string }).error).toBe('unauthorized');
  });

  it('returns 429 rate_limited when recent challenges exceed window', async () => {
    const state = { ...baseState(), recentCount: 5 };
    const app = buildApp({ storage: makeStorage(state) }, 'u1', 's1');
    const res = await app.request('/step-up/initiate', {
      method: 'POST', body: JSON.stringify({ method: 'totp' }),
    });
    expect(res.status).toBe(429);
    expect((await res.json() as { error: string }).error).toBe('rate_limited');
  });

  it('returns challengeId on totp happy path', async () => {
    const state = baseState();
    const app = buildApp({ storage: makeStorage(state) }, 'u1', 's1');
    const res = await app.request('/step-up/initiate', {
      method: 'POST', body: JSON.stringify({ method: 'totp' }),
    });
    const j = (await res.json()) as { challengeId: string; method: string; expiresAt: string };
    expect(j.method).toBe('totp');
    expect(j.challengeId).toBeTruthy();
    expect(state.challenges.has(j.challengeId)).toBe(true);
  });

  it('email_otp without sendEmail handler does NOT mark challenge completed', async () => {
    const state = baseState();
    const app = buildApp({ storage: makeStorage(state) }, 'u1', 's1');
    await app.request('/step-up/initiate', {
      method: 'POST', body: JSON.stringify({ method: 'email_otp' }),
    }).catch(() => undefined);
    expect(state.statusUpdates.find((u) => u.status === 'completed')).toBeUndefined();
  });

  it('returns webauthnChallenge for method=passkey', async () => {
    const state = baseState();
    const app = buildApp({ storage: makeStorage(state) }, 'u1', 's1');
    const res = await app.request('/step-up/initiate', {
      method: 'POST', body: JSON.stringify({ method: 'passkey' }),
    });
    const j = (await res.json()) as { method: string; webauthnChallenge: string };
    expect(j.method).toBe('passkey');
    expect(j.webauthnChallenge).toBeTruthy();
    expect(j.webauthnChallenge.length).toBeGreaterThan(20);
  });
});

describe('createStepUpRoutes /complete', () => {
  beforeEach(() => { mockVerifyTotp.mockReset(); });

  it('returns 400 invalid_challenge when storage has no record', async () => {
    const state = baseState();
    const app = buildApp({ storage: makeStorage(state) }, 'u1', 's1');
    const res = await app.request('/step-up/complete', {
      method: 'POST', body: JSON.stringify({ challengeId: 'no-such-id', code: '123456' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('invalid_challenge');
  });

  it('verifies email_otp and updates challenge to completed', async () => {
    const state = baseState();
    state.challenges.set('ch_1', {
      id: 'ch_1', sessionId: 's1', userId: 'u1',
      reason: 'trust_score_drop', method: 'email_otp', status: 'pending',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      createdAt: new Date().toISOString(), completedAt: null,
    });
    state.otps.set('ch_1', '123456');
    const app = buildApp({ storage: makeStorage(state) }, 'u1', 's1');
    const res = await app.request('/step-up/complete', {
      method: 'POST', body: JSON.stringify({ challengeId: 'ch_1', code: '123456' }),
    });
    const j = (await res.json()) as { verified: boolean; trustScore: number };
    expect(j.verified).toBe(true);
    expect(j.trustScore).toBe(100);
    expect(state.statusUpdates.find((u) => u.status === 'completed')).toBeDefined();
  });

  it('returns 401 verification_failed for totp with wrong code', async () => {
    mockVerifyTotp.mockResolvedValue(false);
    const state = baseState();
    state.challenges.set('ch_2', {
      id: 'ch_2', sessionId: 's1', userId: 'u1',
      reason: 'trust_score_drop', method: 'totp', status: 'pending',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      createdAt: new Date().toISOString(), completedAt: null,
    });
    const app = buildApp({ storage: makeStorage(state) }, 'u1', 's1');
    const res = await app.request('/step-up/complete', {
      method: 'POST', body: JSON.stringify({ challengeId: 'ch_2', code: '000000' }),
    });
    expect(res.status).toBe(401);
    expect((await res.json() as { error: string }).error).toBe('verification_failed');
    expect(state.statusUpdates.find((u) => u.status === 'failed')).toBeDefined();
  });

  const pendingChallenge = (over: Partial<StepUpChallengeRecord> = {}): StepUpChallengeRecord => ({
    id: 'ch_x', sessionId: 's1', userId: 'u1', reason: 'trust_score_drop',
    method: 'totp', status: 'pending',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date().toISOString(), completedAt: null, ...over,
  });

  it('/complete returns 401 unauthorized when userId is missing on the request', async () => {
    const app = buildApp({ storage: makeStorage(baseState()) }, null, null);
    const res = await app.request('/step-up/complete', { method: 'POST', body: '{}' });
    expect(res.status).toBe(401);
  });

  it('/complete returns 400 challenge_expired and marks status=expired when past expiresAt', async () => {
    const state = baseState();
    state.challenges.set('ch_e', pendingChallenge({ id: 'ch_e', expiresAt: new Date(Date.now() - 1000).toISOString() }));
    const app = buildApp({ storage: makeStorage(state) }, 'u1', 's1');
    const res = await app.request('/step-up/complete', {
      method: 'POST', body: JSON.stringify({ challengeId: 'ch_e', code: '000000' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toBe('challenge_expired');
    expect(state.statusUpdates.find((u) => u.status === 'expired')).toBeDefined();
  });

  it('/complete calls restoreTrust ONLY when X-TF-Device-ID header is present', async () => {
    mockVerifyTotp.mockResolvedValue(true);
    const state = baseState();
    state.challenges.set('ch_r', pendingChallenge({ id: 'ch_r' }));
    const app = buildApp({ storage: makeStorage(state) }, 'u1', 's1');
    // Without device-id header
    await app.request('/step-up/complete', {
      method: 'POST', body: JSON.stringify({ challengeId: 'ch_r', code: '111' }),
    });
    expect(state.restoreTrustCalls).toHaveLength(0);
    // With device-id header
    state.challenges.set('ch_r2', pendingChallenge({ id: 'ch_r2' }));
    await app.request('/step-up/complete', {
      method: 'POST',
      headers: { 'X-TF-Device-ID': 'dev_42' },
      body: JSON.stringify({ challengeId: 'ch_r2', code: '111' }),
    });
    expect(state.restoreTrustCalls).toEqual([{ deviceId: 'dev_42', userId: 'u1' }]);
  });
});
