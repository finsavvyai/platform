/**
 * Policy DSL evaluator (Sprint 38).
 *
 * Each policy is a JSON object: { if_any?: Rule[]; if_all?: Rule[]; then: Action }.
 * Rules are predicate atoms over a flat `PolicyContext` describing the
 * current refresh attempt. The evaluator is pure and synchronous — no
 * IO, no time, no surprises — so it stays unit-testable and safe to
 * call inside the request critical path.
 *
 * Action precedence: block > revoke_session > step_up > allow.
 * Multiple policies for the same tenant are folded with `combineActions`
 * so the most restrictive verdict wins.
 */

export type PolicyAction = 'allow' | 'step_up' | 'block' | 'revoke_session';

export interface PolicyContext {
  geoCountry: string | null;
  asn: string | null;
  bindingClass: 'native_dbsc' | 'webauthn' | 'webcrypto' | null;
  signals: string[];
  sensitivePath: boolean;
  isoHour: number;
}

export type Rule =
  | { geo_country_in: string[] }
  | { geo_country_not_in: string[] }
  | { asn_in: string[] }
  | { binding_class: PolicyContext['bindingClass'] }
  | { has_signal: string }
  | { sensitive_path: boolean }
  | { hour_between: [number, number] };

export interface Policy {
  if_any?: Rule[];
  if_all?: Rule[];
  then: PolicyAction;
}

const PRECEDENCE: Record<PolicyAction, number> = {
  allow: 0,
  step_up: 1,
  revoke_session: 2,
  block: 3,
};

export function evaluatePolicy(policy: Policy, ctx: PolicyContext): PolicyAction {
  const anyRules = policy.if_any ?? [];
  const allRules = policy.if_all ?? [];
  const anyMatch = anyRules.length > 0 && anyRules.some((r) => evalRule(r, ctx));
  const allMatch = allRules.length > 0 && allRules.every((r) => evalRule(r, ctx));
  const conditionTriggered =
    (anyRules.length > 0 && anyMatch) ||
    (allRules.length > 0 && allMatch) ||
    (anyRules.length === 0 && allRules.length === 0);
  return conditionTriggered ? policy.then : 'allow';
}

export function evaluatePolicies(policies: Policy[], ctx: PolicyContext): PolicyAction {
  return policies
    .map((p) => evaluatePolicy(p, ctx))
    .reduce<PolicyAction>(combineActions, 'allow');
}

export function combineActions(a: PolicyAction, b: PolicyAction): PolicyAction {
  return PRECEDENCE[a] >= PRECEDENCE[b] ? a : b;
}

export function parsePolicyRules(raw: string): Policy | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as Partial<Policy>;
    if (p.then !== 'allow' && p.then !== 'step_up' && p.then !== 'block' && p.then !== 'revoke_session') {
      return null;
    }
    if (p.if_any !== undefined && !Array.isArray(p.if_any)) return null;
    if (p.if_all !== undefined && !Array.isArray(p.if_all)) return null;
    return p as Policy;
  } catch {
    return null;
  }
}

function evalRule(rule: Rule, ctx: PolicyContext): boolean {
  if ('geo_country_in' in rule) {
    return ctx.geoCountry !== null && rule.geo_country_in.includes(ctx.geoCountry);
  }
  if ('geo_country_not_in' in rule) {
    return ctx.geoCountry !== null && !rule.geo_country_not_in.includes(ctx.geoCountry);
  }
  if ('asn_in' in rule) {
    return ctx.asn !== null && rule.asn_in.includes(ctx.asn);
  }
  if ('binding_class' in rule) {
    return ctx.bindingClass === rule.binding_class;
  }
  if ('has_signal' in rule) {
    return ctx.signals.includes(rule.has_signal);
  }
  if ('sensitive_path' in rule) {
    return ctx.sensitivePath === rule.sensitive_path;
  }
  if ('hour_between' in rule) {
    const [start, end] = rule.hour_between;
    if (start <= end) return ctx.isoHour >= start && ctx.isoHour < end;
    return ctx.isoHour >= start || ctx.isoHour < end;
  }
  return false;
}
