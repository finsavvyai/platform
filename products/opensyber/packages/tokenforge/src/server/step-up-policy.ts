/**
 * Per-action step-up policy (Sprint 39).
 *
 * Tenant-scoped JSON config describing which routes require fresh PoP
 * (a recent action-signing JWS) vs WebAuthn re-prompt vs nothing
 * special. Will eventually live on `tf_tenants.stepUpActions` (per
 * CISCO-dua spec) — schema migration pending. The pure logic here
 * is independent of where the actions blob is stored.
 *
 * Shape (validated by `parseStepUpActions`):
 *   [
 *     { path: '/checkout',  requireFreshSig: true,  freshSigMaxAgeSec: 60 },
 *     { path: '/admin/*',   requireFreshSig: true,  freshSigMaxAgeSec: 30, requireWebAuthn: true },
 *     { path: '/health',    requireFreshSig: false, requireWebAuthn: false }
 *   ]
 *
 * Matching rules:
 *   - exact path match wins over glob-prefix
 *   - longest glob-prefix wins among prefix-matches
 *   - no match → default verdict (no step-up, no WebAuthn, default 60s)
 */

export interface StepUpAction {
  path: string;
  requireFreshSig?: boolean;
  freshSigMaxAgeSec?: number;
  requireWebAuthn?: boolean;
}

export interface StepUpVerdict {
  matched: boolean;
  requireFreshSig: boolean;
  freshSigMaxAgeSec: number;
  requireWebAuthn: boolean;
}

const DEFAULT_FRESH_SIG_MAX_AGE_SEC = 60;
const MAX_ACTIONS = 50;
const MIN_FRESH_SIG_SEC = 5;
const MAX_FRESH_SIG_SEC = 600;

const DEFAULT_VERDICT: StepUpVerdict = {
  matched: false,
  requireFreshSig: false,
  freshSigMaxAgeSec: DEFAULT_FRESH_SIG_MAX_AGE_SEC,
  requireWebAuthn: false,
};

export function parseStepUpActions(raw: string): StepUpAction[] | null {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!Array.isArray(parsed)) return null;
  if (parsed.length > MAX_ACTIONS) return null;

  const actions: StepUpAction[] = [];
  for (const candidate of parsed) {
    if (!candidate || typeof candidate !== 'object') return null;
    const c = candidate as Record<string, unknown>;
    if (typeof c.path !== 'string' || c.path.length === 0 || c.path.length > 256) return null;
    const action: StepUpAction = { path: c.path };
    if (c.requireFreshSig !== undefined) {
      if (typeof c.requireFreshSig !== 'boolean') return null;
      action.requireFreshSig = c.requireFreshSig;
    }
    if (c.freshSigMaxAgeSec !== undefined) {
      if (typeof c.freshSigMaxAgeSec !== 'number' || !Number.isInteger(c.freshSigMaxAgeSec)) return null;
      if (c.freshSigMaxAgeSec < MIN_FRESH_SIG_SEC || c.freshSigMaxAgeSec > MAX_FRESH_SIG_SEC) return null;
      action.freshSigMaxAgeSec = c.freshSigMaxAgeSec;
    }
    if (c.requireWebAuthn !== undefined) {
      if (typeof c.requireWebAuthn !== 'boolean') return null;
      action.requireWebAuthn = c.requireWebAuthn;
    }
    actions.push(action);
  }
  return actions;
}

export function evaluateStepUpPolicy(
  actions: readonly StepUpAction[],
  requestPath: string,
): StepUpVerdict {
  // Exact match wins outright.
  for (const a of actions) {
    if (!a.path.endsWith('*') && a.path === requestPath) return verdictFrom(a, true);
  }
  // Otherwise, longest matching glob-prefix wins.
  let best: StepUpAction | null = null;
  let bestLen = -1;
  for (const a of actions) {
    if (!a.path.endsWith('*')) continue;
    const prefix = a.path.slice(0, -1);
    if (requestPath.startsWith(prefix) && prefix.length > bestLen) {
      best = a;
      bestLen = prefix.length;
    }
  }
  return best ? verdictFrom(best, true) : DEFAULT_VERDICT;
}

function verdictFrom(a: StepUpAction, matched: boolean): StepUpVerdict {
  return {
    matched,
    requireFreshSig: a.requireFreshSig ?? false,
    freshSigMaxAgeSec: a.freshSigMaxAgeSec ?? DEFAULT_FRESH_SIG_MAX_AGE_SEC,
    requireWebAuthn: a.requireWebAuthn ?? false,
  };
}
