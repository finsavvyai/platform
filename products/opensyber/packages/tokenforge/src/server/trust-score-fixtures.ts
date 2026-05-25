/**
 * Shared test signals for `trust-score.test.ts`.
 *
 * Pulled out so the test file fits the 200L cap. Pure factory — no
 * side effects, returns a TrustSignals shape with sensible defaults.
 */

import { hashFingerprint } from './trust-score.js';
import type { TrustSignals } from '../shared/types.js';

export function makeSignals(overrides: Partial<TrustSignals> = {}): TrustSignals {
  const ua = 'Mozilla/5.0 TestAgent';
  return {
    signatureValid: true,
    ipAddress: '192.168.1.10',
    originalIp: '192.168.1.10',
    countryCode: 'US',
    originalCountry: 'US',
    userAgent: ua,
    originalFingerprint: hashFingerprint(ua),
    requestTimestamp: 1000,
    sessionCreatedAt: 900,
    ...overrides,
  };
}
