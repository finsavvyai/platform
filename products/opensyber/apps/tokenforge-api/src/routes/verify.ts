import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { deviceSessions, tfUsage } from '@opensyber/db';
import { TrustScoreEngine, hashFingerprint } from '@opensyber/tokenforge/server/internal';
import type { Env, Variables } from '../types.js';
import { incrementUsage } from '../lib/usage.js';
import {
  crossedCritical,
  crossedDegraded,
  dispatchWebhook,
} from '../services/webhook-dispatch.js';

const verifySchema = z.object({
  signature: z.string().min(1),
  nonce: z.string().min(1),
  timestamp: z.number().int(),
  publicKey: z.string().min(1),
  path: z.string().min(1),
  method: z.string().min(1),
  sessionId: z.string().min(1),
});

export const verifyRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

const trustEngine = new TrustScoreEngine();

/** POST /v1/verify — verify a signed request */
verifyRoutes.post('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');

  const parseResult = verifySchema.safeParse(await c.req.json());
  if (!parseResult.success) {
    return c.json(
      { error: 'validation_error', message: 'Invalid verify request' },
      400,
    );
  }

  const { signature, nonce, timestamp, publicKey, path, method, sessionId } =
    parseResult.data;

  // Timestamp staleness check (60 second window)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 60) {
    return c.json(
      { error: 'request_expired', message: 'Timestamp outside acceptable window' },
      400,
    );
  }

  // Look up the session by publicKey and tenant
  const rows = await db
    .select()
    .from(deviceSessions)
    .where(
      and(
        eq(deviceSessions.publicKey, publicKey),
        eq(deviceSessions.tenantId, tenantId),
        eq(deviceSessions.sessionId, sessionId),
      ),
    );

  if (rows.length === 0) {
    return c.json(
      { error: 'device_not_bound', message: 'No matching device session' },
      401,
    );
  }

  const session = rows[0]!;

  if (session.revoked === 1) {
    return c.json({ error: 'session_revoked', message: 'Session has been revoked' }, 401);
  }

  if (new Date(session.expiresAt) < new Date()) {
    return c.json({ error: 'session_expired', message: 'Session has expired' }, 401);
  }

  // Compute trust score
  const ipAddress = c.req.header('cf-connecting-ip') ?? '';
  const countryCode = c.req.header('cf-ipcountry') ?? '';
  const userAgent = c.req.header('user-agent') ?? '';

  const signals = {
    signatureValid: true, // signature verified at edge
    ipAddress,
    originalIp: session.ipAddress ?? '',
    countryCode,
    originalCountry: session.countryCode ?? '',
    userAgent,
    originalFingerprint: session.deviceFingerprint ?? '',
    requestTimestamp: timestamp,
    sessionCreatedAt: new Date(session.boundAt).getTime() / 1000,
  };

  const trustScore = trustEngine.compute(signals);
  const previousScore = session.trustScore;

  // Update session trust score
  await db
    .update(deviceSessions)
    .set({
      trustScore,
      lastVerifiedAt: new Date().toISOString(),
    })
    .where(eq(deviceSessions.id, session.id));

  // Increment usage count
  c.executionCtx.waitUntil(incrementUsage(db, tenantId, 'verification'));

  // Fire webhook events (non-blocking). session.verified on every verify;
  // trust_score.* only on band transitions; session.hijack_attempt when every
  // device-identity signal diverged from the bound session.
  const basePayload = {
    sessionId: session.sessionId,
    userId: session.userId,
    deviceId: session.id,
    trustScore,
    previousTrustScore: previousScore,
  };

  c.executionCtx.waitUntil(
    dispatchWebhook(db, tenantId, 'session.verified', basePayload),
  );

  if (crossedCritical(previousScore, trustScore)) {
    c.executionCtx.waitUntil(
      dispatchWebhook(db, tenantId, 'trust_score.critical', basePayload),
    );
  } else if (crossedDegraded(previousScore, trustScore)) {
    c.executionCtx.waitUntil(
      dispatchWebhook(db, tenantId, 'trust_score.degraded', basePayload),
    );
  }

  const ipChanged = (session.ipAddress ?? '') !== ipAddress;
  const countryChanged = (session.countryCode ?? '') !== countryCode;
  const currentFingerprint = hashFingerprint(userAgent);
  const fingerprintChanged =
    (session.deviceFingerprint ?? '') !== currentFingerprint;
  if (ipChanged && countryChanged && fingerprintChanged) {
    c.executionCtx.waitUntil(
      dispatchWebhook(db, tenantId, 'session.hijack_attempt', {
        ...basePayload,
        fromIp: session.ipAddress,
        toIp: ipAddress,
        fromCountry: session.countryCode,
        toCountry: countryCode,
      }),
    );
  }

  return c.json({
    data: {
      valid: true,
      trustScore,
      sessionId: session.sessionId,
      userId: session.userId,
      deviceId: session.id,
    },
  });
});
