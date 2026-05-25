import { describe, it, expect } from 'vitest';
import {
  evaluatePolicy,
  evaluatePolicies,
  combineActions,
  parsePolicyRules,
  type PolicyContext,
  type Policy,
  type Rule,
} from './policy.js';

const baseCtx: PolicyContext = {
  geoCountry: 'US',
  asn: 'AS-COMCAST',
  bindingClass: 'webcrypto',
  signals: [],
  sensitivePath: false,
  isoHour: 14,
};

describe('evaluatePolicy', () => {
  it('returns allow when no rules match', () => {
    const p: Policy = { if_any: [{ geo_country_in: ['RU'] }], then: 'block' };
    expect(evaluatePolicy(p, baseCtx)).toBe('allow');
  });

  it('returns then when if_any rule matches', () => {
    const p: Policy = { if_any: [{ geo_country_in: ['US', 'CA'] }], then: 'step_up' };
    expect(evaluatePolicy(p, baseCtx)).toBe('step_up');
  });

  it('requires every rule for if_all', () => {
    const p: Policy = {
      if_all: [{ geo_country_in: ['US'] }, { binding_class: 'webcrypto' }],
      then: 'step_up',
    };
    expect(evaluatePolicy(p, baseCtx)).toBe('step_up');
    expect(evaluatePolicy(p, { ...baseCtx, bindingClass: 'webauthn' })).toBe('allow');
  });

  it('handles geo_country_not_in', () => {
    const p: Policy = { if_any: [{ geo_country_not_in: ['US'] }], then: 'block' };
    expect(evaluatePolicy(p, baseCtx)).toBe('allow');
    expect(evaluatePolicy(p, { ...baseCtx, geoCountry: 'RU' })).toBe('block');
  });

  it('Sprint 36 line 60: evalRule fallthrough — unknown rule shape returns false (forward-compat defensive guard at policy.ts:110)', () => {
    // 7 known rule discriminators (geo_country_in/not_in, asn_in,
    // binding_class, has_signal, sensitive_path, hour_between). A rule
    // that matches none falls through to `return false` — pin that
    // contract so a future rule-type addition gets a fresh false until
    // explicitly handled. Triggers via if_any with an empty rule cast.
    const p: Policy = { if_any: [{} as Rule], then: 'block' };
    expect(evaluatePolicy(p, baseCtx)).toBe('allow');
  });

  it('Sprint 36 line 57: tenant policy `geo!=IL` blocks US request (geo_country_not_in: ["IL"] against geoCountry=US → block)', () => {
    // Spec-traceable named pin for the IL allow-list scenario. The
    // "even with valid signature" half is structural: combineActions /
    // evaluatePolicies (lines 101+114) already pin block-beats-allow,
    // so a sig-allow decision can never override this policy's block.
    const p: Policy = { if_any: [{ geo_country_not_in: ['IL'] }], then: 'block' };
    expect(evaluatePolicy(p, baseCtx)).toBe('block');
    expect(evaluatePolicy(p, { ...baseCtx, geoCountry: 'IL' })).toBe('allow');
  });

  it('handles has_signal', () => {
    const p: Policy = { if_any: [{ has_signal: 'replay_burst' }], then: 'revoke_session' };
    expect(evaluatePolicy(p, baseCtx)).toBe('allow');
    expect(evaluatePolicy(p, { ...baseCtx, signals: ['replay_burst'] })).toBe('revoke_session');
  });

  it('handles hour_between with wrap-around (overnight window)', () => {
    const p: Policy = { if_any: [{ hour_between: [22, 6] }], then: 'step_up' };
    expect(evaluatePolicy(p, { ...baseCtx, isoHour: 23 })).toBe('step_up');
    expect(evaluatePolicy(p, { ...baseCtx, isoHour: 3 })).toBe('step_up');
    expect(evaluatePolicy(p, { ...baseCtx, isoHour: 14 })).toBe('allow');
  });

  it('handles hour_between for daytime window', () => {
    const p: Policy = { if_any: [{ hour_between: [9, 17] }], then: 'allow' };
    expect(evaluatePolicy(p, { ...baseCtx, isoHour: 12 })).toBe('allow');
    expect(evaluatePolicy(p, { ...baseCtx, isoHour: 17 })).toBe('allow');
  });

  it('treats empty rules as always-true (default policy)', () => {
    const p: Policy = { then: 'step_up' };
    expect(evaluatePolicy(p, baseCtx)).toBe('step_up');
  });

  it('handles asn_in rule (network-level blocklist for known-bad ASNs)', () => {
    const p: Policy = { if_any: [{ asn_in: ['AS-TOR-EXIT', 'AS-VPN-PROVIDER'] }], then: 'block' };
    expect(evaluatePolicy(p, baseCtx)).toBe('allow'); // baseCtx asn = AS-COMCAST
    expect(evaluatePolicy(p, { ...baseCtx, asn: 'AS-TOR-EXIT' })).toBe('block');
  });

  it('handles sensitive_path rule (per-route step-up trigger)', () => {
    // Combined with route classification: sensitive_path=true + low trust → step_up
    const p: Policy = { if_any: [{ sensitive_path: true }], then: 'step_up' };
    expect(evaluatePolicy(p, baseCtx)).toBe('allow');
    expect(evaluatePolicy(p, { ...baseCtx, sensitivePath: true })).toBe('step_up');
  });

  it('rejects null geoCountry against geo_country_in (does NOT match — fail-closed)', () => {
    // A request with no resolved geo (no cf-ipcountry header) must NOT
    // satisfy a "match countries IL/US" rule by being absent from it.
    // The source returns false for null geoCountry, which means downstream
    // policy combinators treat it as "no match" — i.e., default to allow
    // unless other rules fire. Pinning the null-handling protects against
    // a refactor that treats null as a wildcard match.
    const p: Policy = { if_any: [{ geo_country_in: ['IL', 'US'] }], then: 'block' };
    expect(evaluatePolicy(p, { ...baseCtx, geoCountry: null })).toBe('allow');
  });

  it('handles geo_country_not_in with null geoCountry (also no match — fail-closed)', () => {
    const p: Policy = { if_any: [{ geo_country_not_in: ['IL'] }], then: 'block' };
    expect(evaluatePolicy(p, { ...baseCtx, geoCountry: null })).toBe('allow');
  });
});

describe('combineActions', () => {
  it('block beats step_up beats allow', () => {
    expect(combineActions('allow', 'step_up')).toBe('step_up');
    expect(combineActions('step_up', 'block')).toBe('block');
    expect(combineActions('block', 'step_up')).toBe('block');
  });

  it('revoke_session beats step_up but loses to block', () => {
    expect(combineActions('step_up', 'revoke_session')).toBe('revoke_session');
    expect(combineActions('revoke_session', 'block')).toBe('block');
  });
});

describe('evaluatePolicies', () => {
  it('returns the most restrictive verdict across policies', () => {
    const policies: Policy[] = [
      { if_any: [{ geo_country_in: ['US'] }], then: 'step_up' },
      { if_any: [{ has_signal: 'replay_burst' }], then: 'block' },
    ];
    const ctx: PolicyContext = { ...baseCtx, signals: ['replay_burst'] };
    expect(evaluatePolicies(policies, ctx)).toBe('block');
  });

  it('returns allow when no policy fires', () => {
    const policies: Policy[] = [
      { if_any: [{ geo_country_in: ['RU'] }], then: 'block' },
      { if_any: [{ binding_class: 'native_dbsc' }], then: 'step_up' },
    ];
    expect(evaluatePolicies(policies, baseCtx)).toBe('allow');
  });

  it('returns allow for an empty policy list', () => {
    expect(evaluatePolicies([], baseCtx)).toBe('allow');
  });
});

describe('parsePolicyRules', () => {
  it('parses a valid policy', () => {
    const raw = JSON.stringify({ if_any: [{ geo_country_in: ['US'] }], then: 'step_up' });
    const parsed = parsePolicyRules(raw);
    expect(parsed?.then).toBe('step_up');
  });

  it('rejects malformed JSON', () => {
    expect(parsePolicyRules('{ not json')).toBeNull();
  });

  it('rejects unknown action', () => {
    const raw = JSON.stringify({ then: 'destroy_universe' });
    expect(parsePolicyRules(raw)).toBeNull();
  });

  it('rejects non-array if_any', () => {
    const raw = JSON.stringify({ if_any: 'nope', then: 'allow' });
    expect(parsePolicyRules(raw)).toBeNull();
  });
});
