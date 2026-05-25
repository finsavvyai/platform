/**
 * Pure risk-signal detectors per CISCO-dua.md §3.4.
 *
 * Each detector takes a small struct + the session's stored "firsts"
 * baseline and returns either a signal name (if anomalous) or null.
 * Composability is the point — the policy engine decides which subset
 * to score, and which to gate step-up on.
 */

const DEFAULT_REPLAY_WINDOW_SECONDS = 5;
const DEFAULT_LATENCY_MULTIPLIER = 3;

export type RiskSignalName =
  | 'geo_drift'
  | 'asn_change'
  | 'ua_drift'
  | 'tls_exporter_mismatch'
  | 'replay_window_anomaly'
  | 'concurrent_ip_anomaly'
  | 'latency_drift';

export function geoIpDelta(currentGeo: string | null, firstGeo: string | null): RiskSignalName | null {
  if (!currentGeo || !firstGeo) return null;
  return currentGeo !== firstGeo ? 'geo_drift' : null;
}

export function asnChange(currentAsn: string | null, firstAsn: string | null): RiskSignalName | null {
  if (!currentAsn || !firstAsn) return null;
  return currentAsn !== firstAsn ? 'asn_change' : null;
}

export function userAgentDrift(current: string | null, first: string | null): RiskSignalName | null {
  if (!current || !first) return null;
  // Loose match: same major-product token = no drift.
  const cur = stripVersionTokens(current);
  const fst = stripVersionTokens(first);
  return cur === fst ? null : 'ua_drift';
}

export function tlsExporterMismatch(
  boundExporter: string | null,
  requestExporter: string | null,
): RiskSignalName | null {
  if (!boundExporter) return null;
  if (!requestExporter) return null;
  return boundExporter !== requestExporter ? 'tls_exporter_mismatch' : null;
}

export function replayWindowAnomaly(
  nowMs: number,
  lastRefreshMs: number | null,
  thresholdSeconds: number = DEFAULT_REPLAY_WINDOW_SECONDS,
): RiskSignalName | null {
  if (lastRefreshMs == null) return null;
  const delta = nowMs - lastRefreshMs;
  return delta >= 0 && delta < thresholdSeconds * 1000 ? 'replay_window_anomaly' : null;
}

export function concurrentIpAnomaly(
  currentIp: string,
  recentIps: string[],
): RiskSignalName | null {
  if (!currentIp) return null;
  const unique = new Set([currentIp, ...recentIps]);
  return unique.size > 1 ? 'concurrent_ip_anomaly' : null;
}

export function latencyDrift(
  currentRttMs: number | null,
  baselineRttMs: number | null,
  multiplier: number = DEFAULT_LATENCY_MULTIPLIER,
): RiskSignalName | null {
  if (currentRttMs == null || baselineRttMs == null) return null;
  if (baselineRttMs <= 0) return null;
  return currentRttMs > baselineRttMs * multiplier ? 'latency_drift' : null;
}

function stripVersionTokens(ua: string): string {
  // Replace any token of digits/dots with `*` so version bumps don't drift.
  return ua.replace(/[\d.]+/g, '*').toLowerCase();
}
