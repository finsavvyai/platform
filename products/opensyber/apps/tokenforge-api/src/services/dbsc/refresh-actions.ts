/**
 * DBSC refresh action computation + webhook dispatch.
 *
 * Split out of `routes/dbsc-refresh.ts` so the route handler stays
 * under the 200L portfolio cap. Pure-ish: `computeRefreshAction`
 * does no I/O beyond the policy DB read; `fireActionWebhooks` is
 * fire-and-forget.
 */

import {
  combineActions,
  evaluatePolicies,
  type PolicyAction,
  type PolicyContext,
} from '@opensyber/tokenforge/server/internal';
import { computeRiskSignals, actionForSignals } from './risk-signals.js';
import { loadEnabledPolicies } from './policy-loader.js';
import { dispatchWebhook } from '../webhook-dispatch.js';
import type { Variables } from '../../types.js';

type DbLike = Variables['db'];
type BindingClass = PolicyContext['bindingClass'];

export interface RefreshActionInput {
  db: DbLike;
  tenantId: string;
  session: {
    id: string;
    deviceId: string;
    attestation: string | null;
    boundCookieIssuedAt: string;
  };
  geoCountry: string | null;
  asn: string | null;
  userAgent: string | null;
  now: Date;
  /**
   * Override for the bindingClass evaluated against tenant policies. Falls
   * back to attestation.bindingClass, then to `'webcrypto'`. Lets per-route
   * device-bound policies (e.g. require native_dbsc for /admin/*) actually
   * fire instead of every refresh hardcoding `webcrypto`.
   */
  bindingClass?: BindingClass;
}

export interface RefreshActionResult {
  action: PolicyAction;
  signals: ReturnType<typeof computeRiskSignals>;
}

export async function computeRefreshAction(
  input: RefreshActionInput,
): Promise<RefreshActionResult> {
  const signals = computeRiskSignals({
    registeredCountry: extractField(input.session.attestation, 'country'),
    currentCountry: input.geoCountry,
    registeredAsn: extractField(input.session.attestation, 'asn'),
    currentAsn: input.asn,
    registeredUa: extractField(input.session.attestation, 'ua'),
    currentUa: input.userAgent,
    lastRefreshAt: input.session.boundCookieIssuedAt,
    now: input.now,
  });
  const signalAction = actionForSignals(signals);
  const policies = await loadEnabledPolicies(input.db, input.tenantId);
  const policyAction = evaluatePolicies(policies, {
    geoCountry: input.geoCountry,
    asn: input.asn,
    bindingClass: resolveBindingClass(input),
    signals,
    sensitivePath: false,
    isoHour: input.now.getUTCHours(),
  });
  return { action: combineActions(signalAction, policyAction), signals };
}

function resolveBindingClass(input: RefreshActionInput): BindingClass {
  if (input.bindingClass !== undefined) return input.bindingClass;
  const fromAttestation = extractField(input.session.attestation, 'bindingClass');
  if (fromAttestation === 'native_dbsc' || fromAttestation === 'webauthn' || fromAttestation === 'webcrypto') {
    return fromAttestation;
  }
  return 'webcrypto';
}

export interface FireWebhooksCtx {
  db: DbLike;
  tenantId: string;
  sessionId: string;
  deviceId: string;
  waitUntil: (p: Promise<unknown>) => void;
}

export function fireActionWebhooks(
  ctx: FireWebhooksCtx,
  action: PolicyAction,
  signals: ReturnType<typeof computeRiskSignals>,
  revokedReason?: 'policy_revoke' | 'risk_block',
): void {
  if (signals.length > 0) {
    ctx.waitUntil(
      dispatchWebhook(ctx.db, ctx.tenantId, 'dbsc.risk_signal', {
        sessionId: ctx.sessionId,
        signals,
        action,
      }),
    );
  }
  if (action === 'block' || action === 'revoke_session') {
    const event = action === 'block' ? 'dbsc.policy_block' : 'dbsc.session_revoked';
    ctx.waitUntil(
      dispatchWebhook(ctx.db, ctx.tenantId, event, {
        sessionId: ctx.sessionId,
        deviceId: ctx.deviceId,
        signals,
        reason: revokedReason,
      }),
    );
  } else if (action === 'step_up') {
    ctx.waitUntil(
      dispatchWebhook(ctx.db, ctx.tenantId, 'dbsc.session_step_up', {
        sessionId: ctx.sessionId,
        deviceId: ctx.deviceId,
        signals,
      }),
    );
  }
}

function extractField(attestation: string | null, field: string): string | null {
  if (!attestation) return null;
  try {
    const obj = JSON.parse(attestation) as Record<string, unknown>;
    const v = obj[field];
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
}
