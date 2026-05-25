/**
 * Adversary-in-the-middle (AitM) heuristic engine. Pure module.
 * Compares a bind-time fingerprint vs. current request, emits anomalies.
 * trust-score subtracts the delta; device-telemetry surfaces the list.
 */

export interface ClientFingerprint {
  userAgent: string;
  language: string;
  timezone: string;
  colorDepth: number;
  screenWidth: number;
  screenHeight: number;
  /** Optional — only present on protected routes that capture them. */
  origin?: string;
  sni?: string;
  host?: string;
  rttMs?: number;
  /** True when TLS exporter binding succeeded for this request. */
  channelBound?: boolean;
}

export type AitmAnomalyKind =
  | 'origin_mismatch'
  | 'latency_floor'
  | 'ua_drift'
  | 'tz_drift'
  | 'color_drift'
  | 'resolution_swap'
  | 'locale_drift'
  | 'channel_unbound';

export type AitmConfidence = 'low' | 'medium' | 'high';

export interface AitmAnomaly {
  kind: AitmAnomalyKind;
  confidence: AitmConfidence;
  details?: Record<string, unknown>;
}

export interface AitmEvalOptions {
  /**
   * Persistent latency floor delta (ms) above baseline that's considered
   * suspicious. Default 40ms — typical AitM proxy adds at least this much
   * even after EWMA smoothing.
   */
  rttFloorDeltaMs?: number;
  /**
   * When true, missing TLS-exporter binding emits `channel_unbound`.
   * Default true. Disable on routes that don't require channel binding.
   */
  requireChannelBinding?: boolean;
}

const DEFAULT_RTT_FLOOR_DELTA_MS = 40;

/**
 * Evaluate the eight AitM heuristics. Pure function.
 *
 * @param baseline - fingerprint captured at device-bind time
 * @param current - fingerprint of the current request
 * @param opts - thresholds (override per route / tenant)
 * @returns list of anomalies; empty when nothing trips
 */
export function evaluateAitm(
  baseline: ClientFingerprint,
  current: ClientFingerprint,
  opts: AitmEvalOptions = {},
): AitmAnomaly[] {
  const out: AitmAnomaly[] = [];
  const rttFloorDelta = opts.rttFloorDeltaMs ?? DEFAULT_RTT_FLOOR_DELTA_MS;
  const requireChannel = opts.requireChannelBinding ?? true;

  if (current.origin && current.sni && current.host) {
    const originHost = safeHost(current.origin);
    const sni = current.sni.toLowerCase();
    const host = current.host.toLowerCase();
    const all = [originHost, sni, host].filter(Boolean);
    const allMatch = all.every((h) => h === all[0]);
    if (!allMatch) {
      out.push({
        kind: 'origin_mismatch',
        confidence: 'high',
        details: { origin: originHost, sni, host },
      });
    }
  }

  if (baseline.userAgent !== current.userAgent) {
    out.push({
      kind: 'ua_drift',
      confidence: 'high',
      details: { from: baseline.userAgent, to: current.userAgent },
    });
  }

  if (baseline.timezone !== current.timezone) {
    out.push({
      kind: 'tz_drift',
      confidence: 'medium',
      details: { from: baseline.timezone, to: current.timezone },
    });
  }

  if (baseline.language !== current.language) {
    out.push({
      kind: 'locale_drift',
      confidence: 'medium',
      details: { from: baseline.language, to: current.language },
    });
  }

  if (baseline.colorDepth !== current.colorDepth) {
    out.push({
      kind: 'color_drift',
      confidence: 'low',
      details: { from: baseline.colorDepth, to: current.colorDepth },
    });
  }

  const baseDim = `${baseline.screenWidth}x${baseline.screenHeight}`;
  const curDim = `${current.screenWidth}x${current.screenHeight}`;
  const swapped =
    baseline.screenWidth === current.screenHeight &&
    baseline.screenHeight === current.screenWidth &&
    baseline.screenWidth !== baseline.screenHeight;
  if (swapped) {
    out.push({
      kind: 'resolution_swap',
      confidence: 'medium',
      details: { from: baseDim, to: curDim },
    });
  }

  if (
    typeof baseline.rttMs === 'number' &&
    typeof current.rttMs === 'number' &&
    current.rttMs - baseline.rttMs >= rttFloorDelta
  ) {
    out.push({
      kind: 'latency_floor',
      confidence: 'medium',
      details: {
        baselineMs: baseline.rttMs,
        currentMs: current.rttMs,
        deltaMs: current.rttMs - baseline.rttMs,
      },
    });
  }

  if (requireChannel && current.channelBound === false) {
    out.push({
      kind: 'channel_unbound',
      confidence: 'high',
    });
  }

  return out;
}

/**
 * Convert anomalies to a trust-score delta. Negative number; used by
 * TrustScoreEngine to drop score on suspicious sessions. Cap at -60 so
 * a single anomalous request can never block a clean baseline outright
 * — that's the trust score's job once it falls below `step_up_threshold`.
 */
export function aitmScoreDelta(anomalies: AitmAnomaly[]): number {
  let delta = 0;
  for (const a of anomalies) {
    if (a.confidence === 'high') delta -= 25;
    else if (a.confidence === 'medium') delta -= 12;
    else delta -= 5;
  }
  return Math.max(delta, -60);
}

function safeHost(originUrl: string): string | undefined {
  try {
    return new URL(originUrl).host.toLowerCase();
  } catch {
    return undefined;
  }
}
