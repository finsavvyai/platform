/**
 * Risk-signal aggregator.
 *
 * Applies the 7 detectors to a session-refresh event and returns the
 * collected signals plus a recommended action ('allow' | 'step_up' |
 * 'block'). Policy is intentionally simple in Phase 7 so it composes
 * cleanly with the workforce policy DSL in Phase 9.
 */

import {
  asnChange,
  concurrentIpAnomaly,
  geoIpDelta,
  latencyDrift,
  replayWindowAnomaly,
  tlsExporterMismatch,
  userAgentDrift,
  type RiskSignalName,
} from './signals.js';

export interface RiskInput {
  now: Date;
  current: {
    ip: string;
    geo: string | null;
    asn: string | null;
    userAgent: string | null;
    tlsExporter: string | null;
    rttMs: number | null;
  };
  baseline: {
    ipFirst: string | null;
    geoFirst: string | null;
    asnFirst: string | null;
    userAgentFirst: string | null;
    tlsExporterBound: string | null;
    lastRefreshAt: Date | null;
    baselineRttMs: number | null;
    recentIps: string[];
  };
}

export interface RiskOutput {
  signals: RiskSignalName[];
  action: 'allow' | 'step_up' | 'block';
}

const STEP_UP_TRIGGERS: RiskSignalName[] = [
  'tls_exporter_mismatch',
  'replay_window_anomaly',
  'concurrent_ip_anomaly',
];
const BLOCK_THRESHOLD = 4;

export function computeSignals(input: RiskInput): RiskOutput {
  const found = new Set<RiskSignalName>();
  const add = (s: RiskSignalName | null) => { if (s) found.add(s); };

  add(geoIpDelta(input.current.geo, input.baseline.geoFirst));
  add(asnChange(input.current.asn, input.baseline.asnFirst));
  add(userAgentDrift(input.current.userAgent, input.baseline.userAgentFirst));
  add(tlsExporterMismatch(input.baseline.tlsExporterBound, input.current.tlsExporter));
  add(replayWindowAnomaly(
    input.now.getTime(),
    input.baseline.lastRefreshAt?.getTime() ?? null,
  ));
  add(concurrentIpAnomaly(input.current.ip, input.baseline.recentIps));
  add(latencyDrift(input.current.rttMs, input.baseline.baselineRttMs));

  const signals = [...found];
  let action: RiskOutput['action'] = 'allow';
  if (signals.length >= BLOCK_THRESHOLD) action = 'block';
  else if (signals.some((s) => STEP_UP_TRIGGERS.includes(s))) action = 'step_up';
  return { signals, action };
}

export type { RiskSignalName } from './signals.js';
