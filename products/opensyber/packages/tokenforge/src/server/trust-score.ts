import type { TrustSignals, ScoreBreakdown } from '../shared/types.js';
import { aitmScoreDelta, type AitmAnomaly } from './aitm-heuristics.js';
import { scoreTimeOfDay } from './activity-histogram.js';

/**
 * Trust Score Engine — computes a 0-100 trust score for each request.
 *
 * Signal weights:
 *   Signature Valid   40
 *   IP Consistency    15
 *   Geo Consistency   15
 *   UA Fingerprint    10
 *   Velocity/Timing   10
 *   Time of Day        5
 *   Nonce Freshness    5
 */
export class TrustScoreEngine {
  /**
   * Compute a 0-100 trust score from request signals.
   * @param signals - Trust signals (IP, geo, fingerprint, etc.).
   * @returns Numeric trust score (0 = no trust, 100 = full trust).
   */
  compute(signals: TrustSignals, aitmAnomalies?: AitmAnomaly[]): number {
    return this.computeBreakdown(signals, aitmAnomalies).total;
  }

  /**
   * Get human-readable reasons for trust score deductions.
   * @param signals - Trust signals to evaluate.
   * @returns Array of reason strings (e.g. "ip_changed", "geo_changed").
   */
  getDropReasons(signals: TrustSignals, aitmAnomalies?: AitmAnomaly[]): string[] {
    return this.computeBreakdown(signals, aitmAnomalies).reasons;
  }

  /**
   * Compute a detailed trust score breakdown with per-signal scores.
   * @param signals - Trust signals to evaluate.
   * @returns Score breakdown including individual signal scores and reasons.
   */
  computeBreakdown(
    signals: TrustSignals,
    aitmAnomalies?: AitmAnomaly[],
  ): ScoreBreakdown {
    const reasons: string[] = [];

    // Signature (40 points)
    const signatureScore = signals.signatureValid ? 40 : 0;
    if (!signals.signatureValid) reasons.push('invalid_signature');

    // IP consistency (15 points)
    let ipScore = 0;
    if (signals.ipAddress === signals.originalIp) {
      ipScore = 15;
    } else if (sameSubnet(signals.ipAddress, signals.originalIp)) {
      ipScore = 10;
    } else {
      reasons.push('ip_changed');
    }

    // Geo consistency (15 points)
    let geoScore = 0;
    if (signals.countryCode === signals.originalCountry) {
      geoScore = 15;
    } else {
      reasons.push('geo_changed');
    }

    // Device fingerprint (10 points)
    const currentFingerprint = hashFingerprint(signals.userAgent);
    let fingerprintScore = 0;
    if (currentFingerprint === signals.originalFingerprint) {
      fingerprintScore = 10;
    } else {
      reasons.push('device_fingerprint_changed');
    }

    // Velocity / session age (10 points)
    const sessionAge = signals.requestTimestamp - signals.sessionCreatedAt;
    let velocityScore = 10;
    if (sessionAge > 12 * 3600) velocityScore = 7;
    if (sessionAge > 20 * 3600) velocityScore = 5;

    // Time of day (5 points) — histogram-based anomaly detection
    const requestHour = new Date(signals.requestTimestamp * 1000).getUTCHours();
    const timeScore = signals.activityHistogram
      ? scoreTimeOfDay(signals.activityHistogram, requestHour)
      : 5;
    if (timeScore < 5) reasons.push('unusual_time');

    // Nonce freshness (5 points) — if we got here, nonce was valid
    const nonceScore = 5;

    // AitM heuristic delta — negative number, capped at -60 in the engine.
    const aitmDelta = aitmAnomalies?.length ? aitmScoreDelta(aitmAnomalies) : 0;
    if (aitmAnomalies?.length) {
      for (const a of aitmAnomalies) reasons.push(`aitm_${a.kind}`);
    }

    const total = Math.max(
      0,
      signatureScore +
        ipScore +
        geoScore +
        fingerprintScore +
        velocityScore +
        timeScore +
        nonceScore +
        aitmDelta,
    );

    return {
      signatureScore,
      ipScore,
      geoScore,
      fingerprintScore,
      velocityScore,
      timeScore,
      nonceScore,
      aitmDelta,
      total,
      reasons,
    };
  }
}

function sameSubnet(ip1: string, ip2: string): boolean {
  const parts1 = ip1.split('.');
  const parts2 = ip2.split('.');
  if (parts1.length !== 4 || parts2.length !== 4) return false;
  return (
    parts1[0] === parts2[0] &&
    parts1[1] === parts2[1] &&
    parts1[2] === parts2[2]
  );
}

/**
 * Hash a user-agent string into a compact fingerprint (base-36).
 * @param userAgent - The User-Agent header value.
 * @returns A base-36 encoded hash string.
 */
export function hashFingerprint(userAgent: string): string {
  let hash = 0;
  for (let i = 0; i < userAgent.length; i++) {
    const char = userAgent.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash.toString(36);
}
