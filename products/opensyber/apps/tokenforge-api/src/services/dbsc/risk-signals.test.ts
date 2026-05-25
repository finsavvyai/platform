import { describe, it, expect } from 'vitest';
import { computeRiskSignals, actionForSignals } from './risk-signals.js';

const baseInputs = {
  registeredCountry: 'US',
  currentCountry: 'US',
  registeredAsn: 'AS-FOO',
  currentAsn: 'AS-FOO',
  registeredUa: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
  currentUa: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
  lastRefreshAt: '2026-04-27T10:00:00.000Z',
  now: new Date('2026-04-27T10:05:00.000Z'),
};

describe('computeRiskSignals', () => {
  it('returns no signals for matching context', () => {
    expect(computeRiskSignals(baseInputs)).toEqual([]);
  });

  it('detects geo_drift when country differs', () => {
    expect(
      computeRiskSignals({ ...baseInputs, currentCountry: 'RU' }),
    ).toContain('geo_drift');
  });

  it('detects asn_change when ASN differs', () => {
    expect(
      computeRiskSignals({ ...baseInputs, currentAsn: 'AS-EVIL' }),
    ).toContain('asn_change');
  });

  it('detects ua_drift on heavy UA divergence', () => {
    expect(
      computeRiskSignals({
        ...baseInputs,
        currentUa: 'curl/8.0',
      }),
    ).toContain('ua_drift');
  });

  it('does not flag ua_drift on minor UA changes', () => {
    expect(
      computeRiskSignals({
        ...baseInputs,
        currentUa: baseInputs.registeredUa.replace('537.36', '537.37'),
      }),
    ).not.toContain('ua_drift');
  });

  it('detects replay_burst when last refresh was < 2s ago', () => {
    const last = new Date('2026-04-27T10:05:00.000Z');
    expect(
      computeRiskSignals({
        ...baseInputs,
        lastRefreshAt: last.toISOString(),
        now: new Date(last.getTime() + 500),
      }),
    ).toContain('replay_burst');
  });

  it('returns multiple signals concurrently', () => {
    const sigs = computeRiskSignals({
      ...baseInputs,
      currentCountry: 'RU',
      currentAsn: 'AS-EVIL',
    });
    expect(sigs).toEqual(expect.arrayContaining(['geo_drift', 'asn_change']));
  });

  it('skips checks when registration baseline is null', () => {
    expect(
      computeRiskSignals({
        ...baseInputs,
        registeredCountry: null,
        registeredAsn: null,
        registeredUa: null,
      }),
    ).toEqual([]);
  });
});

describe('actionForSignals', () => {
  it('allows when no signals', () => {
    expect(actionForSignals([])).toBe('allow');
  });

  it('steps up on a single signal', () => {
    expect(actionForSignals(['geo_drift'])).toBe('step_up');
  });

  it('blocks on two signals', () => {
    expect(actionForSignals(['geo_drift', 'asn_change'])).toBe('block');
  });

  it('always blocks on replay_burst regardless of count', () => {
    expect(actionForSignals(['replay_burst'])).toBe('block');
  });
});
