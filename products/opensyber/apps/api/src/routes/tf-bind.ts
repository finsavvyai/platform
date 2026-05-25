// @ts-nocheck
/**
 * TokenForge bind endpoints.
 *
 *   POST /api/tf/bind            ECDSA P-256 (browser-bound key)
 *   POST /api/tf/bind/webauthn   FIDO2 / WebAuthn (hardware-bound key)
 *
 * Both endpoints persist a DeviceSession row keyed by (sessionId, deviceId)
 * via the same D1Storage used by verifyRequest at request time. The server
 * stores only the public key (JsonWebKey) — never an attestation cert or
 * private material.
 *
 * Auth: caller must be authenticated (Auth.js JWT). userId/sessionId come
 * from c.get('userId') / c.get('sessionId'). These routes are skipped by
 * the TokenForge middleware (see apps/api/src/index.ts skipPaths) because
 * this is where the device gets bound for the first time.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { D1Storage } from '@opensyber/tokenforge/storage/internal';
import { verifyWebAuthnAttestation } from '@opensyber/tokenforge/server/internal';
import { generateId } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';

export const tfBindRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
tfBindRoutes.use('*', authMiddleware);

const SESSION_TTL_SECONDS = 86400; // 24h, matches verifyRequest sessionMaxAge

const ecdsaBindSchema = z.object({
  publicKey: z.record(z.unknown()), // JsonWebKey
  sessionId: z.string().min(1),
  metadata: z
    .object({
      userAgent: z.string().optional(),
      language: z.string().optional(),
      platform: z.string().optional(),
      screenResolution: z.string().optional(),
      timezone: z.string().optional(),
      colorDepth: z.number().optional(),
    })
    .partial()
    .default({}),
});

const webauthnBindSchema = z.object({
  attestationObject: z.string().min(1),
  clientDataJSON: z.string().min(1),
  credentialId: z.string().min(1),
  sessionId: z.string().min(1),
  expectedChallenge: z.string().min(1),
});

function nowIso(offsetSeconds = 0): string {
  return new Date(Date.now() + offsetSeconds * 1000).toISOString();
}

function fingerprintFromUA(userAgent: string | undefined): string | null {
  if (!userAgent) return null;
  let hash = 0;
  for (let i = 0; i < userAgent.length; i++) {
    hash = ((hash << 5) - hash + userAgent.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

tfBindRoutes.post('/bind', async (c) => {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'unauthorized' }, 401);

  const body = await c.req.json().catch(() => null);
  const parsed = ecdsaBindSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }

  const deviceId = generateId();
  const storage = new D1Storage(c.env.DB, c.env.TF_NONCES);
  await storage.createSession({
    id: deviceId,
    session_id: parsed.data.sessionId,
    user_id: userId,
    public_key: JSON.stringify(parsed.data.publicKey),
    device_fingerprint: fingerprintFromUA(parsed.data.metadata.userAgent),
    ip_address: c.req.header('cf-connecting-ip') ?? null,
    country_code: c.req.header('cf-ipcountry') ?? null,
    trust_score: 100,
    bound_at: nowIso(),
    last_verified_at: nowIso(),
    expires_at: nowIso(SESSION_TTL_SECONDS),
    revoked: 0,
    revoked_reason: null,
    created_at: nowIso(),
  });

  return c.json({ deviceId }, 201);
});

tfBindRoutes.post('/bind/webauthn', async (c) => {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'unauthorized' }, 401);

  const body = await c.req.json().catch(() => null);
  const parsed = webauthnBindSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }

  const expectedOrigin = c.env.TOKENFORGE_RP_ORIGIN ?? 'https://opensyber.cloud';
  let attestation;
  try {
    attestation = await verifyWebAuthnAttestation(
      parsed.data.attestationObject,
      parsed.data.clientDataJSON,
      parsed.data.expectedChallenge,
      expectedOrigin,
    );
  } catch (err) {
    return c.json(
      {
        error: 'attestation_invalid',
        message: err instanceof Error ? err.message : 'attestation verification failed',
      },
      400,
    );
  }

  const deviceId = generateId();
  const storage = new D1Storage(c.env.DB, c.env.TF_NONCES);
  await storage.createSession({
    id: deviceId,
    session_id: parsed.data.sessionId,
    user_id: userId,
    public_key: JSON.stringify(attestation.publicKeyJwk),
    device_fingerprint: fingerprintFromUA(c.req.header('user-agent') ?? undefined),
    ip_address: c.req.header('cf-connecting-ip') ?? null,
    country_code: c.req.header('cf-ipcountry') ?? null,
    trust_score: 100,
    bound_at: nowIso(),
    last_verified_at: nowIso(),
    expires_at: nowIso(SESSION_TTL_SECONDS),
    revoked: 0,
    revoked_reason: null,
    created_at: nowIso(),
  });

  return c.json({ deviceId, credentialId: parsed.data.credentialId }, 201);
});
