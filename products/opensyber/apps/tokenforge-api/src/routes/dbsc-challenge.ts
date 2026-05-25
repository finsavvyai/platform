/**
 * DBSC challenge issuer — POST /v1/dbsc/challenge.
 *
 * Returns a one-shot 32-byte base64url challenge plus a TTL. The client
 * signs the challenge bytes with its candidate private key and posts the
 * compact JWS to /v1/dbsc/register or /v1/dbsc/refresh.
 *
 * Purpose: 'register' | 'refresh' | 'step_up'. For refresh + step_up the
 * caller binds the challenge to a known sessionId so it can't be moved
 * to a different session.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { issueChallenge } from '@opensyber/tokenforge/server/internal';
import type { Env, Variables } from '../types.js';
import { makeChallengeStore } from '../services/dbsc/challenge-store.js';

const issueSchema = z.object({
  purpose: z.enum(['register', 'refresh', 'step_up']),
  sessionId: z.string().min(1).optional(),
  actionHash: z.string().min(1).optional(),
  ttlSeconds: z.number().int().min(15).max(300).optional(),
});

export const dbscChallengeRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

dbscChallengeRoutes.post('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');

  const body = await c.req.json().catch(() => ({}));
  const parsed = issueSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }
  if (
    (parsed.data.purpose === 'refresh' || parsed.data.purpose === 'step_up') &&
    !parsed.data.sessionId
  ) {
    return c.json({ error: 'session_id_required' }, 400);
  }

  const { challenge, record } = await issueChallenge(makeChallengeStore(db), {
    tenantId,
    purpose: parsed.data.purpose,
    sessionId: parsed.data.sessionId,
    actionHash: parsed.data.actionHash,
    ttlSeconds: parsed.data.ttlSeconds,
  });

  c.header(
    'Sec-Session-Registration',
    `(ES256);path="/v1/dbsc/register";challenge="${challenge}"`,
  );
  return c.json({
    data: {
      challenge,
      purpose: record.purpose,
      sessionId: record.sessionId,
      expiresAt: record.expiresAt,
    },
  });
});
