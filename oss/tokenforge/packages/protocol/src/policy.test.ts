import { describe, it, expect } from 'vitest';
import { evaluatePolicy, reconcilePolicy, type PolicyDocument } from './policy.js';

const baseCtx = {
  geoCountry: 'US',
  asn: 'AS15169',
  bindingClass: 'webcrypto' as const,
  sensitivePath: false,
  concurrentIps: 1,
  signals: [] as string[],
};

describe('evaluatePolicy', () => {
  it('returns default action when nothing matches', () => {
    const doc: PolicyDocument = {
      rules: [{ if_any: [{ geo_country_in: ['CN'] }], then: 'block' }],
      default: 'allow',
    };
    expect(evaluatePolicy(doc, baseCtx).action).toBe('allow');
  });

  it('matches a single geo_country_in clause', () => {
    const doc: PolicyDocument = {
      rules: [{ if_any: [{ geo_country_in: ['US', 'CA'] }], then: 'step_up' }],
    };
    const r = evaluatePolicy(doc, baseCtx);
    expect(r.action).toBe('step_up');
    expect(r.matchedRule).toBe(0);
  });

  it('honors if_all conjunction', () => {
    const doc: PolicyDocument = {
      rules: [{
        if_all: [
          { binding_class: 'webcrypto' },
          { signal: 'geo_drift' },
        ],
        then: 'block',
      }],
    };
    expect(evaluatePolicy(doc, baseCtx).action).toBe('allow');
    expect(evaluatePolicy(doc, { ...baseCtx, signals: ['geo_drift'] }).action).toBe('block');
  });

  it('handles concurrent_ips_gt threshold', () => {
    const doc: PolicyDocument = {
      rules: [{ if_any: [{ concurrent_ips_gt: 1 }], then: 'block' }],
    };
    expect(evaluatePolicy(doc, { ...baseCtx, concurrentIps: 1 }).action).toBe('allow');
    expect(evaluatePolicy(doc, { ...baseCtx, concurrentIps: 2 }).action).toBe('block');
  });

  it('honors nested `and` conjunction inside a clause', () => {
    const doc: PolicyDocument = {
      rules: [{
        if_any: [{
          binding_class: 'webcrypto',
          and: { geo_country_in: ['CN'] },
        }],
        then: 'step_up',
      }],
    };
    expect(evaluatePolicy(doc, { ...baseCtx, geoCountry: 'CN' }).action).toBe('step_up');
    expect(evaluatePolicy(doc, baseCtx).action).toBe('allow');
  });

  it('returns the first matching rule', () => {
    const doc: PolicyDocument = {
      rules: [
        { if_any: [{ geo_country_in: ['US'] }], then: 'step_up' },
        { if_any: [{ geo_country_in: ['US'] }], then: 'block' },
      ],
    };
    const r = evaluatePolicy(doc, baseCtx);
    expect(r.action).toBe('step_up');
    expect(r.matchedRule).toBe(0);
  });

  it('rejects clauses where the context field is missing', () => {
    const doc: PolicyDocument = {
      rules: [{ if_any: [{ geo_country_in: ['US'] }], then: 'block' }],
    };
    expect(evaluatePolicy(doc, { ...baseCtx, geoCountry: null }).action).toBe('allow');
  });

  it('matches asn_in', () => {
    const doc: PolicyDocument = {
      rules: [{ if_any: [{ asn_in: ['AS15169'] }], then: 'step_up' }],
    };
    expect(evaluatePolicy(doc, baseCtx).action).toBe('step_up');
  });
});

describe('reconcilePolicy', () => {
  it('keeps the stricter of the two', () => {
    expect(reconcilePolicy('allow', 'step_up')).toBe('step_up');
    expect(reconcilePolicy('step_up', 'block')).toBe('block');
    expect(reconcilePolicy('block', 'allow')).toBe('block');
    expect(reconcilePolicy('revoke_session', 'block')).toBe('revoke_session');
  });

  it('returns the policy decision when equal severity', () => {
    expect(reconcilePolicy('step_up', 'step_up')).toBe('step_up');
  });
});
