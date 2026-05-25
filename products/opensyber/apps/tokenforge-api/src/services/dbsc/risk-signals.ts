/**
 * AitM detection signals for DBSC refresh.
 *
 * Lightweight server-side checks that run against every refresh:
 *   geo_drift     — country code differs from registration
 *   asn_change    — ASN organisation differs from registration
 *   ua_drift      — User-Agent token-set Jaccard distance > 0.4
 *   replay_burst  — last refresh < 2s ago (Evilginx replay pattern)
 *
 * Signals are advisory; the policy engine maps them to actions.
 */

export type RiskSignal = 'geo_drift' | 'asn_change' | 'ua_drift' | 'replay_burst';

export interface RiskInputs {
  registeredCountry: string | null;
  currentCountry: string | null;
  registeredAsn: string | null;
  currentAsn: string | null;
  registeredUa: string | null;
  currentUa: string | null;
  lastRefreshAt: string | null;
  now: Date;
}

export function computeRiskSignals(inp: RiskInputs): RiskSignal[] {
  const signals: RiskSignal[] = [];
  if (
    inp.registeredCountry &&
    inp.currentCountry &&
    inp.registeredCountry !== inp.currentCountry
  ) {
    signals.push('geo_drift');
  }
  if (
    inp.registeredAsn &&
    inp.currentAsn &&
    inp.registeredAsn !== inp.currentAsn
  ) {
    signals.push('asn_change');
  }
  if (inp.registeredUa && inp.currentUa) {
    if (uaJaccard(inp.registeredUa, inp.currentUa) < 0.6) {
      signals.push('ua_drift');
    }
  }
  if (inp.lastRefreshAt) {
    const last = new Date(inp.lastRefreshAt).getTime();
    if (inp.now.getTime() - last < 2_000) {
      signals.push('replay_burst');
    }
  }
  return signals;
}

export function actionForSignals(signals: RiskSignal[]): 'allow' | 'step_up' | 'block' {
  if (signals.includes('replay_burst')) return 'block';
  if (signals.length >= 2) return 'block';
  if (signals.length === 1) return 'step_up';
  return 'allow';
}

function uaJaccard(a: string, b: string): number {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  if (aTokens.size === 0 && bTokens.size === 0) return 1;
  let inter = 0;
  for (const t of aTokens) if (bTokens.has(t)) inter++;
  const union = aTokens.size + bTokens.size - inter;
  return union === 0 ? 1 : inter / union;
}

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[\s/();,]+/).filter((t) => t.length > 1);
}
