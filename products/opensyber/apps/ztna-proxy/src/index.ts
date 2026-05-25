/**
 * OpenSyber ZTNA Reverse Proxy.
 *
 * Customer points the public hostname of an internal app at this worker via
 * CNAME. For each inbound request the worker:
 *   1. Looks up the app config in tf_ztna_apps by Host header
 *   2. Verifies an Auth.js JWT in `Authorization: Bearer <token>`
 *   3. Runs TokenForge verifyRequest() — device-bound signature check
 *   4. Compares trust score against the app's required threshold
 *   5. Forwards approved requests to the upstream origin with attribution
 *      headers (X-Forwarded-User / X-Forwarded-Device / X-Forwarded-Trust-Score)
 *
 * All gating decisions and trust scoring are done by the existing
 * @opensyber/tokenforge engine — no new crypto, no new threat model.
 */

import { verifyRequest } from '@opensyber/tokenforge/server/internal';
import { D1Storage } from '@opensyber/tokenforge/storage/internal';
import type { Env } from './types.js';
import { verifyBearer } from './jwt.js';
import { lookupAppByHostname } from './lookup.js';
import { buildVerifyContext } from './verify-context.js';
import { forwardToUpstream } from './forward.js';

function jsonError(code: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: code,
    headers: { 'content-type': 'application/json' },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const hostname = url.hostname;

    const app = await lookupAppByHostname(env.DB, hostname);
    if (!app) return jsonError(404, { error: 'no_app_for_hostname' });

    if (app.status !== 'active') {
      return jsonError(503, { error: 'app_paused', message: `App is ${app.status}` });
    }

    const identity = await verifyBearer(req.headers.get('authorization'), env.AUTH_SECRET);
    if (!identity) {
      return jsonError(401, {
        error: 'unauthorized',
        action: 'reauth',
        message: 'Missing or invalid bearer token',
      });
    }

    const storage = new D1Storage(env.DB, env.TF_NONCES);
    const ctx = buildVerifyContext(req, url.pathname, identity.userId, identity.sessionId);

    const result = await verifyRequest(ctx, {
      storage,
      trustThresholds: { allow: app.requiredTrustScore, stepUp: 30 },
      sessionMaxAge: 86400,
      nonceExpiry: 60,
      skipPaths: [],
      sensitiveOps: [],
      getIpAddress: () => ctx.ipAddress,
      getCountryCode: () => ctx.countryCode,
      getUserAgent: () => ctx.userAgent,
    });

    if (result.status === 'error') {
      return jsonError(result.code, result.body);
    }
    if (result.status === 'degraded') {
      return jsonError(403, {
        error: 'device_binding_required',
        action: 'bind',
        message: 'This app requires device verification',
      });
    }
    if (result.status === 'skip') {
      // verifyRequest never skips when path/method are non-empty; treat as a
      // misconfiguration rather than silently letting the request through.
      return jsonError(500, { error: 'verify_misconfigured' });
    }

    if (result.trustScore < app.requiredTrustScore) {
      return jsonError(403, {
        error: 'elevated_trust_required',
        action: 'step_up_required',
        trustScore: result.trustScore,
        required: app.requiredTrustScore,
      });
    }

    return forwardToUpstream(req, app, {
      userId: identity.userId,
      deviceId: result.deviceId,
      trustScore: result.trustScore,
    });
  },
};
