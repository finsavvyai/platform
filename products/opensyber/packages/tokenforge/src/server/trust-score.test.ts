import { describe, it, expect } from 'vitest';
import { TrustScoreEngine, hashFingerprint } from './trust-score.js';
import { makeSignals } from './trust-score-fixtures.js';
import type { TrustSignals } from '../shared/types.js';

const engine = new TrustScoreEngine();
const score = (o: Partial<TrustSignals> = {}) => engine.compute(makeSignals(o));
const reasons = (o: Partial<TrustSignals> = {}) => engine.getDropReasons(makeSignals(o));
const breakdown = (o: Partial<TrustSignals> = {}) => engine.computeBreakdown(makeSignals(o));

describe('TrustScoreEngine', () => {
  describe('compute()', () => {
    it('returns 100 for perfect signals', () => {
      expect(score()).toBe(100);
    });

    it('drops 40 points for invalid signature', () => {
      expect(score({ signatureValid: false })).toBe(60);
    });

    it('drops 15 points for completely different IP', () => {
      expect(score({ ipAddress: '10.0.0.1' })).toBe(85);
    });

    it('drops only 5 points for same-subnet IP change', () => {
      // same subnet: 10 out of 15 => 100 - 5 = 95
      expect(score({ ipAddress: '192.168.1.99' })).toBe(95);
    });

    it('drops 15 points for changed country', () => {
      expect(score({ countryCode: 'DE' })).toBe(85);
    });

    it('drops 10 points for changed device fingerprint', () => {
      expect(score({ originalFingerprint: 'different-fp' })).toBe(90);
    });

    it('reduces velocity score for session age >12h', () => {
      const now = 50000;
      // velocity drops from 10 to 7 => 100 - 3 = 97
      expect(score({ requestTimestamp: now, sessionCreatedAt: now - 13 * 3600 })).toBe(97);
    });

    it('reduces velocity score further for session age >20h', () => {
      const now = 100000;
      // velocity drops from 10 to 5 => 100 - 5 = 95
      expect(score({ requestTimestamp: now, sessionCreatedAt: now - 21 * 3600 })).toBe(95);
    });

    it('accumulates multiple drops', () => {
      // -40 sig -15 ip -15 geo = 30
      expect(
        score({ signatureValid: false, ipAddress: '10.0.0.1', countryCode: 'JP' }),
      ).toBe(30);
    });
  });

  describe('getDropReasons()', () => {
    it('returns empty array for perfect signals', () => {
      expect(reasons()).toEqual([]);
    });

    it('returns invalid_signature reason', () => {
      expect(reasons({ signatureValid: false })).toContain('invalid_signature');
    });

    it('returns ip_changed reason', () => {
      expect(reasons({ ipAddress: '10.0.0.1' })).toContain('ip_changed');
    });

    it('does not include ip_changed for same-subnet', () => {
      expect(reasons({ ipAddress: '192.168.1.55' })).not.toContain('ip_changed');
    });

    it('returns geo_changed reason', () => {
      expect(reasons({ countryCode: 'FR' })).toContain('geo_changed');
    });

    it('returns device_fingerprint_changed reason', () => {
      expect(reasons({ originalFingerprint: 'wrong' })).toContain('device_fingerprint_changed');
    });

    it('returns multiple reasons at once', () => {
      const r = reasons({
        signatureValid: false,
        countryCode: 'CN',
        originalFingerprint: 'bad',
      });
      expect(r).toHaveLength(3);
      expect(r).toContain('invalid_signature');
      expect(r).toContain('geo_changed');
      expect(r).toContain('device_fingerprint_changed');
    });
  });

  describe('computeBreakdown()', () => {
    it('returns all 7 component scores', () => {
      const b = breakdown();
      expect(b.signatureScore).toBe(40);
      expect(b.ipScore).toBe(15);
      expect(b.geoScore).toBe(15);
      expect(b.fingerprintScore).toBe(10);
      expect(b.velocityScore).toBe(10);
      expect(b.timeScore).toBe(5);
      expect(b.nonceScore).toBe(5);
      expect(b.total).toBe(100);
      expect(b.reasons).toEqual([]);
    });

    it('shows partial ipScore (10) for same-subnet', () => {
      expect(breakdown({ ipAddress: '192.168.1.200' }).ipScore).toBe(10);
    });

    it('shows ipScore 0 for different subnet', () => {
      expect(breakdown({ ipAddress: '10.0.0.1' }).ipScore).toBe(0);
    });
  });

  describe('hashFingerprint()', () => {
    it('returns deterministic hash', () => {
      expect(hashFingerprint('TestAgent/1.0')).toBe(hashFingerprint('TestAgent/1.0'));
    });

    it('returns different hash for different input', () => {
      expect(hashFingerprint('A')).not.toBe(hashFingerprint('B'));
    });
  });

  describe('AitM anomaly integration', () => {
    it('leaves score unchanged when no anomalies are passed', () => {
      const b = engine.computeBreakdown(makeSignals(), []);
      expect(b.aitmDelta).toBe(0);
      expect(b.total).toBe(100);
    });

    it('subtracts the AitM delta from the total', () => {
      const b = engine.computeBreakdown(makeSignals(), [
        { kind: 'ua_drift', confidence: 'high' },
      ]);
      expect(b.aitmDelta).toBe(-25);
      expect(b.total).toBe(75);
    });

    it('records an aitm_<kind> reason for each anomaly', () => {
      const r = engine.getDropReasons(makeSignals(), [
        { kind: 'origin_mismatch', confidence: 'high' },
        { kind: 'tz_drift', confidence: 'medium' },
      ]);
      expect(r).toContain('aitm_origin_mismatch');
      expect(r).toContain('aitm_tz_drift');
    });

    it('Sprint 39 line 89: Evilginx Origin/SNI mismatch alone drops below the 80 allow threshold (rejects 100%)', () => {
      // Phishing-kit lands the captured session on attacker infra: every
      // signal stays clean (signature valid, IP/country/UA match — the
      // proxy mirrors them) EXCEPT origin/sni/host. evaluateAitm fires
      // origin_mismatch high; aitmScoreDelta=-25; clean total=100 → 75.
      // Pin the upper bound (<80) rather than the exact 75 so retuning
      // a single signal's weight doesn't silently let Evilginx slip into
      // the allow band.
      const total = engine.compute(makeSignals(), [
        { kind: 'origin_mismatch', confidence: 'high' },
      ]);
      expect(total).toBeLessThan(80);
    });

    it('Sprint 39 line 89: Evilginx + channel_unbound stays at or below step_up boundary (no allow, no narrow miss)', () => {
      // Reverse-proxy attack with no TLS-exporter binding — the typical
      // Evilginx shape pre-RFC-9266. Two high-confidence anomalies fire:
      // origin_mismatch + channel_unbound (-50 total). Clean baseline
      // 100 → 50. Pin <=50 (step_up band) so the worst-case AitM signal
      // combo is locked above block (40) but well below allow (80).
      const total = engine.compute(makeSignals(), [
        { kind: 'origin_mismatch', confidence: 'high' },
        { kind: 'channel_unbound', confidence: 'high' },
      ]);
      expect(total).toBeLessThanOrEqual(50);
      expect(total).toBeLessThan(80);
    });

    it('Sprint 39 line 90: latency_floor + ua_drift (50ms reverse-proxy combo) drops below 80 allow threshold', () => {
      // Real reverse-proxies cause BOTH latency_floor (RTT jump) and ua_drift
      // (proxy HTTP client ≠ baseline browser). Combined -37 delta → step_up.
      const total = engine.compute(makeSignals(), [
        { kind: 'latency_floor', confidence: 'medium' },
        { kind: 'ua_drift', confidence: 'high' },
      ]);
      expect(total).toBeLessThan(80);
    });

    it('floors total at 0 even with maximal AitM delta on a damaged baseline', () => {
      const s = engine.compute(makeSignals({ signatureValid: false }), [
        { kind: 'ua_drift', confidence: 'high' },
        { kind: 'origin_mismatch', confidence: 'high' },
        { kind: 'channel_unbound', confidence: 'high' },
      ]);
      expect(s).toBeGreaterThanOrEqual(0);
    });
  });
});
