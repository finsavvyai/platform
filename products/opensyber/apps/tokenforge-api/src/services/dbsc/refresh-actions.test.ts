import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeRefreshAction,
  fireActionWebhooks,
  type RefreshActionInput,
  type FireWebhooksCtx,
} from './refresh-actions.js';
import type { Variables } from '../../types.js';

type DbLike = Variables['db'];

const { mockDispatchWebhook } = vi.hoisted(() => ({
  mockDispatchWebhook: vi.fn(async () => undefined),
}));
vi.mock('../webhook-dispatch.js', () => ({ dispatchWebhook: mockDispatchWebhook }));

function makeDb(policyRows: Array<Record<string, unknown>> = []): DbLike {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(async () => policyRows),
        })),
      })),
    })),
  } as unknown as DbLike;
}

const NOW = new Date('2026-05-04T00:00:00Z');

const baseSession = (over: Partial<RefreshActionInput['session']> = {}): RefreshActionInput['session'] => ({
  id: 'tf-dbsc-1',
  deviceId: 'dev_1',
  attestation: JSON.stringify({ country: 'US', asn: '12345', ua: 'Mozilla/5.0 TestAgent' }),
  boundCookieIssuedAt: new Date(NOW.getTime() - 60_000).toISOString(),
  ...over,
});

const baseInput = (over: Partial<RefreshActionInput> = {}): RefreshActionInput => ({
  db: makeDb(),
  tenantId: 't1',
  session: baseSession(),
  geoCountry: 'US',
  asn: '12345',
  userAgent: 'Mozilla/5.0 TestAgent',
  now: NOW,
  ...over,
});

describe('computeRefreshAction', () => {
  it('returns action=allow with empty signals when nothing drifts and no policies match', async () => {
    const result = await computeRefreshAction(baseInput());
    expect(result.action).toBe('allow');
    expect(result.signals).toEqual([]);
  });

  it('detects country drift via attestation vs current geoCountry', async () => {
    const result = await computeRefreshAction(baseInput({ geoCountry: 'RU' }));
    // risk-signals will produce at least one signal for country drift; the
    // exact action depends on actionForSignals weighting, so we assert
    // signals were emitted rather than a specific action grade
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it('does not crash when attestation JSON is malformed (extractField fails open)', async () => {
    const result = await computeRefreshAction(
      baseInput({ session: baseSession({ attestation: '{not-json' }) }),
    );
    expect(result.action).toBeDefined();
    // signals computed against null registered fields — drift fields show up
    expect(Array.isArray(result.signals)).toBe(true);
  });

  it('treats null attestation as no baseline (fields read as null)', async () => {
    const result = await computeRefreshAction(
      baseInput({ session: baseSession({ attestation: null }) }),
    );
    expect(result.action).toBeDefined();
  });

  it('combines policy verdict with risk-signal verdict via combineActions (policy block wins)', async () => {
    // Seed a policy that always returns 'block' on its first if_any
    const blockPolicy = {
      id: 'p1', tenantId: 't1', name: 'block-all',
      rules: JSON.stringify({ if_any: [{ binding_class: 'webcrypto' }], then: 'block' }),
      priority: 1, enabled: true,
    };
    const result = await computeRefreshAction(
      baseInput({ db: makeDb([blockPolicy]) }),
    );
    expect(result.action).toBe('block');
  });

  describe('bindingClass resolution (Sprint 37 device-bound policy)', () => {
    const policy = (rules: object, then: string, priority = 1): Record<string, unknown> => ({
      id: `p-${priority}`, tenantId: 't1', name: `pol-${priority}`,
      rules: JSON.stringify({ ...rules, then }), priority, enabled: true,
    });
    const onClass = (cls: string, then: string, priority = 1): Record<string, unknown> =>
      policy({ if_any: [{ binding_class: cls }] }, then, priority);

    it('explicit input.bindingClass=native_dbsc fires native_dbsc-scoped policies', async () => {
      const result = await computeRefreshAction(baseInput({
        db: makeDb([onClass('native_dbsc', 'allow', 1), onClass('webcrypto', 'step_up', 2)]),
        bindingClass: 'native_dbsc',
      }));
      expect(result.action).toBe('allow');
    });

    it('attestation.bindingClass takes effect when input does not override', async () => {
      const result = await computeRefreshAction(baseInput({
        db: makeDb([onClass('webauthn', 'step_up')]),
        session: baseSession({
          attestation: JSON.stringify({ country: 'US', asn: '12345', ua: 'Mozilla/5.0 TestAgent', bindingClass: 'webauthn' }),
        }),
      }));
      expect(result.action).toBe('step_up');
    });

    it('falls back to webcrypto default when neither input nor attestation specifies', async () => {
      // 'webcrypto' policy fires (allow), 'native_dbsc' block does not.
      const result = await computeRefreshAction(baseInput({
        db: makeDb([onClass('webcrypto', 'allow', 1), onClass('native_dbsc', 'block', 2)]),
      }));
      expect(result.action).toBe('allow');
    });

    it('rejects unknown attestation.bindingClass values (falls back to webcrypto)', async () => {
      const result = await computeRefreshAction(baseInput({
        db: makeDb([onClass('native_dbsc', 'block')]),
        session: baseSession({ attestation: JSON.stringify({ bindingClass: 'made-up-string' }) }),
      }));
      expect(result.action).toBe('allow');
    });
  });
});

describe('fireActionWebhooks', () => {
  let ctx: FireWebhooksCtx;
  let waitUntilCalls: Array<Promise<unknown>>;

  beforeEach(() => {
    mockDispatchWebhook.mockClear();
    waitUntilCalls = [];
    ctx = {
      db: makeDb(),
      tenantId: 't1',
      sessionId: 'tf-dbsc-1',
      deviceId: 'dev_1',
      waitUntil: (p) => { waitUntilCalls.push(p); },
    };
  });

  it('dispatches zero webhooks when action=allow and no signals', () => {
    fireActionWebhooks(ctx, 'allow', []);
    expect(waitUntilCalls).toHaveLength(0);
  });

  it('dispatches dbsc.risk_signal when signals present (action=allow)', async () => {
    fireActionWebhooks(ctx, 'allow', [{ kind: 'country_drift' }]);
    await Promise.all(waitUntilCalls);
    expect(mockDispatchWebhook).toHaveBeenCalledTimes(1);
    expect(mockDispatchWebhook.mock.calls[0]![2]).toBe('dbsc.risk_signal');
  });

  it('dispatches risk_signal + policy_block when action=block with signals', async () => {
    fireActionWebhooks(ctx, 'block', [{ kind: 'asn_drift' }], 'risk_block');
    await Promise.all(waitUntilCalls);
    expect(mockDispatchWebhook).toHaveBeenCalledTimes(2);
    const events = mockDispatchWebhook.mock.calls.map((c) => c[2]);
    expect(events).toContain('dbsc.risk_signal');
    expect(events).toContain('dbsc.policy_block');
  });

  it('dispatches dbsc.session_revoked when action=revoke_session', async () => {
    fireActionWebhooks(ctx, 'revoke_session', [], 'policy_revoke');
    await Promise.all(waitUntilCalls);
    const events = mockDispatchWebhook.mock.calls.map((c) => c[2]);
    expect(events).toContain('dbsc.session_revoked');
    // Last call's payload includes the reason
    const revokeCall = mockDispatchWebhook.mock.calls.find((c) => c[2] === 'dbsc.session_revoked');
    expect((revokeCall![3] as { reason?: string }).reason).toBe('policy_revoke');
  });

  it('dispatches dbsc.session_step_up when action=step_up (no risk_signal if no signals)', async () => {
    fireActionWebhooks(ctx, 'step_up', []);
    await Promise.all(waitUntilCalls);
    const events = mockDispatchWebhook.mock.calls.map((c) => c[2]);
    expect(events).toEqual(['dbsc.session_step_up']);
  });
});
