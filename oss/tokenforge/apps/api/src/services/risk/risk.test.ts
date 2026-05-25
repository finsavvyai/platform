import { describe, it, expect } from 'vitest';
import { computeSignals } from './index.js';

const baseInput = {
  now: new Date('2026-04-30T10:00:00Z'),
  current: {
    ip: '1.1.1.1',
    geo: 'US',
    asn: 'AS15169',
    userAgent: 'Mozilla/5.0 Chrome/146',
    tlsExporter: 'aaaa',
    rttMs: 100,
  },
  baseline: {
    ipFirst: '1.1.1.1',
    geoFirst: 'US',
    asnFirst: 'AS15169',
    userAgentFirst: 'Mozilla/5.0 Chrome/146',
    tlsExporterBound: 'aaaa',
    lastRefreshAt: new Date('2026-04-30T09:55:00Z'),
    baselineRttMs: 100,
    recentIps: ['1.1.1.1'],
  },
};

describe('computeSignals', () => {
  it('returns no signals for a clean refresh', () => {
    const r = computeSignals(baseInput);
    expect(r.signals).toEqual([]);
    expect(r.action).toBe('allow');
  });

  it('emits geo_drift for a country change without escalating', () => {
    const r = computeSignals({
      ...baseInput,
      current: { ...baseInput.current, geo: 'CN' },
    });
    expect(r.signals).toContain('geo_drift');
    expect(r.action).toBe('allow');
  });

  it('escalates to step_up on tls_exporter_mismatch', () => {
    const r = computeSignals({
      ...baseInput,
      baseline: { ...baseInput.baseline, tlsExporterBound: 'old' },
    });
    expect(r.signals).toContain('tls_exporter_mismatch');
    expect(r.action).toBe('step_up');
  });

  it('escalates to step_up on concurrent_ip_anomaly', () => {
    const r = computeSignals({
      ...baseInput,
      baseline: { ...baseInput.baseline, recentIps: ['9.9.9.9'] },
    });
    expect(r.signals).toContain('concurrent_ip_anomaly');
    expect(r.action).toBe('step_up');
  });

  it('blocks when 4+ signals coincide', () => {
    const r = computeSignals({
      now: baseInput.now,
      current: {
        ip: '2.2.2.2', geo: 'CN', asn: 'AS8075',
        userAgent: 'Mozilla/5.0 Firefox/130',
        tlsExporter: 'evil', rttMs: 600,
      },
      baseline: {
        ...baseInput.baseline,
        recentIps: ['1.1.1.1'],
      },
    });
    expect(r.signals.length).toBeGreaterThanOrEqual(4);
    expect(r.action).toBe('block');
  });
});
