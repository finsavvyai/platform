/**
 * Tests: TokenForge Trust Score Engine
 *
 * Validates the core trust scoring algorithm that powers all adapters:
 * - Signature validity (40 points)
 * - IP consistency (15 points)
 * - Geo consistency (15 points)
 * - Device fingerprint (10 points)
 * - Velocity/timing (10 points)
 * - Time of day (5 points)
 * - Nonce freshness (5 points)
 */
import { describe, it, expect } from 'vitest';
import { TrustScoreEngine, hashFingerprint } from '../../packages/tokenforge/src/server/trust-score.js';
import type { TrustSignals } from '../../packages/tokenforge/src/shared/types.js';

const engine = new TrustScoreEngine();

function makeSignals(overrides: Partial<TrustSignals> = {}): TrustSignals {
  const now = Math.floor(Date.now() / 1000);
  return {
    signatureValid: true,
    ipAddress: '192.168.1.100',
    originalIp: '192.168.1.100',
    countryCode: 'US',
    originalCountry: 'US',
    userAgent: 'Mozilla/5.0 TestBrowser',
    originalFingerprint: hashFingerprint('Mozilla/5.0 TestBrowser'),
    requestTimestamp: now,
    sessionCreatedAt: now - 3600, // 1 hour ago
    ...overrides,
  };
}

describe('TrustScoreEngine', () => {
  it('should return 100 for perfect signals', () => {
    const score = engine.compute(makeSignals());
    expect(score).toBe(100);
  });

  it('should deduct 40 points for invalid signature', () => {
    const score = engine.compute(makeSignals({ signatureValid: false }));
    expect(score).toBe(60);
  });

  it('should deduct 15 points for IP change (different subnet)', () => {
    const score = engine.compute(makeSignals({ ipAddress: '10.0.0.1' }));
    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThanOrEqual(80); // only IP lost
  });

  it('should give partial IP score for same subnet', () => {
    const signals = makeSignals({ ipAddress: '192.168.1.200' });
    const breakdown = engine.computeBreakdown(signals);
    expect(breakdown.ipScore).toBe(10); // same /24 subnet
  });

  it('should deduct 15 points for country change', () => {
    const signals = makeSignals({ countryCode: 'CN' });
    const breakdown = engine.computeBreakdown(signals);
    expect(breakdown.geoScore).toBe(0);
    expect(breakdown.reasons).toContain('geo_changed');
  });

  it('should deduct 10 points for fingerprint change', () => {
    const signals = makeSignals({
      userAgent: 'DifferentBrowser/1.0',
    });
    const breakdown = engine.computeBreakdown(signals);
    expect(breakdown.fingerprintScore).toBe(0);
    expect(breakdown.reasons).toContain('device_fingerprint_changed');
  });

  it('should reduce velocity score for old sessions', () => {
    const now = Math.floor(Date.now() / 1000);
    const signals = makeSignals({
      requestTimestamp: now,
      sessionCreatedAt: now - 50000, // ~14 hours
    });
    const breakdown = engine.computeBreakdown(signals);
    expect(breakdown.velocityScore).toBe(7);
  });

  it('should further reduce velocity for very old sessions', () => {
    const now = Math.floor(Date.now() / 1000);
    const signals = makeSignals({
      requestTimestamp: now,
      sessionCreatedAt: now - 80000, // ~22 hours
    });
    const breakdown = engine.computeBreakdown(signals);
    expect(breakdown.velocityScore).toBe(5);
  });

  it('should return multiple reasons for compound trust drop', () => {
    const signals = makeSignals({
      signatureValid: false,
      ipAddress: '10.0.0.1',
      countryCode: 'RU',
      userAgent: 'Suspicious/1.0',
    });
    const breakdown = engine.computeBreakdown(signals);
    expect(breakdown.reasons).toContain('invalid_signature');
    expect(breakdown.reasons).toContain('ip_changed');
    expect(breakdown.reasons).toContain('geo_changed');
    expect(breakdown.reasons).toContain('device_fingerprint_changed');
    expect(breakdown.total).toBeLessThan(30);
  });

  it('should always include time and nonce baseline scores', () => {
    const breakdown = engine.computeBreakdown(makeSignals());
    expect(breakdown.timeScore).toBe(5);
    expect(breakdown.nonceScore).toBe(5);
  });

  it('getDropReasons should return only failing signals', () => {
    const reasons = engine.getDropReasons(makeSignals({ countryCode: 'JP' }));
    expect(reasons).toContain('geo_changed');
    expect(reasons).not.toContain('invalid_signature');
    expect(reasons).not.toContain('ip_changed');
  });
});

describe('hashFingerprint', () => {
  it('should produce consistent hashes for same input', () => {
    const hash1 = hashFingerprint('Mozilla/5.0');
    const hash2 = hashFingerprint('Mozilla/5.0');
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different inputs', () => {
    const hash1 = hashFingerprint('Mozilla/5.0');
    const hash2 = hashFingerprint('Chrome/120.0');
    expect(hash1).not.toBe(hash2);
  });

  it('should return a base-36 string', () => {
    const hash = hashFingerprint('TestAgent');
    expect(hash).toMatch(/^-?[0-9a-z]+$/);
  });
});
