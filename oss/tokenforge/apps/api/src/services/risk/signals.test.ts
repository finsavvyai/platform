import { describe, it, expect } from 'vitest';
import {
  asnChange,
  concurrentIpAnomaly,
  geoIpDelta,
  latencyDrift,
  replayWindowAnomaly,
  tlsExporterMismatch,
  userAgentDrift,
} from './signals.js';

describe('geoIpDelta', () => {
  it('flags a country change', () => {
    expect(geoIpDelta('US', 'IL')).toBe('geo_drift');
  });
  it('returns null for identical geo', () => {
    expect(geoIpDelta('IL', 'IL')).toBeNull();
  });
  it('returns null when either side is missing', () => {
    expect(geoIpDelta(null, 'IL')).toBeNull();
    expect(geoIpDelta('IL', null)).toBeNull();
  });
});

describe('asnChange', () => {
  it('flags ASN change', () => {
    expect(asnChange('AS15169', 'AS8075')).toBe('asn_change');
  });
  it('returns null for same ASN', () => {
    expect(asnChange('AS15169', 'AS15169')).toBeNull();
  });
});

describe('userAgentDrift', () => {
  it('returns null when only versions changed', () => {
    expect(
      userAgentDrift(
        'Mozilla/5.0 (Macintosh) Chrome/146.0.0',
        'Mozilla/5.0 (Macintosh) Chrome/145.0.0',
      ),
    ).toBeNull();
  });
  it('flags a major product change', () => {
    expect(
      userAgentDrift(
        'Mozilla/5.0 (Macintosh) Firefox/130.0',
        'Mozilla/5.0 (Macintosh) Chrome/146.0',
      ),
    ).toBe('ua_drift');
  });
  it('returns null when either side is missing', () => {
    expect(userAgentDrift(null, 'X')).toBeNull();
  });
});

describe('tlsExporterMismatch', () => {
  it('flags differing exporter values', () => {
    expect(tlsExporterMismatch('aaaa', 'bbbb')).toBe('tls_exporter_mismatch');
  });
  it('returns null when matching', () => {
    expect(tlsExporterMismatch('aaaa', 'aaaa')).toBeNull();
  });
  it('returns null when bound exporter is missing (runtime cannot bind)', () => {
    expect(tlsExporterMismatch(null, 'aaaa')).toBeNull();
  });
});

describe('replayWindowAnomaly', () => {
  it('flags a refresh within 5 seconds of the last', () => {
    const now = 1_000_000;
    expect(replayWindowAnomaly(now, now - 1500)).toBe('replay_window_anomaly');
  });
  it('returns null for refreshes spaced normally', () => {
    const now = 1_000_000;
    expect(replayWindowAnomaly(now, now - 60_000)).toBeNull();
  });
  it('returns null when there has been no refresh yet', () => {
    expect(replayWindowAnomaly(1_000_000, null)).toBeNull();
  });
});

describe('concurrentIpAnomaly', () => {
  it('flags a refresh from a different IP than recent', () => {
    expect(concurrentIpAnomaly('1.1.1.1', ['2.2.2.2'])).toBe('concurrent_ip_anomaly');
  });
  it('returns null when only the same IP appears', () => {
    expect(concurrentIpAnomaly('1.1.1.1', ['1.1.1.1', '1.1.1.1'])).toBeNull();
  });
  it('returns null when current IP is empty', () => {
    expect(concurrentIpAnomaly('', ['1.1.1.1'])).toBeNull();
  });
});

describe('latencyDrift', () => {
  it('flags > 3x baseline', () => {
    expect(latencyDrift(400, 100)).toBe('latency_drift');
  });
  it('returns null for normal latency', () => {
    expect(latencyDrift(120, 100)).toBeNull();
  });
  it('returns null when baseline is missing or zero', () => {
    expect(latencyDrift(400, null)).toBeNull();
    expect(latencyDrift(400, 0)).toBeNull();
  });
});
