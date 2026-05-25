/**
 * POST /v1/sessions/refresh
 *
 * Client → server. The browser SDK signs the issued nonce with the
 * bound private key (DPoP-style ES256 JWS), sends it in the `DPoP`
 * header, and we mint a fresh short-lived cookie + new challenge.
 *
 * Phase 7 wires risk-signal computation: the response carries the
 * detected signals and a recommended action, and any non-empty signal
 * set fans out to webhook subscribers via `WebhookSink`.
 */

import type { Context } from 'hono';
import {
  consumeChallenge,
  issueBoundCookie,
  issueChallenge,
  peekJwsClaims,
  verifyCompactJws,
  evaluatePolicy,
  reconcilePolicy,
  type ChallengeStore,
  type PolicyDocument,
} from '@tokenforge/protocol';
import type { DbAccess } from '../lib/db-access.js';
import { newAuditId } from '../lib/ids.js';
import { shortCookieDescriptor } from '../lib/cookies.js';
import { computeSignals } from '../services/risk/index.js';
import type { App } from '@tokenforge/db';

export interface WebhookSink {
  emit(event: string, payload: Record<string, unknown>, appId: string): Promise<void>;
}

export type RefreshDeps = {
  db: DbAccess;
  challengeStore: ChallengeStore;
  webhooks?: WebhookSink;
  /** Optional resolver for an app-scoped workforce policy. */
  policyResolver?: (appId: string) => Promise<PolicyDocument | null>;
};

export async function handleRefresh(
  c: Context,
  deps: RefreshDeps,
): Promise<Response> {
  const dpop = c.req.header('DPoP') ?? c.req.header('Authorization')?.replace(/^DPoP\s+/i, '') ?? '';
  if (!dpop) return c.json({ error: 'missing_dpop' }, 401);

  const peeked = peekJwsClaims(dpop);
  if (!peeked || !peeked.sub) return c.json({ error: 'jws_malformed' }, 400);

  const session = await deps.db.findSession(peeked.sub);
  if (!session || session.revokedAt) return c.json({ error: 'session_unknown' }, 401);
  const app = c.get('app') as App;
  if (session.appId !== app.id) return c.json({ error: 'session_app_mismatch' }, 403);

  const verify = await verifyCompactJws(dpop, {
    publicKey: JSON.stringify(session.publicKeyJwk),
    maxAgeSeconds: 60,
  });
  if (!verify.ok) {
    await audit(deps.db, app.id, session.id, 'refresh_failed', 'warn', { reason: verify.reason });
    return c.json({ error: verify.reason }, 401);
  }

  const consumed = await consumeChallenge(deps.challengeStore, verify.claims.nonce, {
    tenantId: app.tenantId,
    purpose: 'refresh',
    sessionId: session.id,
  });
  if (!consumed.ok) {
    await audit(deps.db, app.id, session.id, 'refresh_failed', 'warn', { reason: consumed.reason });
    return c.json({ error: consumed.reason }, 401);
  }

  const now = new Date();
  const risk = computeSignals({
    now,
    current: {
      ip: c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? '',
      geo: c.req.header('CF-IPCountry') ?? null,
      asn: c.req.header('CF-AS-Organization') ?? null,
      userAgent: c.req.header('User-Agent') ?? null,
      tlsExporter: c.req.header('X-TLS-Exporter') ?? null,
      rttMs: parseRttHeader(c.req.header('CF-Connect-RTT')),
    },
    baseline: {
      ipFirst: session.ipFirst ?? null,
      geoFirst: session.geoFirst ?? null,
      asnFirst: session.asnFirst ?? null,
      userAgentFirst: session.userAgent ?? null,
      tlsExporterBound: null,
      lastRefreshAt: session.lastRefreshAt ?? null,
      baselineRttMs: null,
      recentIps: session.ipFirst ? [session.ipFirst] : [],
    },
  });

  const short = await issueBoundCookie({ maxAgeSeconds: app.shortCookieTtlSec });
  await deps.db.updateSessionRefresh({
    sessionId: session.id,
    lastRefreshAt: now,
    boundCookieHash: short.hash,
    boundCookieIssuedAt: new Date(short.issuedAt),
    boundCookieExpiresAt: new Date(short.expiresAt),
  });

  const next = await issueChallenge(deps.challengeStore, {
    tenantId: app.tenantId,
    purpose: 'refresh',
    sessionId: session.id,
  });

  let finalAction: 'allow' | 'step_up' | 'block' = risk.action;
  if (app.mode === 'workforce' && deps.policyResolver) {
    const policy = await deps.policyResolver(app.id);
    if (policy) {
      const decision = evaluatePolicy(policy, {
        geoCountry: c.req.header('CF-IPCountry') ?? null,
        asn: c.req.header('CF-AS-Organization') ?? null,
        bindingClass: session.bindingClass as 'native_dbsc' | 'webauthn' | 'webcrypto',
        signals: risk.signals,
      });
      const collapsed: 'allow' | 'step_up' | 'block' =
        decision.action === 'revoke_session' ? 'block' : decision.action;
      const reconciled = reconcilePolicy(collapsed, risk.action);
      finalAction = reconciled === 'revoke_session' ? 'block' : reconciled;
    }
  }

  await audit(deps.db, app.id, session.id, 'refresh', 'info', {
    signals: risk.signals,
    action: finalAction,
  });

  if (risk.signals.length > 0 && deps.webhooks) {
    await deps.webhooks.emit('risk_signal', {
      session_id: session.id,
      app_id: app.id,
      signals: risk.signals,
      action: finalAction,
      at: now.toISOString(),
    }, app.id);
  }

  return c.json({
    short_cookie: shortCookieDescriptor(short.value, short.maxAgeSeconds),
    challenge: next.challenge,
    signals: risk.signals,
    action: finalAction,
  });
}

function parseRttHeader(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function audit(
  db: DbAccess,
  appId: string,
  sessionId: string,
  type: string,
  severity: 'info' | 'warn' | 'critical',
  payload: Record<string, unknown>,
): Promise<void> {
  await db.insertAudit({
    id: newAuditId(),
    appId,
    sessionId,
    type,
    severity,
    payload,
    at: new Date(),
  });
}
