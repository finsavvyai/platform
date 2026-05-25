/**
 * Skill Signature Transparency Log Routes
 *
 * Sigstore-style transparency log for cryptographically signed skill packages.
 * GET  /:slug/signatures — list all signed versions (public)
 * POST /:slug/signatures — record a new signature entry (marketplace.admin)
 */

import { Hono } from 'hono';
import { generateId } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { createSignatureSchema } from './validation/skill-signatures.js';
import {
  signatureKvKey,
  signatureKvPrefix,
  type SignatureEntry,
} from '../services/skill-signature-verify.js';

export const skillSignatureRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

/**
 * GET /:slug/signatures — list all signed versions for a skill.
 * Public endpoint, no auth required.
 */
skillSignatureRoutes.get('/:slug/signatures', async (c) => {
  const slug = c.req.param('slug');
  const prefix = signatureKvPrefix(slug);

  const listed = await c.env.CACHE.list({ prefix, limit: 100 });
  const entries: SignatureEntry[] = [];

  for (const key of listed.keys) {
    const raw = await c.env.CACHE.get(key.name);
    if (raw) {
      entries.push(JSON.parse(raw) as SignatureEntry);
    }
  }

  // Sort newest first
  entries.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return c.json({ data: entries });
});

/**
 * POST /:slug/signatures — record a new signature entry.
 * Requires marketplace.admin permission.
 */
skillSignatureRoutes.post(
  '/:slug/signatures',
  dbMiddleware,
  authMiddleware,
  requirePermission('marketplace.admin'),
  async (c) => {
    const slug = c.req.param('slug');
    const parsed = createSignatureSchema.safeParse(await c.req.json());

    if (!parsed.success) {
      return c.json(
        {
          error: 'Bad request',
          message: parsed.error.issues[0]?.message ?? 'Invalid input',
        },
        400,
      );
    }

    const body = parsed.data;
    const kvKey = signatureKvKey(slug, body.version);

    // Prevent overwriting an existing signature (immutable log)
    const existing = await c.env.CACHE.get(kvKey);
    if (existing) {
      return c.json(
        {
          error: 'Conflict',
          message: `Signature for ${slug}@${body.version} already exists`,
        },
        409,
      );
    }

    const entry: SignatureEntry = {
      id: generateId(),
      skillSlug: slug,
      version: body.version,
      sha256: body.sha256,
      signatureB64: body.signatureB64,
      sbomUrl: body.sbomUrl ?? null,
      reviewedAt: body.reviewedAt,
      reviewerId: body.reviewerId,
      publishedAt: new Date().toISOString(),
    };

    await c.env.CACHE.put(kvKey, JSON.stringify(entry));

    return c.json({ data: entry }, 201);
  },
);
