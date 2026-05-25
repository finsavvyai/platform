import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { deviceSessions } from '@opensyber/db';
import { hashFingerprint } from '@opensyber/tokenforge/server/internal';
import type { Env, Variables } from '../types.js';
import { incrementUsage } from '../lib/usage.js';
import { dispatchWebhook } from '../services/webhook-dispatch.js';

const bindSchema = z.object({
  publicKey: z.string().min(1),
  userId: z.string().min(1),
  sessionId: z.string().min(1),
  fingerprint: z.string().optional(),
});

export const bindRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

/** POST /v1/bind — bind a device to a session */
bindRoutes.post('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');

  const parseResult = bindSchema.safeParse(await c.req.json());
  if (!parseResult.success) {
    return c.json(
      { error: 'validation_error', message: 'Invalid bind request' },
      400,
    );
  }

  const { publicKey, userId, sessionId, fingerprint } = parseResult.data;

  // Check for duplicate active session with same publicKey
  const existing = await db
    .select()
    .from(deviceSessions)
    .where(
      and(
        eq(deviceSessions.publicKey, publicKey),
        eq(deviceSessions.tenantId, tenantId),
        eq(deviceSessions.userId, userId),
      ),
    );

  const activeSession = existing.find((s) => s.revoked === 0);
  if (activeSession) {
    return c.json(
      { error: 'already_bound', message: 'Device is already bound to an active session' },
      409,
    );
  }

  const deviceId = crypto.randomUUID().replace(/-/g, '');
  const ipAddress = c.req.header('cf-connecting-ip') ?? '';
  const countryCode = c.req.header('cf-ipcountry') ?? '';
  const deviceFingerprint = fingerprint ?? hashFingerprint(c.req.header('user-agent') ?? '');
  const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString();
  const now = new Date().toISOString();

  await db.insert(deviceSessions).values({
    id: deviceId,
    tenantId,
    sessionId,
    userId,
    publicKey,
    deviceFingerprint,
    ipAddress,
    countryCode,
    trustScore: 100,
    boundAt: now,
    lastVerifiedAt: now,
    expiresAt,
    revoked: 0,
    revokedReason: null,
    createdAt: now,
  });

  // Increment bind usage count
  c.executionCtx.waitUntil(incrementUsage(db, tenantId, 'bind'));

  // Fire session.bound webhook (non-blocking)
  c.executionCtx.waitUntil(
    dispatchWebhook(db, tenantId, 'session.bound', {
      deviceId,
      sessionId,
      userId,
      trustScore: 100,
      boundAt: now,
      expiresAt,
      ipAddress,
      countryCode,
    }),
  );

  return c.json({
    data: {
      deviceId,
      sessionId,
      userId,
      expiresAt,
      trustScore: 100,
    },
  }, 201);
});
