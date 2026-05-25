/**
 * Workforce-mode policy DSL + evaluator (CISCO-dua.md §5.1).
 *
 * Stored as JSON, evaluated on each refresh:
 *   {
 *     "if_any": [
 *       { "geo_country_in": ["RU","KP","IR"] },
 *       { "asn_in": ["TOR","VPN_KNOWN"] },
 *       { "binding_class": "webcrypto", "and": { "sensitive_path": true } },
 *       { "concurrent_ips_gt": 1, "window_sec": 60 }
 *     ],
 *     "then": "step_up"
 *   }
 *
 * Actions: allow | step_up | block | revoke_session.
 *
 * The evaluator is pure: no DB access, no HTTP. Callers compose it on
 * top of the Phase 7 risk signals OR the bare request context — both
 * are supplied as `PolicyContext`.
 */

import type { BindingClass } from './types.js';

export type PolicyAction = 'allow' | 'step_up' | 'block' | 'revoke_session';

export interface PolicyContext {
  geoCountry?: string | null;
  asn?: string | null;
  bindingClass: BindingClass;
  /** Whether the request hits a route flagged "sensitive". */
  sensitivePath?: boolean;
  /** Number of distinct IPs seen for this session in the last `window_sec`. */
  concurrentIps?: number;
  /** Risk signals already detected by Phase 7's `computeSignals`. */
  signals?: string[];
}

export interface PolicyClause {
  /** Match if `geoCountry` is one of the listed ISO country codes. */
  geo_country_in?: string[];
  /** Match if `asn` is one of the listed ASN strings. */
  asn_in?: string[];
  /** Match if `bindingClass` equals this value. */
  binding_class?: BindingClass;
  /** Match if `concurrentIps > N` within `window_sec`. */
  concurrent_ips_gt?: number;
  /** Companion field for `concurrent_ips_gt`. Pure metadata for now. */
  window_sec?: number;
  /** Match if a Phase-7 signal name is present in `signals`. */
  signal?: string;
  /** Conjunction — every key in `and` must also match. */
  and?: PolicyClause;
}

export interface PolicyRule {
  if_any?: PolicyClause[];
  if_all?: PolicyClause[];
  then: PolicyAction;
}

export interface PolicyDocument {
  rules: PolicyRule[];
  /** Default action when no rule matches. */
  default?: PolicyAction;
}

export function evaluatePolicy(
  doc: PolicyDocument,
  ctx: PolicyContext,
): { action: PolicyAction; matchedRule: number | null } {
  for (let i = 0; i < doc.rules.length; i++) {
    const rule = doc.rules[i]!;
    if (rule.if_any && rule.if_any.some((c) => clauseMatches(c, ctx))) {
      return { action: rule.then, matchedRule: i };
    }
    if (rule.if_all && rule.if_all.every((c) => clauseMatches(c, ctx))) {
      return { action: rule.then, matchedRule: i };
    }
  }
  return { action: doc.default ?? 'allow', matchedRule: null };
}

function clauseMatches(c: PolicyClause, ctx: PolicyContext): boolean {
  if (c.geo_country_in) {
    if (!ctx.geoCountry) return false;
    if (!c.geo_country_in.includes(ctx.geoCountry)) return false;
  }
  if (c.asn_in) {
    if (!ctx.asn) return false;
    if (!c.asn_in.includes(ctx.asn)) return false;
  }
  if (c.binding_class) {
    if (ctx.bindingClass !== c.binding_class) return false;
  }
  if (typeof c.concurrent_ips_gt === 'number') {
    if ((ctx.concurrentIps ?? 0) <= c.concurrent_ips_gt) return false;
  }
  if (c.signal) {
    if (!ctx.signals?.includes(c.signal)) return false;
  }
  if (c.and) {
    if (!clauseMatches(c.and, ctx)) return false;
  }
  return true;
}

/**
 * Reconcile a workforce policy outcome with the Phase-7 default
 * outcome. The stricter of the two wins so a permissive policy can't
 * downgrade a security signal.
 */
export function reconcilePolicy(
  policy: PolicyAction,
  defaultAction: PolicyAction,
): PolicyAction {
  const order: PolicyAction[] = ['allow', 'step_up', 'block', 'revoke_session'];
  return order.indexOf(policy) >= order.indexOf(defaultAction) ? policy : defaultAction;
}
