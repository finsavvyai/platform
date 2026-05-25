/**
 * Internal signing-keys admin — /v1/internal/signing-keys (Sprint 35).
 *
 * BYOK (bring-your-own-key) endpoints for ops to register, list, retire,
 * and revoke the public half of the signing keypairs published at
 * `/.well-known/tokenforge/jwks`. Private keys never cross this boundary
 * — they live in KMS or wrangler secrets and the operator pre-generates
 * them, posting only the public JWK here.
 *
 *   POST /v1/internal/signing-keys     register a new active key
 *   GET  /v1/internal/signing-keys     list all (any status)
 *   PATCH /v1/internal/signing-keys/:kid  change status to retiring/revoked
 *
 * All routes are guarded by `X-Internal-Secret` matching env
 * INTERNAL_API_SECRET — same pattern as `internal-provision.ts`.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { tfSigningKeys } from '@opensyber/db';
import type { Env, Variables } from '../types.js';

export const internalSigningKeysRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

const registerSchema = z.object({
  kid: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  alg: z.literal('ES256'),
  publicJwk: z.object({
    kty: z.literal('EC'),
    crv: z.literal('P-256'),
    x: z.string().min(1),
    y: z.string().min(1),
  }),
});

const patchSchema = z.object({
  status: z.enum(['active', 'retiring', 'revoked']),
});

function requireInternal(c: { req: { header: (n: string) => string | undefined }; env: Env }): boolean {
  return c.req.header('X-Internal-Secret') === c.env.INTERNAL_API_SECRET;
}

internalSigningKeysRoutes.post('/', async (c) => {
  if (!requireInternal(c)) return c.json({ error: 'forbidden' }, 403);

  const parsed = registerSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', details: parsed.error.flatten() }, 400);
  }

  const db = c.get('db');
  const id = `sk_${parsed.data.kid}`;
  const publicJwk = JSON.stringify({ ...parsed.data.publicJwk, kid: parsed.data.kid, alg: parsed.data.alg });

  try {
    await db.insert(tfSigningKeys).values({
      id, kid: parsed.data.kid, alg: parsed.data.alg, publicJwk, status: 'active',
    });
  } catch (err) {
    if (String((err as Error).message).includes('UNIQUE')) {
      return c.json({ error: 'kid_already_exists' }, 409);
    }
    throw err;
  }

  return c.json({ data: { kid: parsed.data.kid, alg: parsed.data.alg, status: 'active' } }, 201);
});

internalSigningKeysRoutes.get('/', async (c) => {
  if (!requireInternal(c)) return c.json({ error: 'forbidden' }, 403);
  const db = c.get('db');
  const rows = await db.select().from(tfSigningKeys);
  return c.json({ data: rows.map((r) => ({ kid: r.kid, alg: r.alg, status: r.status, createdAt: r.createdAt, rotatedAt: r.rotatedAt })) });
});

internalSigningKeysRoutes.patch('/:kid', async (c) => {
  if (!requireInternal(c)) return c.json({ error: 'forbidden' }, 403);

  const parsed = patchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'invalid_payload' }, 400);

  const db = c.get('db');
  const kid = c.req.param('kid');
  const [existing] = await db.select().from(tfSigningKeys).where(eq(tfSigningKeys.kid, kid)).limit(1);
  if (!existing) return c.json({ error: 'kid_not_found' }, 404);

  await db
    .update(tfSigningKeys)
    .set({ status: parsed.data.status, rotatedAt: new Date().toISOString() })
    .where(eq(tfSigningKeys.kid, kid));

  return c.json({ data: { kid, status: parsed.data.status } });
});
